import { Injectable } from '@nestjs/common';
import {
  CourseBoxDto,
  ProyeccionDto,
  SemesterDto,
  SimulationPreferencesDto,
  SimulationResultDto,
  WarningDto,
  YearDto,
} from './dto/simulate-projection.dto';

interface ApiCurso {
  codigo: string;
  asignatura: string;
  creditos?: number;
  nivel?: number;
  prereq?: string;
  creditosRequisito?: number;
  creditosRequeridos?: number;
  creditos_req?: number;
  creditos_minimos?: number;
  nivelRequisito?: number;
  nivelMinimo?: number;
  nivel_minimo?: number;
  nivelReq?: number;
}

interface ApiAvance {
  nrc?: string;
  period?: string;
  student?: string;
  course: string;
  excluded?: boolean;
  inscriptionType?: string;
  status?: string;
  creditos?: number;
  asignatura?: string;
}

type CourseStatus = 'APROBADO' | 'REPROBADO' | 'VACANTE' | 'INSCRITO' | 'CONVALIDADO' | 'BLOQUEADO' | 'EXCEPCION' | 'UNKNOWN';

type CourseMeta = {
  code: string;
  name: string;
  credits: number;
  level: number;
  prereqs: string[];
  creditRequirement: number;
  minLevelRequirement: number;
  isTitulo: boolean;
};

type StudentState = {
  approved: Set<string>;
  approvedCredits: number;
  failures: Map<string, number>;
  pendingFailures: Set<string>;
  maxLevel: number;
  periodSemesters: Array<{ period: string; semester: SemesterDto }>;
};

type SimulationPreferences = {
  maxCoursesPerSemester: number | null;
  targetCredits: { min: number; max: number } | null;
  priority: 'PENDING_FIRST' | 'NEW_FIRST' | 'BALANCED';
  unlockFocus: boolean;
  levelDispersion: number;
  semesterLimit: number | null;
};

@Injectable()
export class SimulationService {
  simulate(
    proyeccion: ProyeccionDto,
    allCourses: ApiCurso[],
    allAvance: ApiAvance[],
    rawPreferences?: SimulationPreferencesDto,
  ): SimulationResultDto {
    const courseMeta = this.buildCourseMeta(allCourses || []);
    
    // 1. Gestionar Overrides (Cambios manuales del usuario en el presente)
    const currentOverrides = this.extractCurrentSemesterOverrides(proyeccion);
    const adjustedAvance = this.applyOverridesToAvance(allAvance || [], currentOverrides);
    const studentState = this.buildStudentState(adjustedAvance, courseMeta);
    this.applyOverridesToStudentState(studentState, currentOverrides, courseMeta);

    // 2. Preparar Línea de Tiempo (SOLO FUTURO)
    const timeline = this.prepareTimeline(proyeccion, studentState, courseMeta);
    
    const preferences = this.buildPreferences(rawPreferences);
    
    // 3. Rellenar Inteligentemente
    const filledTimeline = this.autoPopulateSmart(timeline, courseMeta, studentState, preferences);

    return { years: filledTimeline, warnings: [] };
  }

  // =================================================================================================
  // LÓGICA CORE: POBLADO INTELIGENTE (FIX TEMPORALIDAD ESTRICTA)
  // =================================================================================================

