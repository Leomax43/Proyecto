import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm'; // <--- Importar
import { Repository } from 'typeorm';             // <--- Importar
import { SimulateProjectionDto, SimulationResultDto, ProyeccionDto } from './dto/simulate-projection.dto';
import { SimulationService } from './simulation.service';
import { UcnService } from '../ucn/ucn.service';
import { Projection } from './entities/projection.entity'; // <--- Importar Entidad

// (Interfaces ApiCurso y ApiAvance se mantienen igual...)
interface ApiCurso { codigo: string; asignatura: string; creditos?: number; nivel?: number; prereq?: string; }
interface ApiAvance { nrc?: string; period?: string; student?: string; course: string; excluded?: boolean; inscriptionType?: string; status?: string; }

@Injectable()
export class ProyeccionesService {
  constructor(
    private readonly ucnService: UcnService,
    private readonly simulationService: SimulationService,
    // INYECTAR EL REPOSITORIO (La conexión a la tabla)
    @InjectRepository(Projection)
    private readonly projectionRepo: Repository<Projection>,
  ) {}

  // 1. SIMULAR (Ya lo tenías, se queda igual)
  async simulate(dto: SimulateProjectionDto): Promise<SimulationResultDto> {
    const mallaData = await this.ucnService.getMalla(dto.codCarrera, dto.catalogo);
    const malla = Array.isArray(mallaData) ? mallaData as ApiCurso[] : [];
    
    const avanceData = await this.ucnService.getAvance(dto.rut, dto.codCarrera);
    const avance = Array.isArray(avanceData) ? avanceData as ApiAvance[] : [];
    
    return this.simulationService.simulate(dto.proyeccionActual, malla, avance);
  }

  // 2. NUEVO: GUARDAR PROYECCIÓN
  async create(dto: SimulateProjectionDto): Promise<Projection> {
    // Creamos la entidad con los datos del DTO
    const newProjection = this.projectionRepo.create({
      rut: dto.rut,
      codCarrera: dto.codCarrera,
      catalogo: dto.catalogo,
      title: dto.proyeccionActual.title,
      years: dto.proyeccionActual.years, // Guardamos el JSON de años
    });
    
    return await this.projectionRepo.save(newProjection);
  }

  // 3. NUEVO: OBTENER PROYECCIONES POR RUT
  async findAllByRut(rut: string): Promise<Projection[]> {
    return await this.projectionRepo.find({
      where: { rut },
      order: { createdAt: 'DESC' } // Las más nuevas primero
    });
  }

  // 4. NUEVO: ELIMINAR
  async remove(id: string) {
    return await this.projectionRepo.delete(id);
  }



  // 5. NUEVO: ACTUALIZAR UNA PROYECCIÓN EXISTENTE
  async update(id: string, dto: SimulateProjectionDto) {
    return await this.projectionRepo.update(id, {
      title: dto.proyeccionActual.title,
      years: dto.proyeccionActual.years,
      // Actualizamos también el catálogo por si cambió
      catalogo: dto.catalogo, 
    });
  }
}