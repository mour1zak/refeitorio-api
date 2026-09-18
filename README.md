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
  (`npm audit` está em 0 vulnerabilidades no total — ver seção "Segurança" mais abaixo).
- `engines`/`packageManager` declarados no `package.json` — fixa qual versão de Node/npm gerou o
  `package-lock.json`, pra evitar que versões diferentes de npm resolvam dependências peer (como
  o `typescript` exigido pelo `@prisma/dev`) de formas diferentes e dessincronizem o lockfile.

**Conscientemente fora do escopo** (decisão registrada, não item esquecido): Docker da aplicação
(só o Postgres é containerizado), CI/CD, cobertura de código formal, logs estruturados/observabilidade,
rate limiting em `/auth/login` (força bruta de senha continua possível — `@nestjs/throttler`
resolveria isso, avaliado e adiado conscientemente pra não expandir escopo além do pedido).

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

**Limite conhecido do `FOR UPDATE` sob concorrência muito alta.** O lock serializa as reservas por cardápio — a N-ésima requisição concorrente espera todas as N-1 anteriores. Com 5 simultâneas (o cenário testado) isso é imperceptível. Com centenas de requisições disputando o mesmo cardápio ao mesmo tempo (ex: abertura do almoço num refeitório grande), as últimas da fila podem estourar o timeout padrão da transação interativa do Prisma (5000ms) e retornar `500` em vez de `409`. Não é um problema para o volume desta avaliação, mas é a resposta correta para "e se 500 pessoas clicarem ao mesmo tempo?": mitigação seria aumentar o `timeout` do `$transaction`, ou trocar o lock por uma coluna `reservedCount` no `Menu` atualizada atomicamente via `UPDATE ... SET "reservedCount" = "reservedCount" + 1 WHERE id = $1 AND "reservedCount" < capacity` (sem serialização, escala melhor sob alta concorrência) — fora do escopo desta rodada.

**Por que o Prisma Client usa um driver adapter (`PrismaPg`) em vez do padrão antigo.**
Segue o padrão do Prisma 7: a `datasource` no `schema.prisma` não tem `url`; a connection string é lida só em `prisma.config.ts` (usado pelo Prisma CLI) e, em runtime, pelo `PrismaService`, que constrói `new PrismaPg({ connectionString: process.env.DATABASE_URL })` e passa isso como `adapter` para `super({ adapter })`. Uma única fonte de verdade (a variável de ambiente), lida em dois pontos de entrada diferentes.

**Por que `password` nunca aparece nas respostas.**
Toda query em `UsersService` usa `select` explícito (nunca `select: { password: false }`). O único método que seleciona `password` é de uso interno do `AuthService` para comparar o hash no login — nunca é exposto por um controller.

**Por que as foreign keys de `MealReservation` têm `onDelete` diferentes (`userId`: `Cascade`, `menuId`: `Restrict`).**
`menuId: Restrict` é deliberado: um cardápio com reservas vinculadas não pode ser apagado, porque cada reserva registra qual refeição foi servida — apagar o `Menu` perderia essa rastreabilidade (a alternativa seria `SetNull`, mas isso exigiria `menuId` opcional, o que não faz sentido pra uma reserva). Já `userId: Cascade` é uma escolha **questionável, registrada conscientemente**: apagar um usuário apagaria silenciosamente todo o histórico de reservas dele — exatamente o dado que o `activeSlotKey` foi desenhado pra preservar. A mitigação é que **não existe `DELETE /users` no escopo desta avaliação**, então hoje é risco latente, não bug ativo. Se um endpoint de exclusão de usuário for adicionado no futuro, a escolha correta seria `Restrict` (obriga desativar/reatribuir reservas primeiro) ou soft-delete (`deletedAt` no `User`) em vez de `Cascade`.

**Por que a porta `5432` e as credenciais `postgres`/`postgres` do `docker-compose.yml` são aceitáveis aqui.**
A porta é necessária nesta rodada porque a aplicação roda fora do container (`npm run start:dev` direto na máquina — decisão explícita, só o Postgres é containerizado); se a aplicação também fosse containerizada, bastaria a rede interna do compose, sem publicar a porta pro host. As credenciais hardcoded são aceitáveis para um banco efêmero de desenvolvimento local, sem dados reais e sem exposição pública — e refletem o YAML sugerido no próprio enunciado. Em um ambiente compartilhado ou de produção, virariam variáveis de ambiente.

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

