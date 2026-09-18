import { config } from 'dotenv';

// Garante que a suíte E2E nunca toca no banco de desenvolvimento. `dotenv.config()`
// NÃO lança quando o arquivo não existe — só retorna `{ error }` e segue em silêncio,
// deixando o ConfigModule do Nest carregar o `.env` de desenvolvimento na sequência.
// Como o beforeEach roda `deleteMany()` em todas as tabelas, isso apagaria dados reais.
// Por isso falhamos rápido aqui em vez de confiar que o arquivo existe.
const result = config({ path: '.env.test', override: true });

if (result.error) {
  throw new Error(
    '.env.test não encontrado. Rode `cp .env.test.example .env.test` e preencha antes ' +
      'de rodar os testes E2E — a suíte apaga TODAS as tabelas antes de cada teste e ' +
      'não pode rodar contra o banco de desenvolvimento.',
  );
}

const url = process.env.DATABASE_URL ?? '';
if (!url.includes('refeitorio_test')) {
  const safe = url.replace(/:[^:@/]*@/, ':***@');
  throw new Error(
    `DATABASE_URL de teste não aponta para o banco de teste (recebido: ${safe}). ` +
      'Recusando executar para não apagar dados de desenvolvimento.',
  );
}
