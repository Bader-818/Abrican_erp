import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from './../src/app.module';

const noopThrottlerStorage: ThrottlerStorage = {
  increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
};

/**
 * Cross-module finance integration (INV-D7, INV-X-1/X-3). Exercises the real
 * value chain against the seeded dev DB:
 *   estimate (line math + VAT) → send/approve → convert→job (jobValue copy)
 *   estimate → approve → invoice from-estimate (copy) → approve → issue
 *   → partial payment → full payment (outstanding math + PAID).
 *
 * Note: issued invoices / converted jobs cannot be deleted, so this leaves a few
 * rows under a throwaway client each run — run against the disposable dev DB.
 */
describe('Finance value chain (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let token: string;
  let clientId: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  const lineItems = [{ description: 'Senior technician', quantity: 1, hours: 10, unitPrice: 1000 }];
  // 1 × 10 × 1000 = 10,000 net; +15% VAT = 1,500; total 11,500.
  const NET = 10000;
  const VAT = 1500;
  const TOTAL = 11500;

  async function makeApprovedEstimate() {
    const est = (
      await http
        .post('/api/v1/estimates')
        .set(auth())
        .send({
          clientId,
          title: 'E2E estimate',
          jobType: 'NDT',
          location: 'Site E2E',
          plannedStartDate: '2026-08-01',
          plannedEndDate: '2026-08-10',
          items: lineItems,
        })
        .expect(201)
    ).body;
    await http.post(`/api/v1/estimates/${est.id}/send`).set(auth()).expect(201);
    await http.post(`/api/v1/estimates/${est.id}/approve`).set(auth()).expect(201);
    return est;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(noopThrottlerStorage)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    http = request(app.getHttpServer());

    token = (
      await http.post('/api/v1/auth/login').send({ email: process.env.ADMIN_EMAIL ?? 'admin@abrican.local', password: process.env.ADMIN_PASSWORD ?? 'Admin@12345' })
    ).body.accessToken;

    clientId = (
      await http
        .post('/api/v1/clients')
        .set(auth())
        .send({ name: `E2E Finance Client ${Date.now()}`, clientType: 'PRIVATE', vatNumber: '300000000000003', paymentTermsDays: 30 })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('computes estimate line math + VAT (INV-D7-1/2)', async () => {
    const est = await makeApprovedEstimate();
    expect(Number(est.subtotal)).toBe(NET);
    expect(Number(est.vatAmount)).toBe(VAT);
    expect(Number(est.totalAmount)).toBe(TOTAL);
  });

  it('converts an approved estimate to a job and copies the total to jobValue (INV-D7-3)', async () => {
    const est = await makeApprovedEstimate();
    const converted = await http.post(`/api/v1/estimates/${est.id}/convert`).set(auth()).send({}).expect(201);
    const jobId = converted.body.jobId ?? converted.body.job?.id;
    expect(jobId).toBeDefined();
    const job = (await http.get(`/api/v1/jobs/${jobId}`).set(auth()).expect(200)).body;
    expect(Number(job.jobValue)).toBe(TOTAL);
  });

  it('invoices from an estimate, issues it, and collects payment (INV-D7-4..7)', async () => {
    const est = await makeApprovedEstimate();
    // from-estimate copies the quote's lines as actuals.
    const inv = (
      await http.post('/api/v1/invoices/from-estimate').set(auth()).send({ estimateId: est.id }).expect(201)
    ).body;
    expect(Number(inv.totalAmount)).toBe(TOTAL);

    await http.post(`/api/v1/invoices/${inv.id}/submit-for-approval`).set(auth()).expect(201);
    await http.post(`/api/v1/invoices/${inv.id}/approve`).set(auth()).expect(201);
    const issued = await http.post(`/api/v1/invoices/${inv.id}/issue`).set(auth()).send({}).expect(201);
    expect(issued.body.status).toBe('SUBMITTED');

    // Partial payment → PARTIALLY_PAID, half outstanding. The payment response's
    // embedded invoice snapshot must be fresh (F-006 fixed: invoice updated
    // before the payment row is selected); a GET confirms the persisted state.
    const half = TOTAL / 2;
    const p1 = await http.post('/api/v1/payments').set(auth()).send({ invoiceId: inv.id, amount: half }).expect(201);
    expect(p1.body.invoice.status).toBe('PARTIALLY_PAID');
    expect(Number(p1.body.invoice.outstandingAmount)).toBe(half);
    const afterFirst = (await http.get(`/api/v1/invoices/${inv.id}`).set(auth()).expect(200)).body;
    expect(afterFirst.status).toBe('PARTIALLY_PAID');
    expect(Number(afterFirst.outstandingAmount)).toBe(half);

    // Balance → PAID, zero outstanding.
    const p2 = await http.post('/api/v1/payments').set(auth()).send({ invoiceId: inv.id, amount: half }).expect(201);
    expect(p2.body.invoice.status).toBe('PAID');
    expect(Number(p2.body.invoice.outstandingAmount)).toBe(0);
  });

  it('rejects a payment that exceeds the outstanding balance (INV-D7-7)', async () => {
    const est = await makeApprovedEstimate();
    const inv = (await http.post('/api/v1/invoices/from-estimate').set(auth()).send({ estimateId: est.id }).expect(201)).body;
    await http.post(`/api/v1/invoices/${inv.id}/submit-for-approval`).set(auth()).expect(201);
    await http.post(`/api/v1/invoices/${inv.id}/approve`).set(auth()).expect(201);
    await http.post(`/api/v1/invoices/${inv.id}/issue`).set(auth()).send({}).expect(201);
    await http.post('/api/v1/payments').set(auth()).send({ invoiceId: inv.id, amount: TOTAL + 1 }).expect(400);
  });
});
