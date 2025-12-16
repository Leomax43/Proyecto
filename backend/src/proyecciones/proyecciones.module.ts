import { Module } from '@nestjs/common';
import { ProyeccionesController } from './proyecciones.controller';
import { ProyeccionesService } from './proyecciones.service';
import { SimulationService } from './simulation.service';
import { HttpModule } from '@nestjs/axios';
import { UcnModule } from '../ucn/ucn.module';
import { TypeOrmModule } from '@nestjs/typeorm'; 
import { Projection } from './entities/projection.entity'; 

@Module({
  imports: [HttpModule, UcnModule,TypeOrmModule.forFeature([Projection])],
  controllers: [ProyeccionesController],
  providers: [ProyeccionesService, SimulationService],
  exports: [ProyeccionesService],
})
export class ProyeccionesModule {}
