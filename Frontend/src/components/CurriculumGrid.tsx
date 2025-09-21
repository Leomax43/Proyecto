import React from "react";

export type Course = {
  nombre: string;
  notaFinal: number | null;
  codigo: string;
  creditos: number;
  intentos: number;
};

export type Semester = {
  numero: number;
  cursos: Course[];
};

export type CurriculumGridProps = {
  semestres: Semester[];
};

const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const CurriculumGrid: React.FC<CurriculumGridProps> = ({ semestres }) => (
  <div className="curriculum-main">
    <h2 className="curriculum-title">Malla de carrera usuario</h2>
    <div className="curriculum-grid">
      {semestres.map((sem, idx) => (
        <div key={sem.numero} className="semester-column">
          <div className="semester-header">{romanNumerals[sem.numero - 1]}</div>
          {sem.cursos.map((curso) => (
            <div key={curso.codigo} className="course-card">
              <div className="course-code">{curso.codigo}</div>
              <div className="course-name">{curso.nombre}</div>
              <div className="course-nf">NF: {curso.notaFinal ?? "-"}</div>
              <div className="course-creditos">{curso.creditos} SCT</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

export default CurriculumGrid;
