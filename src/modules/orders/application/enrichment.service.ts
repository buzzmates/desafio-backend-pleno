import { Injectable } from '@nestjs/common';
import { OrderStatus } from '../domain/enums/order-status-enum';
import { IOrderRepository } from '../domain/repositories/order.repository';
import { ExchangeRateService } from '../infrastructure/external/exchange-rate.service';

@Injectable()
export class EnrichmentService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async enrich(orderId: string): Promise<void> {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    try {
      const converted = await this.exchangeRateService.convert(
        order.currency,
        'BRL',
        order.total_amount,
      );
      order.converted_amount = converted;
      order.status = OrderStatus.ENRICHED;
    } catch (error) {
      order.status = OrderStatus.FAILED_ENRICHMENT;
      await this.orderRepository.save(order);
      throw error;
    }

    await this.orderRepository.save(order);
  }
}
