import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderRepository } from '../common/order.repository';
import { PrismaService } from '../common/prisma.service';
import { OrderStatus } from '@prisma/client';

export interface EnrichmentJob {
  orderId: string;
}

export abstract class BaseEnrichmentProcessor<T extends EnrichmentJob> {
  protected readonly logger: Logger;

  constructor(
    protected readonly orderRepository: OrderRepository,
    protected readonly prisma: PrismaService,
    processorName: string,
  ) {
    this.logger = new Logger(processorName);
  }

  /**
   * Main processing logic to be implemented by subclasses.
   * Should perform the enrichment and return the result to be saved.
   */
  abstract enrich(job: Job<T>): Promise<Record<string, unknown>>;

  /**
   * Get the field name in OrderEnrichment table where result should be saved.
   */
  abstract getEnrichmentField(): string;

  /**
   * Main process handler called by BullMQ.
   */
  async process(job: Job<T>): Promise<void> {
    const { orderId } = job.data;
    const fieldName = this.getEnrichmentField();

    this.logger.log(`Processing ${fieldName} for order: ${orderId}`);

    try {
      // Perform enrichment
      const result = await this.enrich(job);

      // Save result to OrderEnrichment
      await this.prisma.orderEnrichment.update({
        where: { orderId },
        data: {
          [fieldName]: result,
        },
      });

      this.logger.log(`${fieldName} completed for order: ${orderId}`);

      // Check if all enrichments are complete
      await this.checkAndFinalizeEnrichment(orderId);
    } catch (error) {
      this.logger.error(
        `Failed to process ${fieldName} for order ${orderId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Check if all 3 enrichments are complete and update order status.
   */
  protected async checkAndFinalizeEnrichment(orderId: string): Promise<void> {
    const enrichment = await this.prisma.orderEnrichment.findUnique({
      where: { orderId },
    });

    if (
      enrichment?.currencyConversion &&
      enrichment?.addressValidation &&
      enrichment?.productVerification
    ) {
      await this.orderRepository.updateStatus(orderId, OrderStatus.ENRICHED);
      this.logger.log(`Order ${orderId} fully enriched`);
    }
  }

  /**
   * Handler for job completion event.
   */
  onCompleted(job: Job<T>): void {
    this.logger.log(`Job ${job.id} completed for order ${job.data.orderId}`);
  }

  /**
   * Handler for job failure event.
   */
  onFailed(job: Job<T>, error: Error): void {
    this.logger.error(
      `Job ${job.id} failed for order ${job.data.orderId}:`,
      error.message,
    );
  }
}
