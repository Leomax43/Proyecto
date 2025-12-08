import { Module } from '@nestjs/common';
import { ProyeccionesController } from './proyecciones.controller';
import { ProyeccionesService } from './proyecciones.service';
import { SimulationService } from './simulation.service';
import { HttpModule } from '@nestjs/axios';
import { UcnModule } from '../ucn/ucn.module';

@Module({
  imports: [HttpModule, UcnModule],
  controllers: [ProyeccionesController],
  providers: [ProyeccionesService, SimulationService],
  exports: [ProyeccionesService],
})
export class ProyeccionesModule {}
