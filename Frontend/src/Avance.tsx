import React, { useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import './styles/Avance.css';

// Mock data for the prototype (UI only). Más tarde conectaremos la API.
const exampleAvance = [
  { nrc: '21943', period: '202320', student: '11188222333', course: 'ECIN-00704', excluded: false, inscriptionType: 'REGULAR', status: 'APROBADO' },
  { nrc: '21944', period: '202320', student: '11188222333', course: 'ECIN-00600', excluded: false, inscriptionType: 'REGULAR', status: 'REPROBADO' },
  { nrc: '21950', period: '202410', student: '11188222333', course: 'MAT-102', excluded: false, inscriptionType: 'REGULAR', status: 'APROBADO' },
  { nrc: '21960', period: '202410', student: '11188222333', course: 'INF-101', excluded: false, inscriptionType: 'REGULAR', status: 'APROBADO' },
  { nrc: '22000', period: '202510', student: '11188222333', course: 'FIS-201', excluded: false, inscriptionType: 'REGULAR', status: 'INSCRITO' },
];

// util: chunk array into groups of size n
const chunk = (arr: any[], size: number) => {
  const res: any[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
};

const ordinal = (n: number) => {
  const map = ['Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo'];
  return map[n - 1] || `Año ${n}`;
};

const statusClass = (status: string | undefined) => {
  if (!status) return 'status-unknown';
  const s = status.toLowerCase();
  if (s.includes('aprob')) return 'status-approved';
  if (s.includes('reprob')) return 'status-failed';
  if (s.includes('inscrit')) return 'status-enrolled';
  return 'status-unknown';
};

const Avance: React.FC = () => {
  // Agrupar por period
  const byPeriod = useMemo(() => {
    const map: Record<string, any[]> = {};
    exampleAvance.forEach(a => {
      const p = a.period || 'unknown';
      if (!map[p]) map[p] = [];
      map[p].push(a);
    });
    const periods = Object.keys(map).sort();
    return { map, periods };
  }, []);

  // Agrupar periodos en años (2 periodos por año, en orden)
  const years = useMemo(() => {
    const groups = chunk(byPeriod.periods, 2); // [[p1,p2],[p3,p4],...]
    return groups.map((periods, idx) => ({
      yearIndex: idx + 1,
      periods
    }));
  }, [byPeriod]);

  // Keep expanded state per year
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    years.forEach(y => { initial[y.yearIndex] = y.yearIndex === 1; }); // open first year by default
    return initial;
  });

  const toggle = (yearIndex: number) => setExpanded(prev => ({ ...prev, [yearIndex]: !prev[yearIndex] }));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: 20 }} className="avance-container">
        <div className="avance-header">
          <h1>Avance de carrera usuario</h1>
        </div>

        <div className="years-list">
          {years.map(y => (
            <div key={y.yearIndex} className="year-block">
              <div className="year-header" onClick={() => toggle(y.yearIndex)}>
                <div className="year-title">{ordinal(y.yearIndex)} Año</div>
                <div className="year-toggle">{expanded[y.yearIndex] ? '−' : '+'}</div>
              </div>

              {expanded[y.yearIndex] && (
                <div className="year-content">
                  {y.periods.map((period, pi) => (
                    <div key={period} className="semester-row">
                      <div className="semester-label">{pi === 0 ? 'Primer Semestre' : 'Segundo Semestre'}</div>
                      <div className="semester-courses">
                        {(byPeriod.map[period] || []).map((curso: any) => (
                          <div key={curso.nrc} className={`avance-course ${statusClass(curso.status)}`}>
                            <div className="course-code">{curso.course}</div>
                            <div className="course-status">{curso.status}</div>
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
    </div>
  );
};

export default Avance;
