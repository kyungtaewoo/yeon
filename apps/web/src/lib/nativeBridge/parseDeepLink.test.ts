import { describe, it, expect } from 'vitest';
import { parseDeepLinkUrl, shouldProcessLaunchUrl } from './parseDeepLink';

describe('parseDeepLinkUrl', () => {
  it('Universal Link 초대: https://yeonapp.com/invite/CODE → invite 액션', () => {
    expect(parseDeepLinkUrl('https://yeonapp.com/invite/ABCD1234')).toEqual({
      type: 'invite',
      code: 'ABCD1234',
    });
  });

  it('Universal Link trailing slash 와 query 무시', () => {
    expect(parseDeepLinkUrl('https://yeonapp.com/invite/XYZ/?utm=foo')).toEqual({
      type: 'invite',
      code: 'XYZ',
    });
  });

  it('Custom scheme 초대: yeonapp://invite?code=CODE', () => {
    expect(parseDeepLinkUrl('yeonapp://invite?code=HELLO')).toEqual({
      type: 'invite',
      code: 'HELLO',
    });
  });

  it('OAuth callback: yeonapp://auth?token=T&isNew=true', () => {
    expect(parseDeepLinkUrl('yeonapp://auth?token=abc.def&isNew=true')).toEqual({
      type: 'auth',
      token: 'abc.def',
      isNew: true,
    });
  });

  it('OAuth callback isNew 누락 → false', () => {
    expect(parseDeepLinkUrl('yeonapp://auth?token=abc')).toEqual({
      type: 'auth',
      token: 'abc',
      isNew: false,
    });
  });

  it('OAuth callback 토큰 없으면 null', () => {
    expect(parseDeepLinkUrl('yeonapp://auth?isNew=true')).toBeNull();
  });

  it('초대 코드 비어있으면 null (Universal Link)', () => {
    expect(parseDeepLinkUrl('https://yeonapp.com/invite/')).toBeNull();
  });

  it('초대 코드 비어있으면 null (custom scheme)', () => {
    expect(parseDeepLinkUrl('yeonapp://invite')).toBeNull();
  });

  it('잘못된 host 는 null (다른 도메인)', () => {
    expect(parseDeepLinkUrl('https://evil.com/invite/X')).toBeNull();
  });

  it('잘못된 path (Universal Link 가 invite 아닌 경우)', () => {
    expect(parseDeepLinkUrl('https://yeonapp.com/home')).toBeNull();
  });

  it('알 수 없는 custom scheme hostname 은 null', () => {
    expect(parseDeepLinkUrl('yeonapp://random?foo=bar')).toBeNull();
  });

  it('파싱 불가 문자열 → null', () => {
    expect(parseDeepLinkUrl('not a url')).toBeNull();
  });
});

describe('shouldProcessLaunchUrl — cold-start 가드', () => {
  it('auth URL + 토큰 있음 → false (재처리 방지)', () => {
    expect(shouldProcessLaunchUrl('yeonapp://auth?token=t', true)).toBe(false);
  });

  it('auth URL + 토큰 없음 → true (정상 OAuth)', () => {
    expect(shouldProcessLaunchUrl('yeonapp://auth?token=t', false)).toBe(true);
  });

  it('invite Universal Link + 토큰 있음 → true (메인 시나리오)', () => {
    expect(
      shouldProcessLaunchUrl('https://yeonapp.com/invite/CODE', true),
    ).toBe(true);
  });

  it('invite Universal Link + 토큰 없음 → true', () => {
    expect(
      shouldProcessLaunchUrl('https://yeonapp.com/invite/CODE', false),
    ).toBe(true);
  });

  it('invite custom scheme + 토큰 있음 → true', () => {
    expect(shouldProcessLaunchUrl('yeonapp://invite?code=X', true)).toBe(true);
  });

  it('알 수 없는 URL → false', () => {
    expect(shouldProcessLaunchUrl('https://yeonapp.com/home', true)).toBe(false);
    expect(shouldProcessLaunchUrl('not a url', false)).toBe(false);
  });
});
