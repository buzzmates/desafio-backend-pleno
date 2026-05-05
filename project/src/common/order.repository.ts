import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Order, OrderStatus, Prisma } from '@prisma/client';

export interface FindAllOptions {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedOrders {
  data: Order[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.OrderCreateInput & { items: Prisma.OrderItemCreateManyOrderInputEnvelope }): Promise<Order> {
    return this.prisma.order.create({
      data: {
        ...data,
        items: data.items,
      },
      include: { items: true },
    }) as Promise<Order & { items: any[] }>;
  }

  async findById(id: string): Promise<(Order & { items: any[] }) | null> {
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    }) as Promise<(Order & { items: any[] }) | null>;
  }

  async findByExternalId(externalOrderId: string): Promise<(Order & { items: any[] }) | null> {
    return this.prisma.order.findUnique({
      where: { externalOrderId },
      include: { items: true },
    }) as Promise<(Order & { items: any[] }) | null>;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<(Order & { items: any[] }) | null> {
    return this.prisma.order.findUnique({
      where: { idempotencyKey },
      include: { items: true },
    }) as Promise<(Order & { items: any[] }) | null>;
  }

  async findAll(options: FindAllOptions = {}): Promise<PaginatedOrders> {
    const { status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = status ? { status } : {};

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders as (Order & { items: any[] })[],
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data: { status, updatedAt: new Date() },
      include: { items: true },
    }) as Promise<Order & { items: any[] }>;
  }
}