  private autoPopulateSmart(
    years: YearDto[],
    courseMeta: Map<string, CourseMeta>,
    initialState: StudentState,
    prefs: SimulationPreferences,
  ): YearDto[] {
    const clonedYears = years.map(y => this.cloneYear(y));
    const currentYear = new Date().getFullYear();

    if (clonedYears.length === 0) {
      clonedYears.push(this.createAutomaticYear(currentYear));
    }

    const sortedYears = [...clonedYears].sort((a, b) => a.yearIndex - b.yearIndex);

    let lastYearIndex = sortedYears[sortedYears.length - 1].yearIndex;
    while (lastYearIndex < currentYear) {
      lastYearIndex++;
      sortedYears.push(this.createAutomaticYear(lastYearIndex));
    }

    // --- ESTADO DE LA SIMULACIÓN ---
    const simApproved = new Set(initialState.approved);
    let simCredits = initialState.approvedCredits;
    let simMaxLevel = initialState.maxLevel;
    
    const globalScheduled = new Set<string>();
    initialState.approved.forEach(code => globalScheduled.add(code));
    
    // Marcamos lo futuro como agendado, PERO NO LO APROBAMOS AÚN
    sortedYears.forEach(y => y.semesters.forEach(s => s.courses.forEach(c => {
      const code = this.normalize(c.code);
      const status = this.normalizePlanStatus(c.status);
      if (code && status !== 'REPROBADO') {
        globalScheduled.add(code);
      }
    })));

    const MAX_CREDITS = prefs.targetCredits?.max || 30;
    const MAX_COURSES = prefs.maxCoursesPerSemester || 10;
    
    // Bucle Año por Año
    for (let i = 0; i < sortedYears.length; i++) {
      const year = sortedYears[i];
      if (year.yearIndex < currentYear) continue;

      let coursesAddedThisYear = 0;

      for (const semester of year.semesters) {
        const keptCourses: CourseBoxDto[] = [];
        let currentLoad = 0;
        const semesterCodes = new Set<string>();

        // 1. Procesar Cursos Manuales (SIN AGREGAR A simApproved AÚN)
        semester.courses.forEach(c => {
          const code = this.normalize(c.code);
          const meta = courseMeta.get(code);
          if (meta) {
            if (!c.id || !c.id.startsWith('AUTO-')) c.id = `MANUAL-${code}`;
            
            keptCourses.push(c);
            currentLoad += meta.credits;
            semesterCodes.add(code);
            
            // Importante: No agregamos a simApproved aquí.
            // Si tomo Estadística ahora, NO cuenta como requisito cumplido para este mismo semestre.
            const status = this.normalizePlanStatus(c.status);
            if (status !== 'REPROBADO') {
               globalScheduled.add(code); 
            }
          }
        });

        // 2. BUSCAR CANDIDATOS (Usando simApproved que SOLO tiene lo histórico/anterior)
        const candidates = Array.from(courseMeta.values()).filter(meta => {
          if (globalScheduled.has(meta.code)) return false;
          if (semesterCodes.has(meta.code)) return false; 
          
          const prereqsMet = meta.prereqs.every(req => simApproved.has(req));
          if (!prereqsMet) return false;

          if (meta.creditRequirement > simCredits) return false;

          return true;
        });

        // 3. ORDENAR
        candidates.sort((a, b) => {
          const levelDiff = a.level - b.level;
          if (levelDiff !== 0) return levelDiff; 
          if (a.isTitulo && !b.isTitulo) return 1;
          if (!a.isTitulo && b.isTitulo) return -1;
          return a.code.localeCompare(b.code);
        });

        // 4. LLENAR EL SEMESTRE
        for (const meta of candidates) {
          if (keptCourses.length >= MAX_COURSES) break;
          const newLoad = currentLoad + meta.credits;
          const isSingleGiant = keptCourses.length === 0 && meta.credits >= 20;
          if (newLoad > MAX_CREDITS && !isSingleGiant) continue;

          keptCourses.push({
            id: `AUTO-${meta.code}`,
            code: meta.code,
            name: meta.name,
            creditos: meta.credits,
            status: 'VACANTE'
          });

          globalScheduled.add(meta.code);
          semesterCodes.add(meta.code);
          currentLoad += meta.credits;
          coursesAddedThisYear++;
        }

        semester.courses = keptCourses;

        // 5. AHORA SÍ: ACTUALIZAR simApproved PARA EL FUTURO (SIGUIENTE ITERACIÓN)
        // Recién aquí "aprobamos" los ramos de este semestre para que sirvan de requisito en el siguiente.
        keptCourses.forEach(c => {
          const code = this.normalize(c.code);
          const meta = courseMeta.get(code);
          const status = this.normalizePlanStatus(c.status);
          
          if (meta && status !== 'REPROBADO' && !simApproved.has(code)) {
            simApproved.add(code);
            simCredits += meta.credits;
            if (meta.level > simMaxLevel) simMaxLevel = meta.level;
          }
        });
      }

      // 6. AGREGAR AÑOS SI FALTAN RAMOS
      if (i === sortedYears.length - 1) {
        const remaining = Array.from(courseMeta.values()).filter(m => !globalScheduled.has(m.code));
        if (remaining.length > 0) {
          const nextYearIdx = year.yearIndex + 1;
          if (nextYearIdx < currentYear + 8) { 
             sortedYears.push(this.createAutomaticYear(nextYearIdx));
          }
        }
      }
    }

    return sortedYears;
  }

