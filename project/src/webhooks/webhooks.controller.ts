import { Controller, Post, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('orders')
  @ApiOperation({ 
    summary: 'Receive order webhook',
    description: 'Receive order webhook with signature verification.'
  })
  @ApiResponse({ status: 201, description: 'Order received successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 401, description: 'Invalid or missing webhook signature' })
  @ApiResponse({ status: 409, description: 'Duplicate idempotency key' })
  async receiveOrder(
    @Body() dto: CreateOrderDto,
    @Headers('x-webhook-signature') signature: string,
  ) {
        
    const result = await this.webhooksService.processOrder(dto);

    return {
      success: true,
      message: 'Order received and enqueued for processing',
      data: {
        orderId: result.orderId,
        isNew: result.isNew,
      },
    };
  }
}
