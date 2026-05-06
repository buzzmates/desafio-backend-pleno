import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/common/prisma.service';
import { ConfigModule } from '@nestjs/config';

jest.resetModules();

if (typeof exports === 'undefined') {
  (global as any).exports = {};
}

(global as any).jest = {
  ...((global as any).jest || {}),
  transform: [],
  transformIgnorePatterns: [],
};

export const testSetup = async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'file::memory:?cache=shared';
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
  process.env.LOG_LEVEL = 'error';
  jest.setTimeout(10000);
};

export const createTestingModule = (
  providers: any[] = [],
): Promise<TestingModule> => {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
    ],
    providers: [
      {
        provide: PrismaService,
        useValue: {
          // Mock PrismaService for unit tests
          $connect: jest.fn(),
          $disconnect: jest.fn(),
          $onModuleInit: jest.fn(),
          $queryRaw: jest.fn(),
          $queryRawUnsafe: jest.fn(),
          $executeRaw: jest.fn(),
          $executeRawUnsafe: jest.fn(),
          $transaction: jest.fn(),
        },
      },
      ...providers,
    ],
  }).compile();
};

export const cleanupTestDatabase = async () => {
  jest.clearAllMocks();
};

export const testHelpers = {
  mockDate: (dateString: string) => {
    const mockDate = new Date(dateString);
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    return mockDate;
  },

  restoreDate: () => {
    jest.restoreAllMocks();
  },

  generateUUID: () => {
    return 'test-uuid-' + Math.random().toString(36).substr(2, 9);
  },

  waitFor: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(async () => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();

  await testSetup();
});

afterAll(async () => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;

  await cleanupTestDatabase();
});

beforeEach(async () => {
  jest.clearAllMocks();
});
