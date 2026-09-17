import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({example: 'usuario@email.com', description:'Email de login'})
  @IsEmail()
  email: string;

  @ApiProperty({example: '*********', description: 'Senha de login'})
  @IsString()
  @MinLength(6)
  password: string;
}
