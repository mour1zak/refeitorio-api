# Status Final — Refeitório Corporativo API

> Documento gerado pra avaliação externa (humana ou outra IA). Auto-contido — não depende de
> contexto de conversa anterior. Requisitos completos em `PRE-05-REFEITORIO.md`, na raiz deste
> repositório. Este projeto passou por **duas rodadas de auditoria externa** (outra IA, revisando
> só o código publicado no GitHub) — os achados de ambas estão registrados nas seções 4 e 6.

## 1. Checklist — Obrigatório (`PRE-05-REFEITORIO.md`)

### Stack obrigatória
- [x] NestJS + TypeScript
- [x] PostgreSQL
- [x] Prisma **7.10.0**, com `prisma.config.ts`, driver adapter (`@prisma/adapter-pg` + `PrismaPg`) e migrations
- [x] DTOs + `class-validator` + `ValidationPipe` global (`whitelist: true, transform: true`)
- [x] JWT (`@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`)
- [x] Variáveis de ambiente (`@nestjs/config`, `.env`/`.env.example`)
- [x] `npm run build` sem erro — **inclusive sem devDependencies instaladas** (`npm ci --omit=dev`),
  cenário de CI/Docker: `tsconfig.build.json` não herda mais `types: ["vitest/globals"]` do
  `tsconfig.json` base, então o build de produção não depende do `vitest` estar presente

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
  `$transaction`, com catch de `P2002` como backstop pra concorrência real. **Testado**:
  reservar de novo após cancelar cria linha nova preservando histórico (2 linhas, 1 `ACTIVE` + 1
  `CANCELLED`) — prova automatizada da decisão de design do `activeSlotKey`
- [x] Capacidade: `tx.mealReservation.count(...) >= menu.capacity` dentro do mesmo `$transaction`,
  **com `SELECT ... FOR UPDATE` na linha do `Menu`** travando a linha até a transação commitar —
  sem isso, usuários **diferentes** (chaves de `activeSlotKey` diferentes, não colidem no índice
  único) podiam estourar a capacidade sob concorrência real. Comprovado com teste de 5
  requisições simultâneas: sem o lock, 5/5 sucediam num menu de `capacity: 1`; com o lock, 1/5
  sucede e 4/5 retornam `409` — estável em múltiplas execuções
- [x] Checagem de duplicidade + capacidade + `create` estão no **mesmo bloco de transação**,
  usando sempre `tx`, nunca `this.prisma` direto
- [x] Cancelar a mesma reserva duas vezes → `409` na segunda (testado)

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
| 7 | Conflito da regra principal | `409` (duplicidade **e** capacidade, testados separadamente + sob concorrência real) |
| 8 | Fluxo principal completo | sucesso em cada etapa |

### Entregáveis
- [x] Código-fonte
- [x] `schema.prisma` + migrations (`prisma/migrations/`, 2 migrations)
- [x] `.env.example` sem segredos reais
- [x] README com instalação, configuração, execução, endpoints, decisões técnicas, segurança
- [x] `npm run build` sem erros (com e sem devDependencies)

## 2. Checklist — Bônus (`PRE-05-REFEITORIO.md`: *"paginação, filtros, Swagger, seed ou testes automatizados"*)

- [x] **Swagger** completo em `/api` — `@ApiTags`/`@ApiOperation`/`@ApiResponse`/`@ApiBearerAuth`
  em todas as rotas, documentando todo status code real (não só os `2xx`)
- [x] **Paginação e filtros** em `GET /menus` — query params `page`, `limit` (teto de 100),
  `date`, `period`; resposta `{ data, total, page, limit }`. **Testado**: `401` sem token,
  formato do envelope, filtro por `period`, `limit` acima de 100 → `400`
- [x] **Seed** idempotente (`npm run seed`) — cria usuários de demo + cenário pronto pra
  reproduzir os dois lados do `409` sem passos manuais. Configurado em `prisma.config.ts`
  (`migrations.seed`, o padrão do Prisma 7 — não o antigo `"prisma":{"seed":...}` do
  `package.json`), então roda automaticamente após `prisma migrate dev`/`migrate reset`
- [x] **Testes automatizados** E2E (`npm run test:e2e`, `vitest` + `supertest`) — **21 testes**,
  banco de teste isolado (`refeitorio_test`, nunca o banco de desenvolvimento), determinismo
  confirmado rodando a suíte múltiplas vezes seguidas. `test/setup-env.ts` **falha rápido**
  (recusa rodar, zero testes executam) se `.env.test` não existir ou não apontar pro banco de
  teste — proteção contra apagar o banco de desenvolvimento por engano

