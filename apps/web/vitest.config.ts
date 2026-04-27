import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * tsconfig 의 paths { "@/*": ["./src/*"] } 와 동일하게 alias 매핑.
 * Vite 의 resolve.alias 가 vitest 에도 그대로 적용됨.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // zustand persist 가 모듈 로드 시점에 localStorage 를 캡처하므로
    // 어떤 import 보다 먼저 stub 을 심는다.
    setupFiles: ['./vitest.setup.ts'],
  },
});
