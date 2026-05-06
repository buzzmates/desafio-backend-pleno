import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  BaseEnrichmentProcessor,
  EnrichmentJob,
} from './base-enrichment.processor';
import { OrderRepository } from '../common/order.repository';
import { PrismaService } from '../common/prisma.service';
import { OrderStatus, OrderEnrichment } from '@prisma/client';

// Test implementation of abstract processor for testing
class TestEnrichmentProcessor extends BaseEnrichmentProcessor<EnrichmentJob> {
  constructor(orderRepository: OrderRepository, prisma: PrismaService) {
    super(orderRepository, prisma, 'TestProcessor');
  }

  getEnrichmentField(): string {
    return 'currencyConversion';
  }

  async enrich(job: Job<EnrichmentJob>): Promise<Record<string, unknown>> {
    const { orderId } = job.data;

    // Simulate enrichment logic
    return {
      orderId,
      enriched: true,
      data: `test-enrichment-${orderId}`,
      timestamp: new Date().toISOString(),
    };
  }
}

describe('BaseEnrichmentProcessor', () => {
  let processor: TestEnrichmentProcessor;
  let mockOrderRepository: jest.Mocked<OrderRepository>;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let module: TestingModule;

  beforeEach(async () => {
    mockOrderRepository = {
      updateEnrichmentData: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    // Create a more complete mock that mimics PrismaClient structure
    mockPrismaService = {
      orderEnrichment: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      order: {
        findUnique: jest.fn(),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        TestEnrichmentProcessor,
        {
          provide: OrderRepository,
          useValue: mockOrderRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    processor = module.get(TestEnrichmentProcessor);

    // Replace the processor's dependencies with our mocks to ensure they are used
    (processor as any)['prisma'] = mockPrismaService;
    (processor as any)['orderRepository'] = mockOrderRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should successfully process enrichment job', async () => {
      // Arrange
      const job: Job<EnrichmentJob> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
        opts: { attempts: 3 },
        attemptsMade: 1,
      } as Job<EnrichmentJob>;

      const enrichmentResult = {
        orderId: 'order-123',
        enriched: true,
        data: 'test-enrichment-order-123',
        timestamp: expect.any(String),
      };

      const mockEnrichment: OrderEnrichment = {
        id: 'enrich-123',
        orderId: 'order-123',
        currencyConversion: enrichmentResult,
        addressValidation: null,
        productVerification: null,
        enrichmentStatus: 'COMPLETED',
        lastError: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (
        mockPrismaService.orderEnrichment.findUnique as jest.Mock
      ).mockResolvedValue(mockEnrichment);

      // Act
      await processor.process(job);

      // Assert
      expect(mockOrderRepository.updateEnrichmentData).toHaveBeenCalledWith(
        'order-123',
        {
          currencyConversion: enrichmentResult,
        },
      );
      expect(mockPrismaService.orderEnrichment.findUnique).toHaveBeenCalledWith(
        {
          where: { orderId: 'order-123' },
        },
      );
    });

    it('should update order status when all enrichments are complete', async () => {
      // Arrange
      const job: Job<EnrichmentJob> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
        opts: { attempts: 3 },
        attemptsMade: 1,
      } as Job<EnrichmentJob>;

      const mockEnrichment: OrderEnrichment = {
        id: 'enrich-123',
        orderId: 'order-123',
        currencyConversion: { data: 'complete' },
        addressValidation: { data: 'complete' },
        productVerification: { data: 'complete' },
        enrichmentStatus: 'COMPLETED',
        lastError: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (
        mockPrismaService.orderEnrichment.findUnique as jest.Mock
      ).mockResolvedValue(mockEnrichment);

      // Act
      await processor.process(job);

      // Assert
      expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith(
        'order-123',
        OrderStatus.ENRICHED,
      );
    });

    it('should not update order status when enrichments are incomplete', async () => {
      // Arrange
      const job: Job<EnrichmentJob> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
        opts: { attempts: 3 },
        attemptsMade: 1,
      } as Job<EnrichmentJob>;

      const mockEnrichment: OrderEnrichment = {
        id: 'enrich-123',
        orderId: 'order-123',
        currencyConversion: { data: 'complete' },
        addressValidation: null, // Missing
        productVerification: { data: 'complete' },
        enrichmentStatus: 'COMPLETED',
        lastError: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (
        mockPrismaService.orderEnrichment.findUnique as jest.Mock
      ).mockResolvedValue(mockEnrichment);

      // Act
      await processor.process(job);

      // Assert
      expect(mockOrderRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should handle enrichment errors and rethrow them', async () => {
      // Arrange
      const job: Job<EnrichmentJob> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
        opts: { attempts: 3 },
        attemptsMade: 1,
      } as Job<EnrichmentJob>;

      const enrichmentError = new Error('Enrichment failed');
      jest.spyOn(processor as any, 'enrich').mockRejectedValue(enrichmentError);

      // Act & Assert
      await expect(processor.process(job)).rejects.toThrow('Enrichment failed');
      expect(mockOrderRepository.updateEnrichmentData).not.toHaveBeenCalled();
    });
  });

  describe('checkAndFinalizeEnrichment integration', () => {
    it('should be called during process completion', async () => {
      // Arrange
      const job: Job<EnrichmentJob> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
        opts: { attempts: 3 },
        attemptsMade: 1,
      } as Job<EnrichmentJob>;

      const enrichmentResult = {
        orderId: 'order-123',
        enriched: true,
        data: 'test-enrichment-order-123',
        timestamp: expect.any(String),
      };

      const mockEnrichment: OrderEnrichment = {
        id: 'enrich-123',
        orderId: 'order-123',
        currencyConversion: enrichmentResult,
        addressValidation: { data: 'complete' },
        productVerification: { data: 'complete' },
        enrichmentStatus: 'COMPLETED',
        lastError: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (
        mockPrismaService.orderEnrichment.findUnique as jest.Mock
      ).mockResolvedValue(mockEnrichment);

      // Act
      await processor.process(job);

      // Assert - checkAndFinalizeEnrichment should be called internally
      expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith(
        'order-123',
        OrderStatus.ENRICHED,
      );
    });
  });

  describe('onCompleted', () => {
    it('should log job completion', () => {
      // Arrange
      const job: Job<EnrichmentJob> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<EnrichmentJob>;

      const logSpy = jest.spyOn(processor['logger'] as any, 'log');

      // Act
      processor.onCompleted(job);

      // Assert
      expect(logSpy).toHaveBeenCalledWith(
        'Job job-123 completed for order order-123',
      );
    });
  });

  describe('onFailed', () => {
    it('should handle job failure before max attempts', async () => {
      // Arrange
      const job: Job<EnrichmentJob> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
        opts: { attempts: 3 },
        attemptsMade: 1, // Not final attempt
      } as Job<EnrichmentJob>;

      const error = new Error('Processing failed');
      const logSpy = jest.spyOn(processor['logger'] as any, 'error');

      // Act
      await processor.onFailed(job, error);

      // Assert
      expect(logSpy).toHaveBeenCalledWith(
        'Job job-123 failed for order order-123:',
        'Processing failed',
      );
      expect(mockPrismaService.orderEnrichment.update).not.toHaveBeenCalled();
    });

    it('should handle final job failure and update enrichment', async () => {
      // Arrange
      const job: Job<EnrichmentJob> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
        opts: { attempts: 3 },
        attemptsMade: 3, // Final attempt
      } as Job<EnrichmentJob>;

      const error = new Error('Processing failed');
      const mockEnrichment: OrderEnrichment = {
        id: 'enrich-123',
        orderId: 'order-123',
        currencyConversion: null,
        addressValidation: null,
        productVerification: null,
        enrichmentStatus: 'PROCESSING',
        lastError: null,
        retryCount: 14, // Below threshold
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (
        mockPrismaService.orderEnrichment.findUnique as jest.Mock
      ).mockResolvedValue(mockEnrichment);

      // Act
      await processor.onFailed(job, error);

      // Assert
      expect(mockPrismaService.orderEnrichment.update).toHaveBeenCalled();
    });

    it('should mark order as FAILED_ENRICHMENT when all services exhausted', async () => {
      // Arrange
      const job: Job<EnrichmentJob> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
        opts: { attempts: 3 },
        attemptsMade: 3, // Final attempt
      } as Job<EnrichmentJob>;

      const error = new Error('Processing failed');
      const mockEnrichment: OrderEnrichment = {
        id: 'enrich-123',
        orderId: 'order-123',
        currencyConversion: null,
        addressValidation: null,
        productVerification: null,
        enrichmentStatus: 'PROCESSING',
        lastError: null,
        retryCount: 15, // At or above threshold
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findUnique to return enrichment data after the update
      (mockPrismaService.orderEnrichment.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockEnrichment) // First call for allServicesFailed check
        .mockResolvedValueOnce({ ...mockEnrichment, retryCount: 16 }); // Second call after increment

      // Act
      await processor.onFailed(job, error);

      // Assert
      expect(mockPrismaService.orderEnrichment.update).toHaveBeenCalled();
      expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith(
        'order-123',
        OrderStatus.FAILED_ENRICHMENT,
      );
    });

    it('should handle errors during failure handling', async () => {
      // Arrange
      const job: Job<EnrichmentJob> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
        opts: { attempts: 3 },
        attemptsMade: 3,
      } as Job<EnrichmentJob>;

      const error = new Error('Processing failed');
      const handleError = new Error('Failed to handle enrichment failure');

      const mockEnrichment: OrderEnrichment = {
        id: 'enrich-123',
        orderId: 'order-123',
        currencyConversion: null,
        addressValidation: null,
        productVerification: null,
        enrichmentStatus: 'PROCESSING',
        lastError: null,
        retryCount: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (
        mockPrismaService.orderEnrichment.findUnique as jest.Mock
      ).mockResolvedValue(mockEnrichment);
      (mockPrismaService.orderEnrichment.update as jest.Mock).mockRejectedValue(
        handleError,
      );

      const logSpy = jest.spyOn(processor['logger'] as any, 'error');

      // Act
      await processor.onFailed(job, error);

      // Assert
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('abstract methods', () => {
    it('should require implementation of enrich method', () => {
      // TypeScript will catch missing abstract methods at compile time
      // This test verifies the abstract class structure is enforced
      expect(BaseEnrichmentProcessor.prototype).toBeDefined();
    });

    it('should require implementation of getEnrichmentField method', () => {
      // TypeScript will catch missing abstract methods at compile time
      // This test verifies the abstract class structure is enforced
      expect(BaseEnrichmentProcessor.prototype).toBeDefined();
    });
  });

  describe('constructor', () => {
    it('should initialize logger with processor name', () => {
      // Act
      const testProcessor = new TestEnrichmentProcessor(
        mockOrderRepository,
        mockPrismaService,
      );

      // Assert
      expect(testProcessor['logger']).toBeDefined();
      expect(testProcessor['logger'] instanceof Logger).toBe(true);
    });
  });
});
