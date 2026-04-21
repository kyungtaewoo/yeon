import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';
import { decimalTransformer } from '../../common/decimal.transformer';

export type PaymentStatus = 'ready' | 'done' | 'canceled' | 'failed';

@Entity('payments')
@Index(['userId', 'status'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 구독 결제면 null, 매칭 연결비면 matchId */
  @Column({ type: 'varchar', nullable: true })
  matchId: string | null;

  @Column()
  userId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  amount: number;

  /** 우리가 생성하는 주문 id (토스에 전달) */
  @Column({ unique: true })
  orderId: string;

  /** 토스가 발급하는 결제 키 (confirm 단계에 채워짐) */
  @Column({ type: 'varchar', nullable: true })
  paymentKey: string | null;

  @Column({ type: 'varchar', default: 'ready' })
  status: PaymentStatus;

  /** 구독 결제 구분용 — plan + cycle을 저장해 confirm 시 참조 */
  @Column({ type: 'varchar', nullable: true })
  plan: string | null;

  @Column({ type: 'varchar', nullable: true })
  billingCycle: string | null;

  @Column({ type: 'jsonb', nullable: true })
  tossResponse: any;

  @Column({ type: 'varchar', nullable: true })
  failureReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
