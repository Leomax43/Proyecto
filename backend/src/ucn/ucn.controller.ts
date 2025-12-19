import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
// 1. Importamos el SERVICIO
import { UcnService } from './ucn.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ImportMallaDto } from './dto/import-malla.dto';
import { ImportAvanceDto } from './dto/import-avance.dto';
import { RemoteMigrateDto } from './dto/remote-migrate.dto';
import { UpdateCourseEquivalencesDto } from './dto/update-course-equivalences.dto';

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

  @Post('local/users')
  async createUser(@Body() dto: CreateUserDto) {
    return this.ucnService.createUser(dto);
  }

  @Post('local/malla')
  async importMalla(@Body() dto: ImportMallaDto) {
    return this.ucnService.importMalla(dto);
  }

  @Post('local/malla/equivalencias')
  async updateCourseEquivalences(@Body() dto: UpdateCourseEquivalencesDto) {
    return this.ucnService.updateCourseEquivalences(dto);
  }

  @Post('local/equivalencias/advancement')
  async importEquivalencesFromAdvancement(@Body() payload: unknown) {
    return this.ucnService.importEquivalencesFromAdvancement(payload);
  }

  @Post('local/avance')
  async importAvance(@Body() dto: ImportAvanceDto) {
    return this.ucnService.importAvance(dto);
  }

  @Post('local/migrate')
  async migrateFromRemote(@Body() dto: RemoteMigrateDto) {
    return this.ucnService.migrateFromRemote(dto);
  }
}