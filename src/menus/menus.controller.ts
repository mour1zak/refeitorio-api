import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateMenuDto } from './dto/create-menu.dto';
import { FindMenusDto } from './dto/find-menus.dto';
import { MenusService } from './menus.service';


@ApiTags('Menus')
@ApiBearerAuth()
@Controller('menus')
@UseGuards(JwtAuthGuard)
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cria um novo cardápio (Apenas Admin)'})
  @ApiResponse({ status: 201, description: 'Cardápio criado.'})
  @ApiResponse({ status: 400, description: 'Body inválido (campo obrigatório faltando ou tipo incorreto).'})
  @ApiResponse({ status: 401, description: 'Não Autenticado.'})
  @ApiResponse({ status: 403, description: 'Usuário nao é ADMIN.'})
  @ApiResponse({ status: 409, description: 'Já existe um cardápio para esta data e período'})
  create(@Body() dto: CreateMenuDto) {
    return this.menusService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista cardápios, com paginação e filtros opcionais' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'date', required: false, example: '2026-09-20' })
  @ApiQuery({ name: 'period', required: false, enum: ['BREAKFAST', 'LUNCH', 'DINNER'] })
  @ApiResponse({ status: 200, description: 'Lista paginada de cardápios.' })
  @ApiResponse({ status: 400, description: 'Query param inválido.' })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  findAll(@Query() query: FindMenusDto) {
    return this.menusService.findAll(query);
  }
}
