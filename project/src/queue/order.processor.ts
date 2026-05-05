import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueService } from './queue.service';
import { OrderRepository } from '../common/order.repository';
import { OrderStatus } from '@prisma/client';

interface ProcessOrderJob {
  orderId: string;
}

@Processor('order-processing')
export class OrderProcessor {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly orderRepository: OrderRepository,
  ) {}

  async process(job: Job<ProcessOrderJob>): Promise<void> {
    const { orderId } = job.data;
    this.logger.log(`Processing order: ${orderId}`);

    // Update status to ENRICHING
    await this.orderRepository.updateStatus(orderId, OrderStatus.ENRICHING);

    // Fire-and-forget: enqueue to all 3 service queues in parallel
    // Service processors will handle enrichment and update status to ENRICHED
    await Promise.all([
      this.queueService.enqueueCurrencyConversion(orderId),
      this.queueService.enqueueAddressValidation(orderId),
      this.queueService.enqueueProductVerification(orderId),
    ]);

    this.logger.log(`Order ${orderId} enqueued to all enrichment queues`);
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