## 3. Além do pedido (obrigatório + bônus) — decisões extras de engenharia

- `activeSlotKey` em vez de `@@unique([userId, date, period])` simples — preserva histórico de
  cancelamentos (cada evento vira linha nova, nunca é reaproveitada/apagada), com prova automatizada
- Testes cobrindo tentativa de burla de segurança, não só caminho feliz: token JWT malformado,
  `EMPLOYEE` tentando cancelar reserva de **outro** `EMPLOYEE`, inversão de papéis (`ADMIN`
  tentando reservar, `EMPLOYEE` tentando criar cardápio)
- Banco de teste genuinamente isolado (`.env.test` próprio, com verificação de segurança no boot
  da suíte), não reaproveita o banco de dev
- `helmet()` (headers de segurança HTTP) + `compression()` (gzip) globais — `contentSecurityPolicy`
  desligado deliberadamente porque quebraria o Swagger UI
- `npm run lint` **100% limpo** (`oxlint --type-aware`, incluindo a regra `no-floating-promises`)
  e `npx prettier --check` **100% conforme** em todo o `src/`/`test/`
- Seção de segurança no README documentando as 4 vulnerabilidades HIGH em dependências de
  produção que não têm correção disponível sem violar o requisito de versão do Prisma — com
  análise de atingibilidade, não só o número do `npm audit`
- Todos os gates de revisão das fases 1–4 respondidos por escrito no README (10/10, incluindo os
  dois sobre `onDelete` e credenciais do `docker-compose.yml` que faltavam)
- `docker-compose.yml` com `healthcheck` do Postgres

## 4. Bugs encontrados e corrigidos (histórico, não pendência)

### Rodada 1 (Swagger + limpeza, antes da 1ª auditoria externa)
1. `DocumentBuilder` usava `.addBasicAuth()` em vez de `.addBearerAuth()` — Swagger pedia
   usuário/senha em vez de JWT
2. `ReservationsController` sem nenhum decorator Swagger (incluindo onde nasce o `409` central)
3. `MenusController.create` sem `@ApiResponse(409)` documentado
4. `MenusController.findAll` sem nenhum decorator Swagger
5. `AuthController.login` documentava `@ApiResponse(403)` que nunca acontece (login só lança `401`)
6. Import morto/quebrado em `create-user.dto.ts` (`import { a } from 'vitest/dist/...'`)
7. `.gitignore` com padrões que não batiam os nomes reais dos arquivos MD internos (ponto a mais)
8. `tsconfig.build.tsbuildinfo` (cache incremental do TS) estava versionado no Git

### Achado pela 1ª auditoria externa, corrigido e comprovado
9. **Capacidade sem proteção de concorrência real** — o `activeSlotKey` só protege duplicidade do
   mesmo usuário; usuários diferentes podiam estourar a capacidade sob `READ COMMITTED`.
   Corrigido com `SELECT ... FOR UPDATE` na linha do `Menu` dentro da transação. Comprovado
   desativando a trava de propósito (5/5 requisições simultâneas passavam, capacidade de 1
   estourada em 5x) e reativando (1/5 sucede, estável).

### Achados pela 2ª auditoria externa (pós-correções da rodada anterior), corrigidos
10. **🔴 Crítico — a suíte E2E podia apagar o banco de desenvolvimento.** `test/setup-env.ts`
    carregava `.env.test` via `dotenv.config()`, mas essa função **não lança erro** quando o
    arquivo não existe — só retorna `{ error }` silenciosamente. Se alguém esquecesse o
    `cp .env.test.example .env.test` (passo manual do README), a suíte caía de volta no `.env`
    de desenvolvimento, e o `beforeEach` roda `deleteMany()` em todas as tabelas antes de cada
    teste. **Reproduzido e confirmado** antes de corrigir. Corrigido: o setup agora falha rápido
    (lança erro, zero testes executam) se `.env.test` não existir ou se a `DATABASE_URL` carregada
    não contiver `refeitorio_test`.
11. `npm run build` ainda quebrava sem devDependencies instaladas (`TS2688`, `vitest/globals` não
    encontrado) — `tsconfig.json` base ainda listava `types: ["vitest/globals", "node"]`, herdado
    por `tsconfig.build.json`. Corrigido: `tsconfig.build.json` agora sobrescreve `types` para
    `["node"]` (confirmado via `tsc --showConfig`).
