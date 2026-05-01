import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateOrderWebhookDto } from 'src/modules/contracts/http/create-order.dto';
import { ResponseOrderDto } from 'src/modules/contracts/http/response-order.dto';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status-enum';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
  ) {}

  async receiveOrder(
    payload: CreateOrderWebhookDto,
  ): Promise<ResponseOrderDto> {
    const existingOrder = await this.ordersRepository.findOne({
      where: { idempotency_key: payload.idempotency_key },
    });

    if (existingOrder) {
      return this.toResponse(existingOrder);
    }

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

    const savedOrder = await this.ordersRepository.save(order);

    return this.toResponse(savedOrder);
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
