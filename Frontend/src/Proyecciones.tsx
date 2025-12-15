import { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import './styles/Proyecciones.css';
import YearBlock from './components/proyecciones/YearBlock';
import type { Projection, SimulationPreferences, YearSim } from './components/proyecciones/types';
import { makeDefaultProjection, makeEmptySemester, makeId, normalize, statusCycle } from './utils/projectionHelpers';
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

const STORAGE_KEY = 'proyecciones_v1';
const PREF_KEY = 'proyecciones_auto_prefs_v1';
const PREF_ENABLED_KEY = 'proyecciones_auto_enabled_v1';

const DEFAULT_PREFERENCES: SimulationPreferences = {
  maxCoursesPerSemester: null,
  targetLoad: 'MEDIUM',
  priority: 'BALANCED',
  unlockFocus: false,
  levelDispersion: 1,
  semesterLimit: null,
};

const SAFE_PREFERENCE_KEYS: Array<keyof SimulationPreferences> = [
  'maxCoursesPerSemester',
  'targetLoad',
  'priority',
  'unlockFocus',
  'levelDispersion',
  'semesterLimit',
];

const setPreferenceValue = <K extends keyof SimulationPreferences>(
  target: SimulationPreferences,
  key: K,
  value: unknown,
) => {
  if (value !== undefined) {
    target[key] = value as SimulationPreferences[K];
  }
};

const sanitizeStoredPreferences = (raw: unknown): SimulationPreferences => {
  const next: SimulationPreferences = { ...DEFAULT_PREFERENCES };
  if (!raw || typeof raw !== 'object') return next;
  const record = raw as Record<string, unknown>;

  SAFE_PREFERENCE_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      setPreferenceValue(next, key, record[key]);
    }
  });

  return next;
};

// Utilidad para obtener nombre de carrera y rut
function getUserCareerData() {
  const rut = localStorage.getItem('rut');
  const nombre = localStorage.getItem('nombre');
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
  return { rut, careerName, nombre };
}

