import { Injectable } from '@nestjs/common';
import {
  CourseBoxDto,
  ProyeccionDto,
  SemesterDto,
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

type CourseStatus =
  | 'APROBADO'
  | 'REPROBADO'
  | 'VACANTE'
  | 'INSCRITO'
  | 'CONVALIDADO'
  | 'BLOQUEADO'
  | 'EXCEPCION'
  | 'UNKNOWN';

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
  secondChanceCount: number;
  periodSemesters: Array<{ period: string; semester: SemesterDto }>;
};

type SimulationRuntime = {
  approved: Set<string>;
  approvedCredits: number;
  failures: Map<string, number>;
  pendingFailures: Set<string>;
  maxLevel: number;
  secondChanceCount: number;
  secondChanceLimitWarned: boolean;
  thirdFailureWarned: Set<string>;
};

type SemesterProcessContext = {
  yearIndex: number;
  semIdx: number;
  isLastMeaningful: boolean;
};

type ProcessedCourse = {
  course: CourseBoxDto;
  meta?: CourseMeta;
  status: CourseStatus;
  blocked: boolean;
  reasons: string[];
  originalIndex: number;
};

@Injectable()
export class SimulationService {
  simulate(proyeccion: ProyeccionDto, allCourses: ApiCurso[], allAvance: ApiAvance[]): SimulationResultDto {
    const courseMeta = this.buildCourseMeta(allCourses || []);
    const studentState = this.buildStudentState(allAvance || [], courseMeta);
    const initialYears = this.prepareInitialYears(proyeccion, studentState, courseMeta);
    const populatedYears = this.autoPopulateFutureYears(initialYears, courseMeta, studentState);

    const warnings: WarningDto[] = [];
    const processedYears = this.processYears(populatedYears, courseMeta, studentState, warnings);

    return { years: processedYears, warnings };
  }

