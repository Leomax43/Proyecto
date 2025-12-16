import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SimulateProjectionDto, SimulationResultDto } from './dto/simulate-projection.dto';
import { SimulationService } from './simulation.service';
import { UcnService } from '../ucn/ucn.service';
import { Projection } from './entities/projection.entity';

// Interfaces locales
interface ApiCurso { codigo: string; asignatura: string; creditos?: number; nivel?: number; prereq?: string; }
interface ApiAvance { nrc?: string; period?: string; student?: string; course: string; excluded?: boolean; inscriptionType?: string; status?: string; }

@Injectable()
export class ProyeccionesService {
  constructor(
    private readonly ucnService: UcnService,
    private readonly simulationService: SimulationService,
    // Inyectamos el repositorio para poder guardar
    @InjectRepository(Projection)
    private readonly projectionRepo: Repository<Projection>,
  ) {}

  // 1. SIMULAR (Ya lo tenías)
  async simulate(dto: SimulateProjectionDto): Promise<SimulationResultDto> {
    const mallaData = await this.ucnService.getMalla(dto.codCarrera, dto.catalogo);
    const malla = Array.isArray(mallaData) ? mallaData as ApiCurso[] : [];
    
    const avanceData = await this.ucnService.getAvance(dto.rut, dto.codCarrera);
    const avance = Array.isArray(avanceData) ? avanceData as ApiAvance[] : [];
    
    return this.simulationService.simulate(dto.proyeccionActual, malla, avance, dto.preferences);
  }

  // --- MÉTODOS DE BASE DE DATOS (RESTAURADOS) ---

  // 2. CREAR
  async create(dto: SimulateProjectionDto): Promise<Projection> {
    const newProjection = this.projectionRepo.create({
      rut: dto.rut,
      codCarrera: dto.codCarrera,
      catalogo: dto.catalogo,
      title: dto.proyeccionActual.title,
      years: dto.proyeccionActual.years, // Guardamos el JSON
    });
    return await this.projectionRepo.save(newProjection);
  }

  // 3. OBTENER TODAS POR USUARIO
  async findAllByRut(rut: string): Promise<Projection[]> {
    return await this.projectionRepo.find({
      where: { rut },
      order: { createdAt: 'DESC' }
    });
  }

  // 4. ACTUALIZAR
  async update(id: string, dto: SimulateProjectionDto) {
    return await this.projectionRepo.update(id, {
      title: dto.proyeccionActual.title,
      years: dto.proyeccionActual.years,
      catalogo: dto.catalogo,
    });
  }

  // 5. ELIMINAR
  async remove(id: string) {
    return await this.projectionRepo.delete(id);
  }
}