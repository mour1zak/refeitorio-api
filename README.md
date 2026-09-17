# Refeitório Corporativo API

API para gestão de refeições de um refeitório corporativo: administradores publicam cardápios (`Menu`) por data/período com capacidade máxima, e funcionários reservam e cancelam sua refeição, respeitando duas regras centrais — nenhuma reserva duplicada por usuário no mesmo dia/período, e a capacidade do cardápio nunca é excedida.

## Stack

- NestJS + TypeScript (`strict: true`), módulos em CommonJS
- PostgreSQL via Prisma 7.10.0, com driver adapter (`@prisma/adapter-pg`)
- Autenticação JWT (`@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`)
- Validação de entrada com `class-validator`/`class-transformer` (`ValidationPipe` global)

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

5. Para build de produção:
   ```bash
   npm run build
   npm run start:prod
   ```

### Criando o primeiro usuário

O escopo mínimo desta avaliação **não inclui** um endpoint de cadastro de usuário (não consta na lista de endpoints exigidos). Para testar a API, insira usuários diretamente no banco com uma senha já hasheada em bcrypt, por exemplo:

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
| `GET` | `/menus` | Qualquer autenticado | — |
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
Sob o isolamento padrão do Postgres (`READ COMMITTED`), duas transações concorrentes ainda podem, em teoria, passar pela leitura de "existe reserva ativa?" antes de qualquer uma commitar o `INSERT`. Quem realmente impede a duplicata nesse cenário é o índice único em `activeSlotKey`: a segunda transação recebe uma violação de constraint (`P2002`) no momento do commit, e o `ReservationsService` mapeia isso para `409` num `try/catch` em volta da transação. A checagem de capacidade (`tx.mealReservation.count(...) >= menu.capacity`) não tem esse mesmo backstop no schema — é uma limitação conhecida e aceita nesta rodada (exigiria lock explícito ou isolamento `SERIALIZABLE`, fora do escopo pedido).

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

## Fora do escopo desta rodada

Paginação, filtros, Swagger, seed automatizado, testes automatizados (unitários/E2E), Docker da aplicação, CI/CD.
