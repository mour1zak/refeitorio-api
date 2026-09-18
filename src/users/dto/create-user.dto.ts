import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'USER', description: 'Nome do usuario' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'user@email.com', description: 'Email do usuario' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '*********', description: 'Senha do usuario' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    example: 'Admin',
    description: 'Role opcional para o usuario',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
