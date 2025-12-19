import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class CourseEquivalenceDetailDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsOptional()
  @IsString()
  nombre?: string;
}

class CourseInputDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  asignatura: string;

  @IsInt()
  @Min(0)
  creditos: number;

  @IsInt()
  @Min(0)
  nivel: number;

  @IsOptional()
  @IsString()
  prereq?: string;

  @IsOptional()
  @IsArray()
  equivalencias?: Array<string | Record<string, any>>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseEquivalenceDetailDto)
  equivalenciasDetalle?: CourseEquivalenceDetailDto[];
}

export class ImportMallaDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  catalogo: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseInputDto)
  cursos: CourseInputDto[];
}
