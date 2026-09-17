# CONTEXTO MESTRE — Refeitório Corporativo API

> Este arquivo é a fonte única de verdade. Toda fase referencia este arquivo.
> Se qualquer instrução de fase conflitar com este documento, ESTE documento vence.
> Não implemente nada que não esteja aqui ou explicitamente pedido na fase atual.

## Stack obrigatória (não trocar por nada)

- NestJS + TypeScript (`strict: true` no tsconfig)
- PostgreSQL
- **Prisma 7.10.0** — usar o padrão do Prisma 7, NÃO o padrão antigo:
  - `datasource db { provider = "postgresql" }` **sem** `url` no schema
  - Connection string via `prisma.config.ts` (`datasource.url: process.env["DATABASE_URL"]`, com `import "dotenv/config"` no topo)
  - Client usa **driver adapter obrigatório**: `new PrismaPg({ connectionString: process.env.DATABASE_URL })` passado ao `super({ adapter })` no `PrismaService`
  - Pacotes: `@prisma/client@7.10.0`, `prisma@7.10.0`, `@prisma/adapter-pg`, `pg`
- DTOs + `class-validator` + `class-transformer` + `ValidationPipe({ whitelist: true, transform: true })` global
- JWT (`@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`)
- Variáveis de ambiente via `@nestjs/config` (`ConfigModule.forRoot({ isGlobal: true })`)
- `npm run build` (`nest build`) precisa terminar sem erro ao final de toda fase

## Perfis

- `EMPLOYEE` — reserva e cancela refeições
- `ADMIN` — administra cardápios (cria/edita menus)

## Entidades mínimas (defina campos, chaves, constraints coerentes)

- `User` — nunca retornar `password` na API (usar `select` explícito em toda query, nunca `select: { password: false }`)
- `Menu` — cardápio de uma data/período, com capacidade máxima
- `MealReservation` — reserva de um `User` para um `Menu`, com status (ex: `ACTIVE`, `CANCELLED`)

## Endpoints mínimos

```
POST   /auth/login
POST   /menus                          (ADMIN)
GET    /menus                          (autenticado)
POST   /menus/:id/reservations         (EMPLOYEE, o próprio usuário)
PATCH  /meal-reservations/:id/cancel   (dono da reserva)
GET    /meal-reservations/my           (o próprio usuário)
```

## Regra central de negócio (a mais importante — cuidado especial)

1. Um usuário **não pode** ter duas reservas ativas no mesmo período/data (mesmo `Menu` já reservado, ou dois `Menu`s do mesmo dia/período — definir com clareza no schema)
2. A capacidade do `Menu` **não pode** ser excedida

**As duas checagens (existe reserva duplicada? capacidade excedida?) e o `create` da reserva precisam estar dentro do MESMO `prisma.$transaction(...)`.** Fora da transação, dois requests simultâneos podem passar pela checagem ao mesmo tempo antes de qualquer um criar a reserva — condição de corrida clássica.

## Requisitos gerais (não negociáveis)

- `userId` de operação pessoal **nunca** vem do body — sempre do `request.user` (via `@CurrentUser()`/Guard JWT)
- Controller só traduz HTTP ↔ chamada de método. Toda regra de negócio mora no Service.
- Validar existência de recursos relacionados antes de operar (menu existe? reserva existe?)
- Proteger rotas administrativas com Guard de Role
- Status codes: `400` (validação/DTO), `401` (sem token/token inválido), `403` (autenticado mas sem permissão), `404` (recurso não existe), `409` (conflito da regra central — duplicidade ou capacidade excedida)

## Mapeamento de erro do Prisma (padrão já validado em projeto anterior)

```typescript
private isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}
// P2002 (unique constraint) → ConflictException (409)
```

## Convenções de código (seguir sem exceção)

- Params de rota sempre com `ParseIntPipe`
- Delete/cancelamento retorna `{ cancelled: true }` ou objeto atualizado — nunca `204` sem corpo, a menos que pedido
- Exceptions do `@nestjs/common`, mensagens em português: `NotFoundException`, `ForbiddenException`, `ConflictException`, `UnauthorizedException`
- Helper privado `async ensureExists(id)` no Service, reaproveitado por `ensureOwner`, evita duplicar query
- `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` no `.env`, nunca hardcoded

## Escopo EXPLICITAMENTE fora desta rodada (Bônus — só se sobrar tempo)

Paginação, filtros, Swagger, seed, testes automatizados (E2E/unitários), Docker do app, CI/CD, SAST, cobertura de teste. **Não implementar nada disso sem autorização explícita do humano.**

## Entregáveis desta avaliação

- Código-fonte
- `schema.prisma` + migrations
- `.env.example` sem segredos reais
- README com instalação, configuração, execução, lista de endpoints
- `npm run build` sem erro
