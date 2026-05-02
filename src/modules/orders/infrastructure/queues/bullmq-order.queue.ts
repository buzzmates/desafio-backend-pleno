import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IOrderQueue } from '../../domain/queues/order.queue';
import { EnqueueOrderPayload } from '../../domain/types/queue.type';

@Injectable()
export class BullMQOrderQueue extends IOrderQueue {
  constructor(@InjectQueue('orders') private readonly queue: Queue) {
    super();
  }

  async enqueue(data: EnqueueOrderPayload): Promise<void> {
    await this.queue.add('process-order', data, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
