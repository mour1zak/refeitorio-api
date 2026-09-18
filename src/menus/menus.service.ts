import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { FindMenusDto } from './dto/find-menus.dto';

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMenuDto) {
    try {
      return await this.prisma.menu.create({
        data: {
          date: new Date(dto.date),
          period: dto.period,
          description: dto.description,
          capacity: dto.capacity,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Já existe um cardápio para esta data e período');
      }
      throw error;
    }
  }

  async findAll(query: FindMenusDto) {
    const { page, limit, date, period } = query;

    const where: Prisma.MenuWhereInput = {
      ...(date && { date: new Date(date) }),
      ...(period && { period }),
    };

    const [data, total] = await Promise.all([
      this.prisma.menu.findMany({
        where,
        orderBy: [{ date: 'asc' }, { period: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.menu.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
  }
}