**Banco isolado**: os testes rodam contra um banco separado (`refeitorio_test`), nunca contra o banco de desenvolvimento — e isso não é só uma convenção, é **verificado no boot da suíte**: `test/setup-env.ts` recusa rodar (lança erro, zero testes executam) se `.env.test` não existir ou se a `DATABASE_URL` carregada não apontar para `refeitorio_test`. Sem essa trava, esquecer o `cp` abaixo faria a suíte cair de volta no `.env` de desenvolvimento — e o `beforeEach` roda `deleteMany()` em todas as tabelas antes de cada teste, o que apagaria dados reais. Configuração:

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

Cada teste zera as tabelas do banco de teste antes de rodar (`beforeEach`) e cria só os dados que precisa — determinístico, não depende de ordem de execução. Confirmado rodando a suíte 3 vezes seguidas com o mesmo resultado (21/21).

## Segurança — vulnerabilidades em dependências (corrigidas via `overrides`)

`npm audit` reportava **9 vulnerabilidades (4 HIGH em produção)**, todas na mesma cadeia:

```
@prisma/client@7.10.0 (produção)
  └── prisma@7.10.0 (peer dependency "*", instalada automaticamente pelo npm)
        ├── @prisma/config → deepmerge-ts   (stack exhaustion em merge de objetos recursivos)
        └── mysql2                          (downgrade de auth plugin vaza credencial em texto claro)
```

mais 5 vindas de `@nestjs/mau` (devDependency do comando `nest deploy`, que não estava sendo
usado — sem nenhum arquivo de configuração do mau no repositório, e deploy está fora do escopo).

**`npm audit fix` não resolve isso diretamente** — o único fix automático que ele oferece é fazer
downgrade pra `prisma@6.19.3`, o que violaria o requisito obrigatório de **Prisma 7.10.0**. A
causa raiz: `prisma@7.10.0` faz **pin exato** de `mysql2@3.15.3` (não é um range `^3.15.3`), então
o resolvedor do `npm audit fix` não enxerga pra onde subir dentro daquela árvore — a única saída
que ele automatiza é trocar o próprio `prisma`.

**A correção real** usa o campo [`overrides`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides)
do `package.json`, que existe exatamente pra sobrescrever pins de dependências transitivas sem
tocar na dependência direta:

```json
"overrides": {
  "mysql2": "3.24.4",
  "deepmerge-ts": "8.0.2"
}
```

mais a remoção de `@nestjs/mau` (não usado). **Resultado verificado**: `npm audit` e
`npm audit --omit=dev` → **0 vulnerabilidades**, com `prisma@7.10.0` e `@prisma/client@7.10.0`
mantidos intactos, `prisma validate`, `prisma generate`, `prisma migrate deploy` e `npm run build`
funcionando normalmente, e a suíte de 21 testes E2E passando (confirmado rodando 3 vezes seguidas).

**Análise de atingibilidade** (vale mesmo com a correção aplicada, como justificativa caso o
`overrides` precise ser revertido no futuro):
- **`mysql2`** (vazamento de credencial via downgrade de auth plugin) — inalcançável nesta
  aplicação. O projeto só instancia `PrismaPg` (driver do PostgreSQL); nunca abre conexão MySQL,
  então o código vulnerável nunca executa. Presente só como dependência transitiva do CLI do
  Prisma.
- **`deepmerge-ts`** (esgotamento de pilha em grafos recursivos) — inalcançável em runtime. Usado
  pelo `@prisma/config` pra mesclar configuração do **CLI** (`migrate`/`generate`), não pelo
  `PrismaClient` em produção. A entrada mesclada não vem de dado controlado por usuário da API.

**Risco residual do `overrides`**: `deepmerge-ts` 7→8 é um bump *major* de uma dependência
transitiva que o Prisma não testou nessa combinação exata. Validado nesta rodada: `prisma
validate`, `prisma generate`, `prisma migrate deploy`/`diff` (inclusive checagem de drift de
schema) e `npm run build` — todos funcionando. As versões em `overrides` são **fixas** (não
`^3.24.4`), de propósito — evita que o npm suba sozinho pra uma versão futura não testada. Se uma
atualização do Prisma quebrar com essa combinação, o `overrides` deve ser removido e a aceitação
de risco documentada acima volta a valer (o risco real continua baixo, pelos dois caminhos
inalcançáveis descritos).
