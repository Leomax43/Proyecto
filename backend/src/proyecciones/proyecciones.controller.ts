import { Controller, Post, Get, Delete, Body, Param, Put } from '@nestjs/common'; // <--- Agregar imports
import { ProyeccionesService } from './proyecciones.service';
import { SimulateProjectionDto, SimulationResultDto } from './dto/simulate-projection.dto';

@Controller('proyecciones')
export class ProyeccionesController {
  constructor(private readonly proyeccionesService: ProyeccionesService) {}

  // Este ya lo tenías: Calcula sin guardar
  @Post('simulate')
  async simulate(@Body() dto: SimulateProjectionDto): Promise<SimulationResultDto> {
    return this.proyeccionesService.simulate(dto);
  }

  // NUEVO: Guardar en BD
  @Post()
  async create(@Body() dto: SimulateProjectionDto) {
    return this.proyeccionesService.create(dto);
  }

  // NUEVO: Obtener todas las de un usuario
  @Get('user/:rut')
  async findAll(@Param('rut') rut: string) {
    return this.proyeccionesService.findAllByRut(rut);
  }

  // NUEVO: Eliminar una proyección
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.proyeccionesService.remove(id);



  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: SimulateProjectionDto) {
    return this.proyeccionesService.update(id, dto);
  }
  
}