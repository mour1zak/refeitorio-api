# Status Final — Refeitório Corporativo API

> Documento gerado pra avaliação externa (humana ou outra IA). Auto-contido — não depende de
> contexto de conversa anterior. Requisitos completos em `PRE-05-REFEITORIO.md`, na raiz deste
> repositório.

## 1. Checklist — Obrigatório (`PRE-05-REFEITORIO.md`)

### Stack obrigatória
- [x] NestJS + TypeScript
- [x] PostgreSQL
- [x] Prisma **7.10.0**, com `prisma.config.ts`, driver adapter (`@prisma/adapter-pg` + `PrismaPg`) e migrations
- [x] DTOs + `class-validator` + `ValidationPipe` global (`whitelist: true, transform: true`)
- [x] JWT (`@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`)
- [x] Variáveis de ambiente (`@nestjs/config`, `.env`/`.env.example`)
- [x] `npm run build` sem erro (confirmado repetidas vezes ao longo do desenvolvimento)

### Perfis e entidades
- [x] `EMPLOYEE` reserva/cancela, `ADMIN` administra cardápios — via `RolesGuard` + `@Roles(...)`
- [x] `User`, `Menu`, `MealReservation` com campos, chaves e constraints coerentes
- [x] Campos sensíveis (`password`) nunca retornados — `select` explícito em toda query de `User`

### Endpoints mínimos (todos presentes)
- [x] `POST /auth/login`
- [x] `POST /menus` (ADMIN)
- [x] `GET /menus` (autenticado; ganhou paginação/filtros no bônus, ver seção 2)
- [x] `POST /menus/:id/reservations` (EMPLOYEE, para si mesmo)
- [x] `PATCH /meal-reservations/:id/cancel` (dono da reserva)
- [x] `GET /meal-reservations/my` (autenticado, só as próprias)

### Regra central de negócio
- [x] Duplicidade: usuário não reserva duas vezes o mesmo período/data — garantida por
  `activeSlotKey String? @unique` (preenchido só enquanto `ACTIVE`) checado dentro do
  `$transaction`, com catch de `P2002` como backstop pra concorrência real
- [x] Capacidade: `tx.mealReservation.count(...) >= menu.capacity` dentro do mesmo `$transaction`,
  **com `SELECT ... FOR UPDATE` na linha do `Menu`** travando a linha até a transação commitar —
  sem isso, usuários **diferentes** (chaves de `activeSlotKey` diferentes, não colidem no índice
  único) podiam estourar a capacidade sob concorrência real. Comprovado com teste de 5
  requisições simultâneas: sem o lock, 5/5 sucediam num menu de `capacity: 1`; com o lock, 1/5
  sucede e 4/5 retornam `409` — estável em múltiplas execuções (`test/app.e2e-spec.ts`)
- [x] Checagem de duplicidade + capacidade + `create` estão no **mesmo bloco de transação**,
  usando sempre `tx`, nunca `this.prisma` direto

### Requisitos gerais (não negociáveis)
- [x] `userId` de operação pessoal vem sempre de `request.user` via `@CurrentUser()`, nunca do body
- [x] Controllers só traduzem HTTP; regra de negócio 100% nos Services
- [x] Existência de recursos relacionados validada antes de operar (`menu existe?`, `reserva existe?`)
- [x] Tipos, campos obrigatórios e valores validados via DTO + `class-validator`
- [x] Rotas administrativas protegidas (`RolesGuard` + `@Roles(Role.ADMIN)`)
- [x] Status codes `400`/`401`/`403`/`404`/`409` usados conforme o significado do erro
- [x] Cenário positivo e negativo da regra central testados (múltiplos, automatizados — ver seção 2)

### Testes obrigatórios (bateria do enunciado)
Todos verificados manualmente via Swagger **e** cobertos por teste automatizado E2E:

| # | Cenário | Verificado |
|---|---|---|
| 1 | Login válido | `200` + `accessToken` |
| 2 | Login inválido | `401` |
| 3 | Rota protegida sem token | `401` |
| 4 | Operação sem permissão | `403` |
| 5 | Recurso inexistente | `404` |
| 6 | Body inválido | `400` |
| 7 | Conflito da regra principal | `409` (duplicidade **e** capacidade, testados separadamente) |
| 8 | Fluxo principal completo | sucesso em cada etapa |

