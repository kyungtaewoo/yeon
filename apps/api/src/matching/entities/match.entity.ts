import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { decimalTransformer } from '../../common/decimal.transformer';

/**
 * 모델 C (제안-승낙) 상태:
 *   - 'proposed'  — 제안 전송됨, 응답 대기
 *   - 'accepted'  — 받는쪽 수락 → 매칭 성사 (이전 'both_accepted' 와 동치)
 *   - 'rejected'  — 거절 (영구 차단)
 *   - 'expired'   — 7일 무응답 자동 만료
 *
 * 모델 A 레거시 값 (pending/notified/a_accepted/b_accepted/both_accepted/payment_pending/completed)
 * 은 마이그레이션 시 'expired' 로 일괄 정리. 신규 row 는 'proposed' 부터 시작.
 */
export type MatchStatus = 'proposed' | 'accepted' | 'rejected' | 'expired';

export type MatchDecision = 'pending' | 'accepted' | 'rejected';

/**
 * 매칭 시도 출처:
 *   - 'discovery'   — /discover (탐색하기) 에서 후보 발견 후 제안
 *   - 'ideal_match' — 천생연분 (저장된 ideal saju) 에 일치하는 사람을 통해 제안 (v2.2)
 */
export type MatchSource = 'discovery' | 'ideal_match';

export interface ContactMethods {
  kakaoId?: boolean;
  openChat?: boolean;
}

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

  /** 매칭 성립 당시의 이상형 매칭 점수 (IdealSajuProfile.totalScore). */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: decimalTransformer })
  idealMatchScore: number | null;

  /** /compatibility/:matchId 계산 후 채워지는 실제 3단계 궁합 점수 (일반 궁합 총점). */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: decimalTransformer })
  compatibilityScore: number | null;

  @Column({ type: 'jsonb', nullable: true })
  compatibilityReport: any;

  @Column({ type: 'jsonb', nullable: true })
  romanceTimingReport: any;

  @Column({ type: 'varchar', default: 'proposed' })
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

  // ─────────────────────────────────────────────────────────
  // 모델 C (제안-승낙)
  // userA = 제안자 (sender), userB = 받는 사람 (receiver)
  // ─────────────────────────────────────────────────────────

  /** 매칭 시도 출처 — 'discovery' (탐색하기) | 'ideal_match' (천생연분) */
  @Column({ type: 'varchar', default: 'discovery' })
  source: MatchSource;

  /** 제안자가 선택한 연락 방법 — { kakaoId?: true, openChat?: true } */
  @Column({ type: 'jsonb', nullable: true })
  contactMethods: ContactMethods | null;

  /** 제안자 자유 텍스트 메시지 (max 500자). nullable. */
  @Column({ type: 'text', nullable: true })
  proposalMessage: string | null;

  /** 제안자가 공유한 카카오톡 ID (contactMethods.kakaoId=true 일 때 필수). */
  @Column({ type: 'text', nullable: true })
  kakaoTalkIdShared: string | null;

  /** 받는쪽이 수락 시 추가 공유한 본인 카카오톡 ID (옵션). */
  @Column({ type: 'text', nullable: true })
  kakaoTalkIdResponse: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  proposedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  // ─────────────────────────────────────────────────────────
  // 오픈채팅 (contactMethods.openChat=true 일 때 사용)
  // ─────────────────────────────────────────────────────────

  /** 카카오 오픈채팅 URL. */
  @Column({ type: 'text', nullable: true })
  openChatRoomUrl: string | null;

  /** 오픈채팅 비밀번호 (4자리 숫자 권장). */
  @Column({ type: 'varchar', length: 16, nullable: true })
  openChatPassword: string | null;

  /** 오픈채팅을 등록한 사용자 id (제안자가 일반적). */
  @Column({ type: 'uuid', nullable: true })
  openChatCreatedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  openChatCreatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
