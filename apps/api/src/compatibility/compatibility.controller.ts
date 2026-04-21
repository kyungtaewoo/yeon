import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CompatibilityService } from './compatibility.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('compatibility')
export class CompatibilityController {
  constructor(private readonly service: CompatibilityService) {}

  /**
   * POST /compatibility/calculate
   * 현재 유저와 otherUserId 간의 3단계 궁합 계산
   */
  @UseGuards(JwtAuthGuard)
  @Post('calculate')
  async calculate(
    @Request() req: any,
    @Body() body: { otherUserId: string },
  ) {
    return this.service.calculateForCurrentUser(req.user.id, body.otherUserId);
  }

  /**
   * GET /compatibility/:matchId
   * 특정 매칭의 궁합 리포트 조회 (참여자만 접근 가능)
   */
  @UseGuards(JwtAuthGuard)
  @Get(':matchId')
  async getByMatch(
    @Request() req: any,
    @Param('matchId') matchId: string,
  ) {
    return this.service.getForMatch(matchId, req.user.id);
  }
}
