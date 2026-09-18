/**
 * Seed de demonstração — idempotente (pode rodar várias vezes sem duplicar
 * nem quebrar). Usa CommonJS puro + Prisma Client, sem dependência nova
 * (mesmo padrão do driver adapter usado em produção).
 */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = 'senha123';

async function upsertUser(name, email, role) {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { password, name, role },
    create: { name, email, password, role },
  });
}

function isoDate(value) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function upsertMenu(date, period, description, capacity) {
  return prisma.menu.upsert({
    where: { date_period: { date, period } },
    update: { description, capacity },
    create: { date, period, description, capacity },
  });
}

// ATENÇÃO: essa mesma fórmula está duplicada em
// `src/reservations/reservations.service.ts` (não dá pra compartilhar um
// módulo TS com este script CommonJS puro sem mexer em tsconfig/allowJs).
// Se o formato mudar lá, mudar aqui também — senão o índice único deixa de
// detectar duplicidade nas linhas criadas pelo seed.
function buildActiveSlotKey(userId, date, period) {
  return `${userId}:${date.toISOString()}:${period}`;
}

async function upsertActiveReservation(user, menu) {
  const activeSlotKey = buildActiveSlotKey(user.id, menu.date, menu.period);
  return prisma.mealReservation.upsert({
    where: { activeSlotKey },
    update: {},
    create: {
      userId: user.id,
      menuId: menu.id,
      date: menu.date,
      period: menu.period,
      status: 'ACTIVE',
      activeSlotKey,
    },
  });
}

async function main() {
  const admin = await upsertUser('Admin Teste', 'admin@teste.com', 'ADMIN');
  const funcionario1 = await upsertUser('Funcionario Teste', 'funcionario@teste.com', 'EMPLOYEE');
  const funcionario2 = await upsertUser('Funcionario Dois', 'funcionario2@teste.com', 'EMPLOYEE');
  const funcionario3 = await upsertUser('Funcionario Tres', 'funcionario3@teste.com', 'EMPLOYEE');

  // Datas fora do intervalo já usado em testes manuais (16 a 23/09), pra não colidir.
  const menuLivre = await upsertMenu(
    isoDate('2026-09-28'),
    'LUNCH',
    'Frango grelhado com arroz e salada',
    50,
  );
  const menuLotado = await upsertMenu(
    isoDate('2026-09-28'),
    'DINNER',
    'Sopa de legumes com pão',
    1,
  );

  // funcionario1 já reservado no menuLivre -> pronto pra demonstrar 409 de duplicidade
  await upsertActiveReservation(funcionario1, menuLivre);

  // funcionario2 ocupa a única vaga do menuLotado -> pronto pra demonstrar 409 de capacidade
  await upsertActiveReservation(funcionario2, menuLotado);

  console.log('Seed concluído. Senha de todos os usuários de demo: %s\n', DEMO_PASSWORD);
  console.table([
    { email: admin.email, role: admin.role },
    { email: funcionario1.email, role: funcionario1.role },
    { email: funcionario2.email, role: funcionario2.role },
    { email: funcionario3.email, role: funcionario3.role },
  ]);
  console.log('Cenários prontos para demo:');
  console.log(
    `- 409 duplicidade: logar como ${funcionario1.email} e chamar POST /menus/${menuLivre.id}/reservations de novo`,
  );
  console.log(
    `- 409 capacidade: logar como ${funcionario3.email} e chamar POST /menus/${menuLotado.id}/reservations (já ocupado por ${funcionario2.email})`,
  );
  console.log(
    `- sucesso: logar como ${funcionario3.email} e chamar POST /menus/${menuLivre.id}/reservations`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
