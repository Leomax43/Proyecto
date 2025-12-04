import { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import './styles/Proyecciones.css';
import YearBlock from './components/proyecciones/YearBlock';
import type { SemesterSim, YearSim, Projection } from './components/proyecciones/types';
import { makeId, makeEmptySemester, makeDefaultProjection, normalize, statusCycle, parsePrereqs, getSemesterLabel } from './utils/projectionHelpers';

// API curso shape (igual que en Malla.tsx)
type ApiCurso = {
  codigo: string;
  asignatura: string;
  creditos?: number;
  nivel?: number;
  prereq?: string;
};

type ApiAvance = {
  nrc?: string;
  period?: string;
  student?: string;
  course: string;
  excluded?: boolean;
  inscriptionType?: string;
  status?: string;
};

const STORAGE_KEY = 'proyecciones_v1';

const Proyecciones: React.FC = () => {
  const [proyecciones, setProyecciones] = useState<Projection[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as Projection[];
    } catch (e) {
      return [];
    }
  });

  const [selectedId, setSelectedId] = useState<string | null>(proyecciones[0]?.id ?? null);
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(proyecciones));
  }, [proyecciones]);

  useEffect(() => {
    // ensure selected exists
    if (proyecciones.length === 0) setSelectedId(null);
    else if (!selectedId) setSelectedId(proyecciones[0].id);
  }, [proyecciones, selectedId]);

  const selected = useMemo(() => proyecciones.find(p => p.id === selectedId) || null, [proyecciones, selectedId]);

  // normalize helper is imported from utils

  const createNew = () => {
    const p = makeDefaultProjection('Proyección ' + (proyecciones.length + 1));
    setProyecciones(prev => [p, ...prev]);
    setSelectedId(p.id);
  };

  const removeProjection = (id: string) => {
    const next = proyecciones.filter(p => p.id !== id);
    setProyecciones(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };

  const renameProjection = (id: string, title: string) => {
    setProyecciones(prev => prev.map(p => p.id === id ? { ...p, title } : p));
  };

  const addYearToProjection = (id: string) => {
    setProyecciones(prev => prev.map(p => {
      if (p.id !== id) return p;
      const last = p.years[p.years.length - 1];
      const nextIndex = (last?.yearIndex ?? 0) + 1;
      const year: YearSim = { yearIndex: nextIndex, semesters: [makeEmptySemester('Primer Semestre'), makeEmptySemester('Segundo Semestre')], title: `Año Simulado ${nextIndex}` };
      return { ...p, years: [...p.years, year] };
    }));
  };

  // (status toggling handled by toggleCourseByKey)

  const toggleYear = (idx: number) => setExpandedYears(prev => ({ ...prev, [idx]: !prev[idx] }));

  // Career/user for header like Sidebar
  const userRut = localStorage.getItem('rut');
  const userName = userRut ? `RUT: ${userRut}` : 'Usuario';
  let careerName = 'Carrera del usuario';
  const carrerasString = localStorage.getItem('carreras');
  if (carrerasString) {
    try { const carreras = JSON.parse(carrerasString); if (carreras && carreras.length > 0) careerName = carreras[0].nombre || careerName; } catch (e) { careerName = carrerasString; }
  }

  // --- Malla / cursos disponibles ---
  const [allCourses, setAllCourses] = useState<ApiCurso[]>([]);
  const [coursesLoading, setCoursesLoading] = useState<boolean>(false);
  const [, setCoursesError] = useState<string | null>(null);
  const [allAvance, setAllAvance] = useState<ApiAvance[]>([]);
  const [, setAvanceLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchMalla = async () => {
      try {
        setCoursesLoading(true);
        const carrerasString = localStorage.getItem('carreras');
        if (!carrerasString) {
          setCoursesError('No se encontraron datos de carrera en sesión.');
          return;
        }
        const carreras = JSON.parse(carrerasString);
        if (!carreras || carreras.length === 0) {
          setCoursesError('El usuario no tiene carreras asociadas.');
          return;
        }
        const carreraActual = carreras[0];
        const codigo = carreraActual.codigo;
        const catalogo = carreraActual.catalogo;
        const url = `http://localhost:3000/ucn/malla?codigo=${codigo}&catalogo=${catalogo}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Error al obtener la malla del backend');
        const data = await resp.json();
        if (!Array.isArray(data)) throw new Error('Respuesta de malla inválida');
        setAllCourses(data as ApiCurso[]);
      } catch (err) {
        setCoursesError(err instanceof Error ? err.message : String(err));
      } finally {
        setCoursesLoading(false);
      }
    };

    fetchMalla();
  }, []);

  // fetch avance (student academic records) for current user/career
  useEffect(() => {
    const fetchAvance = async () => {
      try {
        setAvanceLoading(true);
        const rut = localStorage.getItem('rut');
        const carrerasString = localStorage.getItem('carreras');
        if (!rut || !carrerasString) return;
        const carreras = JSON.parse(carrerasString);
        if (!carreras || carreras.length === 0) return;
        const carrera = carreras[0];
        const resp = await fetch(`http://localhost:3000/ucn/avance?rut=${rut}&codCarrera=${carrera.codigo}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (Array.isArray(data)) setAllAvance(data as ApiAvance[]);
      } catch (e) {
        // ignore for now
      } finally {
        setAvanceLoading(false);
      }
    };
    fetchAvance();
  }, []);

  // Computar ramos no cursados: consideramos como "cursados" solo los que estén APROBADO en la proyección o avance
  // Manual not-taken list removed — we keep course data for simulation but no longer expose the manual list

  // --- Sugerencias automáticas por semestre ---
  const suggestedProjectionView = useMemo(() => {
    if (!selected || !allCourses || allCourses.length === 0) return selected?.years ?? [];

    // map of NORMALIZED code -> ApiCurso for quick lookup
    const courseByCode = new Map<string, ApiCurso>(allCourses.map(c => [normalize(c.codigo), c]));

    // parsePrereqs imported from utils

    // Build sets of already-approved courses from backend `avance` (these are globally available)
    const avanceApproved = new Set<string>();
    allAvance.forEach(a => {
      const st = (a.status || '').toLowerCase();
      const it = (a.inscriptionType || '').toLowerCase();
      if (a.course && (st.includes('aprob') || st.includes('inscrit') || it.includes('convalidaci') || it.includes('regularizacion'))) {
        avanceApproved.add(normalize(a.course));
      }
    });

    // gather projection-approved courses with their positions so we only consider those from earlier semesters
    type Pos = { code: string; yearIndex: number; semIdx: number };
    const projectionApproved: Pos[] = [];
    selected.years.forEach(y => y.semesters.forEach((s, si) => s.courses.forEach(c => {
      if (c.code && (c.status || '').toUpperCase() === 'APROBADO') projectionApproved.push({ code: normalize(c.code), yearIndex: y.yearIndex, semIdx: si });
    })));

    // getSemesterLabel imported from utils

    let yearActual = selected.years.find(y => y.yearIndex === 0) || selected.years[0];
    if (allAvance && allAvance.length > 0) {
      // find latest calendar year in avance periods
      const periods = Array.from(new Set(allAvance.map(a => a.period).filter(Boolean))) as string[];
      const years = Array.from(new Set(periods.map(p => p.substring(0,4)))).sort();
      const lastYear = years[years.length - 1];
      if (lastYear) {
        const periodsInYear = periods.filter(p => p.substring(0,4) === lastYear)
          .sort((a,b) => parseInt(a.substring(4)) - parseInt(b.substring(4)));
        // build semesters for the yearActual from avance entries grouped by period
        const semestersBuilt: SemesterSim[] = periodsInYear.map(period => {
          const entries = allAvance.filter(a => a.period === period);
          const courses = entries.map(e => ({ id: makeId(), code: e.course, status: (e.status || '').toUpperCase() }));
          return { label: getSemesterLabel(period), courses };
        });
        // ensure at least two semesters
        // ensure at least two semesters (if only one period found, add a second empty)
        while (semestersBuilt.length < 2) semestersBuilt.push(makeEmptySemester(semestersBuilt.length === 0 ? 'Primer Semestre' : 'Segundo Semestre'));
        // keep all semesters found (including winter) so winter appears between 1 and 2
        yearActual = { yearIndex: 0, semesters: semestersBuilt, title: 'Año Actual' };
      }
    }
    // Merge persisted Año Actual statuses from selected projection (if any) so user's REPROBADO/VACANTE changes
    // are reflected in the simulation. We prefer persisted box objects by normalized code.
    if (selected) {
      const persistedYear = selected.years.find(yy => yy.yearIndex === 0);
      if (persistedYear && yearActual) {
        const persistedLookup = new Map<string, any>();
        persistedYear.semesters.forEach(s => s.courses.forEach(c => { if (c.code) persistedLookup.set(normalize(c.code), c); }));
        yearActual.semesters = yearActual.semesters.map(s => ({ ...s, courses: s.courses.map(c => {
          const norm = normalize(c.code);
          if (persistedLookup.has(norm)) {
            return { ...persistedLookup.get(norm) };
          }
          return c;
        }) }));
      }
    }
    let currentSemCourses: string[] = [];
    if (yearActual) {
      const semWithContentIdx = [...yearActual.semesters.keys()].reverse().find(i => yearActual.semesters[i].courses.some(c => c.code && (c.code || '').trim() !== ''));
      const idx = semWithContentIdx ?? 0;
      currentSemCourses = yearActual.semesters[idx].courses.map(c => normalize(c.code)).filter(Boolean) as string[];
    }

    // Determine the student's most advanced course level (nivel) from current semester and approved courses.
    const getNivel = (norm: string) => courseByCode.get(norm)?.nivel ?? 0;
    const maxNivelCurrent = currentSemCourses.reduce((acc, cur) => Math.max(acc, getNivel(cur)), 0);
    const maxNivelApproved = Array.from(avanceApproved.values ? avanceApproved.values() : avanceApproved).reduce((acc, cur: any) => Math.max(acc, getNivel(cur)), 0);
    const maxNivelProjectionApproved = projectionApproved.reduce((acc, p) => Math.max(acc, getNivel(p.code)), 0);
    const overallMaxNivel = Math.max(1, maxNivelCurrent, maxNivelApproved, maxNivelProjectionApproved);
    // Policy: cannot take courses that are 3 semesters ahead of the furthest course -> allowed up to +2 niveles
    const allowedMaxNivel = overallMaxNivel + 2;

    // exclude already passed or present courses from candidate pool: only APROBADO counts as taken
    const alreadyTaken = new Set<string>();
    selected.years.forEach(y => y.semesters.forEach(s => s.courses.forEach(c => {
      if (c.code && ((c.status || '').toUpperCase() === 'APROBADO')) alreadyTaken.add(normalize(c.code));
    })));
    // also include avance-approved as already taken
    avanceApproved.forEach(x => alreadyTaken.add(x));

    // We'll simulate semester-by-semester and only allow prereqs that are satisfied by courses
    // from earlier semesters/years (including approved from `avance` and approved in projection earlier positions).

    const isBefore = (aYear: number, aSem: number, bYear: number, bSem: number) => (aYear < bYear) || (aYear === bYear && aSem < bSem);

    // Helper to test if prereqs are met given a base passed set
    const prereqsMetAgainst = (codigoNorm: string, basePassed: Set<string>) => {
      const api = courseByCode.get(codigoNorm);
      if (!api) return false;
      const prereqs = parsePrereqs(api.prereq);
      return prereqs.every(r => basePassed.has(r));
    };

    // Build suggested years array (deep copy of selected years, but fill simulated years' empty slots with suggestions)
    const suggestedYears: YearSim[] = selected.years.map(y => ({ ...y, semesters: y.semesters.map(s => ({ ...s, courses: s.courses.map(c => ({ ...c })) })) }));

    // replace Año Actual in suggestedYears with yearActual built from avance when present
    const idxActual = suggestedYears.findIndex(y => y.yearIndex === 0);
    if (idxActual >= 0 && yearActual) {
      suggestedYears[idxActual] = { ...yearActual, semesters: yearActual.semesters.map(s => ({ ...s, courses: s.courses.map(c => ({ ...c })) })) };
    }

    // For each year after actual, for each semester, pick up to slotsPerSemester courses whose prereqs are met
    for (const y of suggestedYears.filter(yy => yy.yearIndex > 0).sort((a,b)=>a.yearIndex - b.yearIndex)) {
      for (let si = 0; si < y.semesters.length; si++) {
        const sem = y.semesters[si];
        // Carry over REPROBADO courses from the previous year last semester into the first semester
        if (si === 0) {
          const prevYear = suggestedYears.find(py => py.yearIndex === y.yearIndex - 1);
          if (prevYear) {
            const prevLastSem = prevYear.semesters[prevYear.semesters.length - 1];
            const prevReprobs = prevLastSem.courses.filter(c => (c.status || '').toUpperCase() === 'REPROBADO').map(c => normalize(c.code));
            if (prevReprobs.length > 0) {
              const nextNorms = new Set(sem.courses.map(c => normalize(c.code)));
              for (const rn of prevReprobs) {
                if (!nextNorms.has(rn)) {
                  const origCode = courseByCode.get(rn)?.codigo ?? rn;
                  sem.courses.push({ id: makeId(), code: origCode, status: 'VACANTE' });
                  nextNorms.add(rn);
                }
              }
            }
          }
        }
        const filledCodesAll = sem.courses.map(c => (c.code || '').trim()).filter(Boolean) as string[];

        // remove from filledCodes any course that is already approved in an earlier semester
        const filledCodes = filledCodesAll.filter(code => {
          const norm = normalize(code);
          // approved by backend (always considered earlier)
          if (avanceApproved.has(norm)) return false;
          // approved in projection in an earlier position
          const approvedEarlier = projectionApproved.some(p => p.code === norm && isBefore(p.yearIndex, p.semIdx, y.yearIndex, si));
          return !approvedEarlier;
        });

        // Build base passed set for this semester: include avance-approved and projection-approved from earlier positions
        const basePassed = new Set<string>();
        avanceApproved.forEach(x => basePassed.add(x));
        projectionApproved.forEach(p => {
          if (isBefore(p.yearIndex, p.semIdx, y.yearIndex, si)) basePassed.add(p.code);
        });
        // include current semester courses (assume passed) for simulated years (they unlock next semesters)
        if (y.yearIndex > 0) {
          currentSemCourses.forEach(c => basePassed.add(c));
        }

        // candidates: allCourses codes not in alreadyTaken and not in basePassed and whose prereqs are met against basePassed
        const candidates = allCourses
          .map(c => ({ orig: c.codigo, norm: normalize(c.codigo) }))
          .filter(({ norm }) => norm && !alreadyTaken.has(norm) && !basePassed.has(norm))
          // enforce allowed nivel distance from student's most advanced course
          .filter(({ norm }) => {
            const nivel = courseByCode.get(norm)?.nivel ?? 999;
            return nivel <= allowedMaxNivel;
          })
          .filter(({ norm }) => prereqsMetAgainst(norm, basePassed))
          // prefer lower nivel if available
          .sort((a, b) => {
            const na = courseByCode.get(a.norm)?.nivel ?? 999;
            const nb = courseByCode.get(b.norm)?.nivel ?? 999;
            return na - nb;
          });

        const selectedForThisSemNorm = candidates.map(x => x.norm);

        // Do NOT mark planned candidates as passed here. We assume the student only
        // passes their current real semester — planned (VACANTE) courses do not
        // unlock further courses in this simulation run.

        // Combine existing filled codes with the candidates (avoid duplicates) using normalized keys
        const filledNorms = filledCodes.map(x => normalize(x));
        const combinedNorms = Array.from(new Set([...filledNorms, ...selectedForThisSemNorm]));

        // Build course boxes: keep original objects for those that had codes, and add new candidate boxes (status: VACANTE)
        const existingMap = new Map<string, any>();
        // only keep existing box objects for filled codes that are not approved earlier
        sem.courses.forEach(c => {
          if (!c.code) return;
          const norm = normalize(c.code);
          const keep = filledCodes.includes((c.code || '').trim());
          if (keep) existingMap.set(norm, c);
        });

        sem.courses = combinedNorms.map(norm => {
          if (existingMap.has(norm)) return existingMap.get(norm);
          const origCode = courseByCode.get(norm)?.codigo ?? norm;
          return { id: makeId(), code: origCode, status: 'VACANTE' };
        });

        // If any course in this semester is marked REPROBADO, also ensure it appears in the next semester as VACANTE
        const reprobs = sem.courses.filter(c => (c.status || '').toUpperCase() === 'REPROBADO').map(c => normalize(c.code));
        if (reprobs.length > 0) {
          // determine next semester; if none, create one
          let nextSemIdx = si + 1;
          if (nextSemIdx >= y.semesters.length) {
            // append a new semester to current year
            y.semesters.push(makeEmptySemester(`Semestre adicional ${y.semesters.length + 1}`));
          }
          // ensure we have a reference to the updated next semester
          const nextSem = y.semesters[nextSemIdx] || y.semesters[y.semesters.length - 1];
          // add reprobs as VACANTE in next semester if not already present
          const nextNorms = new Set(nextSem.courses.map(c => normalize(c.code)));
          for (const rn of reprobs) {
            if (!nextNorms.has(rn)) {
              const origCode = courseByCode.get(rn)?.codigo ?? rn;
              nextSem.courses.push({ id: makeId(), code: origCode, status: 'VACANTE' });
              nextNorms.add(rn);
            }
          }
        }
      }
    }

    // For Año Actual, ensure it shows the student's last-semester courses (we already copied selected)
    return suggestedYears;
  }, [selected, allCourses]);

  // Persist carried VACANTE courses from the simulated suggestion into the actual projection
  useEffect(() => {
    if (!selected || !suggestedProjectionView || suggestedProjectionView.length === 0) return;
    // operate only on the selected projection
    setProyecciones(prev => prev.map(p => {
      if (p.id !== selected.id) return p;
      let changed = false;
      const nextYears = p.years.map(y => {
        // only consider simulated years (> 0)
        if (y.yearIndex === 0) return y;
        const suggestedYear = suggestedProjectionView.find(sy => sy.yearIndex === y.yearIndex);
        if (!suggestedYear) return y;
        const semesters = y.semesters.map((sem, si) => {
          const suger = suggestedYear.semesters[si];
          if (!suger) return sem;
          const semNorms = new Set(sem.courses.map(c => normalize(c.code)));
          // take VACANTE courses from suggested that are not present in real sem
          const toAdd = suger.courses
            .filter(c => (c.status || '').toUpperCase() === 'VACANTE')
            .map(c => normalize(c.code))
            .filter(n => n && !semNorms.has(n));
          if (toAdd.length === 0) return sem;
          changed = true;
          // fill empty slots first
          const courses = sem.courses.map(c => {
            if (toAdd.length > 0 && (!c.code || (c.code || '').trim() === '')) {
              const code = toAdd.shift()!;
              return { ...c, code, status: 'VACANTE' };
            }
            return c;
          });
          while (toAdd.length > 0) {
            courses.push({ id: makeId(), code: toAdd.shift()!, status: 'VACANTE' });
          }
          return { ...sem, courses };
        });
        return { ...y, semesters };
      });
      if (!changed) return p;
      return { ...p, years: nextYears };
    }));
  }, [suggestedProjectionView, selected, setProyecciones]);

  // Attach course names to boxes for display
  const viewYearsWithNames = useMemo(() => {
    // Prefer showing the simulated suggestion view, but when a course box
    // exists in the real selected projection (persisted), use that box object
    // so toggles operate on the persistent instance (avoids mismatch of ids).
    const source = (suggestedProjectionView && suggestedProjectionView.length > 0) ? suggestedProjectionView : (selected ? selected.years : []);
    const nameMap = new Map<string, string>(allCourses.map(c => [c.codigo.trim(), c.asignatura]));

    // Build a lookup of persisted boxes by year|semIdx|normalizedCode -> box
    const persistedLookup = new Map<string, any>();
    if (selected) {
      selected.years.forEach(y => y.semesters.forEach((s, si) => s.courses.forEach(c => {
        if (c.code) persistedLookup.set(`${y.yearIndex}|${si}|${normalize(c.code)}`, c);
      })));
    }

    return source.map(y => ({
      ...y,
      semesters: y.semesters.map((s, si) => ({
        ...s,
        courses: s.courses.map(c => {
          // if there's a persisted box for this year/sem/code, prefer it
          const norm = normalize(c.code);
          const key = `${y.yearIndex}|${si}|${norm}`;
          const persisted = persistedLookup.get(key);
          const box = persisted ? { ...persisted } : { ...c };
          return { ...box, name: box.code ? (nameMap.get((box.code || '').trim()) || undefined) : undefined };
        })
      }))
    }));
  }, [suggestedProjectionView, selected, allCourses]);

  // Manual "Ramos no cursados" UI removed per request; additions are done via automatic suggestions.

  // Toggle by code or id. If course exists in the projection, toggle its status.
  // If not found, add it to the target semester with initial status 'VACANTE'.
  const toggleCourseByKey = (projId: string, yearIndex: number, semIdx: number, key: string) => {
    setProyecciones(prev => prev.map(p => {
      if (p.id !== projId) return p;

      const parts = key.split('||');
      const boxId = parts[0] || '';
      const boxCode = (parts[1] || '').trim();
      const normBoxCode = normalize(boxCode || '');

      const ensureSemesters = (y: any, idx: number) => {
        const copy = { ...y };
        const sems = [...copy.semesters];
        while (sems.length <= idx) sems.push(makeEmptySemester(`Semestre adicional ${sems.length + 1}`));
        copy.semesters = sems;
        return copy;
      };

      // 1) Toggle in exact target semester by id
      if (boxId) {
        const years = p.years.map(y => {
          if (y.yearIndex !== yearIndex) return y;
          const yWithSems = ensureSemesters(y, semIdx);
          const semesters = yWithSems.semesters.map((s: any, si: number) => {
            if (si !== semIdx) return s;
            const courses = s.courses.map((c: any) => c.id === boxId ? { ...c, status: statusCycle(c.status) } : c);
            return { ...s, courses };
          });
          return { ...yWithSems, semesters };
        });
        // detect change by searching for boxId
        const changed = years.some((y: any) => y.yearIndex === yearIndex && y.semesters.some((s: any) => s.courses.some((c: any) => c.id === boxId)));
        if (changed) return { ...p, years };
      }

      // 2) Toggle anywhere by id or code
      for (const y of p.years) {
        for (let si = 0; si < y.semesters.length; si++) {
          const s = y.semesters[si];
          for (let ci = 0; ci < s.courses.length; ci++) {
            const c = s.courses[ci];
            if ((boxId && c.id === boxId) || (boxCode && normalize(c.code) === normBoxCode)) {
              const years = p.years.map(yy => ({ ...yy, semesters: yy.semesters.map(ss => ({ ...ss, courses: ss.courses.map(cc => ((cc.id === c.id) ? { ...cc, status: statusCycle(cc.status) } : cc)) })) }));
              return { ...p, years };
            }
          }
        }
      }

      // 3) Not found: add to target semester
      const yearsAdd = p.years.map(y => {
        if (y.yearIndex !== yearIndex) return y;
        const yWithSems = ensureSemesters(y, semIdx);
        const target = yWithSems.semesters[semIdx];
        let filled = false;
        const codeToAdd = boxCode || boxId;
        // if a course with the same normalized code already exists in target, toggle it instead of adding
        const targetNorms = target.courses.map((c: any) => normalize(c.code));
        if (normBoxCode && targetNorms.includes(normBoxCode)) {
          const semesters = [...yWithSems.semesters];
          const courses = target.courses.map((c: any) => normalize(c.code) === normBoxCode ? { ...c, status: statusCycle(c.status) } : c);
          semesters[semIdx] = { ...target, courses };
          return { ...yWithSems, semesters };
        }

        const courses = target.courses.map((c: any) => {
          if (!filled && (!c.code || c.code.trim() === '')) { filled = true; return { ...c, code: codeToAdd, status: 'VACANTE' }; }
          return c;
        });
        if (!filled) courses.push({ id: makeId(), code: codeToAdd, status: 'VACANTE' });
        const semesters = [...yWithSems.semesters];
        semesters[semIdx] = { ...target, courses };
        return { ...yWithSems, semesters };
      });
      return { ...p, years: yearsAdd };
    }));
  };

  return (
    <div className="proyecciones-root" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main className="proyecciones-main">
        <div className="proyecciones-container">
          <header className="proyecciones-header">
            <div>
              <h1>Proyección</h1>
              <div className="proyecciones-sub">{userName} · {careerName}</div>
            </div>
            <div className="proyecciones-actions">
              <button className="btn primary" onClick={() => { if (selected) addYearToProjection(selected.id); }}>Agregar Año</button>
              <button className="btn" onClick={createNew}>Nueva Proyección</button>
            </div>
          </header>

          <div className="proyecciones-body">
            <aside className="proyecciones-sidebar">
              <div className="proj-list-header">Tus proyecciones</div>
              <ul className="proj-list">
                {proyecciones.map(p => (
                  <li key={p.id} className={p.id === selectedId ? 'proj-item active' : 'proj-item'} onClick={() => setSelectedId(p.id)}>
                    <div className="proj-title">{p.title}</div>
                    <div className="proj-meta">{new Date(p.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            </aside>

            <section className="proyecciones-detail">
              {!selected && (
                <div className="empty-state">Selecciona o crea una proyección para empezar</div>
              )}

              {selected && (
                <div>
                  <div className="proj-head">
                    <input className="proj-title-input" value={selected.title} onChange={e => renameProjection(selected.id, e.target.value)} />
                    <div className="proj-controls">
                      <button className="btn danger" onClick={() => removeProjection(selected.id)}>Eliminar</button>
                    </div>
                  </div>

                  <div className="years-list">
                    {viewYearsWithNames.map((y) => (
                      <YearBlock
                        key={y.yearIndex}
                        year={y}
                        expanded={!!expandedYears[y.yearIndex]}
                        onToggle={toggleYear}
                        onToggleCourse={(yearIndex, semIdx, courseKey) => toggleCourseByKey(selected.id, yearIndex, semIdx, courseKey)}
                      />
                    ))}
                  </div>
                  {/* Manual additions removed — UI now shows only automatic suggestions */}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Proyecciones;
