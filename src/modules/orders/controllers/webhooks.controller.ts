import { Body, Controller, Post } from '@nestjs/common';
import { CreateOrderWebhookDto } from '../../contracts/http/create-order.dto';
import { ResponseOrderDto } from '../../contracts/http/response-order.dto';
import { OrderService } from '../services/orders.service';

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
