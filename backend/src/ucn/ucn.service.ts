import { Injectable } from '@nestjs/common';
// 1. Importa HttpService y firstValueFrom
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MallaFormattedDto, SemestreDto, CursoDto } from './dto/malla-formatted.dto';
import { AvanceSummaryDto, CarreraAvanceDto, PeriodoDto, CursoAvanceDto } from './dto/avance-summary.dto';

// La interfaz sigue igual
export interface UcnLoginResponse {
  rut: string;
  carreras: any[];
  error?: string;
  rol?: string;
  nombre?: string;
}

@Injectable()
export class UcnService {

  // 2. Inyecta el HttpService de NestJS
  constructor(private readonly httpService: HttpService) {}

  // 🔹 1. LOGIN
  async login(email: string, password: string) {
    const url = `https://puclaro.ucn.cl/eross/avance/login.php?email=${email}&password=${password}`;

    try {
      // 3. Usa la sintaxis de HttpService
      // Axios (lo que usa HttpService) pone la respuesta en response.data
      const response = await firstValueFrom(this.httpService.get(url));
      const data: UcnLoginResponse = response.data;

      if (!data.error) {
        data.rol = 'estudiante';

        const nameCandidates = [
          data.nombre,
          (response.data as any).name,
          (response.data as any).nombres,
          (response.data as any).student,
          (response.data as any).alumno,
          (response.data as any).usuario,
        ];
        data.nombre = nameCandidates.find((value) => typeof value === 'string' && value.trim())?.trim();

        if (Array.isArray(data.carreras)) {
          data.carreras = data.carreras.map((carrera: any) => {
            const codigo = [carrera.codigo, carrera.codCarrera, carrera.id]
              .find((value) => typeof value === 'string' && value.trim());
            const catalogo = [carrera.catalogo, carrera.plan, carrera.codPlan]
              .find((value) => typeof value === 'string' && value.trim());
            const nombreCarrera = [carrera.nombre, carrera.carrera, carrera.descripcion]
              .find((value) => typeof value === 'string' && value.trim());

            return {
              ...carrera,
              codigo: codigo ? codigo.trim() : carrera.codigo,
              catalogo: catalogo ? catalogo.trim() : carrera.catalogo,
              nombre: nombreCarrera ? nombreCarrera.trim() : carrera.nombre,
            };
          });
        }
      }
      return data;
    } catch (error) {
      console.error('Error en servicio de Login UCN:', error.message);
      return { error: 'No se pudo conectar al servicio externo de Login' };
    }
  }

  // 🔹 2. MALLA (¡Aquí está el cambio clave!)
  async getMalla(codigo: string, catalogo: string) {
    const url = `https://losvilos.ucn.cl/hawaii/api/mallas?${codigo}-${catalogo}`;
    
    // 4. Así es como Axios envía headers, en un objeto 'config'
    const config = {
      headers: {
        'X-HAWAII-AUTH': 'jf400fejof13f'
      }
    };

    try {
      // 5. Pasamos la URL y la config con los headers
      const response = await firstValueFrom(this.httpService.get(url, config));
      return response.data; // Axios ya parsea el JSON
    } catch (error) {
      console.error('Error en servicio de Malla UCN:', error.response?.data || error.message);
      // Retornamos el error que nos dio la API (ej: Unauthorized)
      return error.response?.data || { error: 'No se pudo conectar al servicio externo de Malla' };
    }
  }

