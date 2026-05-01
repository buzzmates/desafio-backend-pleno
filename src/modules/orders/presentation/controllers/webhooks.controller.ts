import { Body, Controller, Post } from '@nestjs/common';
import { CreateOrderWebhookDto } from '../dtos/create-order.dto';
import { ResponseOrderDto } from '../dtos/response-order.dto';
import { OrderService } from '../../application/orders.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly orderService: OrderService) {}

  @Post('orders')
  async receiveOrder(
    @Body() bodyWebhook: CreateOrderWebhookDto,
  ): Promise<ResponseOrderDto> {
    return this.orderService.receiveOrder(bodyWebhook);
  }
}
