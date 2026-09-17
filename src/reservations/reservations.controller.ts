import { Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReservationsService } from './reservations.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post('menus/:id/reservations')
  @UseGuards(RolesGuard)
  @Roles(Role.EMPLOYEE)
  create(@Param('id', ParseIntPipe) menuId: number, @CurrentUser('id') userId: number) {
    return this.reservationsService.create(menuId, userId);
  }

  @Patch('meal-reservations/:id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.reservationsService.cancel(id, userId);
  }

  @Get('meal-reservations/my')
  findMy(@CurrentUser('id') userId: number) {
    return this.reservationsService.findMyReservations(userId);
  }
}
