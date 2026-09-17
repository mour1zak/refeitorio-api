# FASE 2 — Infraestrutura e Configuração

**Tempo alvo: 15 minutos. Só inicie após o gate da Fase 1 aprovado.**

## O que fazer

1. Criar `docker-compose.yml` **só com o serviço PostgreSQL** (não containerizar a aplicação nesta rodada — ela vai rodar via `npm run start:dev` direto na máquina, é mais rápido para o tempo disponível):
```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: refeitorio
    ports:
      - '5432:5432'
    volumes:
      - refeitorio_pgdata:/var/lib/postgresql/data
volumes:
  refeitorio_pgdata:
```
2. Criar `.env` (local, não versionado) e `.env.example` (versionado, sem valores reais) com: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`
3. Configurar `ConfigModule.forRoot({ isGlobal: true })` no `AppModule`
4. Criar `src/prisma/prisma.service.ts` seguindo o padrão Prisma 7 com driver adapter (`PrismaPg`), conectando/desconectando via `onModuleInit`/`onModuleDestroy`
5. Criar `src/prisma/prisma.module.ts`, exportando `PrismaService` (não `@Global()` — cada módulo que precisar importa explicitamente)
6. Configurar `main.ts`: `ValidationPipe({ whitelist: true, transform: true })` global
7. Subir o Postgres (`docker compose up -d`) e rodar a primeira migration (`npx prisma migrate dev --name init`)
8. Rodar `npx prisma generate`

## Gate de revisão — PARE AQUI

1. Onde exatamente a `DATABASE_URL` é lida — no schema, no `prisma.config.ts`, ou nos dois? Por quê?
2. O `docker-compose.yml` expõe alguma porta ou credencial desnecessária para este cenário de avaliação local?
3. Se eu esquecer de rodar `prisma generate` depois de um `git clone` novo, o que quebra, e em que momento (build ou runtime)?

## Critério de saída

- `docker compose ps` mostra o Postgres `healthy`
- Migration inicial aplicada, tabelas visíveis via `npx prisma studio` ou `psql`
- `npm run build` continua passando
- Gate respondido e aprovado