  private buildCourseMeta(allCourses: ApiCurso[]): Map<string, CourseMeta> {
    const map = new Map<string, CourseMeta>();
    const validCodes = new Set<string>();
    allCourses.forEach((curso) => {
      const code = this.normalize(curso.codigo);
      if (!code) return;
      const name = (curso.asignatura || '').trim();
      if (!name) return;
      validCodes.add(code);
      const credits = Number.isFinite(curso.creditos) ? Number(curso.creditos) : 0;
      const level = Number.isFinite(curso.nivel) ? Number(curso.nivel) : 0;
      const prereqs = this.parsePrereqs(curso.prereq);

      const creditCandidates: Array<number | undefined> = [
        curso.creditosRequisito,
        curso.creditosRequeridos,
        curso.creditos_req,
        curso.creditos_minimos,
      ];
      let creditRequirement = 0;
      for (const candidate of creditCandidates) {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed) && parsed > 0) {
          creditRequirement = parsed;
          break;
        }
      }

      const levelCandidates: Array<number | undefined> = [
        curso.nivelRequisito,
        curso.nivelMinimo,
        curso.nivel_minimo,
        curso.nivelReq,
      ];
      let minLevelRequirement = 0;
      for (const candidate of levelCandidates) {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed) && parsed > 0) {
          minLevelRequirement = parsed;
          break;
        }
      }

      map.set(code, {
        code,
        name,
        credits,
        level,
        prereqs,
        creditRequirement,
        minLevelRequirement,
        isTitulo: credits >= 30,
      });
    });

    map.forEach((meta) => {
      meta.prereqs = meta.prereqs.filter((pr) => validCodes.has(pr));
    });
    return map;
  }

  private buildStudentState(avance: ApiAvance[], courseMeta: Map<string, CourseMeta>): StudentState {
    const approved = new Set<string>();
    const failures = new Map<string, number>();
    const pendingFailures = new Set<string>();
    const periodMap = new Map<string, CourseBoxDto[]>();
    let approvedCredits = 0;
    let maxLevel = 0;

    avance.forEach((record) => {
      const code = this.normalize(record.course || (record as any).codigo);
      if (!code) return;
      const meta = courseMeta.get(code);
      const status = this.normalizeRecordStatus(record.status, record.inscriptionType);
      const creditsFromMeta = meta?.credits ?? 0;
      const credits = Number.isFinite(record.creditos) ? Number(record.creditos) : creditsFromMeta;
      const box: CourseBoxDto = {
        id: this.makeId(),
        code,
        status,
        creditos: credits,
        name: meta?.name || record.asignatura,
      };

      const period = (record.period || 'SIN_PERIODO').toString();
      if (!periodMap.has(period)) periodMap.set(period, []);
      periodMap.get(period)!.push({ ...box });

      if (status === 'APROBADO' || status === 'CONVALIDADO') {
        if (!approved.has(code)) {
          approved.add(code);
          approvedCredits += creditsFromMeta || credits || 0;
          pendingFailures.delete(code);
          if (meta && meta.level > maxLevel) maxLevel = meta.level;
        }
      } else if (status === 'REPROBADO') {
        const current = failures.get(code) ?? 0;
        failures.set(code, current + 1);
        pendingFailures.add(code);
      }
    });

    const periodSemesters = Array.from(periodMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, courses]) => ({
        period,
        semester: {
          label: this.getSemesterLabel(period),
          courses: courses.map((c) => ({ ...c, id: c.id || this.makeId() })),
        },
      }));

    failures.forEach((count, code) => {
      if (count === 0) pendingFailures.delete(code);
    });

    const secondChanceCount = Array.from(failures.values()).filter((count) => count >= 2).length;

    return {
      approved,
      approvedCredits,
      failures,
      pendingFailures,
      maxLevel,
      secondChanceCount,
      periodSemesters,
    };
  }

  private prepareInitialYears(
    proyeccion: ProyeccionDto,
    student: StudentState,
    courseMeta: Map<string, CourseMeta>,
  ): YearDto[] {
    const baseYears = Array.isArray(proyeccion?.years)
      ? proyeccion.years.map((year) => this.cloneYear(year))
      : [];
    const enrichedBase = baseYears.map((year) => ({
      ...year,
      semesters: year.semesters.map((sem) => this.enrichSemester(sem, courseMeta)),
    }));

    const futureYears = enrichedBase.filter((y) => y.yearIndex !== 0);
    futureYears.sort((a, b) => a.yearIndex - b.yearIndex);

    const fallbackCurrent = enrichedBase.find((y) => y.yearIndex === 0) ?? null;
    const currentYear = this.buildCurrentYear(student, courseMeta, fallbackCurrent);

    return [currentYear, ...futureYears];
  }

  private autoPopulateFutureYears(
    years: YearDto[],
    courseMeta: Map<string, CourseMeta>,
    student: StudentState,
  ): YearDto[] {
    const strictResult = this.autoPopulateWithMode(years, courseMeta, student, false);
    if (strictResult.remainingCount === 0) {
      return strictResult.years;
    }

    const relaxedResult = this.autoPopulateWithMode(years, courseMeta, student, true);
    return relaxedResult.remainingCount <= strictResult.remainingCount ? relaxedResult.years : strictResult.years;
  }

  private autoPopulateWithMode(
    years: YearDto[],
    courseMeta: Map<string, CourseMeta>,
    student: StudentState,
    relaxed: boolean,
  ): { years: YearDto[]; addedCount: number; hasFutureCourses: boolean; remainingCount: number } {
    const clonedYears = years.map((year) => this.cloneYear(year));
    if (clonedYears.length === 0) {
      return { years: clonedYears, addedCount: 0, hasFutureCourses: false, remainingCount: courseMeta.size };
    }

    const sortedYears = [...clonedYears].sort((a, b) => a.yearIndex - b.yearIndex);

    const scheduledCodes = new Set<string>(student.approved);
    sortedYears.forEach((year) => {
      year.semesters.forEach((semester) => {
        semester.courses.forEach((course) => {
          const code = this.normalize(course.code);
          if (code) scheduledCodes.add(code);
        });
      });
    });

    let maxYearIndex = sortedYears.reduce((acc, year) => Math.max(acc, year.yearIndex), 0);
    if (!sortedYears.some((year) => year.yearIndex > 0)) {
      maxYearIndex += 1;
      sortedYears.push(this.createAutomaticYear(maxYearIndex));
    }

    const planApprovals = new Set<string>(student.approved);
    let planApprovedCredits = student.approvedCredits;
    let planMaxLevel = student.maxLevel;

    const pendingFailures = new Set<string>(student.pendingFailures);

    const remainingList = Array.from(courseMeta.values())
      .filter((meta) => !planApprovals.has(meta.code) && !scheduledCodes.has(meta.code))
      .sort((a, b) => {
        const failA = pendingFailures.has(a.code) ? 0 : 1;
        const failB = pendingFailures.has(b.code) ? 0 : 1;
        if (failA !== failB) return failA - failB;
        if (a.level !== b.level) return a.level - b.level;
        const creditsA = Number.isFinite(a.credits) ? Number(a.credits) : 0;
        const creditsB = Number.isFinite(b.credits) ? Number(b.credits) : 0;
        if (creditsA !== creditsB) return creditsB - creditsA;
        return a.code.localeCompare(b.code);
      });

    const MAX_CREDITS = 30;
    const MAX_EXTRA_YEARS = 6;
    let addedYears = 0;
    let totalAdded = 0;
    let hasFutureCourses = false;

    for (let yearIdx = 0; yearIdx < sortedYears.length; yearIdx++) {
      const year = sortedYears[yearIdx];
      if (year.yearIndex === 0) continue;

      let coursesScheduledInYear = 0;

      for (let semIdx = 0; semIdx < year.semesters.length; semIdx++) {
        const semester = year.semesters[semIdx];

        const sanitizedCourses: CourseBoxDto[] = [];
        const semesterMetas = new Map<string, CourseMeta>();
        let creditLoad = 0;

        semester.courses.forEach((course) => {
          const code = this.normalize(course.code);
          if (!code) return;
          const meta = courseMeta.get(code);
          if (!meta) return;

          const enriched = this.enrichCourse(course, courseMeta);
          sanitizedCourses.push(enriched);
          hasFutureCourses = true;

          if (!scheduledCodes.has(code)) {
            scheduledCodes.add(code);
          }

          if (!planApprovals.has(code)) {
            semesterMetas.set(code, meta);
          }

          const effectiveExisting = Number.isFinite(meta.credits) ? Math.max(Number(meta.credits), 0) : 0;
          creditLoad += effectiveExisting;
        });

        for (const meta of remainingList) {
          if (scheduledCodes.has(meta.code)) continue;
          const rawCredits = Number.isFinite(meta.credits) ? Number(meta.credits) : 0;
          const credits = rawCredits;
          const effectiveCredits = credits > 0 ? credits : 0;

          const allowedLevel = relaxed ? Number.POSITIVE_INFINITY : planMaxLevel === 0 ? 1 : planMaxLevel + 2;
          const prereqsOk = relaxed || meta.prereqs.every((pr) => planApprovals.has(pr));
          const creditReqOk = relaxed || meta.creditRequirement <= planApprovedCredits;
          const minLevelOk = relaxed || meta.minLevelRequirement <= planMaxLevel;
          const levelOk = relaxed || meta.level <= allowedLevel;

          if (!prereqsOk || !creditReqOk || !minLevelOk || !levelOk) continue;

          const exceedsCap = effectiveCredits > 0 && creditLoad + effectiveCredits > MAX_CREDITS;
          const allowOversizedCourse = exceedsCap && creditLoad === 0;
          if (exceedsCap && !allowOversizedCourse) continue;

          const newCourse: CourseBoxDto = {
            id: this.makeId(),
            code: meta.code,
            status: 'VACANTE',
            creditos: credits,
            name: meta.name,
          };

          sanitizedCourses.push(newCourse);
          scheduledCodes.add(meta.code);
          semesterMetas.set(meta.code, meta);
          if (allowOversizedCourse) {
            creditLoad = Math.max(MAX_CREDITS, effectiveCredits);
          } else {
            creditLoad += effectiveCredits;
          }
          totalAdded += 1;
          coursesScheduledInYear += 1;
          hasFutureCourses = true;

          if (creditLoad >= MAX_CREDITS) break;
        }

        const enrichedSemester = this.enrichSemester({ ...semester, courses: sanitizedCourses }, courseMeta);
        year.semesters[semIdx] = enrichedSemester;

        semesterMetas.forEach((meta, code) => {
          if (!planApprovals.has(code)) {
            planApprovals.add(code);
            planApprovedCredits += meta.credits;
            if (meta.level > planMaxLevel) planMaxLevel = meta.level;
          }
        });
      }

      if (yearIdx === sortedYears.length - 1) {
        const unscheduled = remainingList.filter(
          (meta) => !scheduledCodes.has(meta.code) && (meta.credits ?? 0) > 0,
        );

        if (unscheduled.length > 0 && addedYears < MAX_EXTRA_YEARS) {
          if (coursesScheduledInYear === 0 && !relaxed) {
            break;
          }

          if (coursesScheduledInYear > 0 || relaxed) {
            maxYearIndex += 1;
            sortedYears.push(this.createAutomaticYear(maxYearIndex));
            addedYears += 1;
          }
        }
      }
    }

    const remainingCount = remainingList.filter((meta) => !scheduledCodes.has(meta.code)).length;

    return { years: sortedYears, addedCount: totalAdded, hasFutureCourses, remainingCount };
  }

  private createAutomaticYear(yearIndex: number): YearDto {
    return {
      yearIndex,
      title: yearIndex === 0 ? 'Semestre Actual' : `Año Simulado ${yearIndex}`,
      semesters: [
        {
          label: 'Primer Semestre',
          courses: [],
        },
        {
          label: 'Segundo Semestre',
          courses: [],
        },
      ],
    };
  }

  private buildCurrentYear(
    student: StudentState,
    courseMeta: Map<string, CourseMeta>,
    fallback: YearDto | null,
  ): YearDto {
    if (student.periodSemesters.length > 0) {
      const latest = student.periodSemesters[student.periodSemesters.length - 1];
      const enrichedSemester = this.enrichSemester(latest.semester, courseMeta);
      return {
        yearIndex: 0,
        title: 'Semestre Actual',
        semesters: [enrichedSemester],
      };
    }

    if (fallback) {
      const cloned = this.cloneYear(fallback);
      cloned.yearIndex = 0;
      cloned.semesters = cloned.semesters.map((sem) => this.enrichSemester(sem, courseMeta));
      return cloned;
    }

    return {
      yearIndex: 0,
      title: 'Semestre Actual',
      semesters: [
        this.enrichSemester(
          {
            label: 'Semestre Actual',
            courses: [],
          },
          courseMeta,
        ),
      ],
    };
  }

  private processYears(
    years: YearDto[],
    courseMeta: Map<string, CourseMeta>,
    student: StudentState,
    warnings: WarningDto[],
  ): YearDto[] {
    if (years.length === 0) return [];

    const sortedYears = [...years].sort((a, b) => a.yearIndex - b.yearIndex);
    const runtime: SimulationRuntime = {
      approved: new Set(student.approved),
      approvedCredits: student.approvedCredits,
      failures: new Map(student.failures),
      pendingFailures: new Set(student.pendingFailures),
      maxLevel: student.maxLevel,
      secondChanceCount: student.secondChanceCount,
      secondChanceLimitWarned: student.secondChanceCount > 4,
      thirdFailureWarned: new Set<string>(),
    };

    const result: YearDto[] = [];
    const lastPosition = this.findLastSemesterWithCourses(sortedYears);
    let carryForward: CourseBoxDto[] = [];

    sortedYears.forEach((year) => {
      const newYear: YearDto = {
        ...year,
        semesters: [],
      };

      year.semesters.forEach((semester, semIdx) => {
        const clonedSemester = this.cloneSemester(semester);
        const mergedSemester = this.mergeCarryIntoSemester(clonedSemester, carryForward, courseMeta);
        carryForward = [];

        if (year.yearIndex === 0) {
          this.consumeActualSemester(mergedSemester, runtime, courseMeta);
          newYear.semesters.push(mergedSemester);
          return;
        }

        const semResult = this.processSemester(
          mergedSemester,
          {
            yearIndex: year.yearIndex,
            semIdx,
            isLastMeaningful: this.isLastMeaningful(year.yearIndex, semIdx, lastPosition),
          },
          runtime,
          courseMeta,
          warnings,
        );

        newYear.semesters.push(semResult.semester);
        carryForward = this.mergeCarryLists(carryForward, semResult.carryForward);
      });

      result.push(newYear);
    });

    if (carryForward.length > 0) {
      const lastYearIndex = result.reduce((acc, year) => Math.max(acc, year.yearIndex), 0);
      const extraSemester: SemesterDto = {
        label: 'Semestre adicional',
        courses: carryForward.map((course) => this.cloneCourse(course)),
      };
      result.push({
        yearIndex: lastYearIndex + 1,
        title: `Año adicional ${lastYearIndex + 1}`,
        semesters: [this.enrichSemester(extraSemester, courseMeta)],
      });
    }

    return result;
  }

  private processSemester(
    semester: SemesterDto,
    context: SemesterProcessContext,
    runtime: SimulationRuntime,
    courseMeta: Map<string, CourseMeta>,
    warnings: WarningDto[],
  ): { semester: SemesterDto; carryForward: CourseBoxDto[] } {
    const processed: ProcessedCourse[] = [];

    semester.courses.forEach((course, index) => {
      const normalizedCode = this.normalize(course.code);
      const enrichedCourse = this.enrichCourse(course, courseMeta);
      if (!normalizedCode) {
        processed.push({
          course: enrichedCourse,
          meta: undefined,
          status: 'VACANTE',
          blocked: false,
          reasons: [],
          originalIndex: index,
        });
        return;
      }

      const meta = courseMeta.get(normalizedCode);
      let status = this.normalizePlanStatus(enrichedCourse.status);
      const hasException = this.hasExceptionStatus(enrichedCourse.status);
      const reasons: string[] = [];

      if (!meta) {
        reasons.push('Curso no encontrado en la malla');
        status = 'BLOQUEADO';
      }

      if (meta && status !== 'REPROBADO') {
        if (!hasException) {
          if (runtime.approved.has(normalizedCode)) {
            reasons.push('Curso ya aprobado en períodos anteriores');
            status = 'BLOQUEADO';
          }

          const missing = meta.prereqs.filter((pr) => !runtime.approved.has(pr));
          if (missing.length > 0) {
            reasons.push(`Prerequisitos pendientes: ${missing.join(', ')}`);
            status = 'BLOQUEADO';
          }

          const blockedByFailures = meta.prereqs.filter((pr) => runtime.pendingFailures.has(pr));
          if (blockedByFailures.length > 0) {
            reasons.push(`Prerequisitos reprobados sin recuperar: ${blockedByFailures.join(', ')}`);
            status = 'BLOQUEADO';
          }

          const allowedLevel = runtime.maxLevel + 2;
          if (meta.level > allowedLevel) {
            reasons.push(`Nivel ${meta.level} supera el máximo permitido (${allowedLevel})`);
            status = 'BLOQUEADO';
          }

          if (meta.creditRequirement > runtime.approvedCredits) {
            reasons.push(`Requiere ${meta.creditRequirement} créditos aprobados`);
            status = 'BLOQUEADO';
          }

          if (meta.minLevelRequirement > runtime.maxLevel) {
            reasons.push(`Requiere nivel ${meta.minLevelRequirement}`);
            status = 'BLOQUEADO';
          }
        }
      }

      processed.push({
        course: enrichedCourse,
        meta,
        status,
        blocked: status === 'BLOQUEADO',
        reasons,
        originalIndex: index,
      });
    });

    const tituloIndices = processed
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => !item.blocked && item.meta?.isTitulo)
      .map(({ idx }) => idx);

    if (tituloIndices.length > 0) {
      const keepIdx = tituloIndices[0];
      processed.forEach((item, idx) => {
        if (idx === keepIdx) return;
        if (item.meta && item.meta.credits > 0 && !item.blocked) {
          item.blocked = true;
          item.status = 'BLOQUEADO';
          item.reasons.push('Un curso de 30 créditos bloquea el semestre');
          this.addWarning(warnings, context, `${item.meta.name} se bloquea por coexistir con un curso de 30 créditos`);
        }
      });
    }

    let creditSum = processed.reduce((acc, item) => {
      if (item.blocked || !item.meta) return acc;
      if (item.status === 'BLOQUEADO') return acc;
      return acc + (item.meta.credits || 0);
    }, 0);

    for (let i = processed.length - 1; i >= 0 && creditSum > 30; i--) {
      const item = processed[i];
      if (item.blocked || !item.meta) continue;
      if (item.meta.credits <= 0) continue;
      item.blocked = true;
      item.status = 'BLOQUEADO';
      item.reasons.push('Se excede el máximo de 30 créditos');
      creditSum -= item.meta.credits;
      this.addWarning(warnings, context, `${item.meta.name} excede el máximo de 30 créditos en el semestre`);
    }

    if (creditSum > 0 && creditSum < 12 && !context.isLastMeaningful) {
      this.addWarning(warnings, context, 'El semestre tiene menos de 12 créditos (mínimo requerido)');
    }

    if (creditSum === 0) {
      this.addWarning(warnings, context, 'Semestre sin créditos asignados no es válido');
    }

    const carryMap = new Map<string, CourseBoxDto>();

    processed.forEach((item) => {
      const code = this.normalize(item.course.code);
      if (!code) return;
      const meta = item.meta;
      const finalStatus = this.selectFinalStatus(item.status, item.blocked);
      item.course.status = finalStatus;

      if (item.blocked && meta) {
        item.reasons.forEach((reason) => this.addWarning(warnings, context, `${meta.name}: ${reason}`));
      }

      if (!item.blocked) {
        if (finalStatus === 'APROBADO' || finalStatus === 'CONVALIDADO') {
          this.registerApproval(runtime, code, meta);
        }

        if (finalStatus === 'REPROBADO') {
          this.registerFailure(runtime, code, meta, context, warnings);
        }
      }

      const shouldCarry =
        finalStatus === 'REPROBADO' || finalStatus === 'VACANTE' || finalStatus === 'BLOQUEADO';
      if (shouldCarry && meta && !carryMap.has(code)) {
        const carryCourse: CourseBoxDto = {
          id: this.makeId(),
          code: meta.code,
          status: 'VACANTE',
          creditos: meta.credits,
          name: meta.name,
        };
        carryMap.set(code, carryCourse);
      }
    });

    semester.courses = processed
      .sort((a, b) => a.originalIndex - b.originalIndex)
      .map((item) => ({ ...item.course }));

    const carryForward = Array.from(carryMap.values());
    return { semester, carryForward };
  }

  private consumeActualSemester(
    semester: SemesterDto,
    runtime: SimulationRuntime,
    courseMeta: Map<string, CourseMeta>,
  ): void {
    semester.courses = semester.courses.map((course) => {
      const enriched = this.enrichCourse(course, courseMeta);
      const code = this.normalize(enriched.code);
      if (!code) return enriched;
      const meta = courseMeta.get(code);
      const status = this.normalizePlanStatus(enriched.status);
      if (status === 'APROBADO' || status === 'CONVALIDADO') {
        this.registerApproval(runtime, code, meta);
      } else if (status === 'REPROBADO') {
        this.registerFailure(runtime, code, meta, { yearIndex: 0, semIdx: 0, isLastMeaningful: false }, []);
      }
      return enriched;
    });
  }

  private registerApproval(runtime: SimulationRuntime, code: string, meta?: CourseMeta): void {
    if (runtime.approved.has(code)) return;
    runtime.approved.add(code);
    runtime.pendingFailures.delete(code);
    if (meta) {
      runtime.approvedCredits += meta.credits;
      if (meta.level > runtime.maxLevel) runtime.maxLevel = meta.level;
    }
  }

  private registerFailure(
    runtime: SimulationRuntime,
    code: string,
    meta: CourseMeta | undefined,
    context: SemesterProcessContext,
    warnings: WarningDto[],
  ): void {
    const current = runtime.failures.get(code) ?? 0;
    const updated = current + 1;
    runtime.failures.set(code, updated);
    runtime.pendingFailures.add(code);

    if (updated >= 3 && !runtime.thirdFailureWarned.has(code)) {
      this.addWarning(
        warnings,
        context,
        `${meta?.name || code} alcanza una tercera reprobación (proyección inválida)`,
      );
      runtime.thirdFailureWarned.add(code);
    }

    if (updated === 2) {
      runtime.secondChanceCount += 1;
    }

    if (runtime.secondChanceCount > 4 && !runtime.secondChanceLimitWarned) {
      this.addWarning(
        warnings,
        context,
        'Más de cuatro cursos alcanzan segunda reprobación (proyección inválida)',
      );
      runtime.secondChanceLimitWarned = true;
    }
  }

  private mergeCarryIntoSemester(
    semester: SemesterDto,
    carry: CourseBoxDto[],
    courseMeta: Map<string, CourseMeta>,
  ): SemesterDto {
    if (carry.length === 0) return this.enrichSemester(semester, courseMeta);
    const mergedCourses = semester.courses.map((course) => this.cloneCourse(course));
    const existing = new Set(mergedCourses.map((course) => this.normalize(course.code)));
    carry.forEach((course) => {
      const code = this.normalize(course.code);
      if (!code || existing.has(code)) return;
      mergedCourses.push(this.cloneCourse(course));
      existing.add(code);
    });
    return this.enrichSemester({ ...semester, courses: mergedCourses }, courseMeta);
  }

  private mergeCarryLists(current: CourseBoxDto[], next: CourseBoxDto[]): CourseBoxDto[] {
    if (next.length === 0) return current;
    const merged = current.map((course) => this.cloneCourse(course));
    const existing = new Set(merged.map((course) => this.normalize(course.code)));
    next.forEach((course) => {
      const code = this.normalize(course.code);
      if (!code || existing.has(code)) return;
      merged.push(this.cloneCourse(course));
      existing.add(code);
    });
    return merged;
  }

  private findLastSemesterWithCourses(years: YearDto[]): { yearIndex: number; semIdx: number } {
    let last = { yearIndex: 0, semIdx: 0 };
    years.forEach((year) => {
      year.semesters.forEach((semester, index) => {
        const hasContent = semester.courses.some((course) => !!this.normalize(course.code));
        if (hasContent) {
          if (year.yearIndex > last.yearIndex || (year.yearIndex === last.yearIndex && index >= last.semIdx)) {
            last = { yearIndex: year.yearIndex, semIdx: index };
          }
        }
      });
    });
    return last;
  }

  private isLastMeaningful(yearIndex: number, semIdx: number, last: { yearIndex: number; semIdx: number }): boolean {
    return yearIndex === last.yearIndex && semIdx === last.semIdx;
  }

  private enrichSemester(semester: SemesterDto, courseMeta: Map<string, CourseMeta>): SemesterDto {
    return {
      ...semester,
      courses: semester.courses.map((course) => this.enrichCourse(course, courseMeta)),
    };
  }

  private enrichCourse(course: CourseBoxDto, courseMeta: Map<string, CourseMeta>): CourseBoxDto {
    const cloned = this.cloneCourse(course);
    if (!cloned.id) cloned.id = this.makeId();
    const code = this.normalize(cloned.code);
    if (!code) return cloned;
    const meta = courseMeta.get(code);
    if (meta) {
      cloned.code = meta.code;
      if (!cloned.name) cloned.name = meta.name;
      if (meta.credits > 0) cloned.creditos = meta.credits;
    }
    return cloned;
  }

  private cloneYear(year: YearDto): YearDto {
    return {
      ...year,
      semesters: year.semesters.map((semester) => this.cloneSemester(semester)),
    };
  }

  private cloneSemester(semester: SemesterDto): SemesterDto {
    return {
      ...semester,
      courses: semester.courses.map((course) => this.cloneCourse(course)),
    };
  }

  private cloneCourse(course: CourseBoxDto): CourseBoxDto {
    return { ...course };
  }

  private addWarning(warnings: WarningDto[], context: SemesterProcessContext, message: string): void {
    warnings.push({ yearIndex: context.yearIndex, semIdx: context.semIdx, message });
  }

  private normalize(value?: string | null): string {
    return (value || '').toString().trim().toUpperCase();
  }

  private parsePrereqs(prereq?: string): string[] {
    if (!prereq) return [];
    return prereq
      .split(',')
      .map((token) => this.normalize(token))
      .filter(Boolean);
  }

  private normalizePlanStatus(status?: string | null): CourseStatus {
    const raw = this.normalize(status);
    if (raw.includes('APROB')) return 'APROBADO';
    if (raw.includes('CONVALID')) return 'CONVALIDADO';
    if (raw.includes('REPROB') || raw.includes('FAIL')) return 'REPROBADO';
    if (raw.includes('INSCR')) return 'INSCRITO';
    if (raw.includes('VACANTE')) return 'VACANTE';
    if (raw.includes('BLOQUE')) return 'BLOQUEADO';
    if (raw.includes('EXCE')) return 'EXCEPCION';
    if (!raw) return 'VACANTE';
    return 'UNKNOWN';
  }

  private normalizeRecordStatus(status?: string | null, inscriptionType?: string | null): CourseStatus {
    const normalizedInscription = this.normalize(inscriptionType);
    if (normalizedInscription.includes('CONVALID') || normalizedInscription.includes('REGULAR')) {
      return 'CONVALIDADO';
    }
    return this.normalizePlanStatus(status);
  }

  private hasExceptionStatus(status?: string | null): boolean {
    const raw = this.normalize(status);
    return raw.includes('EXCEPC');
  }

  private selectFinalStatus(initial: CourseStatus, blocked: boolean): CourseStatus {
    if (blocked) return 'BLOQUEADO';
    if (initial === 'UNKNOWN') return 'VACANTE';
    return initial;
  }

  private getSemesterLabel(period?: string): string {
    const value = (period || '').toString();
    if (value.length < 6) return `Periodo ${value || 'desconocido'}`;
    const year = value.substring(0, 4);
    const suffix = value.substring(4);
    switch (suffix) {
      case '10':
        return `Primer Semestre ${year}`;
      case '15':
        return `Curso de Invierno ${year}`;
      case '20':
        return `Segundo Semestre ${year}`;
      case '25':
        return `Curso de Verano ${year}`;
      default:
        return `Periodo ${value}`;
    }
  }

  private makeId(): string {
    return Math.random().toString(36).slice(2, 9);
  }
}
