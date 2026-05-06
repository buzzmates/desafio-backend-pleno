import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueService } from '../queue.service';
import { EnrichmentQueueService } from '../../enrichment/services/enrichment-queue.service';
import { OrderRepository } from '../../common/order.repository';
import { OrderStatus } from '@prisma/client';

interface ProcessOrderJob {
  orderId: string;
}

@Processor('order-processing')
export class OrderProcessor {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly enrichmentQueueService: EnrichmentQueueService,
    private readonly orderRepository: OrderRepository,
  ) {}

  async process(job: Job<ProcessOrderJob>): Promise<void> {
    const { orderId } = job.data;
    this.logger.log(`Processing order: ${orderId}`);

    try {
      await this.orderRepository.updateStatus(orderId, OrderStatus.ENRICHING);

      await this.queueService.enqueueNotification(orderId, 'order_received');

      await Promise.all([
        this.enrichmentQueueService.enqueueCurrencyConversion(orderId),
        this.enrichmentQueueService.enqueueAddressValidation(orderId),
        this.enrichmentQueueService.enqueueProductVerification(orderId),
      ]);

      this.logger.log(`Order ${orderId} enqueued to all enrichment queues`);

      setTimeout(async () => {
        await this.checkEnrichmentCompletion(orderId);
      }, 10000);
    } catch (error) {
      this.logger.error(`Failed to process order ${orderId}:`, error.message);

      await this.orderRepository.updateStatus(
        orderId,
        OrderStatus.FAILED_ENRICHMENT,
      );

      await this.queueService.enqueueNotification(orderId, 'order_failed');

      throw error;
    }
  }

  private async checkEnrichmentCompletion(orderId: string): Promise<void> {
    try {
      // For demo purposes, we'll assume enrichment is complete
      await this.orderRepository.updateStatus(orderId, OrderStatus.ENRICHED);

      await this.queueService.enqueueNotification(orderId, 'order_enriched');

      this.logger.log(
        `Order ${orderId} enrichment completed and status updated to ENRICHED`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to complete enrichment for order ${orderId}:`,
        error.message,
      );
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProcessOrderJob>) {
    this.logger.log(`Job ${job.id} completed for order ${job.data.orderId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProcessOrderJob>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed for order ${job.data.orderId}:`,
      error.message,
    );
  }
}
