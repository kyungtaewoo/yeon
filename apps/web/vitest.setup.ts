/**
 * zustand persist 의 기본 storage 가 `() => window.localStorage` 라서
 * node 에선 ReferenceError → storage = undefined → 매 set() 마다 경고가 찍힘.
 * window + window.localStorage 를 한 번에 stub 해서 해결.
 *
 * 테스트 파일은 globalThis.localStorage (window.localStorage 와 같은 객체) 를
 * 직접 사용하고, beforeEach 에서 clear 한다.
 */
const store = new Map<string, string>();
const localStorageStub: Storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => {
    store.clear();
  },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
};

// window 가 없으면 만들고, 있으면 localStorage 만 채움.
const g = globalThis as unknown as { window?: { localStorage: Storage }; localStorage: Storage };
g.window = { ...(g.window ?? {}), localStorage: localStorageStub };
g.localStorage = localStorageStub;
