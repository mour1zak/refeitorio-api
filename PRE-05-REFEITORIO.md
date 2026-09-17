# Pré-Avaliação --- Refeitório Corporativo

## Contexto e objetivo

Implemente uma API REST para **Refeitório Corporativo**. A pré-avaliação
tem duração de **1 dia** e deve demonstrar capacidade de interpretar
requisitos, modelar o banco, estruturar uma aplicação NestJS e entregar
um fluxo funcional com autenticação, autorização, validação e regras de
negócio.

## Stack obrigatória

-   NestJS + TypeScript
-   PostgreSQL
-   Prisma **7.10.0**, com `prisma.config.ts`, driver adapter e
    migrations
-   DTOs + `class-validator` + `ValidationPipe`
-   JWT
-   variáveis de ambiente
-   build funcionando com `npm run build`

## Perfis

EMPLOYEE reserva/cancela; ADMIN administra cardápios.

## Entidades mínimas

User, Menu, MealReservation.

Defina campos, chaves, constraints e relacionamentos coerentes. Campos
sensíveis não devem ser retornados pela API.

## Endpoints mínimos

POST /auth/login - POST/GET /menus - POST /menus/:id/reservations -
PATCH /meal-reservations/:id/cancel - GET /meal-reservations/my

O aluno pode ajustar nomes mantendo comportamento REST consistente.

## Regra central

Usuário não pode reservar duas refeições do mesmo período/data;
capacidade do cardápio não pode ser excedida.

## Requisitos gerais

-   usuário autenticado deve ser identificado pelo contexto da
    requisição, sem confiar em `userId` enviado pelo cliente quando a
    operação for pessoal;
-   Controllers tratam HTTP; Services concentram regras de negócio;
-   validar existência de recursos relacionados;
-   validar tipos, campos obrigatórios e valores;
-   proteger operações administrativas;
-   usar `400`, `401`, `403`, `404` e `409` conforme o significado do
    erro;
-   testar pelo menos um cenário positivo e um negativo para a regra
    central.

## Testes obrigatórios

-   login válido e inválido;
-   rota protegida sem token → `401`;
-   operação sem permissão → `403`;
-   recurso inexistente → `404`;
-   body inválido → `400`;
-   conflito da regra principal → `409`;
-   fluxo principal completo → sucesso.

## Entregáveis

-   código-fonte;
-   schema e migrations;
-   `.env.example` sem segredos;
-   README com instalação, configuração, execução e endpoints;
-   `npm run build` sem erros.

## Bônus

Somente após concluir o obrigatório: paginação, filtros, Swagger, seed
ou testes automatizados.
