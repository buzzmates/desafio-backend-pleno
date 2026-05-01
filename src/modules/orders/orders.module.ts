import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderService } from './services/orders.service';
import { WebhookController } from './controllers/webhooks.controller';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    BullModule.registerQueue({
      name: 'orders',
    }),
    BullModule.registerQueue({
      name: 'orders-dlq',
    }),
  ],
  providers: [OrderService],
  controllers: [WebhookController],
  exports: [OrderService],
})
export class OrdersModule {}
