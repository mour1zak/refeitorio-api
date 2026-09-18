# Refeitório Corporativo API

API para gestão de refeições de um refeitório corporativo: administradores publicam cardápios (`Menu`) por data/período com capacidade máxima, e funcionários reservam e cancelam sua refeição, respeitando duas regras centrais — nenhuma reserva duplicada por usuário no mesmo dia/período, e a capacidade do cardápio nunca é excedida.

## Stack

- NestJS + TypeScript (`strict: true`), módulos em CommonJS
- PostgreSQL via Prisma 7.10.0, com driver adapter (`@prisma/adapter-pg`)
- Autenticação JWT (`@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`)
- Validação de entrada com `class-validator`/`class-transformer` (`ValidationPipe` global)
- Documentação interativa via Swagger/OpenAPI (`@nestjs/swagger`)
- `helmet` (security headers) + `compression` (gzip de resposta) globais em `main.ts`

## O que foi implementado

Esta seção existe pra quem receber o projeto saber exatamente o que é mínimo exigido, o que é
bônus, e o que foi além de ambos — sem precisar ler código pra descobrir.

**Obrigatório do enunciado** (todos os 5 endpoints, as duas regras centrais, os 5 status codes
com o significado correto, DTOs validados, JWT, `userId` sempre do token):
- ✅ Completo. Auditado item a item contra o enunciado, com 5 bugs de Swagger encontrados e
  corrigidos ao longo do processo (documentados nas decisões técnicas abaixo e no histórico da
  conversa que gerou este projeto).
- ✅ **Correção de concorrência real na capacidade** (revisão externa apontou o gap, comprovado
  com teste de 5 requisições simultâneas): a checagem de capacidade agora trava a linha do `Menu`
  (`SELECT ... FOR UPDATE`) dentro da transação, não só o índice único como a duplicidade tinha.
  Ver seção "Decisões técnicas relevantes".

**Bônus do enunciado** (*"paginação, filtros, Swagger, seed ou testes automatizados"*):
- ✅ Swagger completo em `/api`, com `@ApiResponse` documentando todo status code real de cada
  rota (inclusive os `409` e `403` — não só os `200`).
- ✅ Paginação e filtros em `GET /menus` (`page`, `limit`, `date`, `period`).
- ✅ Seed idempotente (`npm run seed`) com cenário pronto pra demonstrar os dois lados do `409`.
- ✅ Testes automatizados E2E (`npm run test:e2e`) cobrindo toda a bateria obrigatória do
  enunciado, contra banco de teste isolado.

**Além do que foi pedido** (decisões de engenharia extras, não exigidas nem pelo obrigatório nem
pelo bônus):
- `activeSlotKey` (índice único parcial via `String? @unique`) em vez de um `@@unique` simples —
  preserva histórico de cancelamentos e serve como rede de segurança contra race condition real
  (não só a checagem dentro da transação), com `P2002` mapeado pra `409` no `catch`.
- Testes cobrindo tentativa de burlar autorização, não só o caminho feliz: token JWT malformado,
  um `EMPLOYEE` tentando cancelar reserva de **outro** `EMPLOYEE`, e inversão de papéis (`ADMIN`
  tentando reservar, `EMPLOYEE` tentando criar cardápio).
- Banco de teste genuinamente isolado do banco de desenvolvimento (`.env.test` próprio), em vez
  de reaproveitar o mesmo banco com risco de sujar dados de demo.
- Teto de `limit` na paginação (`@Max(100)`) pra evitar uma query de `GET /menus` sobrecarregar o
  banco com um valor arbitrariamente grande.
- `helmet()` + `compression()` globais em `main.ts` — headers de segurança HTTP básicos (ex:
  `X-Content-Type-Options: nosniff`) e gzip de resposta. `contentSecurityPolicy` do helmet foi
  desligado deliberadamente porque o CSP padrão quebra o Swagger UI (scripts/estilos inline); os
  demais headers continuam ativos. Confirmado que o Swagger e o login continuam funcionando com
  as duas libs ativas, e que nenhuma vulnerabilidade nova entrou no `npm audit` por causa delas
  (as 9 já existentes vêm de `prisma`/`@nestjs/mau`/`mysql2`/`undici`, nada relacionado).

**Conscientemente fora do escopo** (decisão registrada, não item esquecido): Docker da aplicação
(só o Postgres é containerizado), CI/CD, cobertura de código formal, logs estruturados/observabilidade.

## Estrutura de pastas

Reflete o que existe hoje no repositório, não um modelo genérico:

