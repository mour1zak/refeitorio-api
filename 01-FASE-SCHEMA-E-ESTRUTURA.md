# FASE 1 — Modelagem e Estrutura

**Tempo alvo: 20 minutos. Leia `00-CONTEXTO-E-REGRAS.md` primeiro — é a fonte de verdade.**

## O que fazer

1. Inicializar o projeto NestJS (`nest new refeitorio-api`, npm, CommonJS)
2. Instalar dependências: `@nestjs/common @nestjs/core @nestjs/platform-express @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt bcryptjs class-validator class-transformer @prisma/client@7.10.0 @prisma/adapter-pg pg` e devDependencies `prisma@7.10.0 @types/passport-jwt @types/bcryptjs @types/pg`
3. Criar `prisma/schema.prisma` com os models `User`, `Menu`, `MealReservation`, seguindo EXATAMENTE o padrão Prisma 7 descrito no contexto mestre (sem `url` no datasource)
4. Definir o enum de Role (`ADMIN`, `EMPLOYEE`)
5. Definir a constraint que impede reserva duplicada (`@@unique([...])` — pense em quais campos compõem essa unicidade dado que a regra é "mesmo período/data")
6. Criar a estrutura de pastas: `src/auth`, `src/users`, `src/menus`, `src/reservations`, `src/prisma`, `src/common/guards`, `src/common/decorators` (ainda sem implementar lógica — só as pastas/módulos vazios gerados via `nest g module/controller/service`)
7. Criar `prisma.config.ts` na raiz, conforme o padrão do contexto mestre

## Gate de revisão — PARE AQUI e responda antes de eu aprovar

Não prossiga para a Fase 2 até eu responder este gate.

1. Explique a constraint `@@unique(...)` escolhida para evitar reserva duplicada — por que esses campos especificamente, e o que aconteceria se ela não existisse (dependendo só da checagem em código)?
2. As foreign keys têm `onDelete` definido? Justifique a escolha para `MealReservation.userId` e `MealReservation.menuId`.
3. Onde fica a capacidade do `Menu`, e como o schema por si só garante (ou não garante) que ela nunca seja excedida?

## Critério de saída

- `npx prisma validate` passa sem erro
- Estrutura de pastas criada, sem lógica de negócio ainda
- Gate de revisão respondido e aprovado pelo humano
