import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
  ) {}

  async enqueueOrder(orderId: string): Promise<void> {
    await this.orderQueue.add(
      'process-order',
      { orderId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
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
    notifications: QueueMetrics;
    aggregated: QueueMetrics;
  }> {
    const [orderMetrics, notificationMetrics] = await Promise.all([
      this.getQueueMetrics(this.orderQueue),
      this.getQueueMetrics(this.notificationQueue),
    ]);

    return {
      orderProcessing: orderMetrics,
      notifications: notificationMetrics,
      aggregated: {
        waiting: orderMetrics.waiting + notificationMetrics.waiting,
        active: orderMetrics.active + notificationMetrics.active,
        completed: orderMetrics.completed + notificationMetrics.completed,
        failed: orderMetrics.failed + notificationMetrics.failed,
        delayed: orderMetrics.delayed + notificationMetrics.delayed,
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

  async enqueueNotification(
    orderId: string,
    type: 'order_received' | 'order_enriched' | 'order_failed',
  ): Promise<void> {
    await this.notificationQueue.add(
      'send-notification',
      { orderId, type },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
    this.logger.log(`Order ${orderId} enqueued for ${type} notification`);
  }

  async clearQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    await queue.clean(0, 0, 'completed');
    await queue.clean(0, 0, 'failed');
    await queue.clean(0, 0, 'waiting');
    await queue.clean(0, 0, 'active');
    this.logger.log(`Queue ${queueName} cleared`);
  }

  async getQueueJobs(queueName: string, query: any): Promise<any> {
    const queue = this.getQueueByName(queueName);
    const { state = 'waiting', page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;

    const jobs = await queue.getJobs(state, offset, limit);

    const total = await queue.getJobCounts();

    return {
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        progress: typeof job.progress === 'number' ? job.progress : 0,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        returnvalue: job.returnvalue,
      })),
      pagination: {
        page,
        limit,
        total: total[state] || 0,
      },
    };
  }

  private getQueueByName(queueName: string): Queue {
    const queues = {
      'order-processing': this.orderQueue,
      notifications: this.notificationQueue,
    };

    const queue = queues[queueName as keyof typeof queues];
    if (!queue) {
      throw new BadRequestException(`Queue ${queueName} not found`);
    }

    return queue;
  }

  async healthCheck(): Promise<void> {
    await this.orderQueue.getJobCounts();
  }
}