```
refeitorio-api/
├── prisma/
│   ├── schema.prisma              # Models User, Menu, MealReservation + enums (Role, MealPeriod, ReservationStatus)
│   ├── migrations/
│   │   ├── 20260917122956_init/migration.sql
│   │   └── migration_lock.toml
│   └── seeds/
│       └── seed.js                # Seed idempotente (bônus) — node puro, sem dependência nova
├── src/
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts   # @CurrentUser() — extrai request.user (nunca o body)
│   │   │   └── roles.decorator.ts          # @Roles(...)
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts           # AuthGuard('jwt')
│   │       └── roles.guard.ts              # Compara @Roles exigido com request.user.role
│   ├── auth/
│   │   ├── dto/login.dto.ts
│   │   ├── auth.controller.ts       # POST /auth/login
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts          # validateUser() + login() (assina o JWT)
│   │   └── jwt.strategy.ts          # PassportStrategy — valida token, popula request.user
│   ├── users/
│   │   ├── dto/create-user.dto.ts   # não exposto por controller — cadastro de usuário está fora do escopo mínimo
│   │   ├── users.module.ts
│   │   └── users.service.ts         # create() (não usado por HTTP) + findByEmailWithPassword() (usado só pelo AuthService)
│   ├── menus/
│   │   ├── dto/
│   │   │   ├── create-menu.dto.ts
│   │   │   └── find-menus.dto.ts    # paginação + filtros (bônus)
│   │   ├── menus.controller.ts      # POST /menus (ADMIN), GET /menus (autenticado)
│   │   ├── menus.module.ts
│   │   └── menus.service.ts
│   ├── reservations/
│   │   ├── reservations.controller.ts   # POST /menus/:id/reservations, PATCH .../cancel, GET .../my
│   │   ├── reservations.module.ts
│   │   └── reservations.service.ts      # regra central de negócio — $transaction atômica
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts        # PrismaClient com driver adapter (PrismaPg)
│   ├── app.controller.ts, app.module.ts, app.service.ts   # boilerplate do `nest new` (rota raiz)
│   └── main.ts                      # bootstrap: helmet + compression, ValidationPipe global, Swagger em /api
├── test/
│   ├── app.e2e-spec.ts       # suíte E2E (bônus) — bateria obrigatória completa do enunciado
│   └── setup-env.ts          # carrega .env.test antes dos testes, isola do banco de dev
├── .env.example, .env.test.example   # sem segredo real, versionados
├── docker-compose.yml         # só o Postgres é containerizado nesta rodada
├── prisma.config.ts            # Prisma 7 — connection string fora do schema.prisma
├── vitest.config.ts, vitest.config.e2e.ts
└── package.json
```

**Por que não segue um layout "de livro-texto" com `src/common/filters/`, `src/common/pipes/`,
`src/common/interceptors/` ou `src/config/`** — decisão consciente, não pasta esquecida: não
existe filtro de exceção global porque cada Service já mapeia o próprio erro pro status certo
(`P2002` → `409` em `MenusService`/`ReservationsService`); não existe pipe customizado porque
`ValidationPipe` global + `ParseIntPipe` nos params já cobrem toda validação necessária; e as
variáveis de ambiente são lidas direto via `ConfigService`, sem precisar de uma camada de
configuração própria pro tamanho deste projeto.

## Instalação

```bash
npm install
```

## Configuração

Copie o arquivo de exemplo e preencha com valores reais do seu ambiente:

```bash
cp .env.example .env
```

Variáveis:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão do Postgres (`postgresql://usuario:senha@host:porta/banco?schema=public`) |
| `JWT_SECRET` | Segredo usado para assinar os tokens JWT |
| `JWT_EXPIRES_IN` | Validade do token (ex: `1d`, `12h`) |
| `PORT` | Porta em que a aplicação HTTP sobe |

## Como rodar

1. Suba o Postgres (só o banco é containerizado nesta rodada; a aplicação roda direto na máquina):
   ```bash
   docker compose up -d
   ```
   > Se preferir usar um Postgres já instalado localmente em vez do container, ajuste `DATABASE_URL` no `.env` de acordo e pule este passo.

2. Rode as migrations (cria as tabelas a partir de `prisma/schema.prisma`):
   ```bash
   npx prisma migrate dev
   ```

3. Gere o client do Prisma (necessário após todo `git clone`/`npm install`, sem isso o `import { PrismaClient } from '@prisma/client'` falha em build-time):
   ```bash
   npx prisma generate
   ```

4. Suba a aplicação em modo desenvolvimento:
   ```bash
   npm run start:dev
   ```

5. Popule dados de demonstração (opcional, mas recomendado — cria usuários e um cenário pronto
   pra testar os `409`, ver seção "Criando o primeiro usuário" abaixo):
   ```bash
   npm run seed
   ```

6. Acesse a documentação interativa (Swagger), com todos os endpoints, status codes e schemas:
   ```
   http://localhost:3000/api
   ```

