import { Injectable } from '@nestjs/common';

import { Order } from '../domain/entities/order';
import { CreateOrderCommand } from '../domain/types/order.type';
import { ResponseOrderDto } from '../presentation/dtos/response-order.dto';
import { IOrderRepository } from '../domain/repositories/order.repository';
import { IOrderQueue } from '../domain/queues/order.queue';
import { OrderStatus } from '../domain/enums/order-status-enum';
import { OrderNotFound } from '../domain/errors/order-not-found.error';
import { ResponseDetailOrder } from '../presentation/dtos/response-details-order.dto';

@Injectable()
export class OrderService {
  constructor(
    private readonly ordersRepository: IOrderRepository,
    private readonly queueRepository: IOrderQueue,
  ) {}

  async receiveOrder(command: CreateOrderCommand): Promise<ResponseOrderDto> {
    const order = Order.create(command);
    const result = await this.ordersRepository.createIfAbsent(order);
    if (result.created) {
      await this.queueRepository.enqueue({ order_id: result.order.id });
    }
    return this.toResponse(result.order);
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

  private toDetail(order: Order): ResponseDetailOrder {
    return {
      id: order.id,
      order_id: order.order_id,
      idempotency_key: order.idempotency_key,
      status: order.status,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
      },
      items: order.items,
      currency: order.currency,
      total_amount: order.total_amount,
      converted_amount: order.converted_amount ?? null,
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }

  async findById(id: string): Promise<ResponseDetailOrder> {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new OrderNotFound();
    }

    return this.toDetail(order);
  }

  async findAll(status?: OrderStatus): Promise<ResponseOrderDto[]> {
    const orders = await this.ordersRepository.findAll(status);
    return orders.map((order) => this.toResponse(order));
  }
}
