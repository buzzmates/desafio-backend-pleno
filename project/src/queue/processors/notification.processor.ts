import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderRepository } from '../../common/order.repository';
import { OrderStatus } from '@prisma/client';

interface SendNotificationJob {
  orderId: string;
  type: 'order_received' | 'order_enriched' | 'order_failed';
}

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly orderRepository: OrderRepository) {}

  async process(job: Job<SendNotificationJob>): Promise<void> {
    const { orderId, type } = job.data;
    this.logger.log(`Sending ${type} notification for order: ${orderId}`);

    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      let notificationData;
      
      switch (type) {
        case 'order_received':
          notificationData = {
            to: order.customerEmail,
            subject: 'Order Received',
            message: `Your order ${order.externalOrderId} has been received and is being processed.`,
            template: 'order_received',
          };
          break;
        
        case 'order_enriched':
          notificationData = {
            to: order.customerEmail,
            subject: 'Order Processing Complete',
            message: `Your order ${order.externalOrderId} has been processed successfully.`,
            template: 'order_enriched',
          };
          break;
        
        case 'order_failed':
          notificationData = {
            to: order.customerEmail,
            subject: 'Order Processing Issue',
            message: `There was an issue processing your order ${order.externalOrderId}. Please contact support.`,
            template: 'order_failed',
          };
          break;
      }

      await this.sendNotification(notificationData);

      this.logger.log(`Notification sent for order ${orderId}, type: ${type}`);
    } catch (error) {
      this.logger.error(`Failed to send notification for order ${orderId}:`, error.message);
      throw error;
    }
  }

  private async sendNotification(notificationData: any): Promise<void> {
    this.logger.log(`Sending notification:`, JSON.stringify(notificationData, null, 2));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<SendNotificationJob>) {
    this.logger.log(`Notification job ${job.id} completed for order ${job.data.orderId}, type: ${job.data.type}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SendNotificationJob>, error: Error) {
    this.logger.error(
      `Notification job ${job.id} failed for order ${job.data.orderId}, type: ${job.data.type}:`,
      error.message,
    );
  }
}