7. Para build de produção:
   ```bash
   npm run build
   npm run start:prod
   ```

### Criando o primeiro usuário

O escopo mínimo desta avaliação **não inclui** um endpoint de cadastro de usuário (não consta na lista de endpoints exigidos). Duas formas de ter usuários pra testar:

**1. Seed de demonstração (recomendado)** — cria usuários, cardápios e reservas já prontos pra demonstrar os cenários de sucesso e de conflito (`409`), sem passos manuais:

```bash
npm run seed
```

É idempotente (pode rodar várias vezes sem duplicar dados). Cria:

| Email | Senha | Role |
|---|---|---|
| `admin@teste.com` | `senha123` | `ADMIN` |
| `funcionario@teste.com` | `senha123` | `EMPLOYEE` |
| `funcionario2@teste.com` | `senha123` | `EMPLOYEE` |
| `funcionario3@teste.com` | `senha123` | `EMPLOYEE` |

> Credenciais de demo em texto claro aqui é intencional — são usuários de um banco **local de avaliação**, não segredo de produção. Nada disso vai pro `.env`/`.env.example`.

O script imprime no console os IDs dos cardápios criados e como reproduzir os dois lados do `409` (duplicidade e capacidade) direto na primeira tentativa, sem precisar montar o cenário na hora.

**2. Inserção manual** — se preferir não rodar o seed, insira direto no banco com uma senha já hasheada em bcrypt:

```bash
node -e "console.log(require('bcryptjs').hashSync('sua-senha', 10))"
```

```sql
INSERT INTO users (name, email, password, role)
VALUES ('Admin', 'admin@empresa.com', '<hash gerado acima>', 'ADMIN');
```

## Endpoints

| Método | Rota | Quem acessa | Body de exemplo |
|---|---|---|---|
| `POST` | `/auth/login` | Público | `{ "email": "admin@empresa.com", "password": "sua-senha" }` |
| `POST` | `/menus` | `ADMIN` | `{ "date": "2026-09-20", "period": "LUNCH", "description": "Frango grelhado com arroz e salada", "capacity": 50 }` |
| `GET` | `/menus` | Qualquer autenticado | — (query params opcionais: `page`, `limit` — máx. 100 —, `date`, `period`; resposta paginada `{ data, total, page, limit }`) |
| `POST` | `/menus/:id/reservations` | `EMPLOYEE`, para si mesmo | — (`:id` é o id do `Menu`; o usuário vem do token) |
| `PATCH` | `/meal-reservations/:id/cancel` | Dono da reserva | — (`:id` é o id da `MealReservation`) |
| `GET` | `/meal-reservations/my` | Autenticado, retorna só as próprias | — |

Todas as rotas exceto `/auth/login` exigem o header `Authorization: Bearer <token>` obtido no login.

`period` aceita `BREAKFAST`, `LUNCH` ou `DINNER`.

### Exemplos de resposta de erro

| Situação | Status |
|---|---|
| Body inválido (DTO) | `400` |
| Sem token / token inválido | `401` |
| Autenticado, mas sem permissão (role errada ou não é o dono) | `403` |
| Recurso não existe (menu ou reserva) | `404` |
| Reserva duplicada no mesmo dia/período, ou capacidade excedida | `409` |

## Decisões técnicas relevantes

**Por que a checagem de duplicidade/capacidade e o `create` estão na mesma `$transaction`.**
Sem isso, duas requisições simultâneas do mesmo usuário poderiam ler o estado "ainda não tenho reserva" ao mesmo tempo, antes de qualquer uma gravar a sua — uma condição de corrida clássica de *check-then-act*. Em `ReservationsService.create()`, a busca do `Menu`, a checagem de duplicidade e a checagem de capacidade usam sempre o `tx` recebido pelo callback do `$transaction`, nunca `this.prisma` diretamente.

**Por que existe um `activeSlotKey` em vez de um `@@unique([userId, date, period])` simples.**
A primeira versão do schema usava `@@unique([userId, date, period])`, mas isso obrigava a "reservar de novo depois de cancelar" a ser um `UPDATE` da mesma linha — apagando o histórico de cancelamentos. A solução final usa `activeSlotKey String? @unique`, preenchido com `${userId}:${date}:${period}` só enquanto a reserva está `ACTIVE`, e `null` quando `CANCELLED`. Como o Postgres nunca considera dois `NULL` como iguais numa constraint `UNIQUE`, várias reservas canceladas do mesmo usuário/slot podem coexistir livremente, enquanto no máximo uma reserva `ACTIVE` por slot continua sendo garantida pelo índice único — e cada cancelamento/nova reserva vira uma linha nova, preservando o histórico completo.

