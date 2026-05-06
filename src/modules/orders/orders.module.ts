import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './application/orders.service';
import { EnrichmentService } from './application/enrichment.service';
import { WebhookController } from './presentation/controllers/webhooks.controller';
import { OrdersController } from './presentation/controllers/orders.controller';
import { QueueController } from './presentation/controllers/queue.controller';
import { QueueMetricsService } from './infrastructure/queues/queue-metrics.service';
import { BullModule } from '@nestjs/bullmq';
import { OrderEntity } from './infrastructure/persistance/order.entity';
import { TypeOrmOrderRepository } from './infrastructure/persistance/typeorm-order.repository';
import { IOrderRepository } from './domain/repositories/order.repository';
import { HttpModule } from '@nestjs/axios';
import { BullMQOrderQueue } from './infrastructure/queues/bullmq-order.queue';
import { IOrderQueue } from './domain/queues/order.queue';
import { OrderProcessor } from './infrastructure/queues/order.processor';
import { ExchangeRateService } from './infrastructure/external/exchange-rate.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([OrderEntity]),
    BullModule.registerQueue({
      name: 'orders',
    }),
    BullModule.registerQueue({
      name: 'orders-dlq',
    }),
  ],
  providers: [
    OrderService,
    EnrichmentService,
    OrderProcessor,
    ExchangeRateService,
    QueueMetricsService,
    {
      provide: IOrderRepository,
      useClass: TypeOrmOrderRepository,
    },
    {
      provide: IOrderQueue,
      useClass: BullMQOrderQueue,
    },
  ],
  controllers: [WebhookController, OrdersController, QueueController],
  exports: [OrderService],
})
export class OrdersModule {}
