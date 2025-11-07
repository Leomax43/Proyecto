import React, { useState, useEffect } from "react"; 
// 1. Importamos useNavigate para redirigir si no hay sesión
import { useNavigate } from "react-router-dom";
import CurriculumGrid from "./components/CurriculumGrid";
import type { Semester } from "./components/CurriculumGrid";
import "./components/CurriculumGrid.css";
import Sidebar from "./components/Sidebar";
import "./components/Sidebar.css";

// --- INTERFACES ---
interface ApiCurso {
  codigo: string;
  asignatura: string;
  creditos: number;
  nivel: number;
  prereq: string;
}

interface CursoGrid {
  nombre: string;
  notaFinal: number | null;
  codigo: string;
  creditos: number;
  intentos: number;
}

// 2. Definimos una interfaz para la carrera (del localStorage)
interface Carrera {
  codigo: string;
  nombre: string;
  catalogo: string;
}
// --- FIN INTERFACES ---


// --- FUNCIÓN TRADUCTORA (Sin cambios) ---
const transformarApiASemestres = (apiData: ApiCurso[]): Semester[] => {
  const grupos = new Map<number, CursoGrid[]>();

  apiData.forEach(apiCurso => {
    const nivel = apiCurso.nivel;
    const cursoGrid: CursoGrid = {
      codigo: apiCurso.codigo,
      nombre: apiCurso.asignatura,
      creditos: apiCurso.creditos,
      notaFinal: null,
      intentos: 1
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate(); // 3. Inicializamos useNavigate

  useEffect(() => {
    const fetchMallaData = async () => {
      try {
        // --- INICIO DE LA LÓGICA DINÁMICA ---
        
        // 4. Leemos las carreras del localStorage (la guardaste en Login.tsx)
        const carrerasString = localStorage.getItem('carreras');
        if (!carrerasString) {
          setError('No se encontraron datos de carrera. Por favor, inicie sesión.');
          navigate('/'); // Redirigimos al Login
          return;
        }

        // 5. Parseamos los datos
        const carreras: Carrera[] = JSON.parse(carrerasString);

        if (!carreras || carreras.length === 0) {
          setError('El usuario no tiene carreras asociadas.');
          return;
        }
        
        // 6. Seleccionamos la carrera (usamos la primera de la lista)
        const carreraActual = carreras[0]; 
        const codigo = carreraActual.codigo;
        const catalogo = carreraActual.catalogo;
        
        // --- FIN DE LA LÓGICA DINÁMICA ---

        // 7. Construimos la URL de forma dinámica
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
        
        const semestresFormateados = transformarApiASemestres(dataApi as ApiCurso[]);
        setSemestres(semestresFormateados);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMallaData();
  }, [navigate]); // 8. Añadimos 'navigate' a las dependencias

  // --- RENDERIZADO (Sin cambios, esto está bien) ---
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
          <CurriculumGrid semestres={semestres} />
        )}
        
      </div>
    </div>
  );
}

export default Malla;