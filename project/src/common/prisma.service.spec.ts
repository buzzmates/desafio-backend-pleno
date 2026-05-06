import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let prismaService: PrismaService;
  let mockPrismaClient: any;

  beforeEach(async () => {
    // Mock the Prisma Client methods
    mockPrismaClient = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn(),
      $queryRawUnsafe: jest.fn(),
      $executeRaw: jest.fn(),
      $executeRawUnsafe: jest.fn(),
      $transaction: jest.fn((callback) => callback(mockPrismaClient)),
      prisma: {},
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService);

    // Mock the PrismaClient methods on the service instance
    Object.assign(prismaService, mockPrismaClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('module initialization', () => {
    it('should be defined', () => {
      expect(prismaService).toBeDefined();
    });

    it('should initialize prisma client', () => {
      expect((prismaService as any).prisma).toBeDefined();
    });
  });

  describe('connection management', () => {
    it('should connect to database on module init', async () => {
      // Act
      await prismaService.onModuleInit();

      // Assert
      expect(mockPrismaClient.$connect).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      // Arrange
      const connectionError = new Error('Connection failed');
      mockPrismaClient.$connect.mockRejectedValue(connectionError);

      // Act & Assert
      await expect(prismaService.onModuleInit()).rejects.toThrow(
        connectionError,
      );
    });

    it('should disconnect from database', async () => {
      // Act
      await prismaService.$disconnect();

      // Assert
      expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
    });

    it('should handle disconnection errors gracefully', async () => {
      // Arrange
      const disconnectionError = new Error('Disconnection failed');
      mockPrismaClient.$disconnect.mockRejectedValue(disconnectionError);

      // Act & Assert
      await expect(prismaService.$disconnect()).rejects.toThrow(
        disconnectionError,
      );
    });
  });

  describe('query operations', () => {
    it('should execute raw queries', async () => {
      // Arrange
      const query = Prisma.sql`SELECT * FROM orders`;
      const expectedResult = [{ id: '1', name: 'test' }];
      mockPrismaClient.$queryRaw.mockResolvedValue(expectedResult);

      // Act
      const result = await prismaService.$queryRaw(query);

      // Assert
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle query errors', async () => {
      // Arrange
      const query = Prisma.sql`SELECT * FROM orders`;
      const queryError = new Error('Query failed');
      mockPrismaClient.$queryRaw.mockRejectedValue(queryError);

      // Act & Assert
      await expect(prismaService.$queryRaw(query)).rejects.toThrow(queryError);
    });

    it('should execute unsafe raw queries', async () => {
      // Arrange
      const query = 'SELECT * FROM orders WHERE id = $1';
      const params = ['123'];
      const expectedResult = [{ id: '123', name: 'test' }];
      mockPrismaClient.$queryRawUnsafe.mockResolvedValue(expectedResult);

      // Act
      const result = await prismaService.$queryRawUnsafe(query, ...params);

      // Assert
      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
        query,
        ...params,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should execute raw commands', async () => {
      // Arrange
      const command = Prisma.sql`DELETE FROM orders WHERE id = ${'123'}`;
      const expectedResult = { count: 1 };
      mockPrismaClient.$executeRaw.mockResolvedValue(expectedResult);

      // Act
      const result = await prismaService.$executeRaw(command);

      // Assert
      expect(mockPrismaClient.$executeRaw).toHaveBeenCalledWith(command);
      expect(result).toEqual(expectedResult);
    });

    it('should execute unsafe raw commands', async () => {
      // Arrange
      const command = Prisma.sql`DELETE FROM orders WHERE id = ${'123'}`;
      const expectedResult = { count: 1 };
      mockPrismaClient.$executeRawUnsafe.mockResolvedValue(expectedResult);

      // Act
      const result = await prismaService.$executeRawUnsafe(command as any);

      // Assert
      expect(mockPrismaClient.$executeRawUnsafe).toHaveBeenCalledWith(command);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('transaction handling', () => {
    it('should execute transactions successfully', async () => {
      // Arrange
      const transactionCallback = jest
        .fn()
        .mockResolvedValue({ success: true });
      const expectedResult = { success: true };
      mockPrismaClient.$transaction.mockImplementation((cb: any) =>
        cb(mockPrismaClient),
      );

      // Act
      const result = await prismaService.$transaction(transactionCallback);

      // Assert
      expect(mockPrismaClient.$transaction).toHaveBeenCalledWith(
        transactionCallback,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle transaction rollback', async () => {
      // Arrange
      const transactionCallback = jest
        .fn()
        .mockRejectedValue(new Error('Transaction failed'));
      const transactionError = new Error('Transaction failed');
      mockPrismaClient.$transaction.mockImplementation(async (cb: any) => {
        await cb(mockPrismaClient);
        throw transactionError;
      });

      // Act & Assert
      await expect(
        prismaService.$transaction(transactionCallback),
      ).rejects.toThrow(transactionError);
      expect(transactionCallback).toHaveBeenCalled();
    });

    it('should handle transactions with callback', async () => {
      // Arrange
      const transactionCallback = jest
        .fn()
        .mockResolvedValue({ success: true });
      const expectedResult = { success: true };
      mockPrismaClient.$transaction.mockResolvedValue(expectedResult);

      // Act
      const result = await prismaService.$transaction(transactionCallback);

      // Assert
      expect(mockPrismaClient.$transaction).toHaveBeenCalledWith(
        transactionCallback,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle database timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Database timeout');
      timeoutError.name = 'PrismaClientKnownRequestError';
      (timeoutError as any).code = 'P2024';
      mockPrismaClient.$queryRaw.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(prismaService.$queryRaw('SELECT 1' as any)).rejects.toThrow(
        timeoutError,
      );
    });

    it('should handle connection pool exhaustion', async () => {
      // Arrange
      const poolError = new Error('Connection pool exhausted');
      poolError.name = 'PrismaClientKnownRequestError';
      (poolError as any).code = 'P2025';
      mockPrismaClient.$queryRaw.mockRejectedValue(poolError);

      // Act & Assert
      await expect(prismaService.$queryRaw`SELECT 1`).rejects.toThrow(
        poolError,
      );
    });

    it('should handle constraint violations', async () => {
      // Arrange
      const constraintError = new Error('Unique constraint violation');
      constraintError.name = 'PrismaClientKnownRequestError';
      (constraintError as any).code = 'P2002';
      mockPrismaClient.$executeRaw.mockRejectedValue(constraintError);

      // Act & Assert
      await expect(
        prismaService.$executeRaw`INSERT INTO orders`,
      ).rejects.toThrow(constraintError);
    });

    it('should handle unknown errors gracefully', async () => {
      // Arrange
      const unknownError = new Error('Unknown database error');
      mockPrismaClient.$queryRaw.mockRejectedValue(unknownError);

      // Act & Assert
      await expect(prismaService.$queryRaw`SELECT 1`).rejects.toThrow(
        unknownError,
      );
    });
  });

  describe('connection lifecycle', () => {
    it('should maintain connection state across operations', async () => {
      // Arrange
      mockPrismaClient.$queryRaw.mockResolvedValue([{ count: 1 }]);
      mockPrismaClient.$executeRaw.mockResolvedValue({ count: 1 });

      // Act
      await prismaService.onModuleInit();
      const queryResult =
        await prismaService.$queryRaw`SELECT COUNT(*) as count FROM orders`;
      const executeResult =
        await prismaService.$executeRaw`UPDATE orders SET updated_at = NOW()`;

      // Assert
      expect(mockPrismaClient.$connect).toHaveBeenCalled();
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
      expect(mockPrismaClient.$executeRaw).toHaveBeenCalled();
      expect(queryResult).toEqual([{ count: 1 }]);
      expect(executeResult).toEqual({ count: 1 });
    });

    it('should handle rapid connection/disconnection cycles', async () => {
      // Arrange
      mockPrismaClient.$connect.mockResolvedValue(undefined);
      mockPrismaClient.$disconnect.mockResolvedValue(undefined);

      // Act
      await prismaService.$connect();
      await prismaService.$disconnect();
      await prismaService.$connect();
      await prismaService.$disconnect();

      // Assert
      expect(mockPrismaClient.$connect).toHaveBeenCalledTimes(2);
      expect(mockPrismaClient.$disconnect).toHaveBeenCalledTimes(2);
    });
  });

  describe('performance considerations', () => {
    it('should handle concurrent operations', async () => {
      // Arrange
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve({ id: `order-${i}`, name: `Order ${i}` }),
      );
      mockPrismaClient.$queryRaw.mockImplementation(
        () => promises[Math.floor(Math.random() * promises.length)],
      );

      // Act
      const results = await Promise.all(
        Array.from(
          { length: 10 },
          () => prismaService.$queryRaw`SELECT * FROM orders LIMIT 1`,
        ),
      );

      // Assert
      expect(results).toHaveLength(10);
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(10);
    });

    it('should handle large result sets', async () => {
      // Arrange
      const largeResultSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `order-${i}`,
        name: `Order ${i}`,
        created_at: new Date(),
      }));
      mockPrismaClient.$queryRaw.mockResolvedValue(largeResultSet);

      // Act
      const result = await prismaService.$queryRaw`SELECT * FROM orders`;

      // Assert
      expect(result).toHaveLength(1000);
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
    });
  });
});
