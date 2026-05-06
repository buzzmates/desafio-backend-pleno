/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.spec.json'
    }],
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s'
  ],
  coverageDirectory: './coverage',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!@faker-js/faker)'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: false,
  silent: true,
  errorOnDeprecated: false,
  notify: false,
  bail: false,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  reporters: ['default'],
  maxWorkers: 1
};