  // =================================================================================================
  // HELPERS
  // =================================================================================================

  private prepareTimeline(
    proyeccion: ProyeccionDto,
    student: StudentState,
    courseMeta: Map<string, CourseMeta>,
  ): YearDto[] {
    const currentYear = new Date().getFullYear();
    const futureYears: YearDto[] = [];

    if (proyeccion && Array.isArray(proyeccion.years)) {
        const relevantYears = proyeccion.years.filter(y => y.yearIndex >= currentYear);
        relevantYears.forEach(y => {
            futureYears.push({
                ...y,
                yearIndex: y.yearIndex,
                title: y.title || `Año Simulado ${y.yearIndex}`,
                semesters: y.semesters.map(s => this.enrichSemester(s, courseMeta))
            });
        });
    }
    return futureYears.sort((a, b) => a.yearIndex - b.yearIndex);
  }

  private buildCourseMeta(allCourses: ApiCurso[]): Map<string, CourseMeta> {
    const map = new Map<string, CourseMeta>();
    const validCodes = new Set<string>();
    
    allCourses.forEach((curso) => {
      const code = this.normalize(curso.codigo);
      if (!code) return;
      validCodes.add(code);
      
      const credits = Number(curso.creditos) || 0;
      const creditReq = Number(curso.creditosRequisito || curso.creditosRequeridos || curso.creditos_req || 0);
      const levelReq = Number(curso.nivelRequisito || curso.nivelMinimo || curso.nivelReq || 0);
      const rawName = (curso.asignatura || '').trim();
      const isCapstone = rawName.toLowerCase().includes('capstone') || rawName.toLowerCase().includes('proyecto de titulo');
      
      map.set(code, {
        code,
        name: rawName,
        credits,
        level: Number(curso.nivel) || 0,
        prereqs: this.parsePrereqs(curso.prereq),
        creditRequirement: creditReq,
        minLevelRequirement: levelReq,
        isTitulo: credits >= 20 || isCapstone, 
      });
    });

    return map;
  }

  private buildStudentState(avance: ApiAvance[], courseMeta: Map<string, CourseMeta>): StudentState {
    const approved = new Set<string>();
    const failures = new Map<string, number>();
    const pendingFailures = new Set<string>();
    let approvedCredits = 0;
    let maxLevel = 0;

    avance.forEach((record) => {
      const code = this.normalize(record.course || (record as any).codigo);
      if (!code) return;
      const meta = courseMeta.get(code);
      const status = this.normalizeRecordStatus(record.status, record.inscriptionType);
      const credits = Number(record.creditos) || meta?.credits || 0;

      if (status === 'APROBADO' || status === 'CONVALIDADO') {
        if (!approved.has(code)) {
          approved.add(code);
          approvedCredits += credits;
          pendingFailures.delete(code);
          if (meta && meta.level > maxLevel) maxLevel = meta.level;
        }
      } else if (status === 'REPROBADO') {
        const current = failures.get(code) ?? 0;
        failures.set(code, current + 1);
        pendingFailures.add(code);
      }
    });

    failures.forEach((_, code) => { if (approved.has(code)) pendingFailures.delete(code); });

    return { approved, approvedCredits, failures, pendingFailures, maxLevel, periodSemesters: [] };
  }

