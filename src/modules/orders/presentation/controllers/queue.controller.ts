import { Controller, Get } from '@nestjs/common';
import {
  QueueMetrics,
  QueueMetricsService,
} from '../../infrastructure/queues/queue-metrics.service';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueMetricsService: QueueMetricsService) {}

  @Get('metrics')
  async getMetrics(): Promise<QueueMetrics[]> {
    return this.queueMetricsService.getMetrics();
  }
}
