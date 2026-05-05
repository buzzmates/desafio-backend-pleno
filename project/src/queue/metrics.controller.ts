import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QueueService } from './queue.service';

@ApiTags('queue')
@Controller('queue')
export class MetricsController {
  constructor(private readonly queueService: QueueService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get queue metrics for all queues' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getMetrics() {
    const metrics = await this.queueService.getAllQueueMetrics();
    return {
      success: true,
      data: metrics,
    };
  }
}
