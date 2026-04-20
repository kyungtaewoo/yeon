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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => SajuProfile, (sp) => sp.user)
  sajuProfile: SajuProfile;
}
