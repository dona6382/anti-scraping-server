import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Security Guard Chain (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // JWT_SECRET 필수
    process.env.JWT_SECRET = 'e2e-test-secret';
    process.env.IP_HASH_SALT = 'e2e-test-salt';
    process.env.DB_SYNCHRONIZE = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Root & Health', () => {
    it('GET / → 200 서버 상태', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('success');
          expect(res.body.data.name).toBe('Anti-Scraping Server');
        });
    });

    it('GET /health → 200 헬스체크', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.healthy).toBeDefined();
          expect(res.body.checks).toBeInstanceOf(Array);
        });
    });

    it('GET /health/live → 200 liveness', () => {
      return request(app.getHttpServer())
        .get('/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('alive');
        });
    });
  });

  describe('Public API', () => {
    it('GET /api/public/data → 200 공개 데이터', () => {
      return request(app.getHttpServer())
        .get('/api/public/data')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('success');
        });
    });
  });

  describe('Auth Flow', () => {
    const uid = Date.now().toString(36);
    const testUser = {
      username: `e2e_${uid}`,
      email: `e2e_${uid}@test.com`,
      password: 'SecureP@ss1',
    };
    let accessToken: string;

    it('POST /auth/register → 201 회원가입', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body.username).toBe(testUser.username);
          expect(res.body.role).toBe('user');
          expect(res.body.password).toBeUndefined();
        });
    });

    it('POST /auth/register → 409 중복 가입 방지', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('POST /auth/register → 400 약한 비밀번호', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'weak', email: 'weak@test.com', password: 'weakpass' })
        .expect(400);
    });

    it('POST /auth/login → 200 로그인 성공', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: testUser.username, password: testUser.password })
        .expect(200)
        .expect((res) => {
          expect(res.body.access_token).toBeDefined();
          expect(res.body.user.username).toBe(testUser.username);
          accessToken = res.body.access_token;
        });
    });

    it('POST /auth/login → 401 잘못된 비밀번호', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: testUser.username, password: 'WrongP@ss1' })
        .expect(401);
    });

    it('GET /admin/system/info → 401 토큰 없이 접근', () => {
      return request(app.getHttpServer())
        .get('/admin/system/info')
        .expect(401);
    });

    it('GET /admin/system/info → 403 일반 사용자 접근', () => {
      return request(app.getHttpServer())
        .get('/admin/system/info')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });

  describe('User-Agent Guard', () => {
    it('Scrapy UA → health에는 UA guard 미적용 (SkipThrottle)', () => {
      return request(app.getHttpServer())
        .get('/health/live')
        .set('User-Agent', 'Scrapy/2.11')
        .expect(200);
    });

    it('Scrapy UA → /test/security-full에서 403 차단', () => {
      return request(app.getHttpServer())
        .get('/test/security-full')
        .set('User-Agent', 'Scrapy/2.11')
        .expect(403);
    });
  });

  describe('DTO Validation', () => {
    it('POST /auth/login → 400 빈 body', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });

    it('POST /auth/login → 400 이메일 형식으로 username 전송', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: '', password: 'SecureP@ss1' })
        .expect(400);
    });

    it('POST /auth/login → 400 비밀번호 미전송', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'test' })
        .expect(400);
    });
  });
});
