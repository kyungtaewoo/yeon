import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * 프리미엄 전용 엔드포인트 가드.
 * JwtAuthGuard 이후에 적용되며, User.isPremium + premiumExpiresAt 체크.
 *
 * 사용 시: 모듈 imports에 TypeOrmModule.forFeature([User]) 포함 필요.
 *
 * @UseGuards(JwtAuthGuard, PremiumGuard)
 * @Get('/compatibility/:id/deep')
 */
@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('인증이 필요합니다');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.isPremium) {
      throw new ForbiddenException('프리미엄 전용 기능입니다');
    }
    if (user.premiumExpiresAt && user.premiumExpiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('프리미엄 기간이 만료되었습니다');
    }
    return true;
  }
}
