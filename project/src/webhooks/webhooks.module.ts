import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookSignatureMiddleware } from './middleware/webhook-signature.middleware';
import { RawBodyMiddleware } from './middleware/raw-body.middleware';
import { OrderRepository } from '../common/order.repository';
import { PrismaService } from '../common/prisma.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, OrderRepository, PrismaService],
})
export class WebhooksModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RawBodyMiddleware, WebhookSignatureMiddleware)
      .forRoutes('webhooks');
  }
}
