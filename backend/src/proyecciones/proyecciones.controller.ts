import { Controller, Post, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { ProyeccionesService } from './proyecciones.service';
import { SimulateProjectionDto, SimulationResultDto } from './dto/simulate-projection.dto';

@Controller('proyecciones')
export class ProyeccionesController {
  constructor(private readonly proyeccionesService: ProyeccionesService) {}

  @Post('simulate')
  async simulate(@Body() dto: SimulateProjectionDto): Promise<SimulationResultDto> {
    return this.proyeccionesService.simulate(dto);
  }

  // --- RUTAS DE BASE DE DATOS (RESTAURADAS) ---

  @Post()
  async create(@Body() dto: SimulateProjectionDto) {
    return this.proyeccionesService.create(dto);
  }

  @Get('user/:rut')
  async findAll(@Param('rut') rut: string) {
    return this.proyeccionesService.findAllByRut(rut);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: SimulateProjectionDto) {
    return this.proyeccionesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.proyeccionesService.remove(id);
  }
}