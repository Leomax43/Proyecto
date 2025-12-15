import { useState, useEffect, useMemo } from 'react';
import type { Projection, YearSim, SimulationPreferences } from '../components/proyecciones/types';

interface UseSimulationResult {
  simulatedYears: YearSim[];
  isSimulating: boolean;
  simulationError: string | null;
  warnings: Array<{ yearIndex: number; semIdx: number; message: string }>;
}

export function useProjectionSimulation(
  projection: Projection | null,
  rut: string | null,
  codCarrera: string | null,
  catalogo: string | null,
  preferences: SimulationPreferences | null,
): UseSimulationResult {
  const [simulatedYears, setSimulatedYears] = useState<YearSim[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Array<{ yearIndex: number; semIdx: number; message: string }>>([]);

  const sanitizedPreferences = useMemo(() => {
    if (!preferences) return null;
    const allowedKeys: Array<keyof SimulationPreferences> = [
      'maxCoursesPerSemester',
      'targetLoad',
      'priority',
      'unlockFocus',
      'levelDispersion',
      'semesterLimit',
    ];
    const entries = Object.entries(preferences).filter(
      ([key, value]) =>
        allowedKeys.includes(key as keyof SimulationPreferences) && value !== null && value !== undefined,
    );
    if (entries.length === 0) return null;
    return Object.fromEntries(entries) as SimulationPreferences;
  }, [preferences]);

  const preferencesKey = useMemo(() => JSON.stringify(sanitizedPreferences ?? {}), [sanitizedPreferences]);

  useEffect(() => {
    if (!projection || !rut || !codCarrera || !catalogo) {
      setSimulatedYears(projection?.years ?? []);
      setWarnings([]);
      return;
    }

    const runSimulation = async () => {
      setIsSimulating(true);
      setSimulationError(null);
      
      try {
        const payload: any = {
          rut,
          codCarrera,
          catalogo,
          proyeccionActual: {
            id: projection.id,
            title: projection.title,
            years: projection.years,
          },
        };

        if (sanitizedPreferences) {
          payload.preferences = sanitizedPreferences;
        }

        const response = await fetch('http://localhost:3000/proyecciones/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Simulación falló: ${response.status}`);
        }

        const result = await response.json();
        setSimulatedYears(result.years || []);
        setWarnings(result.warnings || []);
      } catch (error) {
        console.error('Error en simulación:', error);
        setSimulationError(error instanceof Error ? error.message : 'Error desconocido');
        // Fallback: usar proyección sin simulación
        setSimulatedYears(projection.years);
      } finally {
        setIsSimulating(false);
      }
    };

    runSimulation();
  }, [projection, rut, codCarrera, catalogo, preferencesKey, sanitizedPreferences]);

  return { simulatedYears, isSimulating, simulationError, warnings };
}
