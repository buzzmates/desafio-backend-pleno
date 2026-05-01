import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderService } from './services/orders.service';
import { WebhookController } from './controllers/webhooks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [OrderService],
  controllers: [WebhookController],
  exports: [OrderService],
})
export class OrdersModule {}
