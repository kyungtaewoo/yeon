import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
}

interface KakaoUserInfo {
  id: number;
  kakao_account?: {
    profile?: { nickname?: string };
    email?: string;
    gender?: string;
    birthday?: string;
  };
}

export class KakaoCodeAlreadyUsedError extends Error {
  constructor() {
    super('카카오 인가코드가 이미 사용됐어요. 앱으로 돌아가 다시 시도해주세요.');
    this.name = 'KakaoCodeAlreadyUsedError';
  }
}

export interface KakaoLoginResult {
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

interface CachedKakaoResult {
  result: KakaoLoginResult;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  /**
   * 카카오 인가코드 → 결과 캐시.
   * iOS Safari 가 같은 콜백 URL 을 두 번 hit (preload, refresh, 백/포워드) 하면
   * Kakao 가 invalid_grant 로 거부함. 첫 번째 성공 결과를 짧게 캐시해서 두 번째
   * 요청도 동일한 yeonapp:// 리다이렉트를 받게 함 (idempotent).
   */
  private readonly codeCache = new Map<string, CachedKakaoResult>();
  private static readonly CODE_CACHE_TTL_MS = 60_000;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 카카오 인가코드로 토큰 교환 → 유저 정보 조회 → DB 유저 생성/조회 → JWT 발급
   */
  async kakaoLogin(code: string, redirectUri: string): Promise<KakaoLoginResult> {
    // 캐시 hit — 이미 처리된 코드면 그대로 반환 (refresh/double-fire 방어)
    const cached = this.codeCache.get(code);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
    if (cached) this.codeCache.delete(code);

    // 1. 인가코드 → 카카오 access_token
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.get('KAKAO_CLIENT_ID', ''),
        client_secret: this.config.get('KAKAO_CLIENT_SECRET') || '',
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      // 이미 사용된 코드 — 별도 에러 타입으로 던져서 controller 가 친절한 페이지로 보낼 수 있게
      if (err.includes('invalid_grant') || err.includes('authorization code not found')) {
        throw new KakaoCodeAlreadyUsedError();
      }
      throw new UnauthorizedException(`카카오 토큰 교환 실패: ${err}`);
    }

    const tokenData: KakaoTokenResponse = await tokenRes.json();

    // 2. access_token → 카카오 유저 정보
    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      throw new UnauthorizedException('카카오 유저 정보 조회 실패');
    }

    const kakaoUser: KakaoUserInfo = await userRes.json();
    const kakaoId = String(kakaoUser.id);
    const kakaoNickname = kakaoUser.kakao_account?.profile?.nickname; // 동의 안 했으면 undefined
    const fallbackNickname = `유저${kakaoId.slice(-4)}`;
    const gender = kakaoUser.kakao_account?.gender; // "male" | "female" | undefined

    // 3. DB에서 유저 조회 또는 생성
    let user = await this.usersService.findByKakaoId(kakaoId);
    const isNewUser = !user;

    if (!user) {
      user = await this.usersService.createFromKakao(
        kakaoId,
        kakaoNickname || fallbackNickname,
        gender,
      );
    } else if (kakaoNickname && user.nickname !== kakaoNickname && user.nickname.startsWith('유저')) {
      // 기존 유저 — 자동 생성된 닉네임 (유저XXXX) 인 경우에만 카카오 닉네임으로 갱신.
      // 사용자가 직접 수정한 닉네임은 보존 (추후 닉네임 편집 기능 들어와도 안전).
      const updated = await this.usersService.update(user.id, { nickname: kakaoNickname });
      if (updated) user = updated;
    }

    // 4. JWT 발급
    const payload = { sub: user.id, kakaoId: user.kakaoId };
    const accessToken = this.jwtService.sign(payload);

    const result = {
      accessToken,
      user: {
        id: user.id,
        nickname: user.nickname,
        gender: user.gender,
        isOnboardingComplete: user.isOnboardingComplete,
        isPremium: user.isPremium,
      },
      isNewUser,
    };

    // 캐시 저장 — Safari 가 같은 콜백을 다시 hit 해도 같은 결과 반환
    this.codeCache.set(code, {
      result,
      expiresAt: Date.now() + AuthService.CODE_CACHE_TTL_MS,
    });
    // 단순 메모리 누수 방지 — 캐시 사이즈가 커지면 만료된 항목 정리
    if (this.codeCache.size > 100) {
      const now = Date.now();
      for (const [k, v] of this.codeCache.entries()) {
        if (v.expiresAt <= now) this.codeCache.delete(k);
      }
    }

    return result;
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('유저를 찾을 수 없습니다');
    return user;
  }
}
