import React, { useMemo, useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import './styles/Avance.css';
import CourseCard from './components/course/CourseCard';
import { normalizeStatus } from './utils/statusHelpers';
import { apiGet } from './config/api';

// --- Interfaces ---
interface CursoAvance {
  nrc: string;
  codigo: string;
  nombre: string;
  status: string;
  creditos: number;
  inscriptionType?: string;
}

interface Periodo {
  periodo: string;
  label: string;
  cursos: CursoAvance[];
}

interface CarreraAvance {
  codigo: string;
  nombre: string;
  catalogo: string;
  periodos: Periodo[];
  creditosAprobados: number;
  creditosTotales: number;
}

interface AvanceSummary {
  carreras: CarreraAvance[];
}

const ordinal = (n: number) => {
  const map = ['Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo'];
  return map[n - 1] || `Año ${n}`;
};




// --- COMPONENTE INTERNO 'CarreraAvanceBlock' ---
const CarreraAvanceBlock: React.FC<{
  carrera: CarreraAvance;
}> = ({ carrera }) => {

  // Agrupar períodos por año calendario
  const years = useMemo(() => {
    const periodsByYear = new Map<string, Periodo[]>();
    for (const periodo of carrera.periodos) {
      const year = periodo.periodo.substring(0, 4);
      if (!periodsByYear.has(year)) {
        periodsByYear.set(year, []);
      }
      periodsByYear.get(year)!.push(periodo);
    }
    const sortedCalendarYears = Array.from(periodsByYear.keys()).sort();
    return sortedCalendarYears.map((calendarYear, idx) => {
      return {
        yearIndex: idx + 1,
        periodos: periodsByYear.get(calendarYear)!,
        calendarYear: calendarYear
      };
    });
  }, [carrera.periodos]);

  
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

  if (carrera.periodos.length === 0) {
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
  const isConvalidated = (curso: CursoAvance) => {
    const type = (curso.inscriptionType || '').toLowerCase();
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
                    {y.periodos.map(periodo => (
                      <div key={periodo.periodo} className="semester-row">
                        
                        <div className="semester-label">{periodo.label}</div>
                        
                        <div className="semester-courses">
                          {periodo.cursos.map((curso: CursoAvance) => {
                            const ns = normalizeStatus(curso.status, curso.inscriptionType);
                            const isConv = isConvalidated(curso);

                            return (
                              <CourseCard
                                key={curso.nrc}
                                code={curso.codigo}
                                name={curso.nombre}
                                status={isConv ? 'Convalidado' : curso.status}
                                className={`avance-course ${isConv ? 'status-convalidated' : ''} ${ns.spanishClass} ${ns.englishClass}`}
                              />
                            );
                          })}
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


// --- COMPONENTE PRINCIPAL ---
const Avance: React.FC = () => {
  const [avanceSummary, setAvanceSummary] = useState<AvanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvanceSummary = async () => {
      try {
        const rut = localStorage.getItem('rut');
        const carrerasString = localStorage.getItem('carreras');
        
        if (!rut) throw new Error('RUT no encontrado en localStorage.');
        if (!carrerasString) throw new Error('Carreras no encontradas en localStorage.');

        // Parse carreras from localStorage
        let carreras;
        try {
          carreras = JSON.parse(carrerasString);
          if (!Array.isArray(carreras) || carreras.length === 0) {
            throw new Error('No hay carreras asociadas al usuario.');
          }
        } catch (e) {
          throw new Error('Error al interpretar datos de carrera.');
        }

        // Send carreras as query params (encoded as JSON)
        const carrerasParam = encodeURIComponent(JSON.stringify(carreras));
        const data = await apiGet(`/ucn/avance/${encodeURIComponent(rut)}/summary?carreras=${carrerasParam}`);
        setAvanceSummary(data as AvanceSummary);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvanceSummary();
  }, []);



  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: 20 }} className="avance-container">
        <div className="avance-header">
          <h1>Avance de carrera usuario</h1>
        </div>

        {isLoading && ( <div className="loading-state"><p>Cargando avance académico...</p></div> )}
        {error && ( <div className="error-state"><h3>Error al cargar el avance</h3><p>{error}</p></div> )}

        {!isLoading && !error && avanceSummary && (
          <div className="carreras-list">
            {avanceSummary.carreras.map(carrera => (
              <CarreraAvanceBlock
                key={carrera.codigo}
                carrera={carrera}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default Avance;