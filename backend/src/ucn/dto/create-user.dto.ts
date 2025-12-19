import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

class CareerInputDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  catalogo: string;
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  rut: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(4)
  password: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  rol?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CareerInputDto)
  carreras: CareerInputDto[];
}
