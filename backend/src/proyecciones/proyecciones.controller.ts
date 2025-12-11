import { Controller, Post, Body } from '@nestjs/common';
import { ProyeccionesService } from './proyecciones.service';
import { SimulateProjectionDto, SimulationResultDto } from './dto/simulate-projection.dto';

@Controller('proyecciones')
export class ProyeccionesController {
  constructor(private readonly proyeccionesService: ProyeccionesService) {}

  @Post('simulate')
  async simulate(@Body() dto: SimulateProjectionDto): Promise<SimulationResultDto> {
    return this.proyeccionesService.simulate(dto);
  }
}
