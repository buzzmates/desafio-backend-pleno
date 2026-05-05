import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { OrderProcessor } from './order.processor';
import { MetricsController } from './metrics.controller';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { OrderRepository } from '../common/order.repository';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [
    EnrichmentModule,
  ],
  controllers: [MetricsController],
  providers: [QueueService, OrderProcessor, OrderRepository, PrismaService],
  exports: [QueueService],
})
export class QueueModule {}
