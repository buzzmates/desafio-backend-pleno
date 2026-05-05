import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { EnrichmentService } from './enrichment.service';
import { CurrencyProcessor } from './currency.processor';
import { AddressProcessor } from './address.processor';
import { ProductProcessor } from './product.processor';
import { OrderRepository } from '../common/order.repository';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue(
      { name: 'currency-conversion' },
      { name: 'address-validation' },
      { name: 'product-verification' },
    ),
  ],
  providers: [
    EnrichmentService,
    CurrencyProcessor,
    AddressProcessor,
    ProductProcessor,
    OrderRepository,
    PrismaService,
  ],
  exports: [],
})
export class EnrichmentModule {}
