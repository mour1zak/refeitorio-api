import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MealPeriod } from '@prisma/client';

export class FindMenusDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, description: 'Página (1-indexed)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 100, description: 'Itens por página (máx. 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({ example: '2026-09-20', description: 'Filtra cardápios por data' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: MealPeriod, example: 'LUNCH', description: 'Filtra cardápios por período' })
  @IsOptional()
  @IsEnum(MealPeriod)
  period?: MealPeriod;
}