12. `moduleResolution: "node"` no `tsconfig.json` quebrava `npm run lint` (`oxlint --type-aware`
    não conseguia montar o programa de tipos, então regras type-aware como
    `no-floating-promises` ficavam **desligadas silenciosamente**, mostrando "0 warnings" de forma
    enganosa). Corrigido: removido (TypeScript infere a partir de `module: "commonjs"`). Ao
    reativar, o lint imediatamente capturou o próximo item.
13. `bootstrap()` no `main.ts` era uma promise flutuante (`no-floating-promises`) — só não era
    reportado por causa do item 12. Corrigido: `void bootstrap()`.
14. `GET /menus` (a paginação/filtros do bônus) tinha **zero** teste automatizado. Corrigido: 4
    testes novos (401 sem token, formato do envelope, filtro por período, `limit > 100` → 400).
15. A decisão de design mais original do projeto (`activeSlotKey` preservando histórico ao
    reservar de novo após cancelar) não tinha prova automatizada. Corrigido: teste dedicado.
16. "Cancelar a mesma reserva duas vezes" não era testado, apesar do `409` existir no código.
    Corrigido.
17. 15 arquivos fora do padrão Prettier (incluindo `main.ts`, com indentação quebrada desde antes
    da 1ª rodada). Corrigido: `npm run format`.
18. `buildActiveSlotKey` duplicado em `reservations.service.ts` e `seed.js`, sem aviso de
    sincronização — se o formato mudasse num e não no outro, o índice único pararia de detectar
    duplicidade nas linhas do seed silenciosamente. Corrigido: comentário de sincronização
    cruzado nos dois arquivos (extrair um módulo compartilhado exigiria `allowJs` no tsconfig,
    risco desproporcional ao benefício pra este tamanho de projeto).
19. Gates 1.2 (`onDelete` das FKs) e 2.2 (porta/credenciais do `docker-compose.yml`) nunca
    tiveram resposta escrita em lugar nenhum. Corrigido: respondidos no README.
20. `docker-compose.yml` sem `healthcheck` — o critério de saída original da Fase 2 pedia
    `docker compose ps` mostrando `healthy`, mas sem healthcheck só mostra `Up`. Corrigido.
21. `STATUS-FINAL-CHECKLIST.md` (este arquivo) dizia "14 testes" quando já eram 15. Corrigido
    (e agora são 21, com os testes da seção 2 acima).

### Documentado, não corrigido (risco aceito e justificado)
- **4 vulnerabilidades HIGH** em dependências de produção (`mysql2`, `deepmerge-ts`, via peer
  dependency `prisma` do `@prisma/client`) — sem correção disponível sem fazer downgrade pra
  `prisma@6.19.3`, o que violaria o requisito obrigatório de **Prisma 7.10.0**. Análise de
  atingibilidade completa no README, seção "Segurança".

## 5. Conscientemente fora do escopo (decisão registrada, não esquecimento)

- Docker da aplicação (só o Postgres é containerizado)
- CI/CD
- Cobertura de código formal (threshold %)
- Logs estruturados / observabilidade
- Testcontainers (usado banco de teste separado no mesmo Postgres em vez disso)
- `cancel()` fora de uma `$transaction` própria (risco de *check-then-act* de baixo impacto — o
  pior caso é dois cancelamentos simultâneos convergindo pro mesmo estado final, sem efeito
  cumulativo nem violação de regra de negócio)
- Rate limiting em `/auth/login` (força bruta de senha ainda é possível — `@nestjs/throttler`
  resolveria, não implementado nesta rodada)

## 6. Pendências / decisões em aberto

Nenhuma pendência técnica conhecida no momento. Único passo manual restante: **revisar e rodar o
commit/push final** das mudanças descritas nas seções 4 (itens 10–21) e no `updatedAt` de
`User`/`Menu` (schema + migration já aplicados em desenvolvimento e teste).

## 7. Como verificar por conta própria

```bash
npm install
npm run build            # precisa terminar sem erro
npm run build --omit=dev # também precisa funcionar (não depende de devDependencies)
npm run lint              # deve terminar 100% limpo
npx prettier --check "src/**/*.ts" "test/**/*.ts"  # deve estar 100% conforme
npm run seed               # popula dados de demo (opcional)
npm run start:dev          # sobe a API em http://localhost:3000
# Swagger em http://localhost:3000/api

# Testes automatizados (precisa de .env.test configurado, ver README)
npm run test:e2e           # deve rodar 21/21, e falhar rápido se .env.test não existir
```
