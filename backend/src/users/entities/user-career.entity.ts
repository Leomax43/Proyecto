import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_careers')
export class UserCareer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  codigo: string;

  @Column()
  nombre: string;

  @Column()
  catalogo: string;

  @Column()
  rut: string;

  @ManyToOne(() => User, (user) => user.carreras, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rut' })
  user: User;
}
