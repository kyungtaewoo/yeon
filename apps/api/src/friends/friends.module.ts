import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SajuProfile } from '../saju/entities/saju-profile.entity';
import { FriendInvite } from './entities/friend-invite.entity';
import { FriendCompatibility } from './entities/friend-compatibility.entity';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FriendInvite, FriendCompatibility, SajuProfile])],
  providers: [FriendsService],
  controllers: [FriendsController],
  exports: [FriendsService],
})
export class FriendsModule {}
