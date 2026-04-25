import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedIdealTarget } from '../entities/saved-ideal-target.entity';
import { User } from '../../users/entities/user.entity';
import { SavedIdealTargetsController } from './saved-ideal-targets.controller';
import { SavedIdealTargetsService } from './saved-ideal-targets.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavedIdealTarget, User])],
  controllers: [SavedIdealTargetsController],
  providers: [SavedIdealTargetsService],
})
export class SavedIdealTargetsModule {}
