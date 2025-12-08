export type NormalizedStatus =
  | 'aprobado'
  | 'reprobado'
  | 'inscrito'
  | 'vacante'
  | 'convalidated'
  | 'unknown';

export function normalizeStatus(rawStatus?: string | null, inscriptionType?: string | null) {
  const raw = (rawStatus || '').toString().toLowerCase();
  const ins = (inscriptionType || '').toString().toLowerCase();

  if (ins.includes('convalid') || ins.includes('regularizacion')) {
    return {
      normalized: 'convalidated' as NormalizedStatus,
      spanishClass: 'status-convalidated',
      englishClass: 'status-convalidated'
    };
  }

  if (raw.includes('aprob')) {
    return { normalized: 'aprobado' as NormalizedStatus, spanishClass: 'status-aprobado', englishClass: 'status-approved' };
  }

  if (raw.includes('reprob') || raw.includes('fail')) {
    return { normalized: 'reprobado' as NormalizedStatus, spanishClass: 'status-reprobado', englishClass: 'status-failed' };
  }

  if (raw.includes('inscrit') || raw.includes('enroll')) {
    return { normalized: 'inscrito' as NormalizedStatus, spanishClass: 'status-inscrito', englishClass: 'status-enrolled' };
  }

  if (!raw || raw.trim() === '') {
    return { normalized: 'vacante' as NormalizedStatus, spanishClass: 'status-vacante', englishClass: 'status-vacante' };
  }

  return { normalized: 'unknown' as NormalizedStatus, spanishClass: 'status-unknown', englishClass: 'status-unknown' };
}
