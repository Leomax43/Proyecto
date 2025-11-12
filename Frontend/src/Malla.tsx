import { useState, useEffect } from "react"; 
import { useNavigate } from "react-router-dom";
import CurriculumGrid from "./components/CurriculumGrid";
// 1. IMPORTANTE: 'Semester' se actualizará, pero la definición está en CurriculumGrid.tsx
import type { Semester, CursoGrid } from "./components/CurriculumGrid"; 
import "./styles/CurriculumGrid.css";
import Sidebar from "./components/Sidebar";
import "./styles/Sidebar.css";

// --- INTERFACES ---
// 'ApiCurso' sigue igual (lo que viene del backend)
interface ApiCurso {
  codigo: string;
  asignatura: string;
  creditos: number;
  nivel: number;
  prereq: string;
}

// 'Carrera' del localStorage sigue igual
interface Carrera {
  codigo: string;
  nombre: string;
  catalogo: string;
}
// --- FIN INTERFACES ---


// --- FUNCIÓN TRADUCTORA (ACTUALIZADA) ---
const transformarApiASemestres = (apiData: ApiCurso[]): Semester[] => {
  const grupos = new Map<number, CursoGrid[]>();

  apiData.forEach(apiCurso => {
    const nivel = apiCurso.nivel;
    
    // 2. "Traduce" el formato: AÑADIMOS 'prereq'
    const cursoGrid: CursoGrid = {
      codigo: apiCurso.codigo,
      nombre: apiCurso.asignatura,
      creditos: apiCurso.creditos,
      notaFinal: null, 
      intentos: 1,
      prereq: apiCurso.prereq // <-- ¡CAMBIO IMPORTANTE!
    };

    if (!grupos.has(nivel)) {
      grupos.set(nivel, []);
    }
    grupos.get(nivel)!.push(cursoGrid);
  });

  const semestres: Semester[] = Array.from(grupos.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([nivel, cursos]) => ({
      numero: nivel,
      cursos: cursos
    }));
    
  return semestres;
}
// --- FIN FUNCIÓN TRADUCTORA ---


function Malla() {
  const [semestres, setSemestres] = useState<Semester[]>([]);
  // 3. NUEVO ESTADO: para guardar la lista plana de cursos
  const [allCourses, setAllCourses] = useState<ApiCurso[]>([]); 
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate(); 

  useEffect(() => {
    const fetchMallaData = async () => {
      try {
        const carrerasString = localStorage.getItem('carreras');
        if (!carrerasString) {
          setError('No se encontraron datos de carrera. Por favor, inicie sesión.');
          navigate('/'); 
          return;
        }

        const carreras: Carrera[] = JSON.parse(carrerasString);

        if (!carreras || carreras.length === 0) {
          setError('El usuario no tiene carreras asociadas.');
          return;
        }
        
        const carreraActual = carreras[0]; 
        const codigo = carreraActual.codigo;
        const catalogo = carreraActual.catalogo;
        
        const url = `http://localhost:3000/ucn/malla?codigo=${codigo}&catalogo=${catalogo}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Error al obtener la malla del backend (response no ok)');
        }

        const dataApi = await response.json(); 

        if (!Array.isArray(dataApi)) {
          console.error("La API no devolvió un array:", dataApi);
          throw new Error('La API no devolvió una malla de cursos válida.');
        }
        
        // 4. Guardamos la lista plana de cursos en el nuevo estado
        setAllCourses(dataApi as ApiCurso[]); 

        // 5. La función "traductora" usará 'dataApi'
        const semestresFormateados = transformarApiASemestres(dataApi as ApiCurso[]);
        setSemestres(semestresFormateados);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMallaData();
  }, [navigate]);

  // --- RENDERIZADO (ACTUALIZADO) ---
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        
        {isLoading && (
          <div style={{ padding: '2rem' }}>
            <h2>Cargando malla curricular...</h2>
          </div>
        )}

        {error && (
          <div style={{ padding: '2rem', color: 'red' }}>
            <h2>Error: {error}</h2>
            <p>Asegúrate de que el servidor backend esté corriendo en `localhost:3000`</p>
          </div>
        )}

        {/* 6. Pasamos 'allCourses' como prop al Grid */}
        {!isLoading && !error && (
          <CurriculumGrid semestres={semestres} allCourses={allCourses} />
        )}
        
      </div>
    </div>
  );
}

export default Malla;