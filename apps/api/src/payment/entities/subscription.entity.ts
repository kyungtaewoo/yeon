import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { decimalTransformer } from '../../common/decimal.transformer';

export type SubscriptionPlan = 'free' | 'premium';
export type BillingCycle = 'monthly' | 'yearly';

@Entity('subscriptions')
@Index(['userId', 'isActive'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'varchar', default: 'free' })
  plan: SubscriptionPlan;

  /** 토스 빌링키 — 정기결제 용 (MVP에선 단건만 지원하므로 보통 null) */
  @Column({ type: 'varchar', nullable: true })
  billingKey: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  amount: number | null;

  @Column({ type: 'varchar', nullable: true })
  billingCycle: BillingCycle | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  /** 프리 플랜의 월 한도 — 이상형 재검색 */
  @Column({ default: 1 })
  idealSearchRemaining: number;

  /** 프리 플랜의 월 한도 — 사주 재분석 */
  @Column({ default: 0 })
  reanalysisRemaining: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
