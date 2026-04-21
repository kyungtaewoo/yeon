import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { RomanceTimingService } from './romance-timing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('romance-timing')
@UseGuards(JwtAuthGuard)
export class RomanceTimingController {
  constructor(private readonly service: RomanceTimingService) {}

  /** GET /romance-timing/me — 내 연애 시기 분석 (향후 10년) */
  @Get('me')
  async getMe(@Request() req: any) {
    return this.service.getForMe(req.user.id);
  }

  /** GET /romance-timing/match/:id — 매칭 상대와의 최적 만남 시기 */
  @Get('match/:id')
  async getForMatch(@Request() req: any, @Param('id') matchId: string) {
    return this.service.getForMatch(matchId, req.user.id);
  }
}
