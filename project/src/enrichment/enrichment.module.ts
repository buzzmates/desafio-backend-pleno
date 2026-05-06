import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { OrderRepository } from '../common/order.repository';
import { PrismaService } from '../common/prisma.service';

// Services
import { CurrencyConversionService } from './services/currency-conversion.service';
import { AddressValidationService } from './services/address-validation.service';
import { ProductVerificationService } from './services/product-verification.service';
import { EnrichmentQueueService } from './services/enrichment-queue.service';

// Processors
import { CurrencyProcessor } from './processors/currency.processor';
import { AddressProcessor } from './processors/address.processor';
import { ProductProcessor } from './processors/product.processor';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue(
      { name: 'currency-conversion' },
      { name: 'address-validation' },
      { name: 'verify-product' },
    ),
  ],
  providers: [
    // Common services
    OrderRepository,
    PrismaService,

    // External services
    CurrencyConversionService,
    AddressValidationService,
    ProductVerificationService,

    // Queue services
    EnrichmentQueueService,

    // Queue processors
    CurrencyProcessor,
    AddressProcessor,
    ProductProcessor,
  ],
  exports: [
    CurrencyConversionService,
    AddressValidationService,
    ProductVerificationService,
    EnrichmentQueueService,
  ],
})
export class EnrichmentModule {}
