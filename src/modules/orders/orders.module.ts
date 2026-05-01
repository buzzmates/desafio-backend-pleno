import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './application/orders.service';
import { WebhookController } from './presentation/controllers/webhooks.controller';
import { BullModule } from '@nestjs/bullmq';
import { OrderEntity } from './infrastructure/persistance/order.entity';
import { TypeOrmOrderRepository } from './infrastructure/persistance/typeorm-order.repository';
import { IOrderRepository } from './domain/repositories/order.repository';

@Module({
  imports: [
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
  ],
  controllers: [WebhookController],
  exports: [OrderService],
})
export class OrdersModule {}
