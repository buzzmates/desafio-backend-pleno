import { Body, ConflictException, Controller, Post } from '@nestjs/common';
import { CreateOrderWebhookDto } from '../dtos/create-order.dto';
import { ResponseOrderDto } from '../dtos/response-order.dto';
import { OrderService } from '../../application/orders.service';
import { OrderAlreadyExistsError } from '../../domain/errors/order-already-existis.error';
import { CreateOrderCommand } from '../../domain/types/order.type';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly orderService: OrderService) {}

  @Post('orders')
  async receiveOrder(
    @Body() body: CreateOrderWebhookDto,
  ): Promise<ResponseOrderDto> {
    const command: CreateOrderCommand = {
      order_id: body.order_id,
      idempotency_key: body.idempotency_key,
      customer_name: body.customer.name,
      customer_email: body.customer.email,
      items: body.items,
      currency: body.currency,
    };

    try {
      return await this.orderService.receiveOrder(command);
    } catch (error) {
      if (error instanceof OrderAlreadyExistsError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
