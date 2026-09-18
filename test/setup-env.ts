import { config } from 'dotenv';

// Garante que a suíte E2E nunca toca no banco de desenvolvimento — sobrescreve
// qualquer DATABASE_URL já carregada com a do banco de teste isolado.
config({ path: '.env.test', override: true });
