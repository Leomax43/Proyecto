import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class SimulationPreferencesDto {
  @IsOptional()
  @Min(1)
  @Max(8)
  @IsNumber()
  maxCoursesPerSemester?: number;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  targetLoad?: 'LOW' | 'MEDIUM' | 'HIGH';

  @IsOptional()
  @IsIn(['PENDING_FIRST', 'NEW_FIRST', 'BALANCED'])
  priority?: 'PENDING_FIRST' | 'NEW_FIRST' | 'BALANCED';

  @IsOptional()
  @IsBoolean()
  unlockFocus?: boolean;

  @IsOptional()
  @Min(0)
  @Max(2)
  @IsNumber()
  levelDispersion?: number;

  @IsOptional()
  @Min(1)
  @Max(2)
  @IsNumber()
  semesterLimit?: number;
}

export class SimulateProjectionDto {
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

  @IsOptional()
  @ValidateNested()
  @Type(() => SimulationPreferencesDto)
  preferences?: SimulationPreferencesDto;
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

