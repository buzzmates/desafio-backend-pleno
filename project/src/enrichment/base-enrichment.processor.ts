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
   * Should perform enrichment and return result to be saved.
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
      const result = await this.enrich(job);

      await this.orderRepository.updateEnrichmentData(orderId, {
        [fieldName]: result,
      });

      this.logger.log(`${fieldName} completed for order: ${orderId}`);

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
  async onFailed(job: Job<T>, error: Error): Promise<void> {
    const { orderId } = job.data;
    const fieldName = this.getEnrichmentField();

    this.logger.error(
      `Job ${job.id} failed for order ${orderId}:`,
      error.message,
    );

    // Check if this is the final attempt (exhausted retries)
    if (job.attemptsMade >= job.opts.attempts) {
      this.logger.warn(
        `All retries exhausted for ${fieldName} on order ${orderId}, marking as FAILED_ENRICHMENT`,
      );
      
      await this.handleFailedEnrichment(orderId, fieldName, error);
    }
  }

  /**
   * Handle failed enrichment after all retries are exhausted.
   */
  private async handleFailedEnrichment(
    orderId: string,
    fieldName: string,
    error: Error,
  ): Promise<void> {
    try {
      // Update OrderEnrichment with error details
      await this.prisma.orderEnrichment.update({
        where: { orderId },
        data: {
          lastError: `${fieldName}: ${error.message}`,
          retryCount: { increment: 1 },
        },
      });

      // Check if all services have failed
      const enrichment = await this.prisma.orderEnrichment.findUnique({
        where: { orderId },
      });

      const allServicesFailed = 
        !enrichment?.currencyConversion &&
        !enrichment?.addressValidation &&
        !enrichment?.productVerification &&
        enrichment.retryCount >= 15; // 5 attempts per service * 3 services

      if (allServicesFailed) {
        await this.orderRepository.updateStatus(
          orderId,
          OrderStatus.FAILED_ENRICHMENT,
        );
        this.logger.error(
          `Order ${orderId} marked as FAILED_ENRICHMENT after all services failed`,
        );
      }
    } catch (handleError) {
      this.logger.error(
        `Failed to handle enrichment failure for order ${orderId}:`,
        handleError instanceof Error ? handleError.message : String(handleError),
      );
    }
  }
}
