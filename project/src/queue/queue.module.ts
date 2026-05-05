import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { OrderProcessor } from './processors/order.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { MetricsController } from './metrics.controller';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { OrderRepository } from '../common/order.repository';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'order-processing' },
      { name: 'notifications' },
    ),
    EnrichmentModule,
  ],
  controllers: [MetricsController],
  providers: [
    QueueService,
    OrderProcessor,
    NotificationProcessor,
    OrderRepository,
    PrismaService,
  ],
  exports: [QueueService],
})
export class QueueModule {}
