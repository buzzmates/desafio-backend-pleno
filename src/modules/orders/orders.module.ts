import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderService } from './services/orders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrdersModule {}
