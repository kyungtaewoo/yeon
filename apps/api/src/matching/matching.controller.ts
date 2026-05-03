import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import type { CompatibilityWeights } from '@yeon/saju-engine';
import { MatchingService } from './matching.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('matching')
@UseGuards(JwtAuthGuard)
export class MatchingController {
  constructor(private readonly service: MatchingService) {}

  /**
   * POST /matching/find-ideal
   * 이상적 상대 사주 전수 탐색 (동기) — 결과를 DB에 저장
   */
  @Post('find-ideal')
  async findIdeal(
    @Request() req: any,
    @Body() body: { weights: CompatibilityWeights; topN?: number },
  ) {
    const profiles = await this.service.findIdeal(req.user.id, body.weights, body.topN);
    return { profiles };
  }

  /**
   * GET /matching/ideal-profiles
   * 저장된 이상형 프로필 조회
   */
  @Get('ideal-profiles')
  async getIdealProfiles(@Request() req: any) {
    const profiles = await this.service.getIdealProfiles(req.user.id);
    return { profiles };
  }

  /** GET /matching — 내 매칭 리스트 */
  @Get()
  async listMatches(@Request() req: any) {
    const matches = await this.service.listMyMatches(req.user.id);
    return { matches };
  }

  /** GET /matching/:id — 매칭 상세 (상대방 닉네임/사주 포함) */
  @Get(':id')
  async getMatch(@Request() req: any, @Param('id') id: string) {
    return this.service.getMatchDetail(id, req.user.id);
  }

  /** POST /matching/:id/accept */
  @Post(':id/accept')
  async accept(@Request() req: any, @Param('id') id: string) {
    return this.service.accept(id, req.user.id);
  }

  /** POST /matching/:id/reject */
  @Post(':id/reject')
  async reject(@Request() req: any, @Param('id') id: string) {
    return this.service.reject(id, req.user.id);
  }
}
