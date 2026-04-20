import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { SajuService } from './saju.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('saju')
export class SajuController {
  constructor(private readonly sajuService: SajuService) {}

  /**
   * POST /saju/calculate
   * 사주팔자 산출 + 리포트 생성 (비로그인도 가능)
   */
  @Post('calculate')
  calculate(@Body() body: {
    year: number;
    month: number;
    day: number;
    hour?: number | null;
    isLunar?: boolean;
  }) {
    const { pillars, report } = this.sajuService.calculateAndReport(body);
    return { pillars, report };
  }

  /**
   * POST /saju/calculate-and-save
   * 사주팔자 산출 + DB 저장 (로그인 필요)
   */
  @UseGuards(JwtAuthGuard)
  @Post('calculate-and-save')
  async calculateAndSave(
    @Request() req: any,
    @Body() body: {
      year: number;
      month: number;
      day: number;
      hour?: number | null;
      isLunar?: boolean;
    },
  ) {
    return this.sajuService.calculateAndSave(req.user.id, body);
  }

  /**
   * GET /saju/report
   * 저장된 사주 리포트 조회 (로그인 필요)
   */
  @UseGuards(JwtAuthGuard)
  @Get('report')
  async getReport(@Request() req: any) {
    return this.sajuService.getReport(req.user.id);
  }

  /**
   * POST /saju/ideal-match
   * 이상적 상대 사주 서치 (비로그인도 가능)
   */
  @Post('ideal-match')
  findIdealMatch(@Body() body: {
    year: number;
    month: number;
    day: number;
    hour?: number | null;
    isLunar?: boolean;
    weights: any;
    ageRangeMin: number;
    ageRangeMax: number;
    topN?: number;
  }) {
    const profiles = this.sajuService.findIdealMatches(body);
    return { profiles };
  }
}