const Proyecciones: React.FC = () => {
  const [proyecciones, setProyecciones] = useState<Projection[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as Projection[];
    } catch {
      return [];
    }
  });

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Projection[];
      return parsed[0]?.id ?? null;
    } catch {
      return null;
    }
  });

  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({ 0: true });
  const [warningsCollapsed, setWarningsCollapsed] = useState(true);
  const [allCourses, setAllCourses] = useState<ApiCurso[]>([]);
  const [userCareerData, setUserCareerData] = useState<{ rut: string; codCarrera: string; catalogo: string } | null>(null);
  const [autoPreferences, setAutoPreferences] = useState<SimulationPreferences>(() => {
    try {
      const stored = localStorage.getItem(PREF_KEY);
      if (!stored) return DEFAULT_PREFERENCES;
      const parsed = JSON.parse(stored);
      return sanitizeStoredPreferences(parsed);
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });
  const [autoEnabled, setAutoEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(PREF_ENABLED_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return true;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(proyecciones));
  }, [proyecciones]);

  useEffect(() => {
    localStorage.setItem(PREF_KEY, JSON.stringify(autoPreferences));
  }, [autoPreferences]);

  useEffect(() => {
    localStorage.setItem(PREF_ENABLED_KEY, autoEnabled ? 'true' : 'false');
  }, [autoEnabled]);

  useEffect(() => {
    if (proyecciones.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId) {
      setSelectedId(proyecciones[0].id);
    }
  }, [proyecciones, selectedId]);

  const selected = useMemo(
    () => proyecciones.find((projection) => projection.id === selectedId) ?? null,
    [proyecciones, selectedId],
  );

  const createNew = () => {
    const projection = makeDefaultProjection();
    setProyecciones((prev) => [...prev, projection]);
    setSelectedId(projection.id);
    setExpandedYears({ [projection.years[0]?.yearIndex ?? 0]: true });
  };

  const removeProjection = (id: string) => {
    setProyecciones((prev) => {
      const filtered = prev.filter((projection) => projection.id !== id);
      if (id === selectedId) {
        setSelectedId(filtered[0]?.id ?? null);
      }
      return filtered;
    });
  };

  const renameProjection = (id: string, title: string) => {
    setProyecciones((prev) =>
      prev.map((projection) => (projection.id === id ? { ...projection, title } : projection)),
    );
  };

  const addYearToProjection = (id: string) => {
    setProyecciones((prev) =>
      prev.map((projection) => {
        if (projection.id !== id) return projection;
        const nextIndex = projection.years.reduce((max, year) => Math.max(max, year.yearIndex), 0) + 1;
        const newYear = {
          yearIndex: nextIndex,
          title: nextIndex === 0 ? 'Semestre Actual' : `Año Simulado ${nextIndex}`,
          semesters: [makeEmptySemester('Primer Semestre'), makeEmptySemester('Segundo Semestre')],
        };
        return {
          ...projection,
          years: [...projection.years, newYear].sort((a, b) => a.yearIndex - b.yearIndex),
        };
      }),
    );
  };

  const toggleYear = (idx: number) => setExpandedYears((prev) => ({ ...prev, [idx]: !prev[idx] }));

  useEffect(() => {
    const fetchMalla = async () => {
      try {
        const carrerasString = localStorage.getItem('carreras');
        const rut = localStorage.getItem('rut');
        if (!carrerasString || !rut) return;
        const carreras = JSON.parse(carrerasString);
        if (!Array.isArray(carreras) || carreras.length === 0) return;
        const carreraActual = carreras[0];
        if (!carreraActual?.codigo || !carreraActual?.catalogo) return;
        setUserCareerData({ rut, codCarrera: carreraActual.codigo, catalogo: carreraActual.catalogo });
        const data = await apiGet(
          `/ucn/malla?codigo=${encodeURIComponent(carreraActual.codigo)}&catalogo=${encodeURIComponent(carreraActual.catalogo)}`,
        );
        if (Array.isArray(data)) setAllCourses(data as ApiCurso[]);
      } catch {
        /* noop */
      }
    };
    fetchMalla();
  }, []);

  const { simulatedYears, isSimulating, simulationError, warnings: simulationWarnings } = useProjectionSimulation(
    selected,
    userCareerData?.rut ?? null,
    userCareerData?.codCarrera ?? null,
    userCareerData?.catalogo ?? null,
    autoEnabled ? autoPreferences : null,
  );


  const displayYears = useMemo(() => {
    const source = simulatedYears.length > 0 ? simulatedYears : selected?.years ?? [];
    const nameMap = new Map<string, string>(allCourses.map((course) => [normalize(course.codigo), course.asignatura]));
    const creditsMap = new Map<string, number>(allCourses.map((course) => [normalize(course.codigo), course.creditos ?? 0]));

    return source.map((year) => ({
      ...year,
      semesters: year.semesters.map((semester) => ({
        ...semester,
        courses: semester.courses.reduce<Array<typeof semester.courses[number]>>((acc, course) => {
          const codeTrim = (course.code || '').trim();
          if (!codeTrim) {
            acc.push({ ...course });
            return acc;
          }
          const normalizedCode = normalize(codeTrim);
          const exists = acc.some((existing) => normalize(existing.code || '') === normalizedCode);
          if (exists) return acc;
          acc.push({
            ...course,
            name: course.name ?? nameMap.get(normalizedCode),
            creditos: course.creditos ?? creditsMap.get(normalizedCode),
          });
          return acc;
        }, []),
      })),
    }));
  }, [simulatedYears, selected, allCourses]);

  const toggleCourseByKey = (projId: string, yearIndex: number, semIdx: number, key: string) => {
    const [idPart, codePart = ''] = key.split('||');
    const normalizedCodeKey = normalize(codePart);
    const displayYear = displayYears.find((year) => year.yearIndex === yearIndex);
    const displayCourse = displayYear?.semesters[semIdx]?.courses.find((course) => {
      const matchesId = idPart ? course.id === idPart : false;
      const matchesCode = normalizedCodeKey ? normalize(course.code) === normalizedCodeKey : false;
      return matchesId || matchesCode;
    });

    setProyecciones((prev) =>
      prev.map((projection) => {
        if (projection.id !== projId) return projection;

        let years = projection.years;
        if (!years.some((year) => year.yearIndex === yearIndex)) {
          const newYear = {
            yearIndex,
            title: yearIndex === 0 ? 'Semestre Actual' : `Año Simulado ${yearIndex}`,
            semesters: [makeEmptySemester('Primer Semestre'), makeEmptySemester('Segundo Semestre')],
          };
          years = [...years, newYear].sort((a, b) => a.yearIndex - b.yearIndex);
        }

        const updatedYears = years.map((year) => {
          if (year.yearIndex !== yearIndex) return year;

          const semesters = [...year.semesters];
          let structureChanged = false;
          let targetSemIdx = semIdx;
          while (semesters.length <= targetSemIdx) {
            semesters.push(makeEmptySemester(`Semestre adicional ${semesters.length + 1}`));
            structureChanged = true;
          }
          if (year.yearIndex === 0) {
            targetSemIdx = Math.max(0, semesters.length - 1);
          }

          let toggled = false;
          const newSemesters = semesters.map((semester, index) => {
            if (index !== targetSemIdx) {
              return structureChanged ? { ...semester } : semester;
            }

            const courses = semester.courses.map((course) => {
              if (toggled) return course;
              const matchesId = idPart ? course.id === idPart : false;
              const matchesCode = normalizedCodeKey ? normalize(course.code) === normalizedCodeKey : false;
              if (matchesId || matchesCode) {
                toggled = true;
                return { ...course, status: statusCycle(course.status) };
              }
              return course;
            });

            if (!toggled && displayCourse && displayCourse.code) {
              const nextStatus = statusCycle(displayCourse.status);
              courses.push({
                id: displayCourse.id || makeId(),
                code: displayCourse.code,
                status: nextStatus,
                creditos: displayCourse.creditos,
                name: displayCourse.name,
              });
              toggled = true;
            }

            return { ...semester, courses };
          });

          if (!structureChanged && !toggled) return year;

          return {
            ...year,
            semesters: newSemesters,
          };
        });

        return {
          ...projection,
          years: updatedYears,
        };
      }),
    );
  };

  // --- RENDER ---
  const { rut, careerName, nombre } = getUserCareerData();
  const userName = nombre?.trim() ? nombre : rut ? `RUT: ${rut}` : 'Usuario';

  const updatePreference = <Key extends keyof SimulationPreferences>(key: Key, value: SimulationPreferences[Key]) => {
    setAutoPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const parseNumberOrNull = (raw: string, min?: number, max?: number): number | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return null;
    if (typeof min === 'number' && parsed < min) return min;
    if (typeof max === 'number' && parsed > max) return max;
    return parsed;
  };

  const cloneSimulatedYears = (years: YearSim[]): YearSim[] =>
    years.map((year) => ({
      ...year,
      semesters: year.semesters.map((semester) => ({
        ...semester,
        courses: semester.courses.map((course) => ({ ...course })),
      })),
    }));

  const applyAutomaticProjection = () => {
    if (!selected || simulatedYears.length === 0) return;
    const seenCodes = new Set<string>();
    const clonedYears = cloneSimulatedYears(simulatedYears).map((year) => {
      const isCurrent = year.yearIndex === 0;
      const updatedSemesters = year.semesters.map((semester) => {
        const filteredCourses = semester.courses.reduce<Array<typeof semester.courses[number]>>((acc, course) => {
          const normalizedCode = normalize(course.code || '');
          const nextId = course.id || makeId();
          const normalizedStatus = (course.status || '').toUpperCase();

          if (!isCurrent && normalizedCode && seenCodes.has(normalizedCode)) {
            return acc;
          }

          if (normalizedCode) {
            seenCodes.add(normalizedCode);
          }

          const resolvedStatus = isCurrent
            ? course.status ?? 'VACANTE'
            : normalizedStatus === 'REPROBADO'
            ? 'REPROBADO'
            : normalizedStatus === 'CONVALIDADO'
            ? 'CONVALIDADO'
            : 'APROBADO';

          acc.push({
            ...course,
            id: nextId,
            status: resolvedStatus,
          });
          return acc;
        }, []);

        return {
          ...semester,
          courses: filteredCourses,
        };
      });

      return {
        ...year,
        semesters: updatedSemesters,
      };
    });

    setProyecciones((prev) =>
      prev.map((projection) => {
        if (projection.id !== selected.id) return projection;
        return {
          ...projection,
          years: clonedYears,
        };
      }),
    );
    setExpandedYears(
      clonedYears.reduce<Record<number, boolean>>((acc, year) => {
        acc[year.yearIndex] = true;
        return acc;
      }, {}),
    );
  };

  const canApplyAutomaticProjection = autoEnabled && Boolean(selected) && simulatedYears.length > 0 && !isSimulating;

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
          <section className="auto-config-card" aria-label="Configuración de proyección automática">
            <div className="auto-config-header">
              <label className="auto-config-toggle">
                <input
                  type="checkbox"
                  checked={autoEnabled}
                  onChange={(event) => setAutoEnabled(event.target.checked)}
                />
                Activar proyección automática
              </label>
              <div className="auto-config-header-controls">
                <span className="auto-config-hint">Ajusta la carga sugerida antes de simular.</span>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={applyAutomaticProjection}
                  disabled={!canApplyAutomaticProjection}
                >
                  Generar proyección automática
                </button>
              </div>
            </div>
            {autoEnabled && (
              <div className="auto-config-grid">
                <label className="auto-config-field">
                  <span className="auto-config-label">Carga objetivo</span>
                  <select
                    value={autoPreferences.targetLoad ?? ''}
                    onChange={(event) => updatePreference('targetLoad', event.target.value ? event.target.value as SimulationPreferences['targetLoad'] : null)}
                  >
                    <option value="">Automática</option>
                    <option value="LOW">Baja (12-18)</option>
                    <option value="MEDIUM">Media (18-24)</option>
                    <option value="HIGH">Alta (24-30)</option>
                  </select>
                </label>
                <label className="auto-config-field">
                  <span className="auto-config-label">Prioridad</span>
                  <select
                    value={autoPreferences.priority ?? ''}
                    onChange={(event) => updatePreference('priority', event.target.value ? event.target.value as SimulationPreferences['priority'] : null)}
                  >
                    <option value="">Automática</option>
                    <option value="PENDING_FIRST">Reprobadas primero</option>
                    <option value="NEW_FIRST">Nuevas primero</option>
                    <option value="BALANCED">Balanceada</option>
                  </select>
                </label>
                <label className="auto-config-field">
                  <span className="auto-config-label">Máx. ramos / semestre</span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={autoPreferences.maxCoursesPerSemester ?? ''}
                    onChange={(event) => updatePreference('maxCoursesPerSemester', parseNumberOrNull(event.target.value, 1, 8))}
                  />
                </label>
                <label className="auto-config-field">
                  <span className="auto-config-label">Dispersion de nivel</span>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    value={autoPreferences.levelDispersion ?? ''}
                    onChange={(event) => updatePreference('levelDispersion', parseNumberOrNull(event.target.value, 0, 2))}
                  />
                </label>
                <label className="auto-config-field">
                  <span className="auto-config-label">Límite de semestres</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={autoPreferences.semesterLimit ?? ''}
                    onChange={(event) => updatePreference('semesterLimit', parseNumberOrNull(event.target.value, 1, 12))}
                  />
                </label>
                <label className="auto-config-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(autoPreferences.unlockFocus)}
                    onChange={(event) => updatePreference('unlockFocus', event.target.checked)}
                  />
                  Potenciar ramos clave
                </label>
              </div>
            )}
          </section>
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
                  {isSimulating && (
                    <div className="simulation-indicator" role="status" aria-live="polite">
                      <div className="simulation-indicator-bubble">
                        <span className="simulation-spinner" aria-hidden="true" />
                        Calculando proyección…
                      </div>
                    </div>
                  )}
                  {simulationError && (
                    <div className="simulation-error">{simulationError}</div>
                  )}
                  {simulationWarnings.length > 0 && (
                    <div className="projection-warnings">
                      <div className="projection-warnings-header">
                        <div className="projection-warnings-title">
                          Restricciones detectadas ({simulationWarnings.length})
                        </div>
                        <button
                          className="btn"
                          onClick={() => setWarningsCollapsed((prev) => !prev)}
                        >
                          {warningsCollapsed ? 'Mostrar' : 'Minimizar'}
                        </button>
                      </div>
                      {!warningsCollapsed && (
                        <ul>
                          {simulationWarnings.map((warning, idx) => (
                            <li key={`${warning.yearIndex}-${warning.semIdx}-${idx}`}>
                              <strong>Año {warning.yearIndex}, Semestre {warning.semIdx + 1}:</strong> {warning.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  <div className="years-list">
                    {displayYears.map((y) => (
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
