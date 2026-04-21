import { Controller, Post, Get, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { BillingCycle } from './entities/subscription.entity';

@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  /** POST /payment/prepare — 결제 준비 (orderId 생성) */
  @Post('prepare')
  async prepare(
    @Request() req: any,
    @Body() body: { billingCycle: BillingCycle; matchId?: string },
  ) {
    return this.service.prepare(req.user.id, body);
  }

  /** POST /payment/confirm — 토스 paymentKey 승인 */
  @Post('confirm')
  async confirm(
    @Request() req: any,
    @Body() body: { paymentKey: string; orderId: string; amount: number },
  ) {
    return this.service.confirm(req.user.id, body);
  }

  /** POST /payment/subscription — 승인된 결제로 프리미엄 활성화 */
  @Post('subscription')
  async activate(@Request() req: any, @Body() body: { orderId: string }) {
    return this.service.activateSubscription(req.user.id, body);
  }

  /** DELETE /payment/subscription — 구독 해지 (만기일까지 유지) */
  @Delete('subscription')
  async cancel(@Request() req: any) {
    return this.service.cancelSubscription(req.user.id);
  }

  /** GET /payment/subscription/status — 구독 현황 */
  @Get('subscription/status')
  async status(@Request() req: any) {
    return this.service.getSubscriptionStatus(req.user.id);
  }
}
