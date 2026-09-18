import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';

const DEMO_PASSWORD = 'senha123';
let userCounter = 0;

describe('Refeitório API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersService: UsersService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    usersService = app.get(UsersService);
  });

  afterAll(async () => {
    await app.close();
  });

  // Cada teste começa com o banco de teste zerado — determinístico independente
  // de ordem de execução. Ordem de delete respeita as foreign keys.
  beforeEach(async () => {
    await prisma.mealReservation.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.user.deleteMany();
  });

  async function createUser(role: Role) {
    userCounter += 1;
    return usersService.create({
      name: `Teste ${role} ${userCounter}`,
      email: `${role.toLowerCase()}.${userCounter}@teste.com`,
      password: DEMO_PASSWORD,
      role,
    });
  }

  async function loginAs(
    email: string,
    password = DEMO_PASSWORD,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return res.body.accessToken as string;
  }

  async function createMenu(
    adminToken: string,
    overrides: Partial<{
      date: string;
      period: string;
      description: string;
      capacity: number;
    }> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/menus')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2027-01-10',
        period: 'LUNCH',
        description: 'Menu de teste',
        capacity: 5,
        ...overrides,
      });
    return res.body as { id: number };
  }

  describe('POST /auth/login', () => {
    it('login válido retorna 200 + accessToken', async () => {
      const admin = await createUser(Role.ADMIN);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: DEMO_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.password).toBeUndefined();
    });

    it('login com senha errada retorna 401', async () => {
      const admin = await createUser(Role.ADMIN);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: 'senha-errada' });

      expect(res.status).toBe(401);
    });

    it('login com body inválido (email mal formatado) retorna 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nao-e-um-email', password: '123456' });

      expect(res.status).toBe(400);
    });
  });

  describe('Autenticação e autorização', () => {
    it('rota protegida sem token retorna 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/meal-reservations/my',
      );
      expect(res.status).toBe(401);
    });

    it('token JWT malformado retorna 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/meal-reservations/my')
        .set('Authorization', 'Bearer token-invalido-e-malformado');

      expect(res.status).toBe(401);
    });

    it('EMPLOYEE tentando criar menu (rota exclusiva de ADMIN) retorna 403', async () => {
      const employee = await createUser(Role.EMPLOYEE);
      const token = await loginAs(employee.email);

      const res = await request(app.getHttpServer())
        .post('/menus')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '2027-01-10',
          period: 'LUNCH',
          description: 'Teste',
          capacity: 5,
        });

      expect(res.status).toBe(403);
    });

    it('ADMIN tentando reservar (rota exclusiva de EMPLOYEE) retorna 403', async () => {
      const admin = await createUser(Role.ADMIN);
      const adminToken = await loginAs(admin.email);
      const menu = await createMenu(adminToken);

      const res = await request(app.getHttpServer())
        .post(`/menus/${menu.id}/reservations`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Validação de recursos e de body', () => {
    it('reservar menu inexistente retorna 404', async () => {
      const employee = await createUser(Role.EMPLOYEE);
      const token = await loginAs(employee.email);

      const res = await request(app.getHttpServer())
        .post('/menus/999999/reservations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('cancelar reserva inexistente retorna 404', async () => {
      const employee = await createUser(Role.EMPLOYEE);
      const token = await loginAs(employee.email);

      const res = await request(app.getHttpServer())
        .patch('/meal-reservations/999999/cancel')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('criar menu sem capacity (campo obrigatório) retorna 400', async () => {
      const admin = await createUser(Role.ADMIN);
      const token = await loginAs(admin.email);

      const res = await request(app.getHttpServer())
        .post('/menus')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '2027-01-10',
          period: 'LUNCH',
          description: 'Teste sem capacidade',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /menus — paginação e filtros (bônus)', () => {
    it('sem token retorna 401', async () => {
      const res = await request(app.getHttpServer()).get('/menus');
      expect(res.status).toBe(401);
    });

    it('retorna o envelope paginado { data, total, page, limit }', async () => {
      const admin = await createUser(Role.ADMIN);
      const adminToken = await loginAs(admin.email);
      await createMenu(adminToken, { date: '2027-04-01', period: 'LUNCH' });
      await createMenu(adminToken, { date: '2027-04-02', period: 'LUNCH' });

      const res = await request(app.getHttpServer())
        .get('/menus?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 2, page: 1, limit: 1 });
      expect(res.body.data).toHaveLength(1);
    });

    it('filtra por period', async () => {
      const admin = await createUser(Role.ADMIN);
      const adminToken = await loginAs(admin.email);
      await createMenu(adminToken, { date: '2027-04-03', period: 'LUNCH' });
      await createMenu(adminToken, { date: '2027-04-04', period: 'DINNER' });

      const res = await request(app.getHttpServer())
        .get('/menus?period=DINNER')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.total).toBe(1);
      expect(res.body.data[0].period).toBe('DINNER');
    });

    it('limit acima de 100 retorna 400 (@Max)', async () => {
      const admin = await createUser(Role.ADMIN);
      const adminToken = await loginAs(admin.email);

      const res = await request(app.getHttpServer())
        .get('/menus?limit=9999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('activeSlotKey — histórico de cancelamentos', () => {
    it('reservar de novo após cancelar cria linha NOVA e preserva o histórico', async () => {
      const admin = await createUser(Role.ADMIN);
      const employee = await createUser(Role.EMPLOYEE);
      const adminToken = await loginAs(admin.email);
      const employeeToken = await loginAs(employee.email);
      const menu = await createMenu(adminToken, {
        date: '2027-05-01',
        period: 'LUNCH',
        capacity: 5,
      });

      const r1 = await request(app.getHttpServer())
        .post(`/menus/${menu.id}/reservations`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(r1.status).toBe(201);

      await request(app.getHttpServer())
        .patch(`/meal-reservations/${r1.body.id}/cancel`)
        .set('Authorization', `Bearer ${employeeToken}`);

      const r2 = await request(app.getHttpServer())
        .post(`/menus/${menu.id}/reservations`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(r2.status).toBe(201);

      // As duas asserções que provam a decisão de design do activeSlotKey:
      expect(r2.body.id).not.toBe(r1.body.id); // linha NOVA, não UPDATE da antiga

      const my = await request(app.getHttpServer())
        .get('/meal-reservations/my')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(my.body).toHaveLength(2); // histórico completo preservado
      expect(
        my.body.filter((r: { status: string }) => r.status === 'CANCELLED'),
      ).toHaveLength(1);
      expect(
        my.body.filter((r: { status: string }) => r.status === 'ACTIVE'),
      ).toHaveLength(1);
    });

    it('cancelar a mesma reserva duas vezes retorna 409 na segunda', async () => {
      const admin = await createUser(Role.ADMIN);
      const employee = await createUser(Role.EMPLOYEE);
      const adminToken = await loginAs(admin.email);
      const employeeToken = await loginAs(employee.email);
      const menu = await createMenu(adminToken, {
        date: '2027-05-02',
        period: 'LUNCH',
        capacity: 5,
      });

      const reservation = await request(app.getHttpServer())
        .post(`/menus/${menu.id}/reservations`)
        .set('Authorization', `Bearer ${employeeToken}`);

      const first = await request(app.getHttpServer())
        .patch(`/meal-reservations/${reservation.body.id}/cancel`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(first.status).toBe(200);

      const second = await request(app.getHttpServer())
        .patch(`/meal-reservations/${reservation.body.id}/cancel`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(second.status).toBe(409);
    });
  });

  describe('Regra central de negócio — conflito 409', () => {
    it('reservar duas vezes o mesmo menu retorna 409 (duplicidade)', async () => {
      const admin = await createUser(Role.ADMIN);
      const employee = await createUser(Role.EMPLOYEE);
      const adminToken = await loginAs(admin.email);
      const employeeToken = await loginAs(employee.email);
      const menu = await createMenu(adminToken, {
        date: '2027-02-01',
        period: 'LUNCH',
        capacity: 10,
      });

      const first = await request(app.getHttpServer())
        .post(`/menus/${menu.id}/reservations`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(`/menus/${menu.id}/reservations`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(second.status).toBe(409);
    });

    it('exceder a capacidade do menu retorna 409', async () => {
      const admin = await createUser(Role.ADMIN);
      const employee1 = await createUser(Role.EMPLOYEE);
      const employee2 = await createUser(Role.EMPLOYEE);
      const adminToken = await loginAs(admin.email);
      const token1 = await loginAs(employee1.email);
      const token2 = await loginAs(employee2.email);
      const menu = await createMenu(adminToken, {
        date: '2027-02-02',
        period: 'DINNER',
        capacity: 1,
      });

      const first = await request(app.getHttpServer())
        .post(`/menus/${menu.id}/reservations`)
        .set('Authorization', `Bearer ${token1}`);
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(`/menus/${menu.id}/reservations`)
        .set('Authorization', `Bearer ${token2}`);
      expect(second.status).toBe(409);
    });

    it('capacidade sob concorrência real (requisições simultâneas) nunca é excedida', async () => {
      const admin = await createUser(Role.ADMIN);
      const employees = await Promise.all(
        [1, 2, 3, 4, 5].map(() => createUser(Role.EMPLOYEE)),
      );
      const adminToken = await loginAs(admin.email);
      const tokens = await Promise.all(employees.map((e) => loginAs(e.email)));
      const menu = await createMenu(adminToken, {
        date: '2027-02-04',
        period: 'LUNCH',
        capacity: 1,
      });

      // Dispara as 5 reservas ao mesmo tempo (não em sequência) — é o cenário
      // que o SELECT ... FOR UPDATE em ReservationsService.create() existe pra cobrir.
      const results = await Promise.all(
        tokens.map((token) =>
          request(app.getHttpServer())
            .post(`/menus/${menu.id}/reservations`)
            .set('Authorization', `Bearer ${token}`),
        ),
      );

      const successes = results.filter((r) => r.status === 201);
      const conflicts = results.filter((r) => r.status === 409);
      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(4);

      const activeCount = await prisma.mealReservation.count({
        where: { menuId: menu.id, status: 'ACTIVE' },
      });
      expect(activeCount).toBe(1);
    });
  });

  describe('Segurança — dono da reserva', () => {
    it('cancelar reserva de outro usuário retorna 403', async () => {
      const admin = await createUser(Role.ADMIN);
      const owner = await createUser(Role.EMPLOYEE);
      const intruder = await createUser(Role.EMPLOYEE);
      const adminToken = await loginAs(admin.email);
      const ownerToken = await loginAs(owner.email);
      const intruderToken = await loginAs(intruder.email);
      const menu = await createMenu(adminToken, {
        date: '2027-02-03',
        period: 'BREAKFAST',
        capacity: 5,
      });

      const reservation = await request(app.getHttpServer())
        .post(`/menus/${menu.id}/reservations`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const res = await request(app.getHttpServer())
        .patch(`/meal-reservations/${reservation.body.id}/cancel`)
        .set('Authorization', `Bearer ${intruderToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Fluxo principal completo', () => {
    it('login -> criar menu -> reservar -> cancelar -> listar', async () => {
      const admin = await createUser(Role.ADMIN);
      const employee = await createUser(Role.EMPLOYEE);
      const adminToken = await loginAs(admin.email);
      const employeeToken = await loginAs(employee.email);

      const menu = await createMenu(adminToken, {
        date: '2027-03-01',
        period: 'LUNCH',
        capacity: 5,
      });
      expect(menu.id).toBeDefined();

      const reserveRes = await request(app.getHttpServer())
        .post(`/menus/${menu.id}/reservations`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(reserveRes.status).toBe(201);

      const cancelRes = await request(app.getHttpServer())
        .patch(`/meal-reservations/${reserveRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.cancelled).toBe(true);

      const myRes = await request(app.getHttpServer())
        .get('/meal-reservations/my')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(myRes.status).toBe(200);

      const cancelled = myRes.body.find(
        (r: { id: number }) => r.id === reserveRes.body.id,
      );
      expect(cancelled.status).toBe('CANCELLED');
    });
  });
});
