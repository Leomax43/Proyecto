import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('projections') 
export class Projection {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Datos para saber de quién es la proyección
  @Column()
  rut: string;

  @Column()
  codCarrera: string;

  @Column({ nullable: true })
  catalogo: string;

  @Column()
  title: string;

  // ¡AQUÍ ESTÁ LA CLAVE! 
  // Usamos 'jsonb' para guardar toda la estructura de 'years' (YearDto[]) 
  // que definiste en tu DTO sin tener que crear 20 tablas distintas.
  @Column({ type: 'jsonb' }) 
  years: any; 

  @CreateDateColumn()
  createdAt: Date;
}