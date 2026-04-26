/**
 * 모든 API 4xx/5xx 응답의 표준 body shape.
 * 프론트는 statusCode 가 아닌 `code` 로 분기한다 (메시지 변경 안전).
 *
 *   { statusCode: 409, code: 'LIMIT_EXCEEDED', message: '...', details?: {...} }
 *
 * Nest 기본 HttpException 의 body 는 { statusCode, message, error } — 본 인터페이스로
 * 통일하기 위해 ApiException 사용. JwtAuthGuard 의 401 은 별도로 통일하지 않음
 * (Passport 자체 throw, 필요 시 글로벌 ExceptionFilter 로 추후 보강).
 */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
