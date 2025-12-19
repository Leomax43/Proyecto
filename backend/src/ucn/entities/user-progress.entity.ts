import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_progress')
@Index(['rut', 'codCarrera'])
export class UserProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  rut: string;

  @Column()
  codCarrera: string;

  @Column({ nullable: true })
  nrc?: string;

  @Column({ nullable: true })
  period?: string;

  @Column({ nullable: true })
  student?: string;

  @Column()
  course: string;

  @Column({ default: false })
  excluded: boolean;

  @Column({ nullable: true })
  inscriptionType?: string;

  @Column({ nullable: true })
  status?: string;

  @Column({ type: 'int', nullable: true })
  creditos?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
