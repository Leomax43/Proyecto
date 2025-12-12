import { IsString, IsNotEmpty, IsArray, ValidateNested, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SimulateProjectionDto {
  rut: string;
  codCarrera: string;
  catalogo: string;
  proyeccionActual: ProyeccionDto;
}

export class ProyeccionDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => YearDto)
  years: YearDto[];
}

export class YearDto {
 @IsNumber()
  yearIndex: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SemesterDto)
  semesters: SemesterDto[];
}

export class SemesterDto {
  @IsString()
  label: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseBoxDto)
  courses: CourseBoxDto[];
}

export class CourseBoxDto {
   @IsString()
  @IsNotEmpty()
  id: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  creditos?: number;

  @IsOptional()
  @IsString()
  name?: string;
}

export class SimulationResultDto {
  //este pedazo de código estaba dando error al compilar backend -- comentado por martina
/*
  @IsString()
  @IsNotEmpty()
  rut: string;

  @IsString()
  @IsNotEmpty()
  codCarrera: string;

  @IsString()
  @IsNotEmpty()
  catalogo: string;

  @ValidateNested()
  @Type(() => ProyeccionDto)
  proyeccionActual: ProyeccionDto;
  */

  years: YearDto[];
  warnings: WarningDto[];
}

export class WarningDto {
  yearIndex: number;
  semIdx: number;
  message: string;
}

