import { Injectable } from '@nestjs/common';
import { ProyeccionDto, SimulationResultDto, YearDto, SemesterDto, CourseBoxDto, WarningDto } from './dto/simulate-projection.dto';

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

interface CandidateItem {
  orig: string;
  norm: string;
  nivel: number;
  creditos: number;
  prereqs: string[];
}

@Injectable()
export class SimulationService {
  
  /**
   * Main simulation logic: given current projection, malla and avance,
   * compute suggested courses for future semesters
   */
  simulate(
    proyeccion: ProyeccionDto,
    allCourses: ApiCurso[],
    allAvance: ApiAvance[],
  ): SimulationResultDto {
    const warnings: WarningDto[] = [];
    
    if (!allCourses || allCourses.length === 0) {
      return { years: proyeccion.years || [], warnings };
    }

    // Build metadata maps
    const { courseByCode, creditMap, nivelMap, prereqsMap } = this.buildMetadata(allCourses);

    // Identify approved courses from avance
    const avanceApproved = this.getApprovedFromAvance(allAvance);

    // Gather projection-approved courses with positions
    const projectionApproved = this.getProjectionApproved(proyeccion.years);

    // Build Año Actual from avance
    let yearActual = this.buildCurrentYearFromAvance(
      allAvance,
      proyeccion.years,
      creditMap,
    );

    // Merge persisted statuses
    yearActual = this.mergePersistedStatuses(yearActual, proyeccion.years);

    // Calculate current semester courses
    const currentSemCourses = this.getCurrentSemesterCourses(yearActual);

    // Calculate max allowed level
    const overallMaxNivel = this.calculateMaxNivel(
      currentSemCourses,
      avanceApproved,
      projectionApproved,
      nivelMap,
    );
    const allowedMaxNivel = overallMaxNivel + 2;

    // Build already taken set
    const alreadyTaken = new Set<string>();
    for (const y of proyeccion.years) {
      for (const s of y.semesters) {
        for (const c of s.courses) {
          if (c.code && c.status?.toUpperCase() === 'APROBADO') {
            alreadyTaken.add(this.normalize(c.code));
          }
        }
      }
    }
    avanceApproved.forEach(x => alreadyTaken.add(x));

    // Precompute candidate pool
    const allCandidatesPool = this.buildCandidatePool(
      allCourses,
      nivelMap,
      creditMap,
      prereqsMap,
      allowedMaxNivel,
      alreadyTaken,
    );

    // Build suggested years
    const suggestedYears = this.simulateFutureSemesters(
      proyeccion.years,
      yearActual,
      allCandidatesPool,
      avanceApproved,
      projectionApproved,
      currentSemCourses,
      courseByCode,
      creditMap,
      warnings,
    );

    return { years: suggestedYears, warnings };
  }

  // ========== Helper Methods ==========

  private normalize(s?: string): string {
    return (s || '').toString().trim().toUpperCase();
  }

  private parsePrereqs(p?: string): string[] {
    if (!p) return [];
    return p.split(',').map(x => this.normalize(x)).filter(Boolean);
  }

  private buildMetadata(allCourses: ApiCurso[]) {
    const courseByCode = new Map<string, ApiCurso>();
    const creditMap = new Map<string, number>();
    const nivelMap = new Map<string, number>();
    const prereqsMap = new Map<string, string[]>();

    for (const c of allCourses) {
      const n = this.normalize(c.codigo);
      courseByCode.set(n, c);
      creditMap.set(n, c.creditos ?? 0);
      nivelMap.set(n, c.nivel ?? 0);
      prereqsMap.set(n, this.parsePrereqs(c.prereq));
    }

    return { courseByCode, creditMap, nivelMap, prereqsMap };
  }

  private getApprovedFromAvance(allAvance: ApiAvance[]): Set<string> {
    const approved = new Set<string>();
    allAvance.forEach(a => {
      const st = (a.status || '').toLowerCase();
      const it = (a.inscriptionType || '').toLowerCase();
      if (a.course && (st.includes('aprob') || st.includes('inscrit') || 
          it.includes('convalidaci') || it.includes('regularizacion'))) {
        approved.add(this.normalize(a.course));
      }
    });
    return approved;
  }

