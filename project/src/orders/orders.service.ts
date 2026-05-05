import { Injectable } from '@nestjs/common';
import { OrderRepository, FindAllOptions, PaginatedOrders } from '../common/order.repository';
import { Order } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly orderRepository: OrderRepository) {}

  async findAll(options: FindAllOptions): Promise<PaginatedOrders> {
    return this.orderRepository.findAll(options);
  }

  async findById(id: string): Promise<(Order & { items: any[] }) | null> {
    return this.orderRepository.findById(id);
  }
}
