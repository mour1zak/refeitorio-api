import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReservationsService } from './reservations.service';

@ApiTags('Reservas')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post('menus/:id/reservations')
  @UseGuards(RolesGuard)
  @Roles(Role.EMPLOYEE)
  @ApiOperation({
    summary: 'Reserva uma refeição de um cardápio (Apenas EMPLOYEE)',
  })
  @ApiResponse({ status: 201, description: 'Reserva criada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Parâmetro de rota invalido.' })
  @ApiResponse({ status: 401, description: 'Não Autenticado.' })
  @ApiResponse({ status: 403, description: 'Usuario não é EMPLOYEE.' })
  @ApiResponse({ status: 404, description: 'Menu não encontrado.' })
  @ApiResponse({
    status: 409,
    description:
      'Reserva duplicada no periodo ou capacidade do cardápio excedida',
  })
  create(
    @Param('id', ParseIntPipe) menuId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.reservationsService.create(menuId, userId);
  }

  @Patch('meal-reservations/:id/cancel')
  @ApiOperation({ summary: 'Cancela uma reserva (apenas o dono)' })
  @ApiResponse({ status: 200, description: 'Reserva cancelada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Parâmetro de rota invalido.' })
  @ApiResponse({ status: 401, description: 'Não Autenticado.' })
  @ApiResponse({
    status: 403,
    description: 'Reserva não pertence ao usuário autenticado.',
  })
  @ApiResponse({ status: 404, description: 'Reserva não encontrada.' })
  @ApiResponse({ status: 409, description: 'Reserva já está cancelada' })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.reservationsService.cancel(id, userId);
  }

  @Get('meal-reservations/my')
  @ApiOperation({ summary: 'Lista as reservas do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de reservas do usuário' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  findMy(@CurrentUser('id') userId: number) {
    return this.reservationsService.findMyReservations(userId);
  }
}
