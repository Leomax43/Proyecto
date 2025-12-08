export class AvanceSummaryDto {
  carreras: CarreraAvanceDto[];
}

export class CarreraAvanceDto {
  codigo: string;
  nombre: string;
  catalogo: string;
  periodos: PeriodoDto[];
  creditosAprobados: number;
  creditosTotales: number;
}

export class PeriodoDto {
  periodo: string;
  label: string;
  cursos: CursoAvanceDto[];
}

export class CursoAvanceDto {
  nrc: string;
  codigo: string;
  nombre: string;
  status: string;
  creditos: number;
  inscriptionType?: string;
}
