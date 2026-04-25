import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
  Index, Unique, Check,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { decimalTransformer } from '../../common/decimal.transformer';

/**
 * 'searching' — 후보로 저장 (현재 기본값, MVP 에서 유일하게 사용)
 * 'matched'   — 실제 유저와 매칭됨 (Phase 2 예약값, 현재 미사용)
 * 'archived'  — 사용자가 보관 처리
 */
export type SavedIdealTargetStatus = 'searching' | 'matched' | 'archived';

@Entity('saved_ideal_targets')
@Index(['userId', 'savedAt'])
@Index(['userId', 'status'])
@Unique('uq_saved_ideal_target_dedup', ['userId', 'dayStem', 'dayBranch', 'ageMin', 'ageMax'])
@Check('chk_saved_ideal_target_age_range', '"ageMin" >= 0 AND "ageMax" >= "ageMin" AND "ageMax" <= 120')
export class SavedIdealTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ length: 1 })
  dayStem: string;

  @Column({ length: 1 })
  dayBranch: string;

  @Column({ type: 'int' })
  ageMin: number;

  @Column({ type: 'int' })
  ageMax: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, transformer: decimalTransformer })
  totalScore: number;

  @Column({ type: 'jsonb' })
  profile: any;

  @Column({ type: 'varchar', default: 'searching' })
  status: SavedIdealTargetStatus;

  @CreateDateColumn()
  savedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
