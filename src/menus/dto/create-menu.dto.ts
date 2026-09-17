import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { MealPeriod } from '@prisma/client';

export class CreateMenuDto {
  @IsDateString()
  date: string;

  @IsEnum(MealPeriod)
  period: MealPeriod;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @Min(1)
  capacity: number;
}
