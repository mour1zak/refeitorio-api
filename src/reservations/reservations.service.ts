import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MealPeriod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(menuId: number, userId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Existência do menu, duplicidade e capacidade sempre via `tx` — nunca
        // `this.prisma` aqui dentro, senão as três operações deixam de ser atômicas.
        //
        // `SELECT ... FOR UPDATE` trava a linha do Menu até esta transação commitar
        // ou dar rollback. Sem isso, sob READ COMMITTED, duas transações concorrentes
        // de usuários DIFERENTES podem contar a mesma vaga livre e ambas passarem —
        // o activeSlotKey não ajuda aqui porque só protege duplicidade do MESMO
        // usuário (chaves diferentes não colidem no índice único). Com o lock, a
        // segunda transação espera a primeira commitar antes de contar as reservas
        // ativas, e aí já enxerga a reserva recém-criada pela primeira.
        await tx.$queryRaw`SELECT id FROM menus WHERE id = ${menuId} FOR UPDATE`;

        const menu = await tx.menu.findUnique({ where: { id: menuId } });
        if (!menu) {
          throw new NotFoundException('Menu não encontrado');
        }

        const activeSlotKey = this.buildActiveSlotKey(userId, menu.date, menu.period);

        const duplicada = await tx.mealReservation.findUnique({
          where: { activeSlotKey },
        });
        if (duplicada) {
          throw new ConflictException('Usuário já possui reserva ativa neste período');
        }

        const totalReservado = await tx.mealReservation.count({
          where: { menuId, status: 'ACTIVE' },
        });
        if (totalReservado >= menu.capacity) {
          throw new ConflictException('Capacidade do cardápio excedida');
        }

        return tx.mealReservation.create({
          data: {
            userId,
            menuId,
            date: menu.date,
            period: menu.period,
            status: 'ACTIVE',
            activeSlotKey,
          },
        });
      });
    } catch (error) {
      // Rede de segurança: se duas transações concorrentes passarem pela
      // checagem de duplicidade antes de qualquer uma commitar, o unique
      // index em activeSlotKey rejeita o segundo INSERT com P2002.
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Usuário já possui reserva ativa neste período');
      }
      throw error;
    }
  }

  async cancel(id: number, userId: number) {
    const reservation = await this.ensureOwner(id, userId);

    if (reservation.status === 'CANCELLED') {
      throw new ConflictException('Reserva já está cancelada');
    }

    const updated = await this.prisma.mealReservation.update({
      where: { id },
      data: { status: 'CANCELLED', activeSlotKey: null, cancelledAt: new Date() },
    });

    return { cancelled: true, reservation: updated };
  }

  findMyReservations(userId: number) {
    return this.prisma.mealReservation.findMany({
      where: { userId },
      orderBy: [{ date: 'desc' }, { period: 'asc' }],
    });
  }

  private async ensureExists(id: number) {
    const reservation = await this.prisma.mealReservation.findUnique({ where: { id } });
    if (!reservation) {
      throw new NotFoundException('Reserva não encontrada');
    }
    return reservation;
  }

  private async ensureOwner(id: number, userId: number) {
    const reservation = await this.ensureExists(id);
    if (reservation.userId !== userId) {
      throw new ForbiddenException('Você não tem permissão sobre esta reserva');
    }
    return reservation;
  }

  private buildActiveSlotKey(userId: number, date: Date, period: MealPeriod): string {
    return `${userId}:${date.toISOString()}:${period}`;
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
  }
}
