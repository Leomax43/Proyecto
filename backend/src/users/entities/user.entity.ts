import { Column, CreateDateColumn, OneToMany, PrimaryColumn, UpdateDateColumn, Entity } from 'typeorm';
import { UserCareer } from './user-career.entity';

@Entity('users')
export class User {
  @PrimaryColumn()
  rut: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  nombre?: string;

  @Column({ default: 'estudiante' })
  rol: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserCareer, (career) => career.user, {
    cascade: true,
  })
  carreras: UserCareer[];
}
