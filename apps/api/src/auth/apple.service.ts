import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { UsersService } from '../users/users.service';

/**
 * Apple Sign In identity token 페이로드 — Apple 공식 스펙 일부.
 * sub: Apple 유저 식별자 (앱별 고유, stable)
 * email: 실제 이메일 또는 private relay 이메일
 * email_verified: 항상 'true' or true
 * is_private_email: relay email 여부
 */
interface AppleIdToken extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: 'true' | boolean;
  is_private_email?: 'true' | boolean;
}

export interface AppleLoginResult {
  accessToken: string;
  user: {
    id: string;
    nickname: string;
    gender: string | undefined;
    isOnboardingComplete: boolean;
    isPremium: boolean;
  };
  isNewUser: boolean;
}

@Injectable()
export class AppleAuthService {
  /**
   * Apple JWKS — public keys for identity token verification.
   * createRemoteJWKSet 가 내부 캐시 (5분) 처리 — 매 요청마다 fetch 안 함.
   */
  private readonly jwks = createRemoteJWKSet(
    new URL('https://appleid.apple.com/auth/keys'),
  );

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Apple identity token 검증 → DB 유저 생성/조회 → JWT 발급.
   *
   * @param identityToken Apple 인증 다이얼로그가 반환한 JWT
   * @param fallbackName  Apple 첫 로그인 시 클라이언트가 함께 보내준 이름 (옵션, sub 만 stable)
   */
  async appleLogin(
    identityToken: string,
    fallbackName?: { givenName?: string; familyName?: string } | null,
  ): Promise<AppleLoginResult> {
    if (!identityToken || typeof identityToken !== 'string') {
      throw new UnauthorizedException('identityToken 누락');
    }

    // 1. JWT verify — Apple 공개키로 서명 검증 + 발급자 / aud 검증
    let payload: AppleIdToken;
    try {
      const expectedAud = this.config.get<string>(
        'APPLE_BUNDLE_ID',
        'com.woopitel.yeon',
      );
      const { payload: p } = await jwtVerify(identityToken, this.jwks, {
        issuer: 'https://appleid.apple.com',
        audience: expectedAud,
      });
      payload = p as AppleIdToken;
    } catch (e) {
      throw new UnauthorizedException(
        `Apple identity token 검증 실패: ${(e as Error).message}`,
      );
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Apple sub 누락');
    }

    // 2. 기존 사용자 조회 — appleId 우선, 없으면 신규 생성
    let user = await this.usersService.findByAppleId(payload.sub);
    let isNewUser = false;

    if (!user) {
      // Apple 첫 로그인은 이름 / 이메일 모두 옴.
      // 두 번째 이후로는 이름 안 옴 → 첫 로그인에서 받아서 저장 필수.
      const nickname =
        [fallbackName?.givenName, fallbackName?.familyName]
          .filter(Boolean)
          .join(' ')
          .trim() || `Apple_${payload.sub.slice(-6)}`;

      user = await this.usersService.createAppleUser({
        appleId: payload.sub,
        email: payload.email ?? null,
        nickname,
      });
      isNewUser = true;
    }

    // 3. JWT 발급 — kakaoLogin 과 동일 payload 형식
    const accessToken = this.jwtService.sign({
      sub: user.id,
      provider: 'apple',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        nickname: user.nickname,
        gender: user.gender ?? undefined,
        isOnboardingComplete: user.isOnboardingComplete,
        isPremium: user.isPremium,
      },
      isNewUser,
    };
  }
}
