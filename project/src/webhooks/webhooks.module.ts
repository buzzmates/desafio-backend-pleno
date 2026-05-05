import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { OrderRepository } from '../common/order.repository';
import { PrismaService } from '../common/prisma.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, OrderRepository, PrismaService],
})
export class WebhooksModule {}
