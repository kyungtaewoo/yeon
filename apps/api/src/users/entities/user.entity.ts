import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToOne,
} from 'typeorm';
import { SajuProfile } from '../../saju/entities/saju-profile.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  kakaoId: string;

  @Column()
  nickname: string;

  @Column({ type: 'varchar' })
  gender: 'male' | 'female';

  @Column({ type: 'date', nullable: true })
  birthDate: Date;

  @Column({ nullable: true })
  birthTime: string; // "HH:MM" or null

  @Column({ default: 'solar' })
  birthCalendar: 'solar' | 'lunar';

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: 25 })
  preferredAgeMin: number;

  @Column({ default: 35 })
  preferredAgeMax: number;

  @Column({ default: false })
  isOnboardingComplete: boolean;

  @Column({ default: false })
  isPremium: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  premiumExpiresAt: Date;

  /** 매칭 직후 입력 — 카카오톡 친구 ID (오픈톡과 별개). nullable. */
  @Column({ type: 'text', nullable: true })
  kakaoTalkId: string | null;

  /** 일일 제안 카운터 — free 5/day, premium 무제한 (체크 우회). KST 자정 리셋. */
  @Column({ type: 'int', default: 0 })
  dailyProposalCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  dailyProposalResetAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => SajuProfile, (sp) => sp.user)
  sajuProfile: SajuProfile;
}
