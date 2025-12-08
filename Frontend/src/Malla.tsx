import { useState, useEffect } from "react"; 
import { useNavigate } from "react-router-dom";
import CurriculumGrid from "./components/CurriculumGrid";
import type { Semester } from "./components/CurriculumGrid"; 
import "./styles/CurriculumGrid.css";
import Sidebar from "./components/Sidebar";
import "./styles/Sidebar.css";
import { apiGet } from "./config/api";

// --- INTERFACES ---
interface ApiCurso {
  codigo: string;
  asignatura: string;
  creditos: number;
  nivel: number;
  prereq: string;
}

interface Carrera {
  codigo: string;
  nombre: string;
  catalogo: string;
}

function Malla() {
  const [semestres, setSemestres] = useState<Semester[]>([]);
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
        const rut = localStorage.getItem('rut');
        
        // Use new formatted endpoint that returns structured data with optional student status
        const rutParam = rut ? `?rut=${encodeURIComponent(rut)}` : '';
        const formattedData = await apiGet(`/ucn/malla/${encodeURIComponent(codigo)}/${encodeURIComponent(catalogo)}/formatted${rutParam}`);

        if (!formattedData || !Array.isArray(formattedData.semestres)) {
          console.error("La API no devolvió datos formateados válidos:", formattedData);
          throw new Error('La API no devolvió una malla de cursos válida.');
        }

        // Extract flat course list for filtering/search
        const flatCourses: ApiCurso[] = formattedData.semestres.flatMap((sem: any) =>
          sem.cursos.map((c: any) => ({
            codigo: c.codigo,
            asignatura: c.nombre,
            creditos: c.creditos,
            nivel: sem.nivel,
            prereq: c.prereqs?.join(',') || '',
          }))
        );
        setAllCourses(flatCourses);

        // Convert backend format to frontend Semester format
        const semestresFormateados: Semester[] = formattedData.semestres.map((sem: any) => ({
          numero: sem.nivel,
          cursos: sem.cursos.map((c: any) => ({
            codigo: c.codigo,
            nombre: c.nombre,
            creditos: c.creditos,
            prereq: c.prereqs?.join(',') || '',
            notaFinal: null,
            intentos: 1,
            status: c.status || undefined,
          })),
        }));
        setSemestres(semestresFormateados);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMallaData();
  }, [navigate]);

  // --- RENDERIZADO ---
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
        {!isLoading && !error && (
          <CurriculumGrid semestres={semestres} allCourses={allCourses} />
        )}
        
      </div>
    </div>
  );
}

export default Malla;