/*
  Warnings:

  - Added the required column `updatedAt` to the `menus` table. Linhas existentes recebem
    o timestamp atual como backfill (`DEFAULT CURRENT_TIMESTAMP`), igual ao padrão já usado
    em `createdAt`. Dali em diante, o Prisma Client define o valor a cada update (`@updatedAt`).
  - Added the required column `updatedAt` to the `users` table. Mesmo backfill acima.

*/
-- AlterTable
ALTER TABLE "menus" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
