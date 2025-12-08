import { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import './styles/Proyecciones.css';
import YearBlock from './components/proyecciones/YearBlock';
import type { YearSim, SemesterSim, Projection, CourseBox } from './components/proyecciones/types';
import { makeId, makeEmptySemester, makeDefaultProjection, normalize, statusCycle } from './utils/projectionHelpers';
import { apiGet } from './config/api';
import { useProjectionSimulation } from './hooks/useProjectionSimulation';

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

// Utilidad para obtener nombre de carrera y rut
function getUserCareerData() {
  const rut = localStorage.getItem('rut');
  let careerName = 'Carrera del usuario';
  const carrerasString = localStorage.getItem('carreras');
  if (carrerasString) {
    try {
      const carreras = JSON.parse(carrerasString);
      if (carreras && carreras.length > 0) careerName = carreras[0].nombre || careerName;
    } catch (e) {
      careerName = carrerasString;
    }
  }
  return { rut, careerName };
}

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
    if (proyecciones.length === 0) setSelectedId(null);
    else if (!selectedId) setSelectedId(proyecciones[0].id);
  }, [proyecciones, selectedId]);

  const selected = useMemo(() => proyecciones.find(p => p.id === selectedId) || null, [proyecciones, selectedId]);

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

  const toggleYear = (idx: number) => setExpandedYears(prev => ({ ...prev, [idx]: !prev[idx] }));

  // --- Malla / cursos disponibles ---
  const [allCourses, setAllCourses] = useState<ApiCurso[]>([]);
  const [_allAvance, setAllAvance] = useState<ApiAvance[]>([]);
  const [userCareerData, setUserCareerData] = useState<{ rut: string; codCarrera: string; catalogo: string } | null>(null);

  useEffect(() => {
    const fetchMalla = async () => {
      try {
        const carrerasString = localStorage.getItem('carreras');
        const rut = localStorage.getItem('rut');
        if (!carrerasString || !rut) return;
        const carreras = JSON.parse(carrerasString);
        if (!carreras || carreras.length === 0) return;
        const carreraActual = carreras[0];
        const codigo = carreraActual.codigo;
        const catalogo = carreraActual.catalogo;
        setUserCareerData({ rut, codCarrera: codigo, catalogo });
        const data = await apiGet(`/ucn/malla?codigo=${encodeURIComponent(codigo)}&catalogo=${encodeURIComponent(catalogo)}`);
        if (!Array.isArray(data)) return;
        setAllCourses(data as ApiCurso[]);
      } catch {}
    };
    fetchMalla();
  }, []);

  useEffect(() => {
    const fetchAvance = async () => {
      try {
        const rut = localStorage.getItem('rut');
        const carrerasString = localStorage.getItem('carreras');
        if (!rut || !carrerasString) return;
        const carreras = JSON.parse(carrerasString);
        if (!carreras || carreras.length === 0) return;
        const carrera = carreras[0];
        const data = await apiGet(`/ucn/avance?rut=${encodeURIComponent(rut)}&codCarrera=${encodeURIComponent(carrera.codigo)}`);
        if (Array.isArray(data)) setAllAvance(data as ApiAvance[]);
      } catch {}
    };
    fetchAvance();
  }, []);

  // --- Simulation using backend ---
  const { simulatedYears, isSimulating: _isSimulating, simulationError: _simulationError, warnings: _warnings } = useProjectionSimulation(
    selected,
    userCareerData?.rut ?? null,
    userCareerData?.codCarrera ?? null,
    userCareerData?.catalogo ?? null
  );

  const suggestedProjectionView = simulatedYears.length > 0 ? simulatedYears : (selected?.years ?? []);

  useEffect(() => {
    if (!selected || !suggestedProjectionView || suggestedProjectionView.length === 0) return;
    const allCoursesMap = new Map<string, ApiCurso>(allCourses.map(c => [normalize(c.codigo), c]));
    setProyecciones(prev => prev.map(p => {
      if (p.id !== selected.id) return p;
      let changed = false;
      const nextYears = p.years.map(y => {
        if (y.yearIndex === 0) return y;
        const suggestedYear = suggestedProjectionView.find(sy => sy.yearIndex === y.yearIndex);
        if (!suggestedYear) return y;
        const semesters = y.semesters.map((sem, si) => {
          const suger = suggestedYear.semesters[si];
          if (!suger) return sem;
          const semNorms = new Set(sem.courses.map(c => normalize(c.code)));
          const toAdd = suger.courses
            .filter(c => (c.status || '').toUpperCase() === 'VACANTE')
            .map(c => normalize(c.code))
            .filter(n => n && !semNorms.has(n));
          if (toAdd.length === 0) return sem;
          changed = true;
          const courses = sem.courses.map(c => {
            if (toAdd.length > 0 && (!c.code || (c.code || '').trim() === '')) {
              const norm = toAdd.shift()!;
              const code = allCoursesMap.get(norm)?.codigo ?? norm;
              const creds = allCoursesMap.get(norm)?.creditos ?? 0;
              return { ...c, code, status: 'VACANTE', creditos: creds };
            }
            return c;
          });
          while (toAdd.length > 0) {
            const norm = toAdd.shift()!;
            const code = allCoursesMap.get(norm)?.codigo ?? norm;
            const creds = allCoursesMap.get(norm)?.creditos ?? 0;
            courses.push({ id: makeId(), code, status: 'VACANTE', creditos: creds });
          }
          return { ...sem, courses };
        });
        return { ...y, semesters };
      });
      if (!changed) return p;
      return { ...p, years: nextYears };
    }));
  }, [suggestedProjectionView, selected, setProyecciones]);

  const viewYearsWithNames = useMemo(() => {
    const source = (suggestedProjectionView && suggestedProjectionView.length > 0) ? suggestedProjectionView : (selected ? selected.years : []);
    const nameMap = new Map<string, string>(allCourses.map(c => [normalize(c.codigo), c.asignatura]));
    const creditsMap = new Map<string, number>(allCourses.map(c => [normalize(c.codigo), c.creditos ?? 0]));
    const persistedLookup = new Map<string, CourseBox>();
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
          const persistedNorm = normalize(c.code);
          const key = `${y.yearIndex}|${si}|${persistedNorm}`;
          const persisted = persistedLookup.get(key);
          const box = persisted ? { ...persisted } : { ...c };
          const codeTrim = (box.code || '').trim();
          const norm = normalize(codeTrim);
          return { ...box, name: codeTrim ? (nameMap.get(norm) || undefined) : undefined, creditos: codeTrim ? (creditsMap.get(norm) ?? 0) : undefined };
        })
      }))
    }));
  }, [suggestedProjectionView, selected, allCourses]);

  const toggleCourseByKey = (projId: string, yearIndex: number, semIdx: number, key: string) => {
    setProyecciones(prev => prev.map(p => {
      if (p.id !== projId) return p;
      const parts = key.split('||');
      const boxId = parts[0] || '';
      const boxCode = (parts[1] || '').trim();
      const normBoxCode = normalize(boxCode || '');
      const ensureSemesters = (y: YearSim, idx: number): YearSim => {
        const copy: YearSim = { ...y } as YearSim;
        const sems = [...copy.semesters];
        while (sems.length <= idx) sems.push(makeEmptySemester(`Semestre adicional ${sems.length + 1}`));
        copy.semesters = sems;
        return copy;
      };
      if (boxId) {
        const years = p.years.map(y => {
          if (y.yearIndex !== yearIndex) return y;
          const yWithSems = ensureSemesters(y, semIdx);
          const semesters = yWithSems.semesters.map((s: SemesterSim, si: number) => {
            if (si !== semIdx) return s;
            const courses = s.courses.map((c: CourseBox) => c.id === boxId ? { ...c, status: statusCycle(c.status) } : c);
            return { ...s, courses };
          });
          return { ...yWithSems, semesters };
        });
        const changed = years.some((y: YearSim) => y.yearIndex === yearIndex && y.semesters.some((s: SemesterSim) => s.courses.some((c: CourseBox) => c.id === boxId)));
        if (changed) return { ...p, years };
      }
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
      const yearsAdd = p.years.map(y => {
        if (y.yearIndex !== yearIndex) return y;
        const yWithSems = ensureSemesters(y, semIdx);
        const semesters = yWithSems.semesters.map((s: SemesterSim, si: number) => {
          if (si !== semIdx) return s;
          const courses = [...s.courses, { id: boxId, code: boxCode, status: 'VACANTE', creditos: 0 }];
          return { ...s, courses };
        });
        return { ...yWithSems, semesters };
      });
      return { ...p, years: yearsAdd };
    }));
  };

  // --- RENDER ---
  const { rut, careerName } = getUserCareerData();
  const userName = rut ? `RUT: ${rut}` : 'Usuario';

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
