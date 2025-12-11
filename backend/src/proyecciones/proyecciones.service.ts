import { Injectable } from '@nestjs/common';
import { SimulateProjectionDto, SimulationResultDto } from './dto/simulate-projection.dto';
import { SimulationService } from './simulation.service';
import { UcnService } from '../ucn/ucn.service';

interface ApiCurso {
  codigo: string;
  asignatura: string;
  creditos?: number;
  nivel?: number;
  prereq?: string;
}

interface ApiAvance {
  nrc?: string;
  period?: string;
  student?: string;
  course: string;
  excluded?: boolean;
  inscriptionType?: string;
  status?: string;
}

@Injectable()
export class ProyeccionesService {
  constructor(
    private readonly ucnService: UcnService,
    private readonly simulationService: SimulationService,
  ) {}

  async simulate(dto: SimulateProjectionDto): Promise<SimulationResultDto> {
    // 1. Fetch malla completa using UcnService
    const mallaData = await this.ucnService.getMalla(dto.codCarrera, dto.catalogo);
    const malla = Array.isArray(mallaData) ? mallaData as ApiCurso[] : [];
    
    // 2. Fetch avance del alumno using UcnService
    const avanceData = await this.ucnService.getAvance(dto.rut, dto.codCarrera);
    const avance = Array.isArray(avanceData) ? avanceData as ApiAvance[] : [];
    
    // 3. Ejecutar simulación
    return this.simulationService.simulate(dto.proyeccionActual, malla, avance);
  }
}
