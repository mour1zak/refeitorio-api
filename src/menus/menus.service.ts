import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';

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

  findAll() {
    return this.prisma.menu.findMany({
      orderBy: [{ date: 'asc' }, { period: 'asc' }],
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
  }
}
