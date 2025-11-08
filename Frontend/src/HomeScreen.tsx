import CurriculumGrid from "./components/CurriculumGrid";
import type { Semester } from "./components/CurriculumGrid";
import "./components/CurriculumGrid.css";
import Sidebar from "./components/Sidebar";
import "./components/Sidebar.css";

const exampleSemesters: Semester[] = [
  {
    numero: 1,
    cursos: [
      { nombre: "Matemática I", notaFinal: 5.5, codigo: "MAT101", creditos: 6, intentos: 1 },
      { nombre: "Química", notaFinal: 4.8, codigo: "QUI101", creditos: 5, intentos: 1 },
      { nombre: "Introducción a la Ingeniería", notaFinal: null, codigo: "ING100", creditos: 3, intentos: 1 },
    ],
  },
  {
    numero: 2,
    cursos: [
      { nombre: "Matemática II", notaFinal: null, codigo: "MAT102", creditos: 6, intentos: 1 },
      { nombre: "Física I", notaFinal: null, codigo: "FIS101", creditos: 5, intentos: 1 },
      { nombre: "Comunicación Efectiva", notaFinal: 6.0, codigo: "COM101", creditos: 3, intentos: 1 },
    ],
  },
  {
    numero: 3,
    cursos: [
      { nombre: "Programación I", notaFinal: null, codigo: "INF101", creditos: 5, intentos: 1 },
      { nombre: "Física II", notaFinal: null, codigo: "FIS102", creditos: 5, intentos: 1 },
      { nombre: "Álgebra Lineal", notaFinal: null, codigo: "MAT201", creditos: 6, intentos: 1 },
    ],
  },

];


function HomeScreen() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <CurriculumGrid semestres={exampleSemesters} />
      </div>
    </div>
  );
}

export default HomeScreen;