### Entregáveis
- [x] Código-fonte
- [x] `schema.prisma` + migrations (`prisma/migrations/20260917122956_init/`)
- [x] `.env.example` sem segredos reais
- [x] README com instalação, configuração, execução, endpoints, decisões técnicas
- [x] `npm run build` sem erros

## 2. Checklist — Bônus (`PRE-05-REFEITORIO.md`: *"paginação, filtros, Swagger, seed ou testes automatizados"*)

- [x] **Swagger** completo em `/api` — `@ApiTags`/`@ApiOperation`/`@ApiResponse`/`@ApiBearerAuth`
  em todas as rotas, documentando todo status code real (não só os `2xx`)
- [x] **Paginação e filtros** em `GET /menus` — query params `page`, `limit` (teto de 100),
  `date`, `period`; resposta `{ data, total, page, limit }`
- [x] **Seed** idempotente (`npm run seed`) — cria usuários de demo + cenário pronto pra
  reproduzir os dois lados do `409` sem passos manuais
- [x] **Testes automatizados** E2E (`npm run test:e2e`, `vitest` + `supertest`) — 14 testes,
  banco de teste isolado (`refeitorio_test`, nunca o banco de desenvolvimento), determinismo
  confirmado rodando a suíte 3x seguidas

## 3. Além do pedido (obrigatório + bônus) — decisões extras de engenharia

- `activeSlotKey` em vez de `@@unique([userId, date, period])` simples — preserva histórico de
  cancelamentos (cada evento vira linha nova, nunca é reaproveitada/apagada)
- Testes cobrindo tentativa de burla de segurança, não só caminho feliz: token JWT malformado,
  `EMPLOYEE` tentando cancelar reserva de **outro** `EMPLOYEE`, inversão de papéis (`ADMIN`
  tentando reservar, `EMPLOYEE` tentando criar cardápio)
- Banco de teste genuinamente isolado (`.env.test` próprio), não reaproveita o banco de dev
- `helmet()` (headers de segurança HTTP) + `compression()` (gzip) globais — `contentSecurityPolicy`
  desligado deliberadamente porque quebraria o Swagger UI; confirmado que nenhuma vulnerabilidade
  nova entrou no `npm audit` por causa dessas duas libs

## 4. Bugs encontrados e corrigidos durante auditoria (histórico, não pendência)

1. `DocumentBuilder` usava `.addBasicAuth()` em vez de `.addBearerAuth()` — Swagger pedia
   usuário/senha em vez de JWT
2. `ReservationsController` sem nenhum decorator Swagger (incluindo onde nasce o `409` central)
3. `MenusController.create` sem `@ApiResponse(409)` documentado
4. `MenusController.findAll` sem nenhum decorator Swagger
5. `AuthController.login` documentava `@ApiResponse(403)` que nunca acontece (login só lança `401`)
6. Import morto/quebrado em `create-user.dto.ts` (`import { a } from 'vitest/dist/...'`)
7. `.gitignore` com padrões que não batiam os nomes reais dos arquivos MD internos (tinham ponto
   a mais na frente)
8. `tsconfig.build.tsbuildinfo` (cache incremental do TS) estava versionado no Git

## 5. Conscientemente fora do escopo (decisão registrada, não esquecimento)

- Docker da aplicação (só o Postgres é containerizado)
- CI/CD
- Cobertura de código formal (threshold %)
- Logs estruturados / observabilidade
- Testcontainers (usado banco de teste separado no mesmo Postgres em vez disso)

## 6. Pendências / decisões em aberto (aguardando o dono do projeto, não bugs)

- [ ] `updatedAt DateTime @updatedAt` em `User` e `Menu` (hoje só têm `createdAt`) — gap de
  auditoria/compliance identificado, correção trivial (1 linha por model + migration), mas não
  aplicada ainda porque mexe em schema e precisa aprovação explícita
- [ ] Commit final das mudanças — ver seção 7
- [ ] `00-CONTEXTO-E-REGRAS.md` a `04-FASE-TESTES-E-ENTREGA.md` e `PRE-05-REFEITORIO.md` já estão
  commitados de um commit anterior (de antes do `.gitignore` ter sido corrigido) — se quiser
  desrastreá-los também, precisa de `git rm --cached` explícito por arquivo

## 7. Como verificar por conta própria

```bash
npm install
npm run build          # precisa terminar sem erro
npm run seed            # popula dados de demo (opcional)
npm run start:dev       # sobe a API em http://localhost:3000
# Swagger em http://localhost:3000/api

# Testes automatizados (precisa de .env.test configurado, ver README)
npm run test:e2e
```
