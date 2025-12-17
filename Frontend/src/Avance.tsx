import React, { useMemo, useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import './styles/Avance.css';
import CourseCard from './components/course/CourseCard';
import { normalizeStatus } from './utils/statusHelpers';
import { apiGet } from './config/api';
import courseCatalog from './data/curses.json';

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

type CourseCatalogEntry = {
  codigo?: string;
  nombre?: string;
  seccion?: string;
};

const courseCatalogData = courseCatalog as { cursos?: CourseCatalogEntry[] };
const catalogEntries: CourseCatalogEntry[] = Array.isArray(courseCatalogData.cursos) ? courseCatalogData.cursos : [];

const normalizeCourseCode = (code?: string): string => {
  if (!code) return '';
  return code.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
};

const toUpperTrim = (value?: string) => (value ?? '').trim().toUpperCase();

const ordinal = (n: number) => {
  const map = ['Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo'];
  return map[n - 1] || `Año ${n}`;
};

const stripCodeParenthesis = (name: string) => name.replace(/\s*\([A-Z0-9-]+\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

const collectCodeVariants = (code?: string, seccion?: string) => {
  const variants = new Set<string>();
  const base = toUpperTrim(code);
  const normalizedBase = normalizeCourseCode(code);
  const section = normalizeCourseCode(seccion);

  [base, normalizedBase].forEach((value) => {
    if (value) variants.add(value);
  });

  const baseWithoutSection = base.replace(/\s*[{(].*[})]\s*$/, '').trim();
  const normalizedBaseWithoutSection = normalizeCourseCode(baseWithoutSection);
  [baseWithoutSection, normalizedBaseWithoutSection].forEach((value) => {
    if (value) variants.add(value);
  });

  if (base && section) {
    variants.add(`${base} ${section}`);
    variants.add(`${base}${section}`);
  }
  if (normalizedBase && section) {
    variants.add(`${normalizedBase}${section}`);
  }

  return Array.from(variants).filter(Boolean);
};

const buildCourseNameLookup = () => {
  const lookup = new Map<string, string>();
  const add = (key: string | undefined, value: string) => {
    if (!key || !value || lookup.has(key)) return;
    lookup.set(key, value);
  };

  catalogEntries.forEach(({ codigo, seccion, nombre }) => {
    const cleanName = stripCodeParenthesis((nombre ?? '').trim());
    if (!cleanName) return;

    collectCodeVariants(codigo, seccion).forEach((variant) => add(variant, cleanName));
    if (seccion) {
      collectCodeVariants(`${codigo} ${seccion}`).forEach((variant) => add(variant, cleanName));
    }
  });

  return lookup;
};

const resolveCourseName = (curso: CursoAvance, lookup: Map<string, string>) => {
  const provided = (curso.nombre ?? '').trim();
  const isPlaceholder = /NO\s+ENCONTRADO|SIN\s+NOMBRE|NO\s+DISPONIBLE|SIN\s+INFORMACI[ÓO]N/i.test(provided);
  if (provided && !isPlaceholder) return stripCodeParenthesis(provided);

  for (const variant of collectCodeVariants(curso.codigo)) {
    const match = lookup.get(variant);
    if (match) return stripCodeParenthesis(match);
  }

  return toUpperTrim(curso.codigo) || normalizeCourseCode(curso.codigo) || stripCodeParenthesis(provided);
};

// --- COMPONENTE INTERNO 'CarreraAvanceBlock' ---
const CarreraAvanceBlock: React.FC<{
  carrera: CarreraAvance;
  courseNameLookup: Map<string, string>;
}> = ({ carrera, courseNameLookup }) => {
  const years = useMemo(() => {
    const periodsByYear = new Map<string, Periodo[]>();
    carrera.periodos.forEach((periodo) => {
      const year = periodo.periodo.substring(0, 4);
      if (!periodsByYear.has(year)) {
        periodsByYear.set(year, []);
      }
      periodsByYear.get(year)!.push(periodo);
    });

    return Array.from(periodsByYear.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([calendarYear, periodos], idx) => ({
        yearIndex: idx + 1,
        calendarYear,
        periodos,
      }));
  }, [carrera.periodos]);

  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    years.forEach((year) => {
      initial[year.yearIndex] = year.yearIndex === 1;
    });
    return initial;
  });

  const [isCarreraExpanded, setIsCarreraExpanded] = useState(true);

  const toggleYear = (yearIndex: number) => setExpandedYears((prev) => ({ ...prev, [yearIndex]: !prev[yearIndex] }));
  const toggleCarrera = () => setIsCarreraExpanded((prev) => !prev);

  const isConvalidated = (curso: CursoAvance) => {
    const type = (curso.inscriptionType || '').toLowerCase();
    return type.includes('convalidaci') || type.includes('regularizacion de creditos');
  };

  if (carrera.periodos.length === 0) {
    return (
      <div className="carrera-block">
        <div className="carrera-header" onClick={toggleCarrera}>
          <span>
            Avance en: <strong>{carrera.nombre}</strong> (Sin registros)
          </span>
          <div className="carrera-toggle">{isCarreraExpanded ? '−' : '+'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="carrera-block">
      <div className="carrera-header" onClick={toggleCarrera}>
        <span>
          Avance en: <strong>{carrera.nombre}</strong>
        </span>
        <div className="carrera-toggle">{isCarreraExpanded ? '−' : '+'}</div>
      </div>

      {isCarreraExpanded && (
        <div className="carrera-content">
          <div className="years-list">
            {years.map((year) => (
              <div key={year.yearIndex} className="year-block">
                <div className="year-header" onClick={() => toggleYear(year.yearIndex)}>
                  <div className="year-title">
                    {ordinal(year.yearIndex)} Año
                    {year.calendarYear && ` (${year.calendarYear})`}
                  </div>
                  <div className="year-toggle">{expandedYears[year.yearIndex] ? '−' : '+'}</div>
                </div>

                {expandedYears[year.yearIndex] && (
                  <div className="year-content">
                    {year.periodos.map((periodo) => (
                      <div key={periodo.periodo} className="semester-row">
                        <div className="semester-label">{periodo.label}</div>
                        <div className="semester-courses">
                          {periodo.cursos.map((curso) => {
                            const ns = normalizeStatus(curso.status, curso.inscriptionType);
                            const isConv = isConvalidated(curso);
                            const fallbackName = resolveCourseName(curso, courseNameLookup);

                            return (
                              <CourseCard
                                key={curso.nrc}
                                code={curso.codigo}
                                name={fallbackName}
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

  const courseNameLookup = useMemo(() => buildCourseNameLookup(), []);

  useEffect(() => {
    const fetchAvanceSummary = async () => {
      try {
        const rut = localStorage.getItem('rut');
        const carrerasString = localStorage.getItem('carreras');

        if (!rut) throw new Error('RUT no encontrado en localStorage.');
        if (!carrerasString) throw new Error('Carreras no encontradas en localStorage.');

        let carreras;
        try {
          carreras = JSON.parse(carrerasString);
          if (!Array.isArray(carreras) || carreras.length === 0) {
            throw new Error('No hay carreras asociadas al usuario.');
          }
        } catch (e) {
          throw new Error('Error al interpretar datos de carrera.');
        }

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

        {isLoading && (
          <div className="loading-state">
            <p>Cargando avance académico...</p>
          </div>
        )}
        {error && (
          <div className="error-state">
            <h3>Error al cargar el avance</h3>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && avanceSummary && (
          <div className="carreras-list">
            {avanceSummary.carreras.map((carrera) => (
              <CarreraAvanceBlock key={carrera.codigo} carrera={carrera} courseNameLookup={courseNameLookup} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Avance;