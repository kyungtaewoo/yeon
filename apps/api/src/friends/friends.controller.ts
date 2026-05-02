import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('friends')
export class FriendsController {
  constructor(private readonly service: FriendsService) {}

  /** POST /friends/invite — 초대 코드 생성 (auth) */
  @UseGuards(JwtAuthGuard)
  @Post('invite')
  async createInvite(@Request() req: any) {
    return this.service.createInvite(req.user.id);
  }

  /** GET /friends/invite/:code/verify — 코드 검증 (비로그인 가능, 랜딩에서 사용) */
  @Get('invite/:code/verify')
  async verifyInvite(@Param('code') code: string) {
    return this.service.verifyInvite(code);
  }

  /** POST /friends/invite/:code/accept — 피초대자가 수락 (auth) */
  @UseGuards(JwtAuthGuard)
  @Post('invite/:code/accept')
  async acceptInvite(@Request() req: any, @Param('code') code: string) {
    return this.service.acceptInvite(code, req.user.id);
  }

  /** GET /friends — 내가 inviter/invitee로 참여한 초대 리스트 */
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Request() req: any) {
    return this.service.listMyInvites(req.user.id);
  }

  /** GET /friends/:inviteId — 초대 상세 + 저장된 3단계 궁합 */
  @UseGuards(JwtAuthGuard)
  @Get(':inviteId')
  async getDetail(@Request() req: any, @Param('inviteId') inviteId: string) {
    return this.service.getDetail(inviteId, req.user.id);
  }

  /** POST /friends/:inviteId/recompute — 나중에 사주가 모였을 때 수동 재계산 */
  @UseGuards(JwtAuthGuard)
  @Post(':inviteId/recompute')
  async recompute(@Request() req: any, @Param('inviteId') inviteId: string) {
    return this.service.recompute(inviteId, req.user.id);
  }
}
