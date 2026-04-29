import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shareInvite, buildInviteUrl } from './inviteShare';

vi.mock('@capacitor/share', () => ({
  Share: { share: vi.fn() },
}));

import { Share } from '@capacitor/share';

interface CapacitorWindow {
  Capacitor?: { isNativePlatform?: () => boolean };
}

const win = globalThis.window as unknown as CapacitorWindow;
const nav = globalThis.navigator as Navigator & {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

beforeEach(() => {
  vi.clearAllMocks();
  delete win.Capacitor;
  delete (nav as Navigator & { share?: unknown }).share;
  delete (nav as Navigator & { clipboard?: unknown }).clipboard;
});

afterEach(() => {
  delete win.Capacitor;
  delete (nav as Navigator & { share?: unknown }).share;
  delete (nav as Navigator & { clipboard?: unknown }).clipboard;
});

describe('buildInviteUrl', () => {
  it('Universal Link 도메인 + 코드 인코딩', () => {
    expect(buildInviteUrl('ABCD1234')).toBe('https://yeonapp.com/invite/ABCD1234');
  });

  it('특수문자 인코딩', () => {
    expect(buildInviteUrl('a+b/c')).toBe('https://yeonapp.com/invite/a%2Bb%2Fc');
  });
});

describe('shareInvite — native (Capacitor)', () => {
  beforeEach(() => {
    win.Capacitor = { isNativePlatform: () => true };
  });

  it('성공 시 shared 반환 + Capacitor Share 호출', async () => {
    vi.mocked(Share.share).mockResolvedValue({ activityType: 'native' } as unknown as never);
    const result = await shareInvite({ inviteCode: 'XYZ', inviterNickname: '경태' });
    expect(result).toBe('shared');
    expect(Share.share).toHaveBeenCalledWith({
      title: expect.any(String),
      text: expect.stringContaining('경태'),
      url: 'https://yeonapp.com/invite/XYZ',
      dialogTitle: expect.any(String),
    });
  });

  it('취소 시 cancelled 반환 (silent)', async () => {
    const abortErr = new Error('User cancelled');
    abortErr.name = 'AbortError';
    vi.mocked(Share.share).mockRejectedValue(abortErr);
    const result = await shareInvite({ inviteCode: 'X', inviterNickname: 'a' });
    expect(result).toBe('cancelled');
  });

  it('취소 외 에러는 throw', async () => {
    vi.mocked(Share.share).mockRejectedValue(new Error('Network down'));
    await expect(shareInvite({ inviteCode: 'X', inviterNickname: 'a' })).rejects.toThrow(
      'Network down',
    );
  });
});

describe('shareInvite — web (navigator.share)', () => {
  beforeEach(() => {
    win.Capacitor = { isNativePlatform: () => false };
  });

  it('navigator.share 성공 → shared', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    nav.share = shareSpy;
    const result = await shareInvite({ inviteCode: 'WEB1', inviterNickname: 'web' });
    expect(result).toBe('shared');
    expect(shareSpy).toHaveBeenCalledWith({
      title: expect.any(String),
      text: expect.stringContaining('web'),
      url: 'https://yeonapp.com/invite/WEB1',
    });
  });

  it('navigator.share 취소 → cancelled (clipboard 호출 안 함)', async () => {
    const abortErr = new Error('share cancelled');
    abortErr.name = 'AbortError';
    nav.share = vi.fn().mockRejectedValue(abortErr);
    const writeText = vi.fn();
    nav.clipboard = { writeText };
    const result = await shareInvite({ inviteCode: 'X', inviterNickname: 'a' });
    expect(result).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('navigator.share 비-취소 실패 → clipboard fallback', async () => {
    nav.share = vi.fn().mockRejectedValue(new Error('not supported by browser'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    nav.clipboard = { writeText };
    const result = await shareInvite({ inviteCode: 'F', inviterNickname: 'f' });
    expect(result).toBe('fallback-copied');
    expect(writeText).toHaveBeenCalledWith('https://yeonapp.com/invite/F');
  });
});

describe('shareInvite — fallback (clipboard only)', () => {
  it('navigator.share 미지원 → clipboard 사용', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    nav.clipboard = { writeText };
    const result = await shareInvite({ inviteCode: 'CLIP', inviterNickname: 'c' });
    expect(result).toBe('fallback-copied');
    expect(writeText).toHaveBeenCalledWith('https://yeonapp.com/invite/CLIP');
  });

  it('share + clipboard 모두 없으면 throw', async () => {
    await expect(shareInvite({ inviteCode: 'X', inviterNickname: 'a' })).rejects.toThrow(
      '공유 기능을 사용할 수 없어요',
    );
  });
});
