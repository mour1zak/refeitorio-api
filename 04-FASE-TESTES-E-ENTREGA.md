# FASE 4 — Testes Manuais e Entrega

**Tempo alvo: 30 minutos. Só inicie após o gate da Fase 3 aprovado E testado manualmente pelo menos uma vez.**

## Bateria de testes obrigatórios (todos precisam do resultado real anotado)

Use Swagger (se já tiver, mesmo que não seja parte desta rodada) ou `curl`/Insomnia/Postman. Para cada linha, anote o status code real obtido.

| # | Cenário | Como testar | Esperado |
|---|---|---|---|
| 1 | Login válido | `POST /auth/login` com credenciais corretas | 200/201 + token |
| 2 | Login inválido | senha errada | 401 |
| 3 | Rota protegida sem token | `GET /meal-reservations/my` sem `Authorization` | 401 |
| 4 | Operação sem permissão | `POST /menus` como EMPLOYEE (não ADMIN) | 403 |
| 5 | Recurso inexistente | `POST /menus/99999/reservations` (menu que não existe) | 404 |
| 6 | Body inválido | `POST /menus` com campo obrigatório faltando | 400 |
| 7 | Conflito — regra central | Reservar duas vezes o mesmo período, OU exceder capacidade | 409 |
| 8 | Fluxo principal completo | login → criar menu → reservar → cancelar → listar minhas reservas | sucesso em cada etapa |

**Se qualquer um desses cenários não bater com o esperado, PARE e corrija antes de seguir para entrega — são os cenários que o enunciado exige explicitamente como "testes obrigatórios".**

## README — conteúdo mínimo

1. Descrição curta do projeto
2. Como instalar (`npm install`)
3. Como configurar (copiar `.env.example` para `.env`, preencher)
4. Como rodar (subir Postgres via `docker compose up -d`, `npx prisma migrate dev`, `npm run start:dev`)
5. Lista de endpoints com método, path, quem pode acessar, exemplo de body quando aplicável
6. Decisões técnicas relevantes (ex: por que a checagem de duplicidade/capacidade está dentro de uma `$transaction`)

## Checklist final antes de entregar

- [ ] `npm run build` sem erro
- [ ] `.env.example` existe, sem nenhum segredo real
- [ ] `.env` está no `.gitignore`
- [ ] Nenhuma senha/chave hardcoded no código (busca manual por "password", "secret" fora do `.env`)
- [ ] Os 8 cenários da bateria de testes confirmados com resultado real
- [ ] README completo conforme acima
- [ ] `git log` mostra histórico de commits coerente (não um commit gigante só no final, se der tempo de cuidar disso)

## Gate final — antes de considerar concluído

1. Rode `npm run build` uma última vez, do zero, numa pasta limpa se possível (ou pelo menos confirme que não há erro nem warning bloqueante).
2. Releia a Regra Central do contexto mestre e confirme, com suas próprias palavras, que o código realmente implementa exatamente o que está descrito — não uma versão aproximada.
