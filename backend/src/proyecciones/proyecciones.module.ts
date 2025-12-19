import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // <--- IMPORTANTE
import { ProyeccionesController } from './proyecciones.controller';
import { ProyeccionesService } from './proyecciones.service';
import { SimulationService } from './simulation.service';
import { UcnModule } from '../ucn/ucn.module';
import { Projection } from './entities/projection.entity'; // <--- IMPORTANTE

@Module({
  imports: [
    UcnModule,
    TypeOrmModule.forFeature([Projection]), // <--- ESTO FALTABA
  ],
  controllers: [ProyeccionesController],
  providers: [ProyeccionesService, SimulationService],
  exports: [ProyeccionesService],
})
export class ProyeccionesModule {}