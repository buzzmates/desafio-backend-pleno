import { faker } from '@faker-js/faker';
import { OrderStatus, Prisma } from '@prisma/client';
import { CreateOrderDto } from '../../webhooks/dto/create-order.dto';

/**
 * Factory for creating test Order entities
 */
export class OrderFactory {
  static create(
    overrides: Partial<Prisma.OrderCreateInput> = {},
  ): Prisma.OrderCreateInput {
    return {
      id: faker.string.uuid(),
      externalOrderId: faker.string.alphanumeric(10),
      idempotencyKey: faker.string.uuid(),
      customerEmail: faker.internet.email(),
      customerName: faker.person.fullName(),
      currency: faker.finance.currencyCode(),
      totalAmount: faker.number.int({ min: 10, max: 1000 }),
      status: faker.helpers.arrayElement([
        OrderStatus.RECEIVED,
        OrderStatus.ENRICHING,
        OrderStatus.ENRICHED,
      ]),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createWithItems(
    overrides: Partial<Prisma.OrderCreateInput> = {},
  ): Prisma.OrderCreateInput & {
    items: Prisma.OrderItemCreateManyOrderInputEnvelope;
  } {
    const items = OrderItemFactory.createMany(
      faker.number.int({ min: 1, max: 3 }),
    );

    return {
      ...this.create(overrides),
      items: {
        data: items,
      },
    };
  }

  static createReceived(
    overrides: Partial<Prisma.OrderCreateInput> = {},
  ): Prisma.OrderCreateInput {
    return this.create({ ...overrides, status: OrderStatus.RECEIVED });
  }

  static createEnriching(
    overrides: Partial<Prisma.OrderCreateInput> = {},
  ): Prisma.OrderCreateInput {
    return this.create({ ...overrides, status: OrderStatus.ENRICHING });
  }

  static createEnriched(
    overrides: Partial<Prisma.OrderCreateInput> = {},
  ): Prisma.OrderCreateInput {
    return this.create({ ...overrides, status: OrderStatus.ENRICHED });
  }

  static createFailedEnrichment(
    overrides: Partial<Prisma.OrderCreateInput> = {},
  ): Prisma.OrderCreateInput {
    return this.create({ ...overrides, status: OrderStatus.FAILED_ENRICHMENT });
  }

  static fromDto(dto: CreateOrderDto): Prisma.OrderCreateInput {
    const totalAmount = dto.items.reduce(
      (sum, item) => sum + item.qty * item.unit_price,
      0,
    );

    return {
      id: faker.string.uuid(),
      externalOrderId: dto.order_id,
      idempotencyKey: dto.idempotency_key,
      customerEmail: dto.customer.email,
      customerName: dto.customer.name,
      currency: dto.currency,
      totalAmount: totalAmount,
      status: OrderStatus.RECEIVED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

/**
 * Factory for creating test OrderItem entities
 */
export class OrderItemFactory {
  static create(
    overrides: Partial<Prisma.OrderItemCreateInput> = {},
  ): Prisma.OrderItemCreateInput {
    return {
      id: faker.string.uuid(),
      order: { connect: { id: faker.string.uuid() } },
      sku: faker.commerce.product(),
      quantity: faker.number.int({ min: 1, max: 10 }),
      unitPrice: faker.number.int({ min: 1, max: 100 }),
      ...overrides,
    };
  }

  static createMany(
    count: number,
    overrides: Partial<Prisma.OrderItemCreateInput> = {},
  ): Prisma.OrderItemCreateInput[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createWithOrder(
    overrides: Partial<Prisma.OrderItemCreateInput> = {},
  ): Prisma.OrderItemCreateInput & { order: Prisma.OrderCreateInput } {
    const order = OrderFactory.create();

    return {
      ...this.create({ ...overrides, order: { connect: { id: order.id } } }),
      order,
    };
  }
}

/**
 * Factory for creating test OrderEnrichment entities
 */
export class OrderEnrichmentFactory {
  static create(
    overrides: Partial<Prisma.OrderEnrichmentCreateInput> = {},
  ): Prisma.OrderEnrichmentCreateInput {
    return {
      id: faker.string.uuid(),
      order: { connect: { id: faker.string.uuid() } },
      currencyConversion: {
        fromCurrency: 'USD',
        toCurrency: 'BRL',
        rate: 5.25,
        convertedAmount: faker.number.int({ min: 50, max: 500 }),
        timestamp: faker.date.recent().toISOString(),
      },
      addressValidation: {
        cep: faker.location.zipCode(),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        isValid: true,
        timestamp: faker.date.recent().toISOString(),
      },
      productVerification: {
        sku: faker.commerce.product(),
        isValid: true,
        price: faker.number.int({ min: 10, max: 100 }),
        stock: faker.number.int({ min: 0, max: 100 }),
        timestamp: faker.date.recent().toISOString(),
      },
      enrichmentStatus: faker.helpers.arrayElement([
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
      ]),
      lastError: null,
      retryCount: faker.number.int({ min: 0, max: 5 }),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createPartial(
    overrides: Partial<Prisma.OrderEnrichmentCreateInput> = {},
  ): Prisma.OrderEnrichmentCreateInput {
    return {
      id: faker.string.uuid(),
      order: { connect: { id: faker.string.uuid() } },
      enrichmentStatus: 'PENDING',
      retryCount: 0,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createWithCurrencyConversion(
    overrides: Partial<Prisma.OrderEnrichmentCreateInput> = {},
  ): Prisma.OrderEnrichmentCreateInput {
    return this.create({
      ...overrides,
      currencyConversion: {
        fromCurrency: 'USD',
        toCurrency: 'BRL',
        rate: 5.25,
        convertedAmount: faker.number.int({ min: 50, max: 500 }),
        timestamp: faker.date.recent().toISOString(),
      },
    });
  }

  static createWithAddressValidation(
    overrides: Partial<Prisma.OrderEnrichmentCreateInput> = {},
  ): Prisma.OrderEnrichmentCreateInput {
    return this.create({
      ...overrides,
      addressValidation: {
        cep: '01310-100',
        address: 'Rua Augusta, 1234',
        city: 'São Paulo',
        state: 'SP',
        isValid: true,
        timestamp: faker.date.recent().toISOString(),
      },
    });
  }

  static createWithProductVerification(
    overrides: Partial<Prisma.OrderEnrichmentCreateInput> = {},
  ): Prisma.OrderEnrichmentCreateInput {
    return this.create({
      ...overrides,
      productVerification: {
        sku: faker.commerce.product(),
        isValid: true,
        price: faker.number.int({ min: 10, max: 100 }),
        stock: faker.number.int({ min: 0, max: 100 }),
        timestamp: faker.date.recent().toISOString(),
      },
    });
  }

  static createFailed(
    overrides: Partial<Prisma.OrderEnrichmentCreateInput> = {},
  ): Prisma.OrderEnrichmentCreateInput {
    return this.create({
      ...overrides,
      enrichmentStatus: 'FAILED',
      lastError: 'External service timeout',
      retryCount: 5,
    });
  }
}

/**
 * Factory for creating valid webhook DTOs
 */
export class WebhookDtoFactory {
  static createValidOrderDto(
    overrides: Partial<CreateOrderDto> = {},
  ): CreateOrderDto {
    return {
      order_id: faker.string.alphanumeric(10),
      customer: {
        email: faker.internet.email(),
        name: faker.person.fullName(),
      },
      items: OrderItemFactory.createMany(
        faker.number.int({ min: 1, max: 3 }),
      ).map((item) => ({
        sku: item.sku,
        qty: item.quantity,
        unit_price: Number(item.unitPrice),
      })),
      currency: faker.finance.currencyCode(),
      idempotency_key: faker.string.uuid(),
      ...overrides,
    };
  }

  static createInvalidOrderDto(
    overrides: Partial<CreateOrderDto> = {},
  ): CreateOrderDto {
    return {
      ...this.createValidOrderDto(),
      order_id: '', // Invalid: empty order ID
      customer: {
        email: 'invalid-email', // Invalid: malformed email
        name: faker.person.fullName(),
      },
      items: [], // Invalid: empty items array
      currency: 'INVALID', // Invalid: non-existent currency
      idempotency_key: '', // Invalid: empty idempotency key
      ...overrides,
    };
  }
}
