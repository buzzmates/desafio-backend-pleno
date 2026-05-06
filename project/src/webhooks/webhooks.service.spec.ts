import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService, ProcessOrderResult } from './webhooks.service';
import { OrderRepository } from '../common/order.repository';
import { QueueService } from '../queue/queue.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, Prisma } from '@prisma/client';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let mockOrderRepository: jest.Mocked<OrderRepository>;
  let mockQueueService: jest.Mocked<QueueService>;

  beforeEach(async () => {
    mockOrderRepository = {
      findByIdempotencyKey: jest.fn(),
      create: jest.fn(),
    } as any;

    mockQueueService = {
      enqueueOrder: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: OrderRepository,
          useValue: mockOrderRepository,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processOrder', () => {
    it('should process a new order successfully', async () => {
      // Arrange
      const dto = {
        order_id: 'order-123',
        customer: {
          email: 'test@example.com',
          name: 'John Doe',
        },
        items: [
          {
            sku: 'SKU-001',
            qty: 2,
            unit_price: 50.0,
          },
        ],
        currency: 'BRL',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      };
      const expectedOrder = {
        id: 'test-order-id',
        externalOrderId: dto.order_id,
        idempotencyKey: dto.idempotency_key,
        customerEmail: dto.customer.email,
        customerName: dto.customer.name,
        currency: dto.currency,
        totalAmount: new Prisma.Decimal(150.0),
        status: OrderStatus.RECEIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      mockOrderRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockOrderRepository.create.mockResolvedValue(expectedOrder);
      mockQueueService.enqueueOrder.mockResolvedValue();

      // Act
      const result = await service.processOrder(dto);

      // Assert
      expect(result).toEqual<ProcessOrderResult>({
        orderId: 'test-order-id',
        isNew: true,
      });

      expect(mockOrderRepository.findByIdempotencyKey).toHaveBeenCalledWith(
        dto.idempotency_key,
      );
      expect(mockOrderRepository.create).toHaveBeenCalledWith({
        id: expect.any(String),
        externalOrderId: dto.order_id,
        idempotencyKey: dto.idempotency_key,
        customerEmail: dto.customer.email,
        customerName: dto.customer.name,
        currency: dto.currency,
        totalAmount: expect.any(Prisma.Decimal),
        status: OrderStatus.RECEIVED,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        items: {
          data: dto.items.map((item) => ({
            id: expect.any(String),
            sku: item.sku,
            quantity: item.qty,
            unitPrice: expect.any(Prisma.Decimal),
          })),
        },
      });

      expect(mockQueueService.enqueueOrder).toHaveBeenCalledWith(
        'test-order-id',
      );
    });

    it('should handle duplicate order with existing idempotency key', async () => {
      // Arrange
      const dto = {
        order_id: 'order-123',
        customer: {
          email: 'test@example.com',
          name: 'John Doe',
        },
        items: [
          {
            sku: 'SKU-001',
            qty: 2,
            unit_price: 50.0,
          },
        ],
        currency: 'BRL',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      };
      const existingOrder = {
        id: 'existing-order-id',
        externalOrderId: dto.order_id,
        idempotencyKey: dto.idempotency_key,
        customerEmail: dto.customer.email,
        customerName: dto.customer.name,
        currency: dto.currency,
        totalAmount: new Prisma.Decimal(100.0),
        status: OrderStatus.RECEIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      mockOrderRepository.findByIdempotencyKey.mockResolvedValue(existingOrder);

      // Act
      const result = await service.processOrder(dto);

      // Assert
      expect(result).toEqual<ProcessOrderResult>({
        orderId: 'existing-order-id',
        isNew: false,
      });

      expect(mockOrderRepository.findByIdempotencyKey).toHaveBeenCalledWith(
        dto.idempotency_key,
      );
      expect(mockOrderRepository.create).not.toHaveBeenCalled();
      expect(mockQueueService.enqueueOrder).not.toHaveBeenCalled();
    });

    it('should calculate total amount correctly for multiple items', async () => {
      // Arrange
      const dto = {
        order_id: 'order-123',
        customer: {
          email: 'test@example.com',
          name: 'John Doe',
        },
        items: [
          { sku: 'ITEM-001', qty: 2, unit_price: 50.0 },
          { sku: 'ITEM-002', qty: 3, unit_price: 25.0 },
        ],
        currency: 'BRL',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      };

      const expectedOrder = {
        id: 'test-order-id',
        externalOrderId: dto.order_id,
        idempotencyKey: dto.idempotency_key,
        customerEmail: dto.customer.email,
        customerName: dto.customer.name,
        currency: dto.currency,
        totalAmount: new Prisma.Decimal(175.0), // 2*50 + 3*25 = 175
        status: OrderStatus.RECEIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      mockOrderRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockOrderRepository.create.mockResolvedValue(expectedOrder);
      mockQueueService.enqueueOrder.mockResolvedValue();

      // Act
      const result = await service.processOrder(dto);

      // Assert
      expect(mockOrderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalAmount: new Prisma.Decimal(175.0),
        }),
      );
      expect(result.orderId).toBe('test-order-id');
      expect(result.isNew).toBe(true);
    });

    it('should handle single item order correctly', async () => {
      // Arrange
      const dto = {
        order_id: 'order-123',
        customer: {
          email: 'test@example.com',
          name: 'John Doe',
        },
        items: [{ sku: 'SINGLE-ITEM', qty: 1, unit_price: 99.99 }],
        currency: 'BRL',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      };

      const expectedOrder = {
        id: 'test-order-id',
        externalOrderId: dto.order_id,
        idempotencyKey: dto.idempotency_key,
        customerEmail: dto.customer.email,
        customerName: dto.customer.name,
        currency: dto.currency,
        totalAmount: new Prisma.Decimal(99.99),
        status: OrderStatus.RECEIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      mockOrderRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockOrderRepository.create.mockResolvedValue(expectedOrder);
      mockQueueService.enqueueOrder.mockResolvedValue();

      // Act
      const result = await service.processOrder(dto);

      // Assert
      expect(mockOrderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalAmount: new Prisma.Decimal(99.99),
        }),
      );
      expect(result.orderId).toBe('test-order-id');
      expect(result.isNew).toBe(true);
    });

    it('should process order items with correct structure', async () => {
      // Arrange
      const dto = {
        order_id: 'order-123',
        customer: {
          email: 'test@example.com',
          name: 'John Doe',
        },
        items: [
          {
            sku: 'SKU-001',
            qty: 2,
            unit_price: 50.0,
          },
        ],
        currency: 'BRL',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      };
      const expectedOrder = {
        id: 'test-order-id',
        externalOrderId: dto.order_id,
        idempotencyKey: dto.idempotency_key,
        customerEmail: dto.customer.email,
        customerName: dto.customer.name,
        currency: dto.currency,
        totalAmount: new Prisma.Decimal(100.0),
        status: OrderStatus.RECEIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      mockOrderRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockOrderRepository.create.mockResolvedValue(expectedOrder);
      mockQueueService.enqueueOrder.mockResolvedValue();

      // Act
      await service.processOrder(dto);

      // Assert
      expect(mockOrderRepository.create).toHaveBeenCalledWith({
        id: expect.any(String),
        externalOrderId: dto.order_id,
        idempotencyKey: dto.idempotency_key,
        customerEmail: dto.customer.email,
        customerName: dto.customer.name,
        currency: dto.currency,
        totalAmount: expect.any(Prisma.Decimal),
        status: OrderStatus.RECEIVED,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        items: {
          data: dto.items.map((item) => ({
            id: expect.any(String),
            sku: item.sku,
            quantity: item.qty,
            unitPrice: new Prisma.Decimal(item.unit_price),
          })),
        },
      });
    });

    it('should handle repository errors during order creation', async () => {
      // Arrange
      const dto = {
        order_id: 'order-123',
        customer: {
          email: 'test@example.com',
          name: 'John Doe',
        },
        items: [
          {
            sku: 'SKU-001',
            qty: 2,
            unit_price: 50.0,
          },
        ],
        currency: 'BRL',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      };
      const error = new Error('Database connection failed');

      mockOrderRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockOrderRepository.create.mockRejectedValue(error);

      // Act & Assert
      await expect(service.processOrder(dto)).rejects.toThrow(
        'Database connection failed',
      );
      expect(mockQueueService.enqueueOrder).not.toHaveBeenCalled();
    });

    it('should handle queue service errors after order creation', async () => {
      // Arrange
      const dto = {
        order_id: 'order-123',
        customer: {
          email: 'test@example.com',
          name: 'John Doe',
        },
        items: [
          {
            sku: 'SKU-001',
            qty: 2,
            unit_price: 50.0,
          },
        ],
        currency: 'BRL',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      };
      const expectedOrder = {
        id: 'test-order-id',
        externalOrderId: dto.order_id,
        idempotencyKey: dto.idempotency_key,
        customerEmail: dto.customer.email,
        customerName: dto.customer.name,
        currency: dto.currency,
        totalAmount: new Prisma.Decimal(100.0),
        status: OrderStatus.RECEIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      mockOrderRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockOrderRepository.create.mockResolvedValue(expectedOrder);
      mockQueueService.enqueueOrder.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      // Act & Assert
      await expect(service.processOrder(dto)).rejects.toThrow(
        'Redis connection failed',
      );
      expect(mockOrderRepository.create).toHaveBeenCalled();
    });

    it('should handle repository errors during idempotency check', async () => {
      // Arrange
      const dto = {
        order_id: 'order-123',
        customer: {
          email: 'test@example.com',
          name: 'John Doe',
        },
        items: [
          {
            sku: 'SKU-001',
            qty: 2,
            unit_price: 50.0,
          },
        ],
        currency: 'BRL',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      };
      const error = new Error('Repository query failed');

      mockOrderRepository.findByIdempotencyKey.mockRejectedValue(error);

      // Act & Assert
      await expect(service.processOrder(dto)).rejects.toThrow(
        'Repository query failed',
      );
      expect(mockOrderRepository.create).not.toHaveBeenCalled();
      expect(mockQueueService.enqueueOrder).not.toHaveBeenCalled();
    });

    it('should generate unique IDs for order and items', async () => {
      // Arrange
      const dto = {
        order_id: 'order-123',
        customer: {
          email: 'test@example.com',
          name: 'John Doe',
        },
        items: [
          {
            sku: 'SKU-001',
            qty: 2,
            unit_price: 50.0,
          },
        ],
        currency: 'BRL',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      };
      const expectedOrder = {
        id: 'test-order-id',
        externalOrderId: dto.order_id,
        idempotencyKey: dto.idempotency_key,
        customerEmail: dto.customer.email,
        customerName: dto.customer.name,
        currency: dto.currency,
        totalAmount: new Prisma.Decimal(100.0),
        status: OrderStatus.RECEIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      mockOrderRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockOrderRepository.create.mockResolvedValue(expectedOrder);
      mockQueueService.enqueueOrder.mockResolvedValue();

      // Act
      await service.processOrder(dto);

      // Assert
      const createCall = mockOrderRepository.create.mock.calls[0][0];
      expect(createCall.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ); // UUID format

      // Check that all items have unique IDs
      const itemsData = createCall.items.data as any[];
      const itemIds = itemsData.map((item: any) => item.id);
      expect(new Set(itemIds).size).toBe(itemIds.length);
      expect(
        itemIds.every((id: string) =>
          id.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
          ),
        ),
      ).toBe(true);
    });

    it('should set correct timestamps for order creation', async () => {
      // Arrange
      const dto = {
        order_id: 'order-123',
        customer: {
          email: 'test@example.com',
          name: 'John Doe',
        },
        items: [
          {
            sku: 'SKU-001',
            qty: 2,
            unit_price: 50.0,
          },
        ],
        currency: 'BRL',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      };
      const expectedOrder = {
        id: 'test-order-id',
        externalOrderId: dto.order_id,
        idempotencyKey: dto.idempotency_key,
        customerEmail: dto.customer.email,
        customerName: dto.customer.name,
        currency: dto.currency,
        totalAmount: new Prisma.Decimal(100.0),
        status: OrderStatus.RECEIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      mockOrderRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockOrderRepository.create.mockResolvedValue(expectedOrder);
      mockQueueService.enqueueOrder.mockResolvedValue();

      // Act
      await service.processOrder(dto);

      // Assert
      const createCall = mockOrderRepository.create.mock.calls[0][0];
      expect(createCall.createdAt).toBeInstanceOf(Date);
      expect(createCall.updatedAt).toBeInstanceOf(Date);
      expect(new Date(createCall.createdAt).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
      expect(new Date(createCall.updatedAt).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
    });
  });
});
