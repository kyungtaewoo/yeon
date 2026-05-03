import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
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

  /**
   * GET /matching/discovery — 호환성 기반 디스커버리.
   * NestJS 라우트 우선순위 — 반드시 GET :id 보다 위에 정의.
   * Query: ageMin, ageMax (number), tier (general|romantic|deep), minScore (number)
   */
  @Get('discovery')
  async discovery(
    @Request() req: any,
    @Query('ageMin') ageMin?: string,
    @Query('ageMax') ageMax?: string,
    @Query('tier') tier?: string,
    @Query('minScore') minScore?: string,
  ) {
    return this.service.discoverCandidates(req.user.id, {
      ageMin: ageMin != null ? parseInt(ageMin, 10) : undefined,
      ageMax: ageMax != null ? parseInt(ageMax, 10) : undefined,
      tier:
        tier === 'general' || tier === 'romantic' || tier === 'deep' ? tier : undefined,
      minScore: minScore != null ? parseInt(minScore, 10) : undefined,
    });
  }

  /** POST /matching/express-interest — 디스커버리 카드의 "관심 표시" */
  @Post('express-interest')
  async expressInterest(@Request() req: any, @Body() body: { targetId: string }) {
    return this.service.expressInterest(req.user.id, body?.targetId);
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
