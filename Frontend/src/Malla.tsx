import React, { useState, useEffect } from "react"; 
import CurriculumGrid from "./components/CurriculumGrid";
import type { Semester } from "./components/CurriculumGrid";
import "./components/CurriculumGrid.css";
import Sidebar from "./components/Sidebar";
import "./components/Sidebar.css";

// --- INTERFACES ---
// 1. Definimos el tipo de curso que esperamos de tu API
interface ApiCurso {
  codigo: string;
  asignatura: string;
  creditos: number;
  nivel: number;
  prereq: string;
}

// 2. Definimos el tipo de curso que tu componente CurriculumGrid espera
interface CursoGrid {
  nombre: string;
  notaFinal: number | null;
  codigo: string;
  creditos: number;
  intentos: number;
}
// --- FIN INTERFACES ---


// --- FUNCIÓN TRADUCTORA (La Lógica Clave) ---
/**
 * Agrupa la lista plana de cursos de la API en la estructura
 * de Semestres que el componente CurriculumGrid espera.
 */
const transformarApiASemestres = (apiData: ApiCurso[]): Semester[] => {
  // 1. Usamos un Map para agrupar cursos por 'nivel'
  const grupos = new Map<number, CursoGrid[]>();

  apiData.forEach(apiCurso => {
    const nivel = apiCurso.nivel;

    // 2. "Traduce" el formato del API al formato del Grid
    const cursoGrid: CursoGrid = {
      codigo: apiCurso.codigo,
      nombre: apiCurso.asignatura,
      creditos: apiCurso.creditos,
      notaFinal: null, // La API de malla no nos da la nota
      intentos: 1       // Ponemos 1 por defecto
    };

    // 3. Agrega el curso al grupo de su nivel
    if (!grupos.has(nivel)) {
      grupos.set(nivel, []);
    }
    grupos.get(nivel)!.push(cursoGrid);
  });

  // 4. Convierte el Map (grupos) en el Array final de Semestres
  const semestres: Semester[] = Array.from(grupos.entries())
    .sort((a, b) => a[0] - b[0]) // Ordena por nivel (Semestre 1, 2, 3...)
    .map(([nivel, cursos]) => ({
      numero: nivel,
      cursos: cursos
    }));
    
  return semestres;
}
// --- FIN FUNCIÓN TRADUCTORA ---


function Malla() {
  // 3. Creamos un estado para guardar los semestres
  const [semestres, setSemestres] = useState<Semester[]>([]);
  // 4. Creamos un estado de carga
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 5. useEffect se ejecuta 1 sola vez cuando el componente se carga
  useEffect(() => {
    
    const fetchMallaData = async () => {
      try {
        // 6. ¡Llamamos a NUESTRO PROPIO backend!
        const response = await fetch('http://localhost:3000/ucn/malla?codigo=8606&catalogo=202320');
        
        if (!response.ok) {
          throw new Error('Error al obtener la malla del backend (response no ok)');
        }

        const dataApi = await response.json(); // La API podría devolver un Array o un Objeto de error

        // --- INICIO DE LA SOLUCIÓN ---
        // 7. Verificamos si la respuesta NO es un array
        if (!Array.isArray(dataApi)) {
          // Si es un objeto (ej: {"error": "..."}), lanzamos un error
          console.error("La API no devolvió un array:", dataApi);
          throw new Error('La API no devolvió una malla de cursos válida.');
        }
        // --- FIN DE LA SOLUCIÓN ---
        
        // 8. Usamos la función "traductora" (Ahora estamos seguros de que dataApi es un Array)
        const semestresFormateados = transformarApiASemestres(dataApi as ApiCurso[]);
        
        // 9. Actualizamos el estado con los datos reales
        setSemestres(semestresFormateados);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido');
      } finally {
        // 10. Dejamos de cargar (en éxito o error)
        setIsLoading(false);
      }
    };

    fetchMallaData();
  }, []); // El array vacío '[]' asegura que se ejecute solo 1 vez

  // --- RENDERIZADO ---
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        
        {/* Mostramos un mensaje de carga */}
        {isLoading && (
          <div style={{ padding: '2rem' }}>
            <h2>Cargando malla curricular...</h2>
          </div>
        )}

        {/* Mostramos un mensaje de error si algo falló */}
        {error && (
          <div style={{ padding: '2rem', color: 'red' }}>
            <h2>Error: {error}</h2>
            <p>Asegúrate de que el servidor backend esté corriendo en `localhost:3000`</p>
          </div>
        )}

        {/* Si no hay carga y no hay error, mostramos la malla */}
        {!isLoading && !error && (
          <CurriculumGrid semestres={semestres} />
        )}
        
      </div>
    </div>
  );
}

export default Malla;