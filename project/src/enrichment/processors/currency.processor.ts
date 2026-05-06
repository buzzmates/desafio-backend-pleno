import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  BaseEnrichmentProcessor,
  EnrichmentJob,
} from '../base-enrichment.processor';
import { OrderRepository } from '../../common/order.repository';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyConversionService } from '../services/currency-conversion.service';
import { CurrencyConversionRequest } from '../dto/currency-conversion.dto';

interface CurrencyJob extends EnrichmentJob {
  orderId: string;
}

@Processor('currency-conversion')
export class CurrencyProcessor extends BaseEnrichmentProcessor<CurrencyJob> {
  constructor(
    orderRepository: OrderRepository,
    prisma: PrismaService,
    private readonly currencyService: CurrencyConversionService,
  ) {
    super(orderRepository, prisma, 'CurrencyProcessor');
  }

  getEnrichmentField(): string {
    return 'currencyConversion';
  }

  async enrich(job: Job<CurrencyJob>): Promise<Record<string, unknown>> {
    const { orderId } = job.data;
    this.logger.log(`Enriching currency for order: ${orderId}`);

    // Get order details for currency conversion
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Convert order currency to USD (default target currency)
    const conversionRequest: CurrencyConversionRequest = {
      amount: Number(order.totalAmount),
      from: order.currency,
      to: 'USD',
    };

    const conversionResult =
      await this.currencyService.convertCurrency(conversionRequest);

    this.logger.log(
      `Currency conversion successful: ${conversionRequest.amount} ${conversionRequest.from} → ${conversionResult.convertedAmount} USD`,
    );

    return conversionResult as unknown as Record<string, unknown>;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CurrencyJob>) {
    super.onCompleted(job);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<CurrencyJob>, error: Error) {
    await super.onFailed(job, error);
  }
}
