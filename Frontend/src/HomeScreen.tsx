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
  {
    numero: 4,
    cursos: [
      { nombre: "Estructuras de Datos", notaFinal: null, codigo: "INF201", creditos: 6, intentos: 1 },
      { nombre: "Probabilidades y Estadística", notaFinal: null, codigo: "EST101", creditos: 5, intentos: 1 },
      { nombre: "Electrónica Básica", notaFinal: null, codigo: "ELC101", creditos: 5, intentos: 1 },
    ],
  },
  {
    numero: 5,
    cursos: [
      { nombre: "Bases de Datos", notaFinal: null, codigo: "INF301", creditos: 6, intentos: 1 },
      { nombre: "Métodos Numéricos", notaFinal: null, codigo: "MAT301", creditos: 5, intentos: 1 },
      { nombre: "Ingeniería de Software I", notaFinal: null, codigo: "INF302", creditos: 6, intentos: 1 },
    ],
  },
  {
    numero: 6,
    cursos: [
      { nombre: "Redes del papu", notaFinal: null, codigo: "INF303", creditos: 5, intentos: 1 },
      { nombre: "Investigación de Operaciones", notaFinal: null, codigo: "ADM201", creditos: 5, intentos: 1 },
      { nombre: "Ingeniería de Software II", notaFinal: null, codigo: "INF304", creditos: 6, intentos: 1 },
    ],
  },
  {
    numero: 7,
    cursos: [
      { nombre: "Inteligencia Artificial", notaFinal: null, codigo: "INF401", creditos: 6, intentos: 1 },
      { nombre: "Sistemas Operativos", notaFinal: null, codigo: "INF402", creditos: 5, intentos: 1 },
      { nombre: "Gestión de Proyectos", notaFinal: null, codigo: "ADM301", creditos: 4, intentos: 1 },
    ],
  },
  {
    numero: 8,
    cursos: [
      { nombre: "Compiladores", notaFinal: null, codigo: "INF403", creditos: 6, intentos: 1 },
      { nombre: "Arquitectura de Computadores", notaFinal: null, codigo: "INF404", creditos: 6, intentos: 1 },
      { nombre: "Ética Profesional", notaFinal: null, codigo: "HUM201", creditos: 3, intentos: 1 },
    ],
  },
  {
    numero: 9,
    cursos: [
      { nombre: "Proyecto de Título I", notaFinal: null, codigo: "PRY501", creditos: 10, intentos: 1 },
    ],
  },
  {
    numero: 10,
    cursos: [
      { nombre: "Proyecto de Título II", notaFinal: null, codigo: "PRY502", creditos: 10, intentos: 1 },
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
