import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class UpdateCourseEquivalencesDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  codigoCarrera: string;

  @IsString()
  @IsNotEmpty()
  catalogo: string;

  @IsArray()
  @IsString({ each: true })
  equivalencias: string[];
}
