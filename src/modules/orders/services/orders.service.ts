import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { QueryFailedError, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status-enum';
import { CreateOrderWebhookDto } from '../../contracts/http/create-order.dto';
import { ResponseOrderDto } from '../../contracts/http/response-order.dto';
import { PgDriverError } from '../types/order.type';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
  ) {}

  async receiveOrder(
    payload: CreateOrderWebhookDto,
  ): Promise<ResponseOrderDto> {
    const totalAmont = this.calculateTotalAmount(payload);

    const order = this.ordersRepository.create({
      order_id: payload.order_id,
      idempotency_key: payload.idempotency_key,
      customer_name: payload.customer.name,
      customer_email: payload.customer.email,
      items: payload.items,
      currency: payload.currency,
      total_amount: totalAmont,
      status: OrderStatus.RECEIVED,
    });

    try {
      const savedOrder = await this.ordersRepository.save(order);
      return this.toResponse(savedOrder);
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const existingOrder = await this.ordersRepository.findOneOrFail({
        where: { idempotency_key: payload.idempotency_key },
      });

      return this.toResponse(existingOrder);
    }
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

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: PgDriverError }).driverError
        ?.code === '23505'
    );
  }
  private calculateTotalAmount(payload: CreateOrderWebhookDto) {
    return payload.items.reduce((total, item) => {
      return total + item.qty * item.unit_price;
    }, 0);
  }
}
