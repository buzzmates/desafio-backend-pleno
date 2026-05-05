import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { OrderRepository } from '../common/order.repository';
import { QueueService } from '../queue/queue.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, Prisma } from '@prisma/client';

export interface ProcessOrderResult {
  orderId: string;
  isNew: boolean;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly queueService: QueueService,
  ) {}

  async processOrder(dto: CreateOrderDto): Promise<ProcessOrderResult> {
    // Idempotency check
    const existingOrder = await this.orderRepository.findByIdempotencyKey(dto.idempotency_key);
    if (existingOrder) {
      this.logger.log(`Duplicate order received: ${dto.idempotency_key}`);
      return {
        orderId: existingOrder.id,
        isNew: false,
      };
    }

    // Calculate total
    const totalAmount = dto.items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);

    // Create order data
    const orderData: Prisma.OrderCreateInput = {
      id: crypto.randomUUID(),
      externalOrderId: dto.order_id,
      idempotencyKey: dto.idempotency_key,
      customerEmail: dto.customer.email,
      customerName: dto.customer.name,
      currency: dto.currency,
      totalAmount: new Prisma.Decimal(totalAmount),
      status: OrderStatus.RECEIVED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const itemsData: Prisma.OrderItemCreateManyOrderInputEnvelope = {
      data: dto.items.map((item) => ({
        id: crypto.randomUUID(),
        sku: item.sku,
        quantity: item.qty,
        unitPrice: new Prisma.Decimal(item.unit_price),
      })),
    };

    // Persist order
    const order = await this.orderRepository.create({
      ...orderData,
      items: itemsData,
    });

    this.logger.log(`Order created: ${order.id}`);

    // Enqueue for processing
    await this.queueService.enqueueOrder(order.id);

    return {
      orderId: order.id,
      isNew: true,
    };
  }
}
