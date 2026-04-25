import { Controller, Post, Get, Body, Query, Res, UseGuards, Request } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService, KakaoCodeAlreadyUsedError } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** POST /auth/kakao — 프론트에서 code를 보내는 방식 */
  @Post('kakao')
  async kakaoLogin(@Body() body: { code: string; redirectUri: string }) {
    return this.authService.kakaoLogin(body.code, body.redirectUri);
  }

  /**
   * GET /auth/kakao/redirect — 카카오 로그인 페이지로 리다이렉트
   * Capacitor 앱에서 시스템 Safari로 이 URL을 연다
   * ?from=app 이면 OAuth state=app 으로 전달 → 콜백에서 네이티브 앱 분기용
   */
  @Get('kakao/redirect')
  kakaoRedirect(@Query('from') from: string | undefined, @Res() res: Response) {
    const clientId = this.config.get('KAKAO_CLIENT_ID');
    const callbackUrl = this.config.get('KAKAO_CALLBACK_URL');
    const stateParam = from === 'app' ? `&state=app` : '';
    const kakaoUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code${stateParam}`;
    res.redirect(kakaoUrl);
  }

  /**
   * GET /auth/kakao/callback — 카카오가 인가코드를 보내주는 콜백
   * code를 JWT로 교환 후, 앱의 커스텀 URL scheme으로 리다이렉트
   */
  @Get('kakao/callback')
  async kakaoCallback(
    @Query('code') code: string,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    try {
      const callbackUrl = this.config.get('KAKAO_CALLBACK_URL');
      const result = await this.authService.kakaoLogin(code, callbackUrl!);

      const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3001');
      // kakaoRedirect에서 ?from=app 으로 진입하면 state=app 으로 돌아옴 (OAuth state 파라미터)
      const isNativeApp = state === 'app';

      if (!isNativeApp) {
        return res.redirect(
          `${frontendUrl}/callback?token=${result.accessToken}&isNew=${result.isNewUser}`,
        );
      }

      // 네이티브 앱: HTTP 302 로 yeonapp:// 에 직접 리다이렉트.
      // JS window.location 방식은 SFSafariViewController 에서 custom URL scheme 을 못 잡음.
      // 302 Location 헤더는 iOS 가 확실히 scheme 으로 인식 → Capacitor 앱 foreground + appUrlOpen 발화.
      return res.redirect(
        `yeonapp://auth?token=${result.accessToken}&isNew=${result.isNewUser}`,
      );
    } catch (error: any) {
      const isAlreadyUsed = error instanceof KakaoCodeAlreadyUsedError;
      const isNativeApp = state === 'app';
      const message = isAlreadyUsed
        ? '이미 처리된 로그인이에요. 앱으로 돌아가서 다시 시도해주세요.'
        : (error?.message || '로그인 처리 중 오류가 발생했어요.');
      const cta = isNativeApp
        ? `<a href="yeonapp://" style="display:inline-block;margin-top:24px;padding:14px 28px;background:#FEE500;color:#191919;text-decoration:none;border-radius:10px;font-weight:600;">앱으로 돌아가기</a>`
        : `<a href="javascript:window.close()" style="color:#666;">닫기</a>`;

      res.status(isAlreadyUsed ? 200 : 400).send(`
        <!doctype html>
        <html lang="ko">
        <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
        <body style="font-family:-apple-system,system-ui,sans-serif;text-align:center;padding:60px 24px;color:#333;">
          <h2 style="font-size:20px;margin:0 0 12px;">${isAlreadyUsed ? '이미 로그인 처리됨' : '로그인 실패'}</h2>
          <p style="font-size:14px;color:#666;line-height:1.5;">${message}</p>
          ${cta}
        </body>
        </html>
      `);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
  }
}
