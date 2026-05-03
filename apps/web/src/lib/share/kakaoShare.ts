/**
 * Kakao JavaScript SDK 의 Share.sendDefault wrapper.
 *
 * 호출 가능 조건:
 *  - SDK 로드됨 + Kakao.init 통과 (KakaoSdkLoader)
 *  - 호출 시점 origin 이 카카오 콘솔 사이트 도메인에 등록 (yeonapp.com)
 *
 * Capacitor WebView origin (capacitor://localhost) 이 사이트 도메인에 등록 안되면
 * 카카오 서버가 referer mismatch 로 거부 — 그 경우 false 반환 → 호출부가 fallback.
 *
 * 미설치(웹) 폰에서는 카카오 측 안내 페이지로 fallback.
 */

interface KakaoShareWindow {
  Kakao?: {
    isInitialized?: () => boolean;
    Share?: {
      sendDefault: (params: KakaoSendDefaultParams) => void;
    };
  };
}

interface KakaoSendDefaultParams {
  objectType: "feed";
  content: {
    title: string;
    description: string;
    imageUrl: string;
    link: {
      mobileWebUrl: string;
      webUrl: string;
    };
  };
  buttons?: Array<{
    title: string;
    link: { mobileWebUrl: string; webUrl: string };
  }>;
  installTalk?: boolean;
}

export interface KakaoShareInviteOptions {
  inviteUrl: string;
  inviterNickname: string;
}

const SHARE_IMAGE_URL = "https://yeonapp.com/icon-192x192.svg";

/**
 * 카카오톡 공유 시도. 성공 시 true, SDK 미로드/origin 거부/기타 오류로 실패 시 false.
 * 사용자가 sheet 를 닫는 케이스는 SDK 가 별도 callback 안 줌 → 일단 true 반환.
 */
export async function shareInviteViaKakao(
  options: KakaoShareInviteOptions,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const w = window as unknown as KakaoShareWindow;
  if (!w.Kakao?.isInitialized?.() || !w.Kakao.Share?.sendDefault) {
    return false;
  }

  const { inviteUrl, inviterNickname } = options;
  const link = { mobileWebUrl: inviteUrl, webUrl: inviteUrl };

  try {
    w.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: `${inviterNickname}님이 사주 궁합 보러 오라고 초대했어요`,
        description: "緣 — 사주로 풀어내는 친구 궁합. 양쪽 사주가 모이면 자동 계산돼요.",
        imageUrl: SHARE_IMAGE_URL,
        link,
      },
      buttons: [
        {
          title: "친구 수락하러 가기",
          link,
        },
      ],
      installTalk: true,
    });
    return true;
  } catch {
    return false;
  }
}
