import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { SajuProfile } from '../saju/entities/saju-profile.entity';
import { Match } from '../matching/entities/match.entity';
import { RomanceTimingService } from './romance-timing.service';
import { RomanceTimingController } from './romance-timing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, SajuProfile, Match])],
  providers: [RomanceTimingService],
  controllers: [RomanceTimingController],
  exports: [RomanceTimingService],
})
export class RomanceTimingModule {}
