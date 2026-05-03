import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import type { CompatibilityWeights } from '@yeon/saju-engine';
import { MatchingService } from './matching.service';
import type { ContactMethods } from './entities/match.entity';
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

  /**
   * POST /matching/propose — 모델 C 제안하기.
   * Body: { targetId, contactMethods, message?, kakaoTalkIdShared?, openChatRoomUrl?, openChatPassword? }
   */
  @Post('propose')
  async propose(
    @Request() req: any,
    @Body()
    body: {
      targetId: string;
      contactMethods: ContactMethods;
      message?: string | null;
      kakaoTalkIdShared?: string | null;
      openChatRoomUrl?: string | null;
      openChatPassword?: string | null;
    },
  ) {
    return this.service.propose(req.user.id, body?.targetId, {
      contactMethods: body?.contactMethods,
      message: body?.message ?? null,
      kakaoTalkIdShared: body?.kakaoTalkIdShared ?? null,
      openChatRoomUrl: body?.openChatRoomUrl ?? null,
      openChatPassword: body?.openChatPassword ?? null,
    });
  }

  /** GET /matching/quota — 일일 제안 한도 사용량 */
  @Get('quota')
  async quota(@Request() req: any) {
    return this.service.getProposalQuota(req.user.id);
  }

  /** POST /matching/me/kakao-talk-id — 본인 카카오톡 ID 등록 */
  @Post('me/kakao-talk-id')
  async setKakaoTalkId(@Request() req: any, @Body() body: { kakaoTalkId: string }) {
    const updated = await this.service.setMyKakaoTalkId(req.user.id, body?.kakaoTalkId);
    return { kakaoTalkId: updated.kakaoTalkId };
  }

  /** GET /matching/:id — 매칭 상세 (상대방 닉네임/사주 포함) */
  @Get(':id')
  async getMatch(@Request() req: any, @Param('id') id: string) {
    return this.service.getMatchDetail(id, req.user.id);
  }

  /**
   * POST /matching/:id/respond — 받는쪽 수락/거절.
   * Body: { decision: 'accepted' | 'rejected', kakaoTalkIdResponse? }
   */
  @Post(':id/respond')
  async respond(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      decision: 'accepted' | 'rejected';
      kakaoTalkIdResponse?: string | null;
    },
  ) {
    return this.service.respondToProposal(id, req.user.id, body?.decision, {
      kakaoTalkIdResponse: body?.kakaoTalkIdResponse ?? null,
    });
  }

  /** @deprecated 호환용 — 모델 C 에서는 /respond 사용 */
  @Post(':id/accept')
  async accept(@Request() req: any, @Param('id') id: string) {
    return this.service.accept(id, req.user.id);
  }

  /** @deprecated 호환용 — 모델 C 에서는 /respond 사용 */
  @Post(':id/reject')
  async reject(@Request() req: any, @Param('id') id: string) {
    return this.service.reject(id, req.user.id);
  }
}
