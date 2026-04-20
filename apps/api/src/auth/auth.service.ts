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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 카카오 인가코드로 토큰 교환 → 유저 정보 조회 → DB 유저 생성/조회 → JWT 발급
   */
  async kakaoLogin(code: string, redirectUri: string) {
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
    const nickname = kakaoUser.kakao_account?.profile?.nickname || `유저${kakaoId.slice(-4)}`;
    const gender = kakaoUser.kakao_account?.gender; // "male" | "female" | undefined

    // 3. DB에서 유저 조회 또는 생성
    let user = await this.usersService.findByKakaoId(kakaoId);
    const isNewUser = !user;

    if (!user) {
      user = await this.usersService.createFromKakao(kakaoId, nickname, gender);
    }

    // 4. JWT 발급
    const payload = { sub: user.id, kakaoId: user.kakaoId };
    const accessToken = this.jwtService.sign(payload);

    return {
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
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('유저를 찾을 수 없습니다');
    return user;
  }
}