  private getProjectionApproved(years: YearDto[]): Array<{ code: string; yearIndex: number; semIdx: number }> {
    const approved: Array<{ code: string; yearIndex: number; semIdx: number }> = [];
    for (const y of years) {
      for (let si = 0; si < y.semesters.length; si++) {
        const s = y.semesters[si];
        for (const c of s.courses) {
          if (c.code && c.status?.toUpperCase() === 'APROBADO') {
            approved.push({ code: this.normalize(c.code), yearIndex: y.yearIndex, semIdx: si });
          }
        }
      }
    }
    return approved;
  }

  private buildCurrentYearFromAvance(
    allAvance: ApiAvance[],
    years: YearDto[],
    creditMap: Map<string, number>,
  ): YearDto {
    let yearActual = years.find(y => y.yearIndex === 0) || years[0];
    
    if (!allAvance || allAvance.length === 0) {
      return yearActual;
    }

    const periods = Array.from(new Set(allAvance.map(a => a.period).filter(Boolean))) as string[];
    const yearNumbers = Array.from(new Set(periods.map(p => p.substring(0, 4)))).sort();
    const lastYear = yearNumbers[yearNumbers.length - 1];

    if (!lastYear) return yearActual;

    const periodsInYear = periods
      .filter(p => p.substring(0, 4) === lastYear)
      .sort((a, b) => parseInt(a.substring(4)) - parseInt(b.substring(4)));

    const semestersBuilt: SemesterDto[] = periodsInYear.map(period => {
      const entries = allAvance.filter(a => a.period === period);
      const courses = entries.map(e => ({
        id: this.makeId(),
        code: e.course,
        status: (e.status || '').toUpperCase(),
        creditos: creditMap.get(this.normalize(e.course)) ?? 0,
      }));
      return { label: this.getSemesterLabel(period), courses };
    });

    while (semestersBuilt.length < 2) {
      semestersBuilt.push(this.makeEmptySemester(
        semestersBuilt.length === 0 ? 'Primer Semestre' : 'Segundo Semestre'
      ));
    }

    const lastNonEmptyIdx = [...semestersBuilt.keys()]
      .reverse()
      .find(i => semestersBuilt[i].courses.some(c => c.code && c.code.trim() !== '')) ?? (semestersBuilt.length - 1);

    const lastSem = semestersBuilt[Math.max(0, lastNonEmptyIdx)];
    
    return {
      yearIndex: 0,
      semesters: [lastSem],
      title: 'Semestre Actual',
    };
  }

  private mergePersistedStatuses(yearActual: YearDto, years: YearDto[]): YearDto {
    const persistedYear = years.find(yy => yy.yearIndex === 0);
    if (!persistedYear) return yearActual;

    const persistedLookup = new Map<string, CourseBoxDto>();
    for (const s of persistedYear.semesters) {
      for (const c of s.courses) {
        if (c.code) persistedLookup.set(this.normalize(c.code), c);
      }
    }

    return {
      ...yearActual,
      semesters: yearActual.semesters.map(s => ({
        ...s,
        courses: s.courses.map(c => {
          const norm = this.normalize(c.code);
          const persisted = persistedLookup.get(norm);
          if (persisted) {
            return {
              ...persisted,
              id: persisted.id || c.id || '',
              code: persisted.code || c.code || '',
              name: persisted.name || c.name || '',
            };
          }
          return {
            ...c,
            id: c.id || '',
            code: c.code || '',
            name: c.name || '',
          };
        }),
      })),
    };
  }

  private getCurrentSemesterCourses(yearActual: YearDto): string[] {
    if (!yearActual) return [];
    const semWithContentIdx = [...yearActual.semesters.keys()]
      .reverse()
      .find(i => yearActual.semesters[i].courses.some(c => c.code && c.code.trim() !== ''));
    const idx = semWithContentIdx ?? 0;
    return yearActual.semesters[idx].courses
      .map(c => this.normalize(c.code))
      .filter(Boolean) as string[];
  }

