import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CurriculumGrid, {Semester} from './CurriculumGrid';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';


const mockData: Semester[] = [
  {
    numero: 1,
    cursos: [
      { 
        codigo: 'INF101', 
        nombre: 'Programación', 
        status: 'APROBADO', 
        creditos: 6, 
        intentos: 1, 
        notaFinal: null, // Campo obligatorio según la interfaz
        prereq: ''       // Campo obligatorio según la interfaz
      },
      { 
        codigo: 'MAT101', 
        nombre: 'Álgebra', 
        status: 'VACANTE', 
        creditos: 6, 
        intentos: 1, 
        notaFinal: null, 
        prereq: '' 
      }
    ]
  }
];


describe('Pruebas de Malla Visual', () => {
  it('Debe renderizar las tarjetas con las clases de estado correctas', () => {
    render(
      <BrowserRouter>
        <CurriculumGrid semestres={mockData} allCourses={[]} />
      </BrowserRouter>
    );

    // Verifica que el curso aparezca
    expect(screen.getByText('Programación')).toBeInTheDocument();

    // Verifica la clase CSS de estado aprobado (asumiendo que normalizeStatus la genera)
    const card = screen.getByText('Programación').closest('.course-card');
    expect(card).toHaveClass('status-approved');
  });

  it('Debe mostrar el número romano correcto para el semestre', () => {
    render(
      <BrowserRouter>
        <CurriculumGrid semestres={mockData} allCourses={[]} />
      </BrowserRouter>
    );
    expect(screen.getByText('I')).toBeInTheDocument();
  });
});