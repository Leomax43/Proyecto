import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class AvanceEntryDto {
  @IsOptional()
  @IsString()
  nrc?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsString()
  student?: string;

  @IsString()
  @IsNotEmpty()
  course: string;

  @IsOptional()
  @IsBoolean()
  excluded?: boolean;

  @IsOptional()
  @IsString()
  inscriptionType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  creditos?: number;
}

export class ImportAvanceDto {
  @IsString()
  @IsNotEmpty()
  rut: string;

  @IsString()
  @IsNotEmpty()
  codCarrera: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvanceEntryDto)
  avances: AvanceEntryDto[];

  @IsOptional()
  @IsBoolean()
  clearPrevious?: boolean;
}
