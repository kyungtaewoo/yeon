import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('saju_profiles')
export class SajuProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (u) => u.sajuProfile)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  // 사주팔자
  @Column() yearStem: string;
  @Column() yearBranch: string;
  @Column() monthStem: string;
  @Column() monthBranch: string;
  @Column() dayStem: string;
  @Column() dayBranch: string;
  @Column({ nullable: true }) hourStem: string;
  @Column({ nullable: true }) hourBranch: string;

  // 분석 캐시
  @Column({ nullable: true }) dominantElement: string;
  @Column({ nullable: true }) yongshin: string;
  @Column({ nullable: true }) gyeokguk: string;
  @Column({ type: 'jsonb', nullable: true }) elementScores: Record<string, number>;
  @Column({ type: 'jsonb', nullable: true }) tenGods: any;
  @Column({ type: 'jsonb', nullable: true }) reportData: any;
  @Column({ type: 'jsonb', nullable: true }) sinsalData: any;

  @CreateDateColumn() createdAt: Date;
}
