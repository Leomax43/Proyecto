import { Controller, Get, Query, Param } from '@nestjs/common';
// 1. Importamos el SERVICIO
import { UcnService } from './ucn.service';

@Controller('ucn')
//
// --- SOLUCIÓN 2: Asegúrate de que 'export' esté aquí ---
//
export class UcnController {
  
  // 3. Inyectamos UcnService
  constructor(private readonly ucnService: UcnService) {}

  @Get('login')
  async login(
    @Query('email') email: string,
    @Query('password') password: string,
  ) {
    return this.ucnService.login(email, password);
  }

  // 6. Endpoint de Malla Formateada (estructura por semestres) - DEBE IR PRIMERO
  @Get('malla/:codigo/:catalogo/formatted')
  async getMallaFormatted(
    @Param('codigo') codigo: string,
    @Param('catalogo') catalogo: string,
    @Query('rut') rut?: string,
  ) {
    return this.ucnService.getMallaFormatted(codigo, catalogo, rut);
  }

  // 4. Endpoint de Malla (genérico)
  @Get('malla')
  async getMalla(
    @Query('codigo') codigo: string,
    @Query('catalogo') catalogo: string,
  ) {
    return this.ucnService.getMalla(codigo, catalogo);
  }

  // 7. Endpoint de Avance Resumen - DEBE IR PRIMERO
  @Get('avance/:rut/summary')
  async getAvanceSummary(
    @Param('rut') rut: string,
    @Query('carreras') carrerasJson?: string,
  ) {
    return this.ucnService.getAvanceSummary(rut, carrerasJson);
  }

  // 5. Endpoint de Avance (genérico)
  @Get('avance')
  async getAvance(
    @Query('rut') rut: string,
    @Query('codCarrera') codCarrera: string,
  ) {
    return this.ucnService.getAvance(rut, codCarrera);
  }
}