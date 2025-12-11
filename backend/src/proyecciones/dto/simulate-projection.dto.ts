export class SimulateProjectionDto {
  rut: string;
  codCarrera: string;
  catalogo: string;
  proyeccionActual: ProyeccionDto;
}

export class ProyeccionDto {
  id: string;
  title: string;
  years: YearDto[];
}

export class YearDto {
  yearIndex: number;
  title?: string;
  semesters: SemesterDto[];
}

export class SemesterDto {
  label: string;
  courses: CourseBoxDto[];
}

export class CourseBoxDto {
  id: string;
  code?: string;
  status?: string;
  creditos?: number;
  name?: string;
}

export class SimulationResultDto {
  years: YearDto[];
  warnings: WarningDto[];
}

export class WarningDto {
  yearIndex: number;
  semIdx: number;
  message: string;
}
