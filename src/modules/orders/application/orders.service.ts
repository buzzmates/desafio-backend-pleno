import { Injectable } from '@nestjs/common';

import { Order } from '../domain/entities/order';
import { CreateOrderCommand } from '../domain/types/order.type';
import { ResponseOrderDto } from '../presentation/dtos/response-order.dto';
import { IOrderRepository } from '../domain/repositories/order.repository';
import { IOrderQueue } from '../domain/queues/order.queue';
import { OrderStatus } from '../domain/enums/order-status-enum';
import { OrderNotFound } from '../domain/errors/order-not-found.error';

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

  async findById(id: string): Promise<ResponseOrderDto> {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new OrderNotFound();
    }

    return order;
  }

  async findAll(status?: OrderStatus): Promise<ResponseOrderDto[]> {
    const orders = await this.ordersRepository.findAll(status);
    return orders;
  }
}
