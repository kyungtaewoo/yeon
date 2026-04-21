import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SajuProfile } from '../saju/entities/saju-profile.entity';
import { Match } from '../matching/entities/match.entity';
import { User } from '../users/entities/user.entity';
import { CompatibilityService } from './compatibility.service';
import { CompatibilityController } from './compatibility.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SajuProfile, Match, User])],
  providers: [CompatibilityService],
  controllers: [CompatibilityController],
  exports: [CompatibilityService],
})
export class CompatibilityModule {}
