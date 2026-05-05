import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class EnrichmentQueueService {
  private readonly logger = new Logger(EnrichmentQueueService.name);

  constructor(
    @InjectQueue('currency-conversion') private readonly currencyQueue: Queue,
    @InjectQueue('address-validation') private readonly addressQueue: Queue,
    @InjectQueue('verify-product') private readonly productQueue: Queue,
  ) {}

  async enqueueCurrencyConversion(orderId: string): Promise<void> {
    await this.currencyQueue.add('convert-currency', { orderId }, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
    this.logger.log(`Order ${orderId} enqueued for currency conversion`);
  }

  async enqueueAddressValidation(orderId: string): Promise<void> {
    await this.addressQueue.add('validate-address', { orderId }, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
    this.logger.log(`Order ${orderId} enqueued for address validation`);
  }

  async enqueueProductVerification(orderId: string): Promise<void> {
    await this.productQueue.add('verify-product', { orderId }, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
    this.logger.log(`Order ${orderId} enqueued for product verification`);
  }
}
