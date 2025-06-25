import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: './tsconfig.jest.json' }]
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironmentOptions: { path: '.env' },
  testTimeout: 2e5,
  detectOpenHandles: false,
  forceExit: false
};
export default config;
