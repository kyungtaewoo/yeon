import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe,
  Post, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SavedIdealTargetsService } from './saved-ideal-targets.service';
import { CreateSavedIdealTargetDto } from './dto/create-saved-ideal-target.dto';

@Controller('matches/saved')
@UseGuards(JwtAuthGuard)
export class SavedIdealTargetsController {
  constructor(private readonly service: SavedIdealTargetsService) {}

  /** GET /matches/saved — 내 wish-list */
  @Get()
  async list(@Request() req: any) {
    const targets = await this.service.findAllByUser(req.user.id);
    return { targets };
  }

  /** POST /matches/saved — 추가 */
  @Post()
  async create(@Request() req: any, @Body() dto: CreateSavedIdealTargetDto) {
    return this.service.create(req.user.id, dto);
  }

  /** DELETE /matches/saved/:id — 삭제 */
  @Delete(':id')
  @HttpCode(204)
  async remove(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.service.remove(req.user.id, id);
  }
}