**Por que esse índice único é uma rede de segurança, não só uma otimização.**
Sob o isolamento padrão do Postgres (`READ COMMITTED`), duas transações concorrentes ainda podem, em teoria, passar pela leitura de "existe reserva ativa?" antes de qualquer uma commitar o `INSERT`. Quem realmente impede a duplicata nesse cenário é o índice único em `activeSlotKey`: a segunda transação recebe uma violação de constraint (`P2002`) no momento do commit, e o `ReservationsService` mapeia isso para `409` num `try/catch` em volta da transação.

**Por que a checagem de capacidade também precisou de um `SELECT ... FOR UPDATE`.**
O `activeSlotKey` só protege contra duplicidade do **mesmo** usuário — a chave é `${userId}:${date}:${period}`, então dois usuários **diferentes** disputando a última vaga têm chaves diferentes e não colidem no índice único. Sem proteção adicional, sob `READ COMMITTED`, várias transações concorrentes podiam contar a mesma vaga livre (`tx.mealReservation.count(...) < menu.capacity`) e todas passarem antes de qualquer uma commitar — comprovado nesta rodada: um teste com 5 requisições simultâneas para 1 vaga só resultava em `1 sucesso` **com** o lock; sem ele, as 5 passavam (`5 sucessos` para `capacity: 1`). A correção foi travar a linha do `Menu` com `SELECT id FROM menus WHERE id = $1 FOR UPDATE` logo no início da transação: a segunda transação concorrente fica bloqueada até a primeira commitar, e aí sim enxerga a reserva recém-criada na contagem. Teste de concorrência real (`Promise.all` com 5 requisições simultâneas) cobre esse cenário em `test/app.e2e-spec.ts`, estável em múltiplas execuções.

**Por que o Prisma Client usa um driver adapter (`PrismaPg`) em vez do padrão antigo.**
Segue o padrão do Prisma 7: a `datasource` no `schema.prisma` não tem `url`; a connection string é lida só em `prisma.config.ts` (usado pelo Prisma CLI) e, em runtime, pelo `PrismaService`, que constrói `new PrismaPg({ connectionString: process.env.DATABASE_URL })` e passa isso como `adapter` para `super({ adapter })`. Uma única fonte de verdade (a variável de ambiente), lida em dois pontos de entrada diferentes.

**Por que `password` nunca aparece nas respostas.**
Toda query em `UsersService` usa `select` explícito (nunca `select: { password: false }`). O único método que seleciona `password` é de uso interno do `AuthService` para comparar o hash no login — nunca é exposto por um controller.

## Bateria de testes manuais (Fase 4)

Confirmados manualmente via `curl` contra uma instância local rodando (`npm run start:dev`):

| # | Cenário | Resultado obtido |
|---|---|---|
| 1 | Login válido | `200` + `accessToken` |
| 2 | Login inválido (senha errada) | `401` |
| 3 | Rota protegida sem token | `401` |
| 4 | `POST /menus` como `EMPLOYEE` | `403` |
| 5 | `POST /menus/99999/reservations` (menu inexistente) | `404` |
| 6 | `POST /menus` com campos obrigatórios faltando | `400` |
| 7 | Reservar duas vezes o mesmo dia/período | `409` (capacidade excedida também testada e confirmada em `409`) |
| 8 | Fluxo completo: login → criar menu → reservar → cancelar → listar | sucesso em cada etapa |

## Testes automatizados (bônus)

Suíte E2E (`vitest` + `supertest`) cobrindo a bateria obrigatória do enunciado, incluindo os dois lados do conflito `409` (duplicidade e capacidade) e tentativas de burlar autenticação/autorização (token malformado, cancelar reserva de outro usuário, role errada).

**Banco isolado**: os testes rodam contra um banco separado (`refeitorio_test`), nunca contra o banco de desenvolvimento. Configuração:

```bash
cp .env.test.example .env.test
```

Preencha `.env.test` com a `DATABASE_URL` do banco de teste (pode ser o mesmo Postgres do `docker-compose.yml`, só com outro nome de banco). Crie o banco e aplique as migrations uma vez:

```bash
# cria o banco (ajuste usuário/senha conforme seu .env.test)
psql -U postgres -h localhost -c "CREATE DATABASE refeitorio_test"

# aplica as migrations nele
DATABASE_URL="<a mesma URL do seu .env.test>" npx prisma migrate deploy
```

Depois disso:

```bash
npm run test:e2e
```

Cada teste zera as tabelas do banco de teste antes de rodar (`beforeEach`) e cria só os dados que precisa — determinístico, não depende de ordem de execução. Confirmado rodando a suíte 3 vezes seguidas com o mesmo resultado (14/14).

> O que está fora do escopo desta entrega (e por quê) está descrito na seção "O que foi implementado", no início deste documento.
