import { describe, it, expect } from 'vitest';
import { ApiError } from '.';
import {
  mapFriendsError,
  FriendInviteAlreadyAcceptedError,
  FriendInviteExpiredError,
  FriendInviteForbiddenError,
  FriendInviteGenerationFailedError,
  FriendInviteNotFoundError,
  FriendSelfInviteError,
  FriendNetworkError,
  FriendUnauthorizedError,
} from './friends';

const callMap = (err: unknown): unknown => {
  try {
    mapFriendsError(err);
  } catch (e) {
    return e;
  }
  return null;
};

describe('mapFriendsError — ApiError code 분기', () => {
  it('401 → FriendUnauthorizedError (code 없어도)', () => {
    const result = callMap(new ApiError(401, 'Unauthorized'));
    expect(result).toBeInstanceOf(FriendUnauthorizedError);
  });

  it('404 INVITE_NOT_FOUND → FriendInviteNotFoundError', () => {
    const result = callMap(
      new ApiError(404, '초대 코드를 찾을 수 없어요', 'INVITE_NOT_FOUND'),
    );
    expect(result).toBeInstanceOf(FriendInviteNotFoundError);
  });

  it('503 INVITE_GENERATION_FAILED → FriendInviteGenerationFailedError', () => {
    const result = callMap(
      new ApiError(503, '초대 코드 생성에 실패했어요', 'INVITE_GENERATION_FAILED'),
    );
    expect(result).toBeInstanceOf(FriendInviteGenerationFailedError);
  });

  it('400 SELF_INVITE → FriendSelfInviteError', () => {
    const result = callMap(
      new ApiError(400, '본인의 초대는 수락할 수 없어요', 'SELF_INVITE'),
    );
    expect(result).toBeInstanceOf(FriendSelfInviteError);
  });

  it('410 INVITE_EXPIRED → FriendInviteExpiredError', () => {
    const result = callMap(
      new ApiError(410, '만료된 초대예요', 'INVITE_EXPIRED'),
    );
    expect(result).toBeInstanceOf(FriendInviteExpiredError);
  });

  it('409 INVITE_ALREADY_ACCEPTED → FriendInviteAlreadyAcceptedError', () => {
    const result = callMap(
      new ApiError(409, '이미 다른 친구가 수락한 초대예요', 'INVITE_ALREADY_ACCEPTED'),
    );
    expect(result).toBeInstanceOf(FriendInviteAlreadyAcceptedError);
  });

  it('403 INVITE_FORBIDDEN → FriendInviteForbiddenError', () => {
    const result = callMap(
      new ApiError(403, '권한 없음', 'INVITE_FORBIDDEN'),
    );
    expect(result).toBeInstanceOf(FriendInviteForbiddenError);
  });

  it('5xx → FriendNetworkError', () => {
    const result = callMap(new ApiError(500, 'Internal Server Error'));
    expect(result).toBeInstanceOf(FriendNetworkError);
  });

  it('status=0 (timeout) → FriendNetworkError', () => {
    const result = callMap(new ApiError(0, '응답 없음'));
    expect(result).toBeInstanceOf(FriendNetworkError);
  });

  it('알 수 없는 4xx code → ApiError 그대로 (도메인 에러로 안 감쌈)', () => {
    const orig = new ApiError(418, "I'm a teapot", 'TEAPOT');
    const result = callMap(orig);
    expect(result).toBe(orig);
  });

  it('일반 Error (fetch fail) → FriendNetworkError', () => {
    const result = callMap(new TypeError('Failed to fetch'));
    expect(result).toBeInstanceOf(FriendNetworkError);
  });

  it('Error 가 아닌 throw (string 등) → FriendNetworkError', () => {
    const result = callMap('something weird');
    expect(result).toBeInstanceOf(FriendNetworkError);
  });
});
