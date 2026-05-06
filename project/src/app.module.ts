import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { OrdersModule } from './orders/orders.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { QueueModule } from './queue/queue.module';
import { EnrichmentModule } from './enrichment/enrichment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    BullModule.registerQueue({ name: 'order-processing' }),
    OrdersModule,
    WebhooksModule,
    QueueModule,
    EnrichmentModule,
  ],
})
export class AppModule {}
