import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SajuProfile } from './entities/saju-profile.entity';
import { SajuService } from './saju.service';
import { SajuController } from './saju.controller';
import { UsersModule } from '../users/users.module';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [TypeOrmModule.forFeature([SajuProfile]), UsersModule, MatchingModule],
  providers: [SajuService],
  controllers: [SajuController],
  exports: [SajuService],
})
export class SajuModule {}
