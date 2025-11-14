import React, { useState } from "react";

// --- DEFINICIÓN DE TIPOS ---
export interface ApiCurso {
  codigo: string;
  asignatura: string;
  creditos: number;
  nivel: number;
  prereq: string;
}

export type CursoGrid = {
  nombre: string;
  notaFinal: number | null;
  codigo: string;
  creditos: number;
  intentos: number;
  prereq: string;
};

export type Semester = {
  numero: number;
  cursos: CursoGrid[];
  headerLabel?: string;
};

export type CurriculumGridProps = {
  semestres: Semester[];
  allCourses: ApiCurso[]; 
  carrera?: string;
};

const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

let careerNameFromStorage = 'Malla de carrera usuario';
const carrerasString = localStorage.getItem('carreras');
if (carrerasString) {
  try {
    const carrerasParsed = JSON.parse(carrerasString);
    if (Array.isArray(carrerasParsed) && carrerasParsed.length > 0) {
      careerNameFromStorage = typeof carrerasParsed[0] === 'string' ? carrerasParsed[0] : carrerasParsed[0].nombre || careerNameFromStorage;
    }
  } catch (e) {
    careerNameFromStorage = carrerasString;
  }
}

// --- INICIO DEL COMPONENTE ---
const CurriculumGrid: React.FC<CurriculumGridProps> = ({ semestres, allCourses, carrera }) => {
  const [hoveredCourse, setHoveredCourse] = useState<CursoGrid | null>(null);

  const findCourseName = (codigo: string): string => {
    const course = allCourses.find(c => c.codigo.trim() === codigo.trim());
    return course ? course.asignatura : codigo;
  };

  const title = carrera ? `Malla curricular - ${carrera}` : `Malla curricular - ${careerNameFromStorage}`;

  return (
    <div className="curriculum-main">
      <h2 className="curriculum-title">{title}</h2>
      <div className="curriculum-grid">
        {semestres.map((sem, idx) => (
          <div key={sem.numero ?? idx} className="semester-column">
            <div className="semester-header">{sem.headerLabel ?? romanNumerals[sem.numero - 1]}</div>
            {sem.cursos.map((curso) => (
              <div
                key={curso.codigo}
                className="course-card"
                onMouseEnter={() => setHoveredCourse(curso)}
                onMouseLeave={() => setHoveredCourse(null)}
              >
                <div className="course-code">{curso.codigo}</div>
                <div className="course-name">{curso.nombre}</div>
                <div className="course-nf">NF: {curso.notaFinal ?? "-"}</div>
                <div className="course-creditos">{curso.creditos} SCT</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {hoveredCourse && (
        <div className="prereq-tooltip">
          <div className="prereq-title">Prerrequisitos para:</div>
          <div className="prereq-course-name">{hoveredCourse.nombre}</div>
          <hr />
          
          {hoveredCourse.prereq ? (
            <ul>
              {hoveredCourse.prereq.split(',').map((codigo) => (
                <li key={codigo}>{findCourseName(codigo)}</li>
              ))}
            </ul>
          ) : (
            <div className="prereq-none">Sin Pre-Requisitos</div>
          )}
        </div>
      )}
    </div>
  );
};

export default CurriculumGrid;