import { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import './styles/Proyecciones.css';
import YearBlock from './components/proyecciones/YearBlock';
import type { SemesterSim, YearSim, Projection } from './components/proyecciones/types';

const STORAGE_KEY = 'proyecciones_v1';

const makeId = () => Math.random().toString(36).slice(2, 9);

const makeEmptySemester = (label = 'Primer Semestre') : SemesterSim => ({
  label,
  courses: Array.from({ length: 5 }).map(() => ({ id: makeId(), code: '', status: '' }))
});

const makeDefaultProjection = (title = 'Proyección nueva'): Projection => {
  const years: YearSim[] = [];
  // Año Actual + 2 años simulados por defecto
  years.push({ yearIndex: 0, semesters: [makeEmptySemester('Primer Semestre'), makeEmptySemester('Segundo Semestre')], title: 'Año Actual' });
  years.push({ yearIndex: 1, semesters: [makeEmptySemester('Primer Semestre'), makeEmptySemester('Segundo Semestre')], title: 'Año Simulado 1' });
  years.push({ yearIndex: 2, semesters: [makeEmptySemester('Primer Semestre'), makeEmptySemester('Segundo Semestre')], title: 'Año Simulado 2' });
  return { id: makeId(), title, createdAt: Date.now(), years };
};

const statusCycle = (s?: string) => {
  const order = ['', 'INSCRITO', 'APROBADO', 'REPROBADO', 'PLANIFICADO'];
  const idx = order.indexOf((s || '').toUpperCase());
  return order[(idx + 1) % order.length];
};

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

  const toggleCourseStatus = (projId: string, yearIndex: number, semIdx: number, courseId: string) => {
    setProyecciones(prev => prev.map(p => {
      if (p.id !== projId) return p;
      const years = p.years.map(y => {
        if (y.yearIndex !== yearIndex) return y;
        const semesters = y.semesters.map((s, si) => {
          if (si !== semIdx) return s;
          const courses = s.courses.map(c => c.id === courseId ? { ...c, status: statusCycle(c.status) } : c);
          return { ...s, courses };
        });
        return { ...y, semesters };
      });
      return { ...p, years };
    }));
  };

  const toggleYear = (idx: number) => setExpandedYears(prev => ({ ...prev, [idx]: !prev[idx] }));

  // Career/user for header like Sidebar
  const userRut = localStorage.getItem('rut');
  const userName = userRut ? `RUT: ${userRut}` : 'Usuario';
  let careerName = 'Carrera del usuario';
  const carrerasString = localStorage.getItem('carreras');
  if (carrerasString) {
    try { const carreras = JSON.parse(carrerasString); if (carreras && carreras.length > 0) careerName = carreras[0].nombre || careerName; } catch (e) { careerName = carrerasString; }
  }

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
                    {selected.years.map((y) => (
                      <YearBlock
                        key={y.yearIndex}
                        year={y}
                        expanded={!!expandedYears[y.yearIndex]}
                        onToggle={toggleYear}
                        onToggleCourse={(yearIndex, semIdx, courseId) => toggleCourseStatus(selected.id, yearIndex, semIdx, courseId)}
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
