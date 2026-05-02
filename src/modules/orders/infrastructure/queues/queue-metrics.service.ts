import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export type QueueMetrics = {
  queue: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};

@Injectable()
export class QueueMetricsService {
  constructor(
    @InjectQueue('orders') private readonly ordersQueue: Queue,
    @InjectQueue('orders-dlq') private readonly dlqQueue: Queue,
  ) {}

  async getMetrics(): Promise<QueueMetrics[]> {
    const [ordersCounts, dlqCounts] = await Promise.all([
      this.ordersQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      ),
      this.dlqQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      ),
    ]);

    return [
      {
        queue: 'orders',
        waiting: ordersCounts.waiting ?? 0,
        active: ordersCounts.active ?? 0,
        completed: ordersCounts.completed ?? 0,
        failed: ordersCounts.failed ?? 0,
        delayed: ordersCounts.delayed ?? 0,
      },
      {
        queue: 'orders-dlq',
        waiting: dlqCounts.waiting ?? 0,
        active: dlqCounts.active ?? 0,
        completed: dlqCounts.completed ?? 0,
        failed: dlqCounts.failed ?? 0,
        delayed: dlqCounts.delayed ?? 0,
      },
    ];
  }

  async retryDlq() {
    const jobs = await this.dlqQueue.getJobs(['waiting']);

    let requeued = 0;

    for (const job of jobs) {
      const orderId = job.data?.order_id;

      if (typeof orderId !== 'string' || orderId.length === 0) {
        continue;
      }

      await this.ordersQueue.add(
        'process-order',
        { order_id: orderId },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: false,
        },
      );

      await job.remove();
      requeued += 1;
    }

    return { requeued };
  }
}
