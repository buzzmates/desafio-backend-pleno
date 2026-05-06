import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import {
  OrderRepository,
  FindAllOptions,
  PaginatedOrders,
} from '../common/order.repository';
import { Order, OrderStatus, Prisma } from '@prisma/client';

describe('OrdersService', () => {
  let service: OrdersService;
  let mockOrderRepository: jest.Mocked<OrderRepository>;

  beforeEach(async () => {
    mockOrderRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrderRepository,
          useValue: mockOrderRepository,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated orders with default options', async () => {
      // Arrange
      const orders = [
        {
          id: 'order-1',
          externalOrderId: 'ext-1',
          idempotencyKey: 'key-1',
          customerEmail: 'test@example.com',
          customerName: 'Test Customer',
          currency: 'BRL',
          totalAmount: new Prisma.Decimal(100),
          status: OrderStatus.RECEIVED,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
        } as Order & { items: any[] },
        {
          id: 'order-2',
          externalOrderId: 'ext-2',
          idempotencyKey: 'key-2',
          customerEmail: 'test2@example.com',
          customerName: 'Test Customer 2',
          currency: 'BRL',
          totalAmount: new Prisma.Decimal(200),
          status: OrderStatus.ENRICHED,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
        } as Order & { items: any[] },
        {
          id: 'order-3',
          externalOrderId: 'ext-3',
          idempotencyKey: 'key-3',
          customerEmail: 'test3@example.com',
          customerName: 'Test Customer 3',
          currency: 'BRL',
          totalAmount: new Prisma.Decimal(300),
          status: OrderStatus.FAILED_ENRICHMENT,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
        } as Order & { items: any[] },
      ];

      const expectedMeta = {
        page: 1,
        limit: 20,
        totalItems: 3,
        totalPages: 1,
      };

      const expectedResult: PaginatedOrders = {
        data: orders,
        meta: expectedMeta,
      };

      mockOrderRepository.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith({});
    });

    it('should return paginated orders with custom options', async () => {
      // Arrange
      const options: FindAllOptions = {
        status: OrderStatus.RECEIVED,
        page: 2,
        limit: 10,
      };

      const orders = [
        {
          id: 'test-order',
          externalOrderId: 'ext-order',
          idempotencyKey: 'test-key',
          customerEmail: 'test@example.com',
          customerName: 'Test Customer',
          currency: 'BRL',
          totalAmount: new Prisma.Decimal(100),
          status: OrderStatus.RECEIVED,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
        } as Order & { items: any[] },
      ];

      const expectedMeta = {
        page: 2,
        limit: 10,
        totalItems: 25,
        totalPages: 3,
      };

      const expectedResult: PaginatedOrders = {
        data: orders,
        meta: expectedMeta,
      };

      mockOrderRepository.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await service.findAll(options);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith(options);
    });

    it('should handle empty result set', async () => {
      // Arrange
      const options: FindAllOptions = {
        status: OrderStatus.FAILED_ENRICHMENT,
      };

      const expectedResult: PaginatedOrders = {
        data: [],
        meta: {
          page: 1,
          limit: 20,
          totalItems: 0,
          totalPages: 0,
        },
      };

      mockOrderRepository.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await service.findAll(options);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith(options);
    });

    it('should handle repository errors', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockOrderRepository.findAll.mockRejectedValue(error);

      // Act & Assert
      await expect(service.findAll({})).rejects.toThrow(
        'Database connection failed',
      );
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith({});
    });
  });

  describe('findById', () => {
    it('should return order when found', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const expectedOrder = {
        id: orderId,
        externalOrderId: 'ext-order',
        idempotencyKey: 'test-key',
        customerEmail: 'test@example.com',
        customerName: 'Test Customer',
        currency: 'BRL',
        totalAmount: new Prisma.Decimal(100),
        status: OrderStatus.RECEIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      } as Order & { items: any[] };

      mockOrderRepository.findById.mockResolvedValue(expectedOrder);

      // Act
      const result = await service.findById(orderId);

      // Assert
      expect(result).toEqual(expectedOrder);
      expect(mockOrderRepository.findById).toHaveBeenCalledWith(orderId);
    });

    it('should return null when order not found', async () => {
      // Arrange
      const orderId = 'non-existent-id';
      mockOrderRepository.findById.mockResolvedValue(null);

      // Act
      const result = await service.findById(orderId);

      // Assert
      expect(result).toBeNull();
      expect(mockOrderRepository.findById).toHaveBeenCalledWith(orderId);
    });

    it('should handle repository errors during findById', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const error = new Error('Database query failed');
      mockOrderRepository.findById.mockRejectedValue(error);

      // Act & Assert
      await expect(service.findById(orderId)).rejects.toThrow(
        'Database query failed',
      );
      expect(mockOrderRepository.findById).toHaveBeenCalledWith(orderId);
    });
  });
});
