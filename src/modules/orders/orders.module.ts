import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './application/orders.service';
import { WebhookController } from './presentation/controllers/webhooks.controller';
import { BullModule } from '@nestjs/bullmq';
import { OrderEntity } from './infrastructure/persistance/order.entity';
import { TypeOrmOrderRepository } from './infrastructure/persistance/typeorm-order.repository';
import { IOrderRepository } from './domain/repositories/order.repository';
import { HttpModule } from '@nestjs/axios';
import { BullMQOrderQueue } from './infrastructure/queues/bullmq-order.queue';
import { IOrderQueue } from './domain/queues/order.queue';

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
    {
      provide: IOrderRepository,
      useClass: TypeOrmOrderRepository,
    },
    {
      provide: IOrderQueue,
      useClass: BullMQOrderQueue,
    },
  ],
  controllers: [WebhookController],
  exports: [OrderService],
})
export class OrdersModule {}
