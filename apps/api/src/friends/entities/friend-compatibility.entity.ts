import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { FriendInvite } from './friend-invite.entity';
import { decimalTransformer } from '../../common/decimal.transformer';

@Entity('friend_compatibilities')
export class FriendCompatibility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => FriendInvite)
  @JoinColumn()
  invite: FriendInvite;

  @Column({ unique: true })
  inviteId: string;

  @Column()
  userAId: string;

  @Column()
  userBId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: decimalTransformer })
  generalScore: number | null;

  @Column({ type: 'jsonb', nullable: true })
  generalBreakdown: any;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: decimalTransformer })
  romanticScore: number | null;

  @Column({ type: 'jsonb', nullable: true })
  romanticBreakdown: any;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: decimalTransformer })
  deepScore: number | null;

  @Column({ type: 'jsonb', nullable: true })
  deepBreakdown: any;

  @Column({ type: 'jsonb', nullable: true })
  deepNarrative: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
