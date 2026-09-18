import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"],
  },
  migrations: {
    // Prisma 7 não usa mais o bloco "prisma": { "seed": ... } do package.json
    // (padrão antigo) — o seed é configurado aqui. Roda automaticamente após
    // `prisma migrate dev` / `migrate reset`.
    seed: "node prisma/seeds/seed.js",
  },
});
