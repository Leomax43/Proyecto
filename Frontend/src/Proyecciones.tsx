import { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import './styles/Proyecciones.css';
import YearBlock from './components/proyecciones/YearBlock';
import type { Projection } from './components/proyecciones/types';
import { makeDefaultProjection, makeEmptySemester, makeId, normalize, statusCycle } from './utils/projectionHelpers';
import { apiGet } from './config/api'; 
import { useProjectionSimulation } from './hooks/useProjectionSimulation';

const API_URL = 'http://localhost:3000/proyecciones';

type ApiCurso = {
  codigo: string;
  asignatura: string;
  creditos?: number;
  nivel?: number;
  prereq?: string;
};

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
  const [proyecciones, setProyecciones] = useState<Projection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({ 0: true });
  const [warningsCollapsed, setWarningsCollapsed] = useState(true);
  const [allCourses, setAllCourses] = useState<ApiCurso[]>([]);
  const [userCareerData, setUserCareerData] = useState<{ rut: string; codCarrera: string; catalogo: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Cargar Datos Iniciales (Malla y Proyecciones desde BD)
  useEffect(() => {
    const fetchMallaAndUser = async () => {
      try {
        const carrerasString = localStorage.getItem('carreras');
        const rut = localStorage.getItem('rut');
        if (!carrerasString || !rut) return;
        const carreras = JSON.parse(carrerasString);
        if (!Array.isArray(carreras) || carreras.length === 0) return;
        const carreraActual = carreras[0];
        
        setUserCareerData({ rut, codCarrera: carreraActual.codigo, catalogo: carreraActual.catalogo });

        // Cargar Malla
        const data = await apiGet(
          `/ucn/malla?codigo=${encodeURIComponent(carreraActual.codigo)}&catalogo=${encodeURIComponent(carreraActual.catalogo)}`,
        );
        if (Array.isArray(data)) setAllCourses(data as ApiCurso[]);

        // Cargar Proyecciones desde BD
        const resp = await fetch(`${API_URL}/user/${rut}`);
        if (resp.ok) {
          const dbProjections = await resp.json();
          const mappedProjections: Projection[] = dbProjections.map((p: any) => ({
            id: p.id,
            title: p.title,
            createdAt: new Date(p.createdAt).getTime(),
            years: p.years // El JSON de años que guardamos
          }));
          
          setProyecciones(mappedProjections);
          if (mappedProjections.length > 0 && !selectedId) {
            setSelectedId(mappedProjections[0].id);
          }
        }
      } catch (e) {
        console.error("Error cargando datos:", e);
      }
    };
    fetchMallaAndUser();
  }, []); 

  const selected = useMemo(
    () => proyecciones.find((projection) => projection.id === selectedId) ?? null,
    [proyecciones, selectedId],
  );

  // 2. Guardar en Base de Datos
  const saveProjectionToBackend = async (projToSave: Projection) => {
    if (!userCareerData) return;
    setIsSaving(true);

    const dto = {
      rut: userCareerData.rut,
      codCarrera: userCareerData.codCarrera,
      catalogo: userCareerData.catalogo,
      proyeccionActual: projToSave
    };

    try {
      // Si el ID tiene longitud > 10, asumimos UUID de la BD -> UPDATE
      // Si es corto (generado por makeId), es temporal -> CREATE
      const isExisting = projToSave.id.length > 10; 

      if (isExisting) {
        await fetch(`${API_URL}/${projToSave.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dto)
        });
      } else {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dto)
        });
        const savedEntity = await res.json();
        
        // Actualizamos el ID local temporal con el ID real de la BD
        setProyecciones(prev => prev.map(p => 
          p.id === projToSave.id ? { ...p, id: savedEntity.id } : p
        ));
        if (selectedId === projToSave.id) setSelectedId(savedEntity.id);
      }
    } catch (e) {
      console.error("Error guardando proyección:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const createNew = () => {
    const projection = makeDefaultProjection();
    setProyecciones((prev) => [...prev, projection]);
    setSelectedId(projection.id);
    setExpandedYears({ [projection.years[0]?.yearIndex ?? 0]: true });
    // Guardar inmediatamente para crear el registro en BD
    saveProjectionToBackend(projection);
  };

  const removeProjection = async (id: string) => {
    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error("Error eliminando:", e);
    }
    setProyecciones((prev) => {
      const filtered = prev.filter((projection) => projection.id !== id);
      if (id === selectedId) {
        setSelectedId(filtered[0]?.id ?? null);
      }
      return filtered;
    });
  };

  const renameProjection = (id: string, title: string) => {
    const currentProj = proyecciones.find(p => p.id === id);
    if (!currentProj) return;

    const updatedProj = { ...currentProj, title };
    setProyecciones(prev => prev.map(p => p.id === id ? updatedProj : p));
    saveProjectionToBackend(updatedProj);
  };

  const addYearToProjection = (id: string) => {
    const currentProj = proyecciones.find(p => p.id === id);
    if (!currentProj) return;

    const nextIndex = currentProj.years.reduce((max, year) => Math.max(max, year.yearIndex), 0) + 1;
    const newYear = {
      yearIndex: nextIndex,
      title: nextIndex === 0 ? 'Semestre Actual' : `Año Simulado ${nextIndex}`,
      semesters: [makeEmptySemester('Primer Semestre'), makeEmptySemester('Segundo Semestre')],
    };
    
    const updatedProj = {
      ...currentProj,
      years: [...currentProj.years, newYear].sort((a, b) => a.yearIndex - b.yearIndex),
    };

    setProyecciones(prev => prev.map(p => p.id === id ? updatedProj : p));
    saveProjectionToBackend(updatedProj);
  };

  const toggleYear = (idx: number) => setExpandedYears((prev) => ({ ...prev, [idx]: !prev[idx] }));

  // 3. Hook de Simulación
  const { simulatedYears, isSimulating, simulationError, warnings: simulationWarnings } = useProjectionSimulation(
    selected,
    userCareerData?.rut ?? null,
    userCareerData?.codCarrera ?? null,
    userCareerData?.catalogo ?? null,
  );

  // 4. Preparar Datos para Visualización (Mezcla simulación con nombres reales)
  const displayYears = useMemo(() => {
    const source = simulatedYears.length > 0 ? simulatedYears : selected?.years ?? [];
    const nameMap = new Map<string, string>(allCourses.map((course) => [normalize(course.codigo), course.asignatura]));
    const creditsMap = new Map<string, number>(allCourses.map((course) => [normalize(course.codigo), course.creditos ?? 0]));

    return source.map((year) => ({
      ...year,
      semesters: year.semesters.map((semester) => ({
        ...semester,
        courses: semester.courses.map((course) => {
          const codeTrim = (course.code || '').trim();
          if (!codeTrim) return { ...course };
          const normalizedCode = normalize(codeTrim);
          return {
            ...course,
            name: course.name ?? nameMap.get(normalizedCode),
            creditos: course.creditos ?? creditsMap.get(normalizedCode),
          };
        }),
      })),
    }));
  }, [simulatedYears, selected, allCourses]);

  // 5. Toggle Course (Versión Robusta Anti-Corrupción)
  const toggleCourseByKey = (projId: string, yearIndex: number, semIdx: number, key: string) => {
    const projectionToUpdate = proyecciones.find(p => p.id === projId);
    if (!projectionToUpdate) return;

    const [idPart, codePart = ''] = key.split('||');
    const normalizedCodeKey = normalize(codePart);

    // Clonamos la estructura para no mutar directamente
    const updatedYears = projectionToUpdate.years.map(year => ({
      ...year,
      semesters: year.semesters.map(sem => ({
        ...sem,
        courses: sem.courses.map(c => ({ ...c }))
      }))
    }));

    let updated = false;

    // BARRIDO 1: Buscar si el curso YA existe en la proyección guardada
    for (const year of updatedYears) {
      for (const sem of year.semesters) {
        for (const course of sem.courses) {
          // Coincidencia por ID o por CÓDIGO (esto es lo que evita duplicados si el ID cambió)
          const matchCode = normalizedCodeKey && normalize(course.code) === normalizedCodeKey;
          const matchId = idPart && course.id === idPart;
          
          if (matchCode || matchId) {
            course.status = statusCycle(course.status);
            if (!course.code && normalizedCodeKey) course.code = normalizedCodeKey;
            updated = true;
            break; // Importante: dejar de buscar para no tocar duplicados si existieran
          }
        }
        if (updated) break;
      }
      if (updated) break;
    }

    // BARRIDO 2: Si no existía (era un curso fantasma sugerido por la simulación), lo agregamos
    if (!updated) {
      // Buscamos los datos en la vista simulada (displayYears)
      const displayYear = displayYears.find(y => y.yearIndex === yearIndex);
      const displayCourse = displayYear?.semesters[semIdx]?.courses.find(c => {
         return (idPart && c.id === idPart) || (normalizedCodeKey && normalize(c.code) === normalizedCodeKey);
      });

      if (displayCourse) {
        // Asegurar que el año existe
        if (!updatedYears.some(y => y.yearIndex === yearIndex)) {
           const newYearTitle = yearIndex === 0 ? 'Semestre Actual' : `Año Simulado ${yearIndex}`;
           updatedYears.push({ 
             yearIndex, 
             title: newYearTitle, 
             semesters: [makeEmptySemester('Primer Semestre'), makeEmptySemester('Segundo Semestre')] 
           });
           updatedYears.sort((a,b) => a.yearIndex - b.yearIndex);
        }

        const targetYear = updatedYears.find(y => y.yearIndex === yearIndex)!;
        
        // Asegurar semestre
        while (targetYear.semesters.length <= semIdx) {
          targetYear.semesters.push(makeEmptySemester(`Semestre ${targetYear.semesters.length + 1}`));
        }

        // Agregar curso
        targetYear.semesters[semIdx].courses.push({
          id: displayCourse.id || makeId(),
          code: displayCourse.code,
          name: displayCourse.name,
          creditos: displayCourse.creditos,
          status: statusCycle(displayCourse.status)
        });
      }
    }

    const finalUpdatedProj = { ...projectionToUpdate, years: updatedYears };
    setProyecciones(prev => prev.map(p => p.id === projId ? finalUpdatedProj : p));
    saveProjectionToBackend(finalUpdatedProj);
  };

  const { rut, careerName } = getUserCareerData();
  const userName = rut ? `RUT: ${rut}` : 'Usuario';

  return (
    <div className="proyecciones-root" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main className="proyecciones-main">
        <div className="proyecciones-container">
          <header className="proyecciones-header">
            <div>
              <h1>Proyección {isSaving && <span style={{fontSize: '0.6em', color: '#888'}}>(Guardando...)</span>}</h1>
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
                    <div className="proj-meta">{new Date(p.createdAt).toLocaleDateString()}</div>
                  </li>
                ))}
              </ul>
            </aside>
            <section className="proyecciones-detail">
              {!selected && <div className="empty-state">Selecciona o crea una proyección</div>}
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
                        Calculando proyección...
                      </div>
                    </div>
                  )}
                  {simulationError && <div className="simulation-error">{simulationError}</div>}
                  {simulationWarnings.length > 0 && (
                    <div className="projection-warnings">
                       <div className="projection-warnings-header">
                        <div className="projection-warnings-title">Restricciones detectadas ({simulationWarnings.length})</div>
                        <button className="btn" onClick={() => setWarningsCollapsed(prev => !prev)}>
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