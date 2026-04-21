import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type FriendInviteStatus =
  | 'pending'       // 코드 생성됨, 아직 수락 안 됨
  | 'joined'        // 피초대자 수락 (한쪽 이상 사주 미완)
  | 'saju_complete' // 양쪽 사주 완비, 계산 대기
  | 'calculated'    // 궁합 계산 완료
  | 'expired';

@Entity('friend_invites')
export class FriendInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn()
  inviter: User;

  @Column()
  inviterId: string;

  @Index()
  @Column({ unique: true })
  inviteCode: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  invitee: User | null;

  @Column({ nullable: true })
  inviteeId: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status: FriendInviteStatus;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
