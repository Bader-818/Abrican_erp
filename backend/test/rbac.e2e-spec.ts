import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from './../src/app.module';

const noopThrottlerStorage: ThrottlerStorage = {
  increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
};

/**
 * Runtime RBAC enforcement (INV-X-5 / INV-D1-6). Complements the static RBAC
 * triangle audit by proving the guards actually allow reads and block mutations
 * for a least-privilege role. Boots the full app against the seeded dev DB.
 */
describe('RBAC enforcement (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let viewerToken: string;
  let viewerUserId: string;
  const viewer = { email: `viewer-${Date.now()}@test.local`, password: 'E2eStr0ng!Pass' };

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

    adminToken = (
      await http.post('/api/v1/auth/login').send({ email: process.env.ADMIN_EMAIL ?? 'admin@abrican.local', password: process.env.ADMIN_PASSWORD ?? 'Admin@12345' })
    ).body.accessToken;

    const roles = (await http.get('/api/v1/roles').set('Authorization', `Bearer ${adminToken}`)).body;
    const viewerRole = roles.find((r: any) => r.name === 'Viewer/Auditor');
    const created = await http
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Viewer', email: viewer.email, password: viewer.password, roleId: viewerRole.id })
      .expect(201);
    viewerUserId = created.body.id;
    viewerToken = (await http.post('/api/v1/auth/login').send(viewer)).body.accessToken;
  });

  afterAll(async () => {
    if (viewerUserId) {
      await http.delete(`/api/v1/users/${viewerUserId}`).set('Authorization', `Bearer ${adminToken}`).catch(() => undefined);
    }
    await app.close();
  });

  it('allows a Viewer/Auditor to read (clients.view)', async () => {
    await http.get('/api/v1/clients?pageSize=5').set('Authorization', `Bearer ${viewerToken}`).expect(200);
  });

  it('blocks a Viewer/Auditor from creating a client (no clients.manage → 403)', async () => {
    await http
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Should Fail', clientType: 'PRIVATE' })
      .expect(403);
  });

  it('blocks a Viewer/Auditor from finance mutations (no payments.manage → 403)', async () => {
    await http
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ invoiceId: '00000000-0000-0000-0000-000000000000', amount: 1 })
      .expect(403);
  });

  it('blocks a Viewer/Auditor from admin user management (no users.manage → 403)', async () => {
    await http
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'x', email: 'x@y.z', password: 'E2eStr0ng!Pass', roleId: 'whatever' })
      .expect(403);
  });

  it('still rejects unauthenticated requests (401)', async () => {
    await http.get('/api/v1/clients').expect(401);
  });
});
