import { Injectable } from '@nestjs/common';

import { Order } from '../domain/entities/order';
import { OrderStatus } from '../domain/enums/order-status-enum';
import { CreateOrderWebhookDto } from '../presentation/dtos/create-order.dto';
import { ResponseOrderDto } from '../presentation/dtos/response-order.dto';
import { IOrderRepository } from '../domain/repositories/order.repository';
import { IOrderQueue } from '../domain/queues/order.queue';

@Injectable()
export class OrderService {
  constructor(
    private readonly ordersRepository: IOrderRepository,
    private readonly queueRepository: IOrderQueue,
  ) {}

  async receiveOrder(
    payload: CreateOrderWebhookDto,
  ): Promise<ResponseOrderDto> {
    const order = new Order();
    order.order_id = payload.order_id;
    order.idempotency_key = payload.idempotency_key;
    order.customer_name = payload.customer.name;
    order.customer_email = payload.customer.email;
    order.items = payload.items;
    order.currency = payload.currency;
    order.total_amount = this.calculateTotalAmount(payload);
    order.status = OrderStatus.RECEIVED;

    const saved = await this.ordersRepository.save(order);
    await this.queueRepository.enqueue({ order_id: saved.id });
    return this.toResponse(saved);
  }

  private toResponse(order: Order): ResponseOrderDto {
    return {
      id: order.id,
      order_id: order.order_id,
      status: order.status,
      idempotency_key: order.idempotency_key,
      created_at: order.created_at,
    };
  }

  private calculateTotalAmount(payload: CreateOrderWebhookDto) {
    return payload.items.reduce((total, item) => {
      return total + item.qty * item.unit_price;
    }, 0);
  }
}