  private calculateMaxNivel(
    currentSemCourses: string[],
    avanceApproved: Set<string>,
    projectionApproved: Array<{ code: string; yearIndex: number; semIdx: number }>,
    nivelMap: Map<string, number>,
  ): number {
    const getNivel = (norm: string) => nivelMap.get(norm) ?? 0;
    const maxNivelCurrent = currentSemCourses.reduce((acc, cur) => Math.max(acc, getNivel(cur)), 0);
    const maxNivelApproved = Array.from(avanceApproved).reduce((acc, cur) => Math.max(acc, getNivel(cur)), 0);
    const maxNivelProjectionApproved = projectionApproved.reduce((acc, p) => Math.max(acc, getNivel(p.code)), 0);
    return Math.max(1, maxNivelCurrent, maxNivelApproved, maxNivelProjectionApproved);
  }

  private buildCandidatePool(
    allCourses: ApiCurso[],
    nivelMap: Map<string, number>,
    creditMap: Map<string, number>,
    prereqsMap: Map<string, string[]>,
    allowedMaxNivel: number,
    alreadyTaken: Set<string>,
  ): CandidateItem[] {
    return allCourses
      .map(c => {
        const norm = this.normalize(c.codigo);
        return {
          orig: c.codigo,
          norm,
          nivel: nivelMap.get(norm) ?? 999,
          creditos: creditMap.get(norm) ?? 0,
          prereqs: prereqsMap.get(norm) ?? [],
        };
      })
      .filter(x => x.norm && x.nivel <= allowedMaxNivel && !alreadyTaken.has(x.norm));
  }

  private simulateFutureSemesters(
    originalYears: YearDto[],
    yearActual: YearDto,
    allCandidatesPool: CandidateItem[],
    avanceApproved: Set<string>,
    projectionApproved: Array<{ code: string; yearIndex: number; semIdx: number }>,
    currentSemCourses: string[],
    courseByCode: Map<string, ApiCurso>,
    creditMap: Map<string, number>,
    warnings: WarningDto[],
  ): YearDto[] {
    // Deep copy years
    const suggestedYears: YearDto[] = originalYears.map(y => ({
      ...y,
      semesters: y.semesters.map(s => ({
        ...s,
        courses: s.courses.map(c => ({ ...c })),
      })),
    }));

    // Replace Año Actual
    const idxActual = suggestedYears.findIndex(y => y.yearIndex === 0);
    if (idxActual >= 0 && yearActual) {
      suggestedYears[idxActual] = {
        ...yearActual,
        semesters: yearActual.semesters.map(s => ({
          ...s,
          courses: s.courses.map(c => ({ ...c })),
        })),
      };
    }

    const isBefore = (aYear: number, aSem: number, bYear: number, bSem: number) =>
      aYear < bYear || (aYear === bYear && aSem < bSem);

    // Simulate each future year
    for (const y of suggestedYears.filter(yy => yy.yearIndex > 0).sort((a, b) => a.yearIndex - b.yearIndex)) {
      for (let si = 0; si < y.semesters.length; si++) {
        const sem = y.semesters[si];

        // Carry over REPROBADO from previous year
        if (si === 0) {
          const prevYear = suggestedYears.find(py => py.yearIndex === y.yearIndex - 1);
          if (prevYear) {
            const prevLastSem = prevYear.semesters[prevYear.semesters.length - 1];
            const prevReprobs = prevLastSem.courses
              .filter(c => c.status?.toUpperCase() === 'REPROBADO')
              .map(c => this.normalize(c.code));
            
            if (prevReprobs.length > 0) {
              const nextNorms = new Set(sem.courses.map(c => this.normalize(c.code)));
              for (const rn of prevReprobs) {
                if (!nextNorms.has(rn)) {
                  const origCode = courseByCode.get(rn)?.codigo ?? rn;
                  sem.courses.push({ id: this.makeId(), code: origCode, status: 'VACANTE' });
                  nextNorms.add(rn);
                }
              }
            }
          }
        }

        // Compute filled codes
        const filledCodesAll = sem.courses.map(c => (c.code || '').trim()).filter(Boolean) as string[];
        const filledCodes = filledCodesAll.filter(code => {
          const norm = this.normalize(code);
          if (avanceApproved.has(norm)) return false;
          return !projectionApproved.some(p => p.code === norm && isBefore(p.yearIndex, p.semIdx, y.yearIndex, si));
        });
        const filledNorms = filledCodes.map(x => this.normalize(x));

        // Build basePassed
        const basePassed = new Set<string>(avanceApproved);
        for (const p of projectionApproved) {
          if (isBefore(p.yearIndex, p.semIdx, y.yearIndex, si)) basePassed.add(p.code);
        }
        if (y.yearIndex > 0) {
          for (const c of currentSemCourses) basePassed.add(c);
        }

        // Select candidates
        const selectedForThisSemNorm = this.selectCandidatesForSemester(
          allCandidatesPool,
          basePassed,
          filledNorms,
          creditMap,
          30,
        );

        const combinedNorms = Array.from(new Set([...filledNorms, ...selectedForThisSemNorm]));

        // Build course boxes
        const existingMap = new Map<string, CourseBoxDto>();
        for (const c of sem.courses) {
          if (!c.code) continue;
          const norm = this.normalize(c.code);
          if (filledCodes.includes(c.code.trim())) existingMap.set(norm, c);
        }

        sem.courses = combinedNorms.map(norm => {
          if (existingMap.has(norm)) return existingMap.get(norm)!;
          const origCode = courseByCode.get(norm)?.codigo ?? norm;
          const creds = creditMap.get(norm) ?? 0;
          return { id: this.makeId(), code: origCode, status: 'VACANTE', creditos: creds };
        });

        // Handle REPROBADO carry-forward
        const reprobs = sem.courses
          .filter(c => c.status?.toUpperCase() === 'REPROBADO')
          .map(c => this.normalize(c.code));
        
        if (reprobs.length > 0) {
          let nextSemIdx = si + 1;
          if (nextSemIdx >= y.semesters.length) {
            y.semesters.push(this.makeEmptySemester(`Semestre adicional ${y.semesters.length + 1}`));
          }
          const nextSem = y.semesters[nextSemIdx];
          const nextNorms = new Set(nextSem.courses.map(c => this.normalize(c.code)));
          let nextCredits = Array.from(nextNorms).reduce((acc, n) => acc + (creditMap.get(n) ?? 0), 0);

          for (const rn of reprobs) {
            if (nextNorms.has(rn)) continue;
            const cred = creditMap.get(rn) ?? 0;
            const origCode = courseByCode.get(rn)?.codigo ?? rn;
            if (nextCredits + cred <= 30) {
              const creds = creditMap.get(rn) ?? 0;
              nextSem.courses.push({ id: this.makeId(), code: origCode, status: 'VACANTE', creditos: creds });
              nextNorms.add(rn);
              nextCredits += cred;
            } else {
              warnings.push({
                yearIndex: y.yearIndex,
                semIdx: nextSemIdx,
                message: `No se pudo arrastrar ${origCode} por límite de créditos`,
              });
            }
          }
        }
      }
    }

    return suggestedYears;
  }

