import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseEnrichmentProcessor, EnrichmentJob } from './base-enrichment.processor';
import { OrderRepository } from '../common/order.repository';
import { PrismaService } from '../common/prisma.service';

interface ProductJob extends EnrichmentJob {
  orderId: string;
}

@Processor('product-verification')
export class ProductProcessor extends BaseEnrichmentProcessor<ProductJob> {
  constructor(
    orderRepository: OrderRepository,
    prisma: PrismaService,
  ) {
    super(orderRepository, prisma, ProductProcessor.name);
  }

  getEnrichmentField(): string {
    return 'productVerification';
  }

  async enrich(job: Job<ProductJob>): Promise<Record<string, unknown>> {
    const { orderId } = job.data;
    this.logger.log(`Enriching products for order: ${orderId}`);

    // TODO: Implement actual product verification API call
    // For now, placeholder implementation
    return {
      products: [
        {
          sku: 'ABC123',
          isValid: true,
          productInfo: {
            name: 'Product Name',
            description: 'Product Description',
            category: 'Category',
            price: 59.9,
            stock: 100,
            isActive: true,
          },
          verifiedAt: new Date().toISOString(),
        },
      ],
      allValid: true,
      validCount: 1,
      totalCount: 1,
      verifiedAt: new Date().toISOString(),
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProductJob>) {
    super.onCompleted(job);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProductJob>, error: Error) {
    super.onFailed(job, error);
  }
}
