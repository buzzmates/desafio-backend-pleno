import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('order-processing') private readonly orderQueue: Queue,
    @InjectQueue('currency-conversion') private readonly currencyQueue: Queue,
    @InjectQueue('address-validation') private readonly addressQueue: Queue,
    @InjectQueue('product-verification') private readonly productQueue: Queue,
  ) {}

  async enqueueOrder(orderId: string): Promise<void> {
    await this.orderQueue.add('process-order', { orderId }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    this.logger.log(`Order ${orderId} enqueued for processing`);
  }

  async getMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.orderQueue.getWaitingCount(),
      this.orderQueue.getActiveCount(),
      this.orderQueue.getCompletedCount(),
      this.orderQueue.getFailedCount(),
      this.orderQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  async getAllQueueMetrics(): Promise<{
    orderProcessing: QueueMetrics;
    currencyConversion: QueueMetrics;
    addressValidation: QueueMetrics;
    productVerification: QueueMetrics;
    aggregated: QueueMetrics;
  }> {
    const [
      orderMetrics,
      currencyMetrics,
      addressMetrics,
      productMetrics,
    ] = await Promise.all([
      this.getQueueMetrics(this.orderQueue),
      this.getQueueMetrics(this.currencyQueue),
      this.getQueueMetrics(this.addressQueue),
      this.getQueueMetrics(this.productQueue),
    ]);

    return {
      orderProcessing: orderMetrics,
      currencyConversion: currencyMetrics,
      addressValidation: addressMetrics,
      productVerification: productMetrics,
      aggregated: {
        waiting: orderMetrics.waiting + currencyMetrics.waiting + addressMetrics.waiting + productMetrics.waiting,
        active: orderMetrics.active + currencyMetrics.active + addressMetrics.active + productMetrics.active,
        completed: orderMetrics.completed + currencyMetrics.completed + addressMetrics.completed + productMetrics.completed,
        failed: orderMetrics.failed + currencyMetrics.failed + addressMetrics.failed + productMetrics.failed,
        delayed: orderMetrics.delayed + currencyMetrics.delayed + addressMetrics.delayed + productMetrics.delayed,
      },
    };
  }

  private async getQueueMetrics(queue: Queue): Promise<QueueMetrics> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

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
    await this.productQueue.add('verify-products', { orderId }, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
    this.logger.log(`Order ${orderId} enqueued for product verification`);
  }
}
