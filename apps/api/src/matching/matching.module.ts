import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { SajuProfile } from '../saju/entities/saju-profile.entity';
import { Match } from './entities/match.entity';
import { IdealSajuProfile } from './entities/ideal-saju-profile.entity';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, SajuProfile, Match, IdealSajuProfile])],
  providers: [MatchingService],
  controllers: [MatchingController],
  exports: [MatchingService],
})
export class MatchingModule {}
