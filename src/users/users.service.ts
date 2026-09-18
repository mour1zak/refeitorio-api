import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          role: dto.role,
        },
        select: SAFE_USER_SELECT,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw error;
    }
  }

  // Usado só pelo AuthService para comparar o hash — nunca exposto por um controller.
  findByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { ...SAFE_USER_SELECT, password: true },
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
