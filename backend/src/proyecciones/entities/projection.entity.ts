import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('projections')
export class Projection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  rut: string;

  @Column()
  codCarrera: string;

  @Column({ nullable: true })
  catalogo: string;

  @Column()
  title: string;

  // Aquí guardamos toda la estructura de años como un JSON gigante
  @Column({ type: 'jsonb' })
  years: any;

  @CreateDateColumn()
  createdAt: Date;
}