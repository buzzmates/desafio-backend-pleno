import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ProductProcessor } from './product.processor';
import { OrderRepository } from '../../common/order.repository';
import { PrismaService } from '../../common/prisma.service';
import { ProductVerificationService } from '../services/product-verification.service';
import {
  ProductVerificationRequest,
  ProductVerificationResult,
} from '../dto/product-verification.dto';

describe('ProductProcessor', () => {
  let processor: ProductProcessor;
  let mockOrderRepository: jest.Mocked<OrderRepository>;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockProductService: jest.Mocked<ProductVerificationService>;
  let module: TestingModule;

  beforeEach(async () => {
    mockOrderRepository = {
      updateEnrichmentData: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    mockPrismaService = {
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      orderEnrichment: {
        findUnique: jest.fn(),
      },
    } as any;

    mockProductService = {
      verifyProduct: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        ProductProcessor,
        {
          provide: OrderRepository,
          useValue: mockOrderRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ProductVerificationService,
          useValue: mockProductService,
        },
      ],
    }).compile();

    processor = module.get(ProductProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEnrichmentField', () => {
    it('should return productVerification field name', () => {
      // Act
      const field = processor.getEnrichmentField();

      // Assert
      expect(field).toBe('productVerification');
    });
  });

  describe('enrich', () => {
    it('should successfully enrich product for valid order with items', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        items: [
          {
            id: 'item-1',
            sku: 'SKU-001',
            quantity: 2,
            unitPrice: 29.99,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'item-2',
            sku: 'SKU-002',
            quantity: 1,
            unitPrice: 89.99,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockVerificationResults: ProductVerificationResult[] = [
        {
          sku: 'SKU-001',
          isValid: true,
          name: 'Wireless Mouse',
          price: 29.99,
          stock: 150,
          isActive: true,
        },
        {
          sku: 'SKU-002',
          isValid: true,
          name: 'Mechanical Keyboard',
          price: 89.99,
          stock: 75,
          isActive: true,
        },
      ];

      const expectedEnrichment = {
        verificationResults: mockVerificationResults,
        totalItems: 2,
        verifiedItems: 2,
        failedItems: 0,
        timestamp: expect.any(String),
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockProductService.verifyProduct as jest.Mock)
        .mockResolvedValueOnce(mockVerificationResults[0])
        .mockResolvedValueOnce(mockVerificationResults[1]);

      // Act
      const result = await processor.enrich(job);

      // Assert
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        include: {
          items: true,
        },
      });
      expect(mockProductService.verifyProduct).toHaveBeenCalledTimes(2);
      expect(mockProductService.verifyProduct).toHaveBeenCalledWith({
        sku: 'SKU-001',
      });
      expect(mockProductService.verifyProduct).toHaveBeenCalledWith({
        sku: 'SKU-002',
      });
      expect(result).toEqual(expectedEnrichment);
    });

    it('should handle order with no items', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        items: [], // No items
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );

      // Act & Assert
      await expect(processor.enrich(job)).rejects.toThrow(
        'No items found for order order-123',
      );
      expect(mockProductService.verifyProduct).not.toHaveBeenCalled();
    });

    it('should handle mixed verification results', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        items: [
          {
            id: 'item-1',
            sku: 'SKU-001',
            quantity: 2,
            unitPrice: 29.99,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'item-2',
            sku: 'SKU-INVALID',
            quantity: 1,
            unitPrice: 99.99,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockVerificationResults: ProductVerificationResult[] = [
        {
          sku: 'SKU-001',
          isValid: true,
          name: 'Wireless Mouse',
          price: 29.99,
          stock: 150,
          isActive: true,
        },
        {
          sku: 'SKU-INVALID',
          isValid: false,
          error: 'Product not found',
        },
      ];

      const expectedEnrichment = {
        verificationResults: mockVerificationResults,
        totalItems: 2,
        verifiedItems: 1,
        failedItems: 1,
        timestamp: expect.any(String),
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockProductService.verifyProduct as jest.Mock)
        .mockResolvedValueOnce(mockVerificationResults[0])
        .mockResolvedValueOnce(mockVerificationResults[1]);

      // Act
      const result = await processor.enrich(job);

      // Assert
      expect(result).toEqual(expectedEnrichment);
    });

    it('should handle out of stock products', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        items: [
          {
            id: 'item-1',
            sku: 'SKU-003',
            quantity: 5,
            unitPrice: 19.99,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockVerificationResult: ProductVerificationResult = {
        sku: 'SKU-003',
        isValid: true,
        name: 'USB-C Hub',
        price: 19.99,
        stock: 0, // Out of stock
        isActive: true,
      };

      const expectedEnrichment = {
        verificationResults: [mockVerificationResult],
        totalItems: 1,
        verifiedItems: 1,
        failedItems: 0,
        timestamp: expect.any(String),
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockProductService.verifyProduct as jest.Mock).mockResolvedValue(
        mockVerificationResult,
      );

      // Act
      const result = await processor.enrich(job);

      // Assert
      expect(result).toEqual(expectedEnrichment);
    });

    it('should handle inactive products', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        items: [
          {
            id: 'item-1',
            sku: 'SKU-004',
            quantity: 1,
            unitPrice: 199.99,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockVerificationResult: ProductVerificationResult = {
        sku: 'SKU-004',
        isValid: true,
        name: 'Discontinued Product',
        price: 199.99,
        stock: 0,
        isActive: false, // Inactive
      };

      const expectedEnrichment = {
        verificationResults: [mockVerificationResult],
        totalItems: 1,
        verifiedItems: 1,
        failedItems: 0,
        timestamp: expect.any(String),
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockProductService.verifyProduct as jest.Mock).mockResolvedValue(
        mockVerificationResult,
      );

      // Act
      const result = await processor.enrich(job);

      // Assert
      expect(result).toEqual(expectedEnrichment);
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

    it('should handle product service errors', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        items: [
          {
            id: 'item-1',
            sku: 'SKU-001',
            quantity: 1,
            unitPrice: 29.99,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const productError = new Error(
        'Product verification service unavailable',
      );

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockProductService.verifyProduct as jest.Mock).mockRejectedValue(
        productError,
      );

      // Act & Assert
      await expect(processor.enrich(job)).rejects.toThrow(
        'Product verification service unavailable',
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
      expect(processor.getEnrichmentField()).toBe('productVerification');
    });

    it('should have proper constructor injection', () => {
      // Assert
      expect(processor).toBeDefined();
      expect(mockOrderRepository).toBeDefined();
      expect(mockPrismaService).toBeDefined();
      expect(mockProductService).toBeDefined();
    });
  });
});
