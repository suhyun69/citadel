import tseslint from 'typescript-eslint';

/**
 * 폴더 경계와 결정론 규칙을 강제한다.
 *
 *   data   → 아무것도 import 하지 않음
 *   engine → data 만 (react/next/dom 금지)
 *   bot    → engine, data
 *   runtime→ bot, engine, data
 *   app,ui → 전부
 *
 * 그리고 engine/bot 에서는 Math.random() 을 금지한다. 시드 RNG 만 쓰면
 * "시드 + 선택 로그 = 완전 재현" 이 보장되고, 이게 봇 대전 디버깅의 전부다.
 */
const deny = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

export default tseslint.config(
  { ignores: ['node_modules/**', '.next/**', 'src/data/generated/**', 'next-env.d.ts'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/data/**/*.ts'],
    rules: deny([
      { group: ['@/engine/*', '@/bot/*', '@/runtime/*', '@/ui/*', '@/app/*'], message: 'data 는 다른 레이어를 참조할 수 없습니다.' },
      { group: ['react', 'react-dom', 'next', 'next/*'], message: 'data 는 프레임워크를 참조할 수 없습니다.' },
    ]),
  },
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      ...deny([
        { group: ['@/bot/*', '@/runtime/*', '@/ui/*', '@/app/*'], message: 'engine 은 data 만 참조할 수 있습니다.' },
        { group: ['react', 'react-dom', 'next', 'next/*'], message: 'engine 은 프레임워크를 몰라야 합니다.' },
      ]),
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'engine 은 결정론적이어야 합니다. src/engine/rng.ts 를 쓰세요.' },
      ],
    },
  },
  {
    files: ['src/bot/**/*.ts'],
    rules: {
      ...deny([
        { group: ['@/runtime/*', '@/ui/*', '@/app/*'], message: 'bot 은 engine, data 만 참조할 수 있습니다.' },
        { group: ['react', 'react-dom', 'next', 'next/*'], message: 'bot 은 프레임워크를 몰라야 합니다.' },
      ]),
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'bot 도 결정론적이어야 합니다. 주입된 rng 를 쓰세요.' },
      ],
    },
  },
  {
    files: ['src/runtime/**/*.ts'],
    rules: deny([{ group: ['@/ui/*', '@/app/*'], message: 'runtime 은 UI 를 참조할 수 없습니다.' }]),
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
