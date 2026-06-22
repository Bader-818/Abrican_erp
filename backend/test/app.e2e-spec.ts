import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from './../src/app.module';

// A no-op throttler storage so rate limiting doesn't interfere with the
// lockout/reuse scenarios (which intentionally issue many logins).
const noopThrottlerStorage: ThrottlerStorage = {
  increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
};

/**
 * End-to-end smoke + integration suite. Boots the full Nest application against
 * the running Postgres instance (seeded via `prisma db seed`) and exercises the
 * real HTTP surface: auth, RBAC, reads, and the assignment conflict/override
 * workflow. Any data it creates is cleaned up in `afterAll`.
 *
 * Run with the dockerized DB exposed on localhost:
 *   DATABASE_URL=postgresql://abrican:abrican_dev_password@localhost:5434/abrican_erp \
 *     npm run test:e2e
 */
describe('Abrican ERP API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let accessToken: string;
  const createdAssignmentIds: string[] = [];

  const admin = {
    email: process.env.ADMIN_EMAIL ?? 'admin@abrican.local',
    password: process.env.ADMIN_PASSWORD ?? 'Admin@12345',
  };

  beforeAll(async () => {
    // Disable rate limiting for the test run so the lockout/reuse scenarios
    // (which issue many logins) aren't throttled.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ThrottlerStorage)
      .useValue(noopThrottlerStorage)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    for (const id of createdAssignmentIds) {
      await http
        .delete(`/api/v1/assignments/${id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .catch(() => undefined);
    }
    await app.close();
  });

  describe('health', () => {
    it('GET /api/v1/health is public and healthy', async () => {
      const res = await http.get('/api/v1/health').expect(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('auth', () => {
    it('rejects invalid credentials with 401', async () => {
      await http
        .post('/api/v1/auth/login')
        .send({ email: admin.email, password: 'wrong-password' })
        .expect(401);
    });

    it('logs in the seeded admin and returns an access token', async () => {
      const res = await http.post('/api/v1/auth/login').send(admin).expect(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(admin.email);
      accessToken = res.body.accessToken;
    });
  });

  describe('RBAC + reads', () => {
    it('rejects unauthenticated access to a protected route', async () => {
      await http.get('/api/v1/clients').expect(401);
    });

    it.each([
      ['clients'],
      ['contracts'],
      ['purchase-orders'],
      ['jobs'],
      ['employees'],
      ['assignments'],
      ['documents'],
    ])('returns a paginated list for /%s', async (resource) => {
      const res = await http
        .get(`/api/v1/${resource}?pageSize=5`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.total).toBe('number');
    });

    it('returns the operations dashboard aggregates incl. top utilization', async () => {
      const res = await http
        .get('/api/v1/dashboard/operations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.jobsByStatus).toBeDefined();
      expect(typeof res.body.activeJobs).toBe('number');
      expect(Array.isArray(res.body.topUtilization)).toBe(true);
      expect(res.body.topUtilization.length).toBeLessThanOrEqual(5);
    });

    it('returns the assets dashboard with a complete document compliance breakdown', async () => {
      const res = await http
        .get('/api/v1/dashboard/assets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const d = res.body.documentExpiry;
      expect(d.total).toBe(
        d.expired + d.expiring30 + d.expiring60 + d.expiring90 + d.noExpiry + d.valid,
      );
    });

    it('returns a utilization report with weekday-based capacity', async () => {
      const res = await http
        .get('/api/v1/assignments/utilization?from=2026-06-01&to=2026-07-01')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.capacityHours).toBeGreaterThan(0);
      expect(Array.isArray(res.body.resources)).toBe(true);
    });
  });

  describe('assignment conflict + override workflow', () => {
    let jobId: string;
    let employeeId: string;
    const start = '2030-03-01T06:00:00.000Z';
    const end = '2030-03-05T16:00:00.000Z';

    it('sets up a base assignment in a far-future window', async () => {
      const auth = `Bearer ${accessToken}`;
      jobId = (await http.get('/api/v1/jobs?pageSize=1').set('Authorization', auth)).body.data[0].id;
      employeeId = (await http.get('/api/v1/employees?pageSize=1').set('Authorization', auth)).body
        .data[0].id;

      const res = await http
        .post('/api/v1/assignments')
        .set('Authorization', auth)
        .send({ jobId, resourceType: 'EMPLOYEE', employeeId, startDatetime: start, endDatetime: end })
        .expect(201);
      createdAssignmentIds.push(res.body.id);
    });

    it('blocks an overlapping booking without an override reason (409)', async () => {
      await http
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          jobId,
          resourceType: 'EMPLOYEE',
          employeeId,
          startDatetime: '2030-03-03T06:00:00.000Z',
          endDatetime: '2030-03-04T16:00:00.000Z',
        })
        .expect(409);
    });

    it('allows an authorized override and persists the reason', async () => {
      const res = await http
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          jobId,
          resourceType: 'EMPLOYEE',
          employeeId,
          startDatetime: '2030-03-03T06:00:00.000Z',
          endDatetime: '2030-03-04T16:00:00.000Z',
          overrideReason: 'e2e override',
        })
        .expect(201);
      expect(res.body.overrideReason).toBe('e2e override');
      createdAssignmentIds.push(res.body.id);
    });

    it('validates the time window (end before start -> 400)', async () => {
      await http
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ jobId, resourceType: 'EMPLOYEE', employeeId, startDatetime: end, endDatetime: start })
        .expect(400);
    });
  });

  describe('auth hardening', () => {
    let roleId: string;

    beforeAll(async () => {
      roleId = (await http.get('/api/v1/roles').set('Authorization', `Bearer ${accessToken}`)).body[0]
        .id;
    });

    it('rejects a weak password on user creation (400)', async () => {
      await http
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Weak Pw', email: `weak-${Date.now()}@test.local`, password: 'short', roleId })
        .expect(400);
    });

    it('accepts a strong password and then cleans up', async () => {
      const email = `strong-${Date.now()}@test.local`;
      const res = await http
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Strong Pw', email, password: 'E2eStr0ng!Pass', roleId })
        .expect(201);
      await http
        .delete(`/api/v1/users/${res.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('locks an account after repeated failed logins (on a throwaway user)', async () => {
      const email = `lock-${Date.now()}@test.local`;
      const created = await http
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Lock Me', email, password: 'E2eStr0ng!Pass', roleId })
        .expect(201);

      // 5 wrong attempts trip the lock.
      for (let i = 0; i < 5; i++) {
        await http.post('/api/v1/auth/login').send({ email, password: 'wrong-pass' }).expect(401);
      }
      // Now even the correct password is rejected with a "locked" message.
      const res = await http
        .post('/api/v1/auth/login')
        .send({ email, password: 'E2eStr0ng!Pass' })
        .expect(401);
      expect(String(res.body.message).toLowerCase()).toContain('locked');

      await http
        .delete(`/api/v1/users/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('signs out all sessions and detects reuse of the revoked refresh cookie', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post('/api/v1/auth/login')
        .send({ email: admin.email, password: admin.password })
        .expect(200);
      const token = loginRes.body.accessToken;

      // logout-all revokes the refresh token family.
      const out = await agent
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(out.body.revoked).toBeGreaterThanOrEqual(1);

      // The agent still holds the (now revoked) cookie — replaying it is treated
      // as reuse and rejected.
      await agent.post('/api/v1/auth/refresh').expect(401);
    });
  });
});
