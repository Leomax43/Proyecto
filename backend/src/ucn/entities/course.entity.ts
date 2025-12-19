import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type CourseEquivalenceDetail = {
  codigo: string;
  nombre?: string;
};

@Entity('courses')
@Index(['codigoCarrera', 'catalogo'])
@Index(['codigo', 'codigoCarrera', 'catalogo'], { unique: true })
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  codigo: string;

  @Column()
  asignatura: string;

  @Column({ type: 'int', default: 0 })
  creditos: number;

  @Column({ type: 'int', default: 0 })
  nivel: number;

  @Column({ type: 'text', nullable: true })
  prereq?: string;

  @Column({ type: 'jsonb', nullable: true })
  equivalencias?: string[];

  @Column({ type: 'jsonb', nullable: true })
  equivalenciasDetalle?: CourseEquivalenceDetail[];

  @Column()
  codigoCarrera: string;

  @Column()
  catalogo: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
