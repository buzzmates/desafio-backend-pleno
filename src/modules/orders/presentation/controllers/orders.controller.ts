import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  Query,
} from '@nestjs/common';
import { OrderService } from '../../application/orders.service';
import { ResponseOrderDto } from '../dtos/response-order.dto';
import { OrderStatus } from '../../domain/enums/order-status-enum';
import { OrderNotFound } from '../../domain/errors/order-not-found.error';
import { ResponseDetailOrder } from '../dtos/response-details-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orderService: OrderService) {}

  @Get(':id')
  async findById(@Param('id') id: string): Promise<ResponseDetailOrder> {
    try {
      return await this.orderService.findById(id);
    } catch (error) {
      if (error instanceof OrderNotFound) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
  @Get()
  async findAll(
    @Query('status', new ParseEnumPipe(OrderStatus, { optional: true }))
    status?: OrderStatus,
  ): Promise<ResponseOrderDto[]> {
    return this.orderService.findAll(status);
  }
}