  // --- OVERRIDES ---
  private extractCurrentSemesterOverrides(proyeccion: ProyeccionDto): Map<string, CourseBoxDto> {
    const overrides = new Map<string, CourseBoxDto>();
    if (!proyeccion?.years) return overrides;
    const currentYearVal = new Date().getFullYear();
    const targetYear = proyeccion.years.find(y => y.yearIndex === 0 || y.yearIndex === currentYearVal);
    
    if (targetYear?.semesters) {
      targetYear.semesters.forEach(s => s.courses.forEach(c => {
        const code = this.normalize(c.code);
        if (code) overrides.set(code, { ...c });
      }));
    }
    return overrides;
  }

  private applyOverridesToAvance(avance: ApiAvance[], overrides: Map<string, CourseBoxDto>): ApiAvance[] {
    if (!overrides.size) return avance;
    return avance.map(r => {
      const code = this.normalize(r.course || (r as any).codigo);
      const ov = overrides.get(code);
      return ov ? { ...r, status: ov.status } : r;
    });
  }

  private applyOverridesToStudentState(state: StudentState, overrides: Map<string, CourseBoxDto>, metaMap: Map<string, CourseMeta>) {
    overrides.forEach((ov, code) => {
      const status = this.normalizePlanStatus(ov.status);
      const meta = metaMap.get(code);
      if (status === 'APROBADO' || status === 'CONVALIDADO') {
        if (!state.approved.has(code)) {
          state.approved.add(code);
          if(meta) state.approvedCredits += meta.credits;
        }
        state.pendingFailures.delete(code);
      } else if (status === 'REPROBADO') {
        state.approved.delete(code);
        state.pendingFailures.add(code);
      }
    });
  }

  // --- UTILS ---
  private buildPreferences(dto?: SimulationPreferencesDto): SimulationPreferences {
    return {
      maxCoursesPerSemester: dto?.maxCoursesPerSemester ?? 6,
      targetCredits: dto?.targetLoad === 'HIGH' ? { min: 20, max: 30 } : { min: 10, max: 20 },
      priority: dto?.priority || 'BALANCED',
      unlockFocus: !!dto?.unlockFocus,
      levelDispersion: dto?.levelDispersion ?? 1,
      semesterLimit: dto?.semesterLimit ?? 12
    };
  }

  private normalize(value?: string | null): string {
    if (!value) return '';
    return value.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private parsePrereqs(prereq?: string): string[] {
    if (!prereq) return [];
    return prereq.split(',').map(t => this.normalize(t)).filter(Boolean);
  }

  private normalizePlanStatus(s?: string | null): CourseStatus {
    const raw = (s || '').toUpperCase();
    if (raw.includes('APROB')) return 'APROBADO';
    if (raw.includes('CONVALID')) return 'CONVALIDADO';
    if (raw.includes('REPROB')) return 'REPROBADO';
    if (raw.includes('INSCR')) return 'INSCRITO';
    return 'VACANTE';
  }

  private normalizeRecordStatus(status?: string | null, type?: string | null): CourseStatus {
    if ((type || '').toUpperCase().includes('CONVALID')) return 'CONVALIDADO';
    return this.normalizePlanStatus(status);
  }

  private createAutomaticYear(yearIndex: number): YearDto {
    return {
      yearIndex,
      title: `Año Simulado ${yearIndex}`,
      semesters: [
        { label: 'Primer Semestre', courses: [] },
        { label: 'Segundo Semestre', courses: [] }
      ]
    };
  }

  private enrichSemester(semester: SemesterDto, metaMap: Map<string, CourseMeta>): SemesterDto {
    return {
      ...semester,
      courses: semester.courses.map(c => this.enrichCourse(c, metaMap))
    };
  }

  private enrichCourse(course: CourseBoxDto, metaMap: Map<string, CourseMeta>): CourseBoxDto {
    const code = this.normalize(course.code);
    const meta = metaMap.get(code);
    return {
      ...course,
      id: course.id || `AUTO-${Math.random().toString(36).slice(2)}`,
      name: meta?.name || course.name,
      creditos: meta?.credits || course.creditos
    };
  }

  private cloneYear(y: YearDto): YearDto { return JSON.parse(JSON.stringify(y)); }
}