import type { ValueTransformer } from 'typeorm';

/** TypeORM decimal 컬럼을 JS number로 역직렬화 (기본은 string). */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value == null ? value : parseFloat(value)),
};
