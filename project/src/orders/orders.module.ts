import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderRepository } from '../common/order.repository';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderRepository, PrismaService],
  exports: [OrdersService],
})
export class OrdersModule {}
