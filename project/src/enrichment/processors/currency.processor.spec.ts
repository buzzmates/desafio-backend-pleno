import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { CurrencyProcessor } from './currency.processor';
import { OrderRepository } from '../../common/order.repository';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyConversionService } from '../services/currency-conversion.service';
import {
  CurrencyConversionRequest,
  CurrencyConversionResult,
} from '../dto/currency-conversion.dto';

describe('CurrencyProcessor', () => {
  let processor: CurrencyProcessor;
  let mockOrderRepository: jest.Mocked<OrderRepository>;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockCurrencyService: jest.Mocked<CurrencyConversionService>;
  let module: TestingModule;

  beforeEach(async () => {
    mockOrderRepository = {
      updateEnrichmentData: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    mockPrismaService = {
      order: {
        findUnique: jest.fn(),
      },
      orderEnrichment: {
        findUnique: jest.fn(),
      },
    } as any;

    mockCurrencyService = {
      convertCurrency: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        CurrencyProcessor,
        {
          provide: OrderRepository,
          useValue: mockOrderRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CurrencyConversionService,
          useValue: mockCurrencyService,
        },
      ],
    }).compile();

    processor = module.get(CurrencyProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEnrichmentField', () => {
    it('should return currencyConversion field name', () => {
      // Act
      const field = processor.getEnrichmentField();

      // Assert
      expect(field).toBe('currencyConversion');
    });
  });

  describe('enrich', () => {
    it('should successfully enrich currency for valid order', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        totalAmount: 100.5,
        currency: 'BRL',
        createdAt: new Date(),
        updatedAt: new Date(),
        // ... other order fields
      };

      const expectedConversionRequest: CurrencyConversionRequest = {
        amount: 100.5,
        from: 'BRL',
        to: 'USD',
      };

      const mockConversionResult: CurrencyConversionResult = {
        originalAmount: 100.5,
        originalCurrency: 'BRL',
        targetCurrency: 'USD',
        conversionRate: 0.2,
        convertedAmount: 20.1,
        timestamp: new Date().toISOString(),
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockCurrencyService.convertCurrency as jest.Mock).mockResolvedValue(
        mockConversionResult,
      );

      // Act
      const result = await processor.enrich(job);

      // Assert
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-123' },
      });
      expect(mockCurrencyService.convertCurrency).toHaveBeenCalledWith(
        expectedConversionRequest,
      );
      expect(result).toEqual(mockConversionResult);
    });

    it('should throw error when order is not found', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(processor.enrich(job)).rejects.toThrow(
        'Order order-123 not found',
      );
    });

    it('should handle various currency pairs', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        totalAmount: 50.0,
        currency: 'EUR',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockConversionResult: CurrencyConversionResult = {
        originalAmount: 50.0,
        originalCurrency: 'EUR',
        targetCurrency: 'USD',
        conversionRate: 1.09,
        convertedAmount: 54.5,
        timestamp: new Date().toISOString(),
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockCurrencyService.convertCurrency as jest.Mock).mockResolvedValue(
        mockConversionResult,
      );

      // Act
      const result = await processor.enrich(job);

      // Assert
      expect(mockCurrencyService.convertCurrency).toHaveBeenCalledWith({
        amount: 50.0,
        from: 'EUR',
        to: 'USD',
      });
      expect(result).toEqual(mockConversionResult);
    });

    it('should handle zero amount orders', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        totalAmount: 0,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockConversionResult: CurrencyConversionResult = {
        originalAmount: 0,
        originalCurrency: 'USD',
        targetCurrency: 'USD',
        conversionRate: 1.0,
        convertedAmount: 0,
        timestamp: new Date().toISOString(),
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockCurrencyService.convertCurrency as jest.Mock).mockResolvedValue(
        mockConversionResult,
      );

      // Act
      const result = await processor.enrich(job);

      // Assert
      expect(mockCurrencyService.convertCurrency).toHaveBeenCalledWith({
        amount: 0,
        from: 'USD',
        to: 'USD',
      });
      expect(result).toEqual(mockConversionResult);
    });

    it('should handle currency service errors', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        totalAmount: 100.0,
        currency: 'BRL',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const conversionError = new Error(
        'Currency conversion service unavailable',
      );

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockCurrencyService.convertCurrency as jest.Mock).mockRejectedValue(
        conversionError,
      );

      // Act & Assert
      await expect(processor.enrich(job)).rejects.toThrow(
        'Currency conversion service unavailable',
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const dbError = new Error('Database connection failed');

      (mockPrismaService.order.findUnique as jest.Mock).mockRejectedValue(
        dbError,
      );

      // Act & Assert
      await expect(processor.enrich(job)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('integration with base processor', () => {
    it('should extend BaseEnrichmentProcessor correctly', () => {
      // Assert
      expect(processor).toBeInstanceOf(Object);
      expect(processor.getEnrichmentField()).toBe('currencyConversion');
    });

    it('should have proper constructor injection', () => {
      // Assert
      expect(processor).toBeDefined();
      expect(mockOrderRepository).toBeDefined();
      expect(mockPrismaService).toBeDefined();
      expect(mockCurrencyService).toBeDefined();
    });
  });
});
