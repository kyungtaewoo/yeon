import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { decimalTransformer } from '../../common/decimal.transformer';

export type MatchStatus =
  | 'pending'
  | 'notified'
  | 'a_accepted'
  | 'b_accepted'
  | 'both_accepted'
  | 'payment_pending'
  | 'completed'
  | 'rejected'
  | 'expired';

export type MatchDecision = 'pending' | 'accepted' | 'rejected';

@Entity('matches')
@Index(['userAId', 'userBId'])
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn()
  userA: User;

  @Column()
  userAId: string;

  @ManyToOne(() => User)
  @JoinColumn()
  userB: User;

  @Column()
  userBId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, transformer: decimalTransformer })
  compatibilityScore: number;

  @Column({ type: 'jsonb', nullable: true })
  compatibilityReport: any;

  @Column({ type: 'jsonb', nullable: true })
  romanceTimingReport: any;

  @Column({ type: 'varchar', default: 'pending' })
  status: MatchStatus;

  @Column({ type: 'varchar', nullable: true })
  userADecision: MatchDecision | null;

  @Column({ type: 'varchar', nullable: true })
  userBDecision: MatchDecision | null;

  @Column({ type: 'timestamptz', nullable: true })
  notifiedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