  private selectCandidatesForSemester(
    pool: CandidateItem[],
    basePassed: Set<string>,
    filledNorms: string[],
    creditMap: Map<string, number>,
    cap: number,
  ): string[] {
    const candidates = pool
      .filter(item => !basePassed.has(item.norm) && item.prereqs.every(r => basePassed.has(r)))
      .sort((a, b) => a.nivel - b.nivel);

    let currentCredits = filledNorms.reduce((acc, fn) => acc + (creditMap.get(fn) ?? 0), 0);
    const selectedForThisSemNorm: string[] = [];

    for (const cand of candidates) {
      if (filledNorms.includes(cand.norm)) continue;
      const cred = cand.creditos;
      if (currentCredits + cred <= cap) {
        selectedForThisSemNorm.push(cand.norm);
        currentCredits += cred;
      }
    }

    return selectedForThisSemNorm;
  }

  // Utility functions
  private makeId(): string {
    return Math.random().toString(36).slice(2, 9);
  }

  private makeEmptySemester(label = 'Primer Semestre'): SemesterDto {
    return {
      label,
      courses: Array.from({ length: 5 }).map(() => ({ id: this.makeId(), code: '', status: '' })),
    };
  }

  private getSemesterLabel(period?: string): string {
    if (!period || period.length < 6) return `Periodo ${period}`;
    const suffix = period.substring(4);
    switch (suffix) {
      case '10': return 'Primer Semestre';
      case '15': return 'Curso de Invierno';
      case '20': return 'Segundo Semestre';
      case '25': return 'Curso de Verano';
      default: return `Periodo ${period}`;
    }
  }
}
