import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MealPeriod } from '@prisma/client';

export class CreateMenuDto {
  @ApiProperty({ example: '2026-09-20', description: 'Data da refeição'})
  @IsDateString()
  date: string;

  @ApiProperty({ enum: MealPeriod, example: 'LUNCH', description: 'Perido da refeição'})
  @IsEnum(MealPeriod)
  period: MealPeriod;

  @ApiProperty({ example: 'Frango grelhado com arroz', description: 'Descrição do prato'})
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 50, minimum: 1, description: 'Capacidade máxima de vagas'})
  @IsInt()
  @Min(1)
  capacity: number;
}