  // 🔹 3. AVANCE
  async getAvance(rut: string, codCarrera: string) {
    const url = `https://puclaro.ucn.cl/eross/avance/avance.php?rut=${rut}&codcarrera=${codCarrera}`;

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data;
    } catch (error) {
      console.error('Error en servicio de Avance UCN:', error.message);
      return { error: 'No se pudo conectar al servicio externo de Avance' };
    }
  }

  // 🔹 4. MALLA FORMATEADA (con prerequisitos procesados y estructura por semestres)
  async getMallaFormatted(
    codigo: string,
    catalogo: string,
    rut?: string,
  ): Promise<MallaFormattedDto> {
    // 1. Fetch malla from external API
    const mallaData = await this.getMalla(codigo, catalogo);
    
    if (mallaData.error || !Array.isArray(mallaData)) {
      return { semestres: [] };
    }

    // 2. Optionally fetch student's avance to include status
    const statusMap = new Map<string, { status: string; periodValue: number; order: number }>();
    if (rut) {
      const avanceData = await this.getAvance(rut, codigo);
      if (Array.isArray(avanceData)) {
        avanceData.forEach((a: any, index: number) => {
          const courseCode = this.normalizeCode(a.course || a.codigo);
          if (!courseCode) return;
          const status = (a.status || '').toString().trim();
          if (!status) return;
          const periodValue = this.getPeriodValue(a.period);
          const existing = statusMap.get(courseCode);
          if (
            !existing ||
            periodValue > existing.periodValue ||
            (periodValue === existing.periodValue && index > existing.order)
          ) {
            statusMap.set(courseCode, { status, periodValue, order: index });
          }
        });
      }
    }

    // 3. Transform: group by nivel and parse prereqs
    const grupos = new Map<number, CursoDto[]>();

    mallaData.forEach((apiCurso: any) => {
      const nivel = apiCurso.nivel || 0;
      const codigo = this.normalizeCode(apiCurso.codigo);
      if (!codigo) return;
      
      const curso: CursoDto = {
        codigo,
        nombre: apiCurso.asignatura || '',
        creditos: apiCurso.creditos || 0,
        prereqs: this.parsePrereqs(apiCurso.prereq),
      };

      // Add status if available
      const statusInfo = statusMap.get(codigo);
      if (statusInfo) {
        curso.status = statusInfo.status;
      }

      if (!grupos.has(nivel)) {
        grupos.set(nivel, []);
      }
      grupos.get(nivel)!.push(curso);
    });

    // 4. Convert to array of semestres sorted by nivel
    const semestres: SemestreDto[] = Array.from(grupos.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([nivel, cursos]) => ({ nivel, cursos }));

    return { semestres };
  }

  // Helper: parse prerequisitos from comma-separated string to array
  private parsePrereqs(prereq?: string): string[] {
    if (!prereq) return [];
    return prereq
      .split(',')
      .map(x => x.trim().toUpperCase())
      .filter(Boolean);
  }

  private normalizeCode(value?: string): string {
    return (value || '').toString().trim().toUpperCase();
  }

  private getPeriodValue(period?: string | number): number {
    if (typeof period === 'number' && Number.isFinite(period)) {
      return period;
    }
    const normalized = (period || '').toString().trim();
    if (!normalized) return Number.NEGATIVE_INFINITY;
    const parsed = parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  }

  // 🔹 5. AVANCE RESUMEN (agrupado por carrera y período)
  async getAvanceSummary(rut: string, carrerasJson?: string): Promise<AvanceSummaryDto> {
    try {
      console.log('[getAvanceSummary] Getting summary for RUT:', rut);
      
      if (!carrerasJson) {
        console.log('[getAvanceSummary] No carreras provided');
        return { carreras: [] };
      }

      // Parse carreras from JSON query param
      let carrerasInfo;
      try {
        carrerasInfo = JSON.parse(carrerasJson);
      } catch (e) {
        console.error('[getAvanceSummary] Error parsing carreras JSON:', e);
        return { carreras: [] };
      }
      
      if (!Array.isArray(carrerasInfo) || carrerasInfo.length === 0) {
        console.log('[getAvanceSummary] Carreras array is empty');
        return { carreras: [] };
      }

      console.log('[getAvanceSummary] Processing', carrerasInfo.length, 'careers');

      // Fetch avance summary for each career
      const carrerasPromises = carrerasInfo.map(async (carreraInfo: any) => {
        const codCarrera = carreraInfo.codigo;
        const catalogo = carreraInfo.catalogo;
        if (!codCarrera || !catalogo) return null;
        
        try {
          console.log('[getAvanceSummary] Fetching career:', codCarrera, 'catalog:', catalogo);
          const carreraData = await this.getAvanceSummaryForCareer(rut, codCarrera, catalogo);
          // Override nombre from localStorage data
          carreraData.nombre = carreraInfo.nombre || carreraData.nombre;
          return carreraData;
        } catch (error) {
          console.error(`[getAvanceSummary] Error fetching avance for career ${codCarrera}:`, error);
          return null;
        }
      });

      const carrerasResults = await Promise.all(carrerasPromises);
      const carreras = carrerasResults.filter((c): c is CarreraAvanceDto => c !== null);

      console.log('[getAvanceSummary] Successfully processed', carreras.length, 'careers');
      return { carreras };
    } catch (error) {
      console.error('[getAvanceSummary] Error:', error);
      return { carreras: [] };
    }
  }

  // 🔹 6. AVANCE RESUMEN CON CODIGO DE CARRERA
  async getAvanceSummaryForCareer(
    rut: string,
    codCarrera: string,
    catalogo: string,
  ): Promise<CarreraAvanceDto> {
    console.log('[getAvanceSummaryForCareer] Fetching for career:', codCarrera, 'catalog:', catalogo);
    
    // Fetch avance and malla in parallel
    const [avanceData, mallaData] = await Promise.all([
      this.getAvance(rut, codCarrera),
      this.getMalla(codCarrera, catalogo)
    ]);
    
    if (avanceData.error || !Array.isArray(avanceData) || avanceData.length === 0) {
      console.log('[getAvanceSummaryForCareer] No avance data found');
      return {
        codigo: codCarrera,
        nombre: '',
        catalogo,
        periodos: [],
        creditosAprobados: 0,
        creditosTotales: 0,
      };
    }

    console.log('[getAvanceSummaryForCareer] Avance records:', avanceData.length);
    
    // Build course name map from malla
    const courseNameMap = new Map<string, string>();
    if (Array.isArray(mallaData)) {
      mallaData.forEach((curso: any) => {
        const codigo = (curso.codigo || '').toString().trim().toUpperCase();
        const nombre = curso.asignatura || '';
        if (codigo) {
          courseNameMap.set(codigo, nombre);
        }
      });
    }
    
    console.log('[getAvanceSummaryForCareer] Course name map size:', courseNameMap.size);

    // Group by period
    const periodoMap = new Map<string, CursoAvanceDto[]>();
    let totalCreditos = 0;
    let creditosAprobados = 0;

    avanceData.forEach((item: any) => {
      const periodo = item.period || 'SIN_PERIODO';
      const status = (item.status || '').toString().toUpperCase();
      const creditos = parseInt(item.creditos || '0', 10);
      const codigoCurso = (item.course || '').toString().trim().toUpperCase();
      
      const curso: CursoAvanceDto = {
        nrc: item.nrc || '',
        codigo: codigoCurso,
        nombre: courseNameMap.get(codigoCurso) || item.asignatura || 'Nombre no encontrado',
        status,
        creditos,
        inscriptionType: item.inscriptionType,
      };

      if (!periodoMap.has(periodo)) {
        periodoMap.set(periodo, []);
      }
      periodoMap.get(periodo)!.push(curso);

      totalCreditos += creditos;
      if (status === 'APROBADO') {
        creditosAprobados += creditos;
      }
    });

    // Convert to array with labels
    const periodos: PeriodoDto[] = Array.from(periodoMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([periodo, cursos]) => ({
        periodo,
        label: this.getPeriodLabel(periodo),
        cursos,
      }));

    return {
      codigo: codCarrera,
      nombre: avanceData[0]?.carrera || '',
      catalogo: avanceData[0]?.catalogo || '',
      periodos,
      creditosAprobados,
      creditosTotales: totalCreditos,
    };
  }

  // Helper: get human-readable label for period code
  private getPeriodLabel(periodo: string): string {
    // Period format is typically YYYYSS where SS is 10, 15, 20, or 25
    if (!periodo || periodo === 'SIN_PERIODO') return 'Sin período';
    
    const year = periodo.substring(0, 4);
    const suffix = periodo.substring(4);
    
    if (suffix === '10') return `Primer Semestre ${year}`;
    if (suffix === '20') return `Segundo Semestre ${year}`;
    if (suffix === '25') return `Curso de Verano ${year}`;
    if (suffix === '15') return `Curso de Invierno ${year}`;
    
    return `Periodo ${periodo}`;
  }
}

