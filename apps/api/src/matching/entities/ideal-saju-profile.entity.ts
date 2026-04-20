import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('ideal_saju_profiles')
@Index(['userId', 'rank'])
@Index(['dayStem', 'dayBranch'])
export class IdealSajuProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column()
  rank: number;

  @Column()
  dayStem: string;

  @Column()
  dayBranch: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  totalScore: number;

  @Column({ type: 'jsonb' })
  profile: any;

  @CreateDateColumn()
  createdAt: Date;
}
