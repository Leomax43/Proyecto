import { Controller, Get, Query } from '@nestjs/common';
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

  // 4. Endpoint de Malla
  @Get('malla')
  async getMalla(
    @Query('codigo') codigo: string,
    @Query('catalogo') catalogo: string,
  ) {
    return this.ucnService.getMalla(codigo, catalogo);
  }

  // 5. Endpoint de Avance
  @Get('avance')
  async getAvance(
    @Query('rut') rut: string,
    @Query('codCarrera') codCarrera: string,
  ) {
    return this.ucnService.getAvance(rut, codCarrera);
  }
}