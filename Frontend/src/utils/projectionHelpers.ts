import type { SemesterSim, YearSim, Projection } from '../components/proyecciones/types';

export const makeId = () => Math.random().toString(36).slice(2, 9);

export const makeEmptySemester = (label = 'Primer Semestre'): SemesterSim => ({
  label,
  courses: Array.from({ length: 5 }).map(() => ({ id: makeId(), code: '', status: '' }))
});

export const makeDefaultProjection = (title = 'Proyección nueva'): Projection => {
  const years: YearSim[] = [];
  years.push({ yearIndex: 0, semesters: [makeEmptySemester('Primer Semestre'), makeEmptySemester('Segundo Semestre')], title: 'Semestre Actual' });
  years.push({ yearIndex: 1, semesters: [makeEmptySemester('Primer Semestre'), makeEmptySemester('Segundo Semestre')], title: 'Año Simulado 1' });
  years.push({ yearIndex: 2, semesters: [makeEmptySemester('Primer Semestre'), makeEmptySemester('Segundo Semestre')], title: 'Año Simulado 2' });
  return { id: makeId(), title, createdAt: Date.now(), years };
};

// --- CORRECCIÓN CRÍTICA AQUÍ ---
export const normalize = (s?: string) => {
  if (!s) return '';
  // Elimina espacios, guiones y puntos. EJ: "ECIN-001" -> "ECIN001"
  return s.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
};
// -------------------------------

export const statusCycle = (s?: string) => {
  const order = ['VACANTE', 'APROBADO', 'REPROBADO'];
  const cur = ((s || '').toUpperCase() || 'VACANTE');
  const idx = order.indexOf(cur);
  return order[(idx + 1) % order.length];
};

export const parsePrereqs = (p?: string) => {
  if (!p) return [] as string[];
  return p.split(',').map(x => normalize(x)).filter(Boolean);
};

export const getSemesterLabel = (period?: string) => {
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