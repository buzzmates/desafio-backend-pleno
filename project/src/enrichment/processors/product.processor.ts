import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  BaseEnrichmentProcessor,
  EnrichmentJob,
} from '../base-enrichment.processor';
import { OrderRepository } from '../../common/order.repository';
import { PrismaService } from '../../common/prisma.service';
import { ProductVerificationService } from '../services/product-verification.service';

interface ProductJob extends EnrichmentJob {
  orderId: string;
}

@Processor('verify-product')
export class ProductProcessor extends BaseEnrichmentProcessor<ProductJob> {
  constructor(
    orderRepository: OrderRepository,
    prisma: PrismaService,
    private readonly productService: ProductVerificationService,
  ) {
    super(orderRepository, prisma, 'ProductProcessor');
  }

  getEnrichmentField(): string {
    return 'productVerification';
  }

  async enrich(job: Job<ProductJob>): Promise<Record<string, unknown>> {
    const { orderId } = job.data;
    this.logger.log(`Enriching product verification for order: ${orderId}`);

    // Get order with items for product verification
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (!order.items || order.items.length === 0) {
      throw new Error(`No items found for order ${orderId}`);
    }

    // Verify all items in the order
    const verificationResults = [];
    for (const item of order.items) {
      const verificationResult = await this.productService.verifyProduct({
        sku: item.sku,
      });
      verificationResults.push(verificationResult);
    }

    // Calculate statistics
    const totalItems = verificationResults.length;
    const verifiedItems = verificationResults.filter(
      (result) => result.isValid,
    ).length;
    const failedItems = totalItems - verifiedItems;

    this.logger.log(
      `Product verification completed: ${verifiedItems}/${totalItems} items verified for order: ${orderId}`,
    );

    return {
      verificationResults,
      totalItems,
      verifiedItems,
      failedItems,
      timestamp: new Date().toISOString(),
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProductJob>) {
    super.onCompleted(job);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ProductJob>, error: Error) {
    await super.onFailed(job, error);
  }
}
