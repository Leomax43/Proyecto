export class MallaFormattedDto {
  semestres: SemestreDto[];
}

export class SemestreDto {
  nivel: number;
  cursos: CursoDto[];
}

export class CursoDto {
  codigo: string;
  nombre: string;
  creditos: number;
  prereqs: string[];
  status?: string; // si se incluye rut del alumno
}
