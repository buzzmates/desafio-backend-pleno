import { Test, TestingModule } from '@nestjs/testing';
import { OrderRepository } from './order.repository';
import { PrismaService } from './prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';

// Simple test helpers to replace factory dependencies
const createOrder = (overrides: any = {}) => ({
  id: 'test-order-id',
  externalOrderId: 'ext-123',
  idempotencyKey: 'test-key',
  customerEmail: 'test@example.com',
  customerName: 'Test Customer',
  currency: 'USD',
  totalAmount: 100,
  status: OrderStatus.RECEIVED,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createOrderWithItems = (overrides: any = {}) => ({
  ...createOrder(overrides),
  items: {
    data: [
      { id: 'item-1', sku: 'SKU1', quantity: 2, unitPrice: 50 },
      { id: 'item-2', sku: 'SKU2', quantity: 1, unitPrice: 50 },
    ],
  },
});

const createEnrichment = (overrides: any = {}) => ({
  id: 'enrichment-id',
  orderId: 'test-order-id',
  currencyConversion: null,
  addressValidation: null,
  productVerification: null,
  enrichmentStatus: 'PENDING',
  lastError: null,
  retryCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('OrderRepository', () => {
  let repository: OrderRepository;
  let prismaService: PrismaService;
  let mockPrisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrismaService = {
      order: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
      },
      orderItem: {
        createMany: jest.fn().mockResolvedValue({}),
      },
      orderEnrichment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<OrderRepository>(OrderRepository);
    prismaService = module.get<PrismaService>(PrismaService);
    mockPrisma = mockPrismaService as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an order with items successfully', async () => {
      // Arrange
      const orderData = createOrderWithItems();
      const expectedOrder = { ...orderData, items: orderData.items.data };

      ((mockPrisma.order as any).create as jest.Mock).mockResolvedValue(
        expectedOrder,
      );

      // Act
      const result = await repository.create(orderData);

      // Assert
      expect((mockPrisma.order as any).create).toHaveBeenCalledWith({
        data: {
          ...orderData,
          items: orderData.items,
        },
        include: { items: true },
      });
      expect(result).toEqual(expectedOrder);
    });

    it('should handle database errors during order creation', async () => {
      // Arrange
      const orderData = createOrderWithItems();
      const error = new Error('Database connection failed');
      (mockPrisma.order as any).create.mockRejectedValue(error);

      // Act & Assert
      await expect(repository.create(orderData)).rejects.toThrow(error);
      expect((mockPrisma.order as any).create).toHaveBeenCalledWith({
        data: {
          ...orderData,
          items: orderData.items,
        },
        include: { items: true },
      });
    });
  });

  describe('findById', () => {
    it('should find an order by ID with items', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const expectedOrder = createOrder({ id: orderId });

      (mockPrisma.order as any).findUnique.mockResolvedValue(expectedOrder);

      // Act
      const result = await repository.findById(orderId);

      // Assert
      expect((mockPrisma.order as any).findUnique).toHaveBeenCalledWith({
        where: { id: orderId },
        include: { items: true },
      });
      expect(result).toEqual(expectedOrder);
    });

    it('should return null when order is not found', async () => {
      // Arrange
      const orderId = 'non-existent-id';
      (mockPrisma.order as any).findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.findById(orderId);

      // Assert
      expect((mockPrisma.order as any).findUnique).toHaveBeenCalledWith({
        where: { id: orderId },
        include: { items: true },
      });
      expect(result).toBeNull();
    });
  });

  describe('findByExternalId', () => {
    it('should find an order by external order ID', async () => {
      // Arrange
      const externalOrderId = 'ext-123';
      const expectedOrder = createOrder({ externalOrderId });

      (mockPrisma.order as any).findUnique.mockResolvedValue(expectedOrder);

      // Act
      const result = await repository.findByExternalId(externalOrderId);

      // Assert
      expect((mockPrisma.order as any).findUnique).toHaveBeenCalledWith({
        where: { externalOrderId },
        include: { items: true },
      });
      expect(result).toEqual(expectedOrder);
    });

    it('should return null when external order ID is not found', async () => {
      // Arrange
      const externalOrderId = 'non-existent-ext';
      (mockPrisma.order as any).findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.findByExternalId(externalOrderId);

      // Assert
      expect((mockPrisma.order as any).findUnique).toHaveBeenCalledWith({
        where: { externalOrderId },
        include: { items: true },
      });
      expect(result).toBeNull();
    });
  });

  describe('findByIdempotencyKey', () => {
    it('should find an order by idempotency key', async () => {
      // Arrange
      const idempotencyKey = 'test-key';
      const expectedOrder = createOrder({ idempotencyKey });

      (mockPrisma.order as any).findUnique.mockResolvedValue(expectedOrder);

      // Act
      const result = await repository.findByIdempotencyKey(idempotencyKey);

      // Assert
      expect((mockPrisma.order as any).findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey },
        include: { items: true },
      });
      expect(result).toEqual(expectedOrder);
    });

    it('should return null when idempotency key is not found', async () => {
      // Arrange
      const idempotencyKey = 'non-existent-key';
      (mockPrisma.order as any).findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.findByIdempotencyKey(idempotencyKey);

      // Assert
      expect((mockPrisma.order as any).findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey },
        include: { items: true },
      });
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated orders with default options', async () => {
      // Arrange
      const orders = [createOrder(), createOrder(), createOrder()];
      const expectedMeta = {
        page: 1,
        limit: 20,
        totalItems: 3,
        totalPages: 1,
      };

      (mockPrisma.order as any).findMany.mockResolvedValue(orders);
      (mockPrisma.order as any).count.mockResolvedValue(3);

      // Act
      const result = await repository.findAll();

      // Assert
      expect((mockPrisma.order as any).findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      });
      expect((mockPrisma.order as any).count).toHaveBeenCalledWith({
        where: {},
      });
      expect(result).toEqual({
        data: orders,
        meta: expectedMeta,
      });
    });

    it('should return paginated orders with custom options', async () => {
      // Arrange
      const options = {
        status: OrderStatus.RECEIVED,
        page: 2,
        limit: 10,
      };
      const orders = [createOrder({ status: OrderStatus.RECEIVED })];
      const expectedMeta = {
        page: 2,
        limit: 10,
        totalItems: 25,
        totalPages: 3,
      };

      (mockPrisma.order as any).findMany.mockResolvedValue(orders);
      (mockPrisma.order as any).count.mockResolvedValue(25);

      // Act
      const result = await repository.findAll(options);

      // Assert
      expect((mockPrisma.order as any).findMany).toHaveBeenCalledWith({
        where: { status: OrderStatus.RECEIVED },
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      });
      expect((mockPrisma.order as any).count).toHaveBeenCalledWith({
        where: { status: OrderStatus.RECEIVED },
      });
      expect(result).toEqual({
        data: orders,
        meta: expectedMeta,
      });
    });

    it('should handle empty result set', async () => {
      // Arrange
      const options = { status: OrderStatus.FAILED_ENRICHMENT };

      (mockPrisma.order as any).findMany.mockResolvedValue([]);
      (mockPrisma.order as any).count.mockResolvedValue(0);

      // Act
      const result = await repository.findAll(options);

      // Assert
      expect(result).toEqual({
        data: [],
        meta: {
          page: 1,
          limit: 20,
          totalItems: 0,
          totalPages: 0,
        },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update order status successfully', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const newStatus = OrderStatus.ENRICHED;
      const expectedOrder = createOrder({
        id: orderId,
        status: newStatus,
      });

      (mockPrisma.order as any).update.mockResolvedValue(expectedOrder);

      // Act
      const result = await repository.updateStatus(orderId, newStatus);

      // Assert
      expect((mockPrisma.order as any).update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: {
          status: newStatus,
          updatedAt: expect.any(Date),
        },
        include: { items: true },
      });
      expect(result).toEqual(expectedOrder);
    });

    it('should handle status update errors', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const newStatus = OrderStatus.FAILED_ENRICHMENT;
      const error = new Error('Order not found');
      (mockPrisma.order as any).update.mockRejectedValue(error);

      // Act & Assert
      await expect(repository.updateStatus(orderId, newStatus)).rejects.toThrow(
        error,
      );
      expect((mockPrisma.order as any).update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: {
          status: newStatus,
          updatedAt: expect.any(Date),
        },
        include: { items: true },
      });
    });
  });

  describe('updateEnrichmentData', () => {
    it('should update existing enrichment data', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const enrichmentData = {
        currencyConversion: {
          fromCurrency: 'USD',
          toCurrency: 'BRL',
          rate: 5.25,
        },
        addressValidation: { isValid: true },
      };
      const existingEnrichment = createEnrichment({
        order: { connect: { id: orderId } },
      });

      (mockPrisma.orderEnrichment as any).findUnique.mockResolvedValue(
        existingEnrichment,
      );
      (mockPrisma.orderEnrichment as any).update.mockResolvedValue(
        existingEnrichment,
      );

      // Act
      await repository.updateEnrichmentData(orderId, enrichmentData);

      // Assert
      expect(
        (mockPrisma.orderEnrichment as any).findUnique,
      ).toHaveBeenCalledWith({
        where: { orderId },
      });
      expect((mockPrisma.orderEnrichment as any).update).toHaveBeenCalledWith({
        where: { orderId },
        data: {
          ...enrichmentData,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should create new enrichment data when none exists', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const enrichmentData = {
        productVerification: { sku: 'ABC123', isValid: true },
      };
      const newEnrichment = createEnrichment({
        order: { connect: { id: orderId } },
      });

      (mockPrisma.orderEnrichment as any).findUnique.mockResolvedValue(null);
      (mockPrisma.orderEnrichment as any).create.mockResolvedValue(
        newEnrichment,
      );

      // Act
      await repository.updateEnrichmentData(orderId, enrichmentData);

      // Assert
      expect(
        (mockPrisma.orderEnrichment as any).findUnique,
      ).toHaveBeenCalledWith({
        where: { orderId },
      });
      expect((mockPrisma.orderEnrichment as any).create).toHaveBeenCalledWith({
        data: {
          orderId,
          ...enrichmentData,
          enrichmentStatus: 'COMPLETED',
        },
      });
      expect((mockPrisma.orderEnrichment as any).update).not.toHaveBeenCalled();
    });

    it('should handle enrichment update errors', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const enrichmentData = { currencyConversion: { rate: 5.25 } };
      const error = new Error('Database constraint violation');

      (mockPrisma.orderEnrichment as any).findUnique.mockResolvedValue(null);
      (mockPrisma.orderEnrichment as any).create.mockRejectedValue(error);

      // Act & Assert
      await expect(
        repository.updateEnrichmentData(orderId, enrichmentData),
      ).rejects.toThrow(error);
      expect((mockPrisma.orderEnrichment as any).create).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle Prisma client errors', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const prismaError = new Error('Record not found') as any;
      prismaError.code = 'P2025';
      prismaError.clientVersion = '4.0.0';
      (mockPrisma.order as any).findUnique.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(repository.findById(orderId)).rejects.toThrow(prismaError);
    });

    it('should handle network timeouts', async () => {
      // Arrange
      const orderId = 'test-order-id';
      const timeoutError = new Error('Connection timeout');
      (mockPrisma.order as any).findUnique.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(repository.findById(orderId)).rejects.toThrow(timeoutError);
    });
  });
});
