import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../src/common/prisma.service';
import { execSync } from 'child_process';
import { Redis } from 'ioredis';

/**
 * Integration Test Setup
 * Uses Docker Compose for PostgreSQL and Redis containers
 */

export interface IntegrationTestContainer {
  postgresUrl: string;
  redisUrl: string;
  cleanup: () => Promise<void>;
}

let testContainer: IntegrationTestContainer | null = null;

/**
 * Sets up integration test environment with real PostgreSQL and Redis
 */
export const setupIntegrationTest =
  async (): Promise<IntegrationTestContainer> => {
    if (testContainer) {
      return testContainer;
    }

    console.log('Starting integration test containers...');

    // Start Docker containers for integration tests
    try {
      execSync('docker-compose -f docker-compose.test.yml up -d', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });

      // Wait for services to be ready
      await waitForPostgres();
      await waitForRedis();

      const postgresUrl =
        'postgresql://postgres:password@localhost:5433/orders_test_db';
      const redisUrl = 'redis://localhost:6380';

      testContainer = {
        postgresUrl,
        redisUrl,
        cleanup: async () => {
          console.log('Cleaning up integration test containers...');
          execSync('docker-compose -f docker-compose.test.yml down -v', {
            stdio: 'inherit',
            cwd: process.cwd(),
          });
        },
      };

      return testContainer;
    } catch (error) {
      console.error('Failed to start integration test containers:', error);
      throw error;
    }
  };

/**
 * Creates a NestJS testing module with real database connections
 */
export const createIntegrationTestingModule = async (
  overrides: any[] = [],
): Promise<TestingModule> => {
  const container = await setupIntegrationTest();

  // Set environment variables for integration tests
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = container.postgresUrl;
  process.env.REDIS_URL = container.redisUrl;

  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
    ],
    providers: [PrismaService, ...overrides],
  }).compile();

  // Initialize database
  const prismaService = module.get<PrismaService>(PrismaService);
  await prismaService.$connect();
  await runDatabaseMigrations(prismaService);

  return module;
};

/**
 * Waits for PostgreSQL to be ready
 */
const waitForPostgres = async (maxAttempts = 30): Promise<void> => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const { Client } = require('pg');
      const client = new Client({
        connectionString:
          'postgresql://postgres:password@localhost:5433/orders_test_db',
      });

      await client.connect();
      await client.query('SELECT 1');
      await client.end();

      console.log('PostgreSQL is ready');
      return;
    } catch (error) {
      console.log(`Waiting for PostgreSQL... (${i + 1}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error('PostgreSQL failed to start within timeout');
};

/**
 * Waits for Redis to be ready
 */
const waitForRedis = async (maxAttempts = 30): Promise<void> => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const redis = new Redis('redis://localhost:6380');
      await redis.ping();
      await redis.disconnect();

      console.log('Redis is ready');
      return;
    } catch (error) {
      console.log(`Waiting for Redis... (${i + 1}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error('Redis failed to start within timeout');
};

/**
 * Runs database migrations for test database
 */
const runDatabaseMigrations = async (
  prismaService: PrismaService,
): Promise<void> => {
  try {
    // Run Prisma migrations on test database
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
    });

    console.log('Database migrations completed');
  } catch (error) {
    console.error('Failed to run database migrations:', error);
    throw error;
  }
};

/**
 * Cleans up test data between tests
 */
export const cleanupTestData = async (
  prismaService: PrismaService,
): Promise<void> => {
  try {
    // Clean up in the correct order due to foreign key constraints
    await prismaService.orderEnrichment.deleteMany();
    await prismaService.orderItem.deleteMany();
    await prismaService.order.deleteMany();

    console.log('Test data cleaned up');
  } catch (error) {
    console.error('Failed to cleanup test data:', error);
    throw error;
  }
};

/**
 * Global cleanup for integration tests
 */
export const cleanupIntegrationTest = async (): Promise<void> => {
  if (testContainer) {
    await testContainer.cleanup();
    testContainer = null;
  }
};

// Global setup and teardown
beforeAll(async () => {
  jest.setTimeout(30000); // Increase timeout for integration tests
});

afterAll(async () => {
  await cleanupIntegrationTest();
});
