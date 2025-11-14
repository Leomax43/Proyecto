import React, { useMemo, useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import './styles/Avance.css';

// --- Interfaces ---
interface ApiAvance {
  nrc: string;
  period: string;
  student: string;
  course: string;
  excluded: boolean;
  inscriptionType: string;
  status: string;
}
interface ApiMalla {
  codigo: string;
  asignatura: string;
  creditos: number;
  nivel: number;
  prereq: string;
}
interface UserCarrera {
  codigo: string;
  nombre: string;
  catalogo: string;
}

const ordinal = (n: number) => {
  const map = ['Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo'];
  return map[n - 1] || `Año ${n}`;
};

// --- Lógica de Clase ---
const statusClass = (status: string | undefined, type: string | undefined) => {
  const lowerType = (type || '').toLowerCase();
  
  // Prioridad estricta para CONVALIDACIÓN/REGULARIZACIÓN DE CRÉDITOS
  if (lowerType.includes('convalidaci') || lowerType.includes('regularizacion de creditos')) {
    return 'status-convalidated'; 
  }
  
  // Para TODOS los demás tipos (REGULAR, CAMBIO CATALOGO CARRERA, etc.), usamos el STATUS
  if (!status) return 'status-unknown';
  const s = status.toLowerCase();
  if (s.includes('aprob')) return 'status-approved';
  if (s.includes('reprob')) return 'status-failed';
  if (s.includes('inscrit')) return 'status-enrolled';
  return 'status-unknown';
};

// --- Helper de Semestres  ---
const getSemesterLabel = (period: string) => {
  if (!period || period.length < 6) return `Periodo ${period}`;
  const suffix = period.substring(4);
  switch(suffix) {
    case '10': return 'Primer Semestre';
    case '15': return 'Curso de Invierno';
    case '20': return 'Segundo Semestre';
    case '25': return 'Curso de Verano';
    default: return `Periodo ${period}`;
  }
};


// --- COMPONENTE INTERNO 'CarreraAvanceBlock' ---
const CarreraAvanceBlock: React.FC<{
  carrera: UserCarrera;
  avanceData: ApiAvance[];
  getCourseName: (code: string) => string;
}> = ({ carrera, avanceData, getCourseName }) => {

  // Lógica de agrupación
  const byPeriod = useMemo(() => {
    const map: Record<string, ApiAvance[]> = {};
    avanceData.forEach(a => {
      const p = a.period || 'unknown';
      if (!map[p]) map[p] = [];
      map[p].push(a);
    });
    const periods = Object.keys(map).sort();
    return { map, periods };
  }, [avanceData]);

  const years = useMemo(() => {
    const periodsByYear = new Map<string, string[]>();
    for (const period of byPeriod.periods) {
      const year = period.substring(0, 4);
      if (!periodsByYear.has(year)) {
        periodsByYear.set(year, []);
      }
      periodsByYear.get(year)!.push(period);
    }
    const sortedCalendarYears = Array.from(periodsByYear.keys()).sort();
    return sortedCalendarYears.map((calendarYear, idx) => {
      return {
        yearIndex: idx + 1,
        periods: periodsByYear.get(calendarYear)!,
        calendarYear: calendarYear
      };
    });
  }, [byPeriod]);

  
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    if (years.length > 0) {
      years.forEach(y => { initial[y.yearIndex] = y.yearIndex === 1; });
    }
    return initial;
  });
  
  const [isCarreraExpanded, setIsCarreraExpanded] = useState(true);

  const toggleYear = (yearIndex: number) => setExpandedYears(prev => ({ ...prev, [yearIndex]: !prev[yearIndex] }));
  const toggleCarrera = () => setIsCarreraExpanded(prev => !prev);

  if (avanceData.length === 0) {
    return (
      <div className="carrera-block">
        <div className="carrera-header" onClick={toggleCarrera}>
          <span>Avance en: <strong>{carrera.nombre}</strong> (Sin registros)</span>
          <div className="carrera-toggle">{isCarreraExpanded ? '−' : '+'}</div>
        </div>
      </div>
    );
  }

  // Helper de texto 
  const isConvalidated = (curso: ApiAvance) => {
    const type = curso.inscriptionType.toLowerCase();
    return type.includes('convalidaci') || type.includes('regularizacion de creditos');
  }

  return (
    <div className="carrera-block">
      <div className="carrera-header" onClick={toggleCarrera}>
        <span>Avance en: <strong>{carrera.nombre}</strong></span>
        <div className="carrera-toggle">{isCarreraExpanded ? '−' : '+'}</div>
      </div>

      {isCarreraExpanded && (
        <div className="carrera-content">
          <div className="years-list">
            
            {years.map(y => (
              <div key={y.yearIndex} className="year-block">
                
                <div className="year-header" onClick={() => toggleYear(y.yearIndex)}>
                  <div className="year-title">
                    {ordinal(y.yearIndex)} Año
                    {y.calendarYear && ` (${y.calendarYear})`}
                  </div>
                  <div className="year-toggle">{expandedYears[y.yearIndex] ? '−' : '+'}</div>
                </div>

                {expandedYears[y.yearIndex] && (
                  <div className="year-content">
                    {y.periods.map(period => (
                      <div key={period} className="semester-row">
                        
                        <div className="semester-label">{getSemesterLabel(period)}</div>
                        
                        <div className="semester-courses">
                          {(byPeriod.map[period] || []).map((curso: ApiAvance) => (
                            <div 
                              key={curso.nrc} 
                              className={`avance-course ${statusClass(curso.status, curso.inscriptionType)}`}
                            >
                              <div className="course-code">{curso.course}</div>
                              <div className="course-name">{getCourseName(curso.course)}</div>
                              <div className="course-status">
                                {isConvalidated(curso)
                                  ? 'Convalidado'
                                  : curso.status
                                }
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


// --- COMPONENTE PRINCIPAL 'Avance' ---
const Avance: React.FC = () => {
  const [avanceByCarrera, setAvanceByCarrera] = useState<Record<string, ApiAvance[]>>({});
  const [apiMalla, setApiMalla] = useState<ApiMalla[]>([]);
  const [userCarreras, setUserCarreras] = useState<UserCarrera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const rut = localStorage.getItem('rut');
        const carrerasString = localStorage.getItem('carreras');

        if (!rut || !carrerasString) throw new Error('Datos de usuario no encontrados en localStorage.');

        let parsedCarreras: UserCarrera[] = [];
        try {
          parsedCarreras = JSON.parse(carrerasString);
          if (!Array.isArray(parsedCarreras) || parsedCarreras.length === 0) {
            throw new Error('No hay carreras asociadas al usuario.');
          }
          setUserCarreras(parsedCarreras);
        } catch (e) {
          throw new Error('Error al interpretar datos de carrera.');
        }

        const avanceFetchPromises = parsedCarreras.map(carrera =>
          fetch(`http://localhost:3000/ucn/avance?rut=${rut}&codCarrera=${carrera.codigo}`)
        );
        
        const mallaFetchPromises = parsedCarreras.map(carrera =>
          fetch(`http://localhost:3000/ucn/malla?codigo=${carrera.codigo}&catalogo=${carrera.catalogo}`)
        );

        const allResponses = await Promise.all([...avanceFetchPromises, ...mallaFetchPromises]);
        
        const numCarreras = parsedCarreras.length;
        const avanceResponses = allResponses.slice(0, numCarreras);
        const mallaResponses = allResponses.slice(numCarreras);

        const newAvanceByCarrera: Record<string, ApiAvance[]> = {};
        for (let i = 0; i < avanceResponses.length; i++) {
          const res = avanceResponses[i];
          const codCarrera = parsedCarreras[i].codigo;
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              newAvanceByCarrera[codCarrera] = data;
            } else {
              newAvanceByCarrera[codCarrera] = [];
            }
          }
        }
        setAvanceByCarrera(newAvanceByCarrera);

        let combinedMallaData: ApiMalla[] = [];
        for (const res of mallaResponses) {
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              
              combinedMallaData = combinedMallaData.concat(data);
            }
          }
        }
        setApiMalla(combinedMallaData);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const courseNameMap = useMemo(() => {
    const map = new Map<string, string>();
    apiMalla.forEach(curso => {
      if (!map.has(curso.codigo)) {
        map.set(curso.codigo, curso.asignatura);
      }
    });
    return map;
  }, [apiMalla]);

  const getCourseName = (code: string) => {
    return courseNameMap.get(code) || 'Nombre no encontrado';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: 20 }} className="avance-container">
        <div className="avance-header">
          <h1>Avance de carrera usuario</h1>
        </div>

        {isLoading && ( <div className="loading-state"><p>Cargando avance académico...</p></div> )}
        {error && ( <div className="error-state"><h3>Error al cargar el avance</h3><p>{error}</p></div> )}

        {!isLoading && !error && (
          <div className="carreras-list">
            {userCarreras.map(carrera => (
              <CarreraAvanceBlock
                key={carrera.codigo}
                carrera={carrera}
                avanceData={avanceByCarrera[carrera.codigo] || []}
                getCourseName={getCourseName}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default Avance;