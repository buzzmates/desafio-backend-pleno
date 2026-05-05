import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseEnrichmentProcessor, EnrichmentJob } from './base-enrichment.processor';
import { OrderRepository } from '../common/order.repository';
import { PrismaService } from '../common/prisma.service';

interface CurrencyJob extends EnrichmentJob {
  orderId: string;
}

@Processor('currency-conversion')
export class CurrencyProcessor extends BaseEnrichmentProcessor<CurrencyJob> {
  constructor(
    orderRepository: OrderRepository,
    prisma: PrismaService,
  ) {
    super(orderRepository, prisma, CurrencyProcessor.name);
  }

  getEnrichmentField(): string {
    return 'currencyConversion';
  }

  async enrich(job: Job<CurrencyJob>): Promise<Record<string, unknown>> {
    const { orderId } = job.data;
    this.logger.log(`Enriching currency for order: ${orderId}`);

    // TODO: Implement actual currency conversion API call
    // For now, placeholder implementation
    return {
      originalAmount: 100,
      originalCurrency: 'USD',
      targetCurrency: 'BRL',
      conversionRate: 5.25,
      convertedAmount: 525,
      timestamp: new Date().toISOString(),
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CurrencyJob>) {
    super.onCompleted(job);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CurrencyJob>, error: Error) {
    super.onFailed(job, error);
  }
}
