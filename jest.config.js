import { createDefaultEsmPreset } from 'ts-jest'

/** @type {import('jest').Config} */
export default {
  ...createDefaultEsmPreset(),
  testEnvironment: 'node',
  moduleNameMapper: {
    // Mirrors the tsconfig path mapping so examples can import 'quoin' by name.
    '^quoin/react$': '<rootDir>/src/react/index.ts',
    '^quoin$': '<rootDir>/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
    '<rootDir>/examples/**/*.test.ts',
    '<rootDir>/examples/**/*.test.tsx'
  ],
  clearMocks: true,
  // The library is small enough to hold at 100% — anything uncovered in src/ is a
  // path nobody thought about. Examples sit lower: a few defensive branches there
  // exist to demonstrate the shape, not because a test can reach them.
  coverageThreshold: {
    global: { statements: 95, branches: 90, functions: 100, lines: 95 },
    './src/': { statements: 100, branches: 100, functions: 100, lines: 100 }
  }
}
