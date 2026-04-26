import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorBody } from './error-response.interface';

/**
 * 도메인 에러 코드 + 사용자 메시지 + 선택적 details 를 한 번에 던진다.
 *
 * @example
 *   throw new ApiException(
 *     HttpStatus.CONFLICT,
 *     'LIMIT_EXCEEDED',
 *     '저장 가능한 인연이 가득 찼어요',
 *     { current, limit, tier: 'free' },
 *   );
 *
 * 점진 도입 — 새 코드/리팩토링 시점에 ApiException 사용 권장.
 * 기존 모듈 (auth, payment, compatibility, matching 본체) 의
 * NestJS 기본 HttpException 들은 추후 별도 PR 에서 마이그레이션 예정.
 */
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    const body: ApiErrorBody = { statusCode: status, code, message };
    if (details !== undefined) body.details = details;
    super(body, status);
  }
}
