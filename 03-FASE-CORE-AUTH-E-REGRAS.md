# FASE 3 — Núcleo: Auth, Menus, Reservations

**Tempo alvo: 90 minutos — a fase mais longa e mais importante. Só inicie após o gate da Fase 2 aprovado.**

## Parte A — Auth (≈25 min)

1. `UsersService.create()` — hash de senha com `bcryptjs`, `select` explícito nunca incluindo `password`
2. `AuthService.validateUser(email, password)` — busca por email, compara hash
3. `AuthService.login()` — assina JWT com payload `{ sub: user.id, email: user.email, role: user.role }`
4. `JwtStrategy` — valida o token, popula `request.user`
5. `JwtAuthGuard` — `AuthGuard('jwt')`
6. `RolesGuard` + decorator `@Roles(Role.ADMIN)` — para proteger rotas administrativas
7. Decorator `@CurrentUser()` — extrai `request.user`, opcionalmente um campo específico (`@CurrentUser('id')`)
8. `POST /auth/login` no Controller

## Parte B — Menus (≈15 min)

1. DTO `CreateMenuDto` com `class-validator` (data, período, capacidade — todos validados)
2. `MenusService.create()` — só ADMIN (Guard no Controller)
3. `MenusService.findAll()` — qualquer autenticado
4. `MenusController` com as rotas do contexto mestre

## Parte C — Reservations, a regra central (≈40 min — não apresse esta parte)

Este é o Service mais importante da avaliação. Estrutura obrigatória:

```typescript
async create(menuId: number, userId: number) {
  return this.prisma.$transaction(async (tx) => {
    const menu = await tx.menu.findUnique({ where: { id: menuId } });
    if (!menu) throw new NotFoundException('Menu não encontrado');

    // conta reservas ativas do MESMO período/data do usuário
    const duplicada = await tx.mealReservation.findFirst({
      where: { userId, /* condição de mesmo período/data, status ACTIVE */ },
    });
    if (duplicada) throw new ConflictException('Usuário já possui reserva neste período');

    const totalReservado = await tx.mealReservation.count({
      where: { menuId, status: 'ACTIVE' },
    });
    if (totalReservado >= menu.capacity) {
      throw new ConflictException('Capacidade do cardápio excedida');
    }

    return tx.mealReservation.create({
      data: { userId, menuId, status: 'ACTIVE' },
    });
  });
}
```

**Ponto crítico**: as duas checagens (duplicidade, capacidade) e o `create` PRECISAM estar dentro do mesmo `$transaction`, usando o `tx` passado no callback — nunca `this.prisma` direto dentro do bloco. Se qualquer uma das três operações usar `this.prisma` em vez de `tx`, a atomicidade se quebra.

1. `ReservationsService.cancel(id, userId)` — usa o padrão `ensureExists` + `ensureOwner` (mesma lógica: buscar, checar existência, checar `reservation.userId === userId`, senão `ForbiddenException`)
2. `ReservationsService.findMyReservations(userId)`
3. Global Exception Filter (opcional, só se sobrar tempo dentro da fase) — mapeando `P2002` do Prisma para `409`, caso alguma constraint de banco seja violada fora do fluxo já tratado acima
4. `ReservationsController` com as rotas do contexto mestre — `userId` SEMPRE via `@CurrentUser()`, nunca do body

## Gate de revisão — PARE AQUI

1. Mostre o trecho exato onde a checagem de duplicidade e a criação da reserva estão no mesmo bloco de transação. Se dois requests chegassem no mesmo milissegundo, o que impede os dois de passarem pela checagem antes de qualquer um criar a reserva?
2. Como o `ReservationsController` garante que o `userId` do cancelamento vem do token, nunca do body ou de um parâmetro de rota manipulável?
3. Existe algum caminho no código onde uma operação de reserva usa `this.prisma` em vez do `tx` da transação, quebrando a atomicidade?

## Critério de saída

- Fluxo completo funcional localmente (login → criar menu como ADMIN → reservar como EMPLOYEE → cancelar)
- `npm run build` sem erro
- Gate respondido e aprovado — **não avance para a Fase 4 sem confirmar isso na prática, testando manualmente pelo menos uma vez**
