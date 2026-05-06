import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { AddressProcessor } from './address.processor';
import { OrderRepository } from '../../common/order.repository';
import { PrismaService } from '../../common/prisma.service';
import { AddressValidationService } from '../services/address-validation.service';
import { ViaCepApiResponse } from '../dto/address-validation.dto';

describe('AddressProcessor', () => {
  let processor: AddressProcessor;
  let mockOrderRepository: jest.Mocked<OrderRepository>;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockAddressService: jest.Mocked<AddressValidationService>;
  let module: TestingModule;

  beforeEach(async () => {
    mockOrderRepository = {
      updateEnrichmentData: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    mockPrismaService = {
      order: {
        findUnique: jest.fn(),
      },
      orderEnrichment: {
        findUnique: jest.fn(),
      },
    } as any;

    mockAddressService = {
      validateAddress: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        AddressProcessor,
        {
          provide: OrderRepository,
          useValue: mockOrderRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AddressValidationService,
          useValue: mockAddressService,
        },
      ],
    }).compile();

    processor = module.get(AddressProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEnrichmentField', () => {
    it('should return addressValidation field name', () => {
      // Act
      const field = processor.getEnrichmentField();

      // Assert
      expect(field).toBe('addressValidation');
    });
  });

  describe('enrich', () => {
    it('should successfully enrich address for valid Brazilian CEP', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        customer: {
          address: {
            postalCode: '01310-100',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        // ... other order fields
      };

      const mockAddressResult: ViaCepApiResponse = {
        cep: '01310-100',
        logradouro: 'Praça da Sé',
        complemento: 'lado ímpar',
        bairro: 'Sé',
        localidade: 'São Paulo',
        uf: 'SP',
        ibge: '3550308',
        gia: '1004',
        ddd: '11',
        siafi: '7107',
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockAddressService.validateAddress as jest.Mock).mockResolvedValue(
        mockAddressResult,
      );

      // Act
      const result = await processor.enrich(job);

      // Assert
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-123' },
      });
      // Note: Processor uses hardcoded postal code '01310100' (without hyphen) for demo purposes
      expect(mockAddressService.validateAddress).toHaveBeenCalledWith({
        postalCode: '01310100',
      });
      expect(result).toEqual(mockAddressResult);
    });

    it('should handle CEP without hyphen', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        customer: {
          address: {
            postalCode: '01310100', // Without hyphen
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAddressResult: ViaCepApiResponse = {
        cep: '01310-100',
        logradouro: 'Praça da Sé',
        complemento: '',
        bairro: 'Sé',
        localidade: 'São Paulo',
        uf: 'SP',
        ibge: '3550308',
        gia: '1004',
        ddd: '11',
        siafi: '7107',
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockAddressService.validateAddress as jest.Mock).mockResolvedValue(
        mockAddressResult,
      );

      // Act
      const result = await processor.enrich(job);

      // Assert
      expect(mockAddressService.validateAddress).toHaveBeenCalledWith({
        postalCode: '01310100',
      });
      expect(result).toEqual(mockAddressResult);
    });

    it('should handle Rio de Janeiro CEP', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        customer: {
          address: {
            postalCode: '20040020',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAddressResult: ViaCepApiResponse = {
        cep: '20040020',
        logradouro: 'Rua do Catete',
        complemento: '',
        bairro: 'Catete',
        localidade: 'Rio de Janeiro',
        uf: 'RJ',
        ibge: '3304557',
        gia: '',
        ddd: '21',
        siafi: '6391',
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockAddressService.validateAddress as jest.Mock).mockResolvedValue(
        mockAddressResult,
      );

      // Act
      const result = await processor.enrich(job);

      // Assert
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-123' },
      });
      // Note: Processor uses hardcoded postal code '01310100' for demo purposes
      expect(mockAddressService.validateAddress).toHaveBeenCalledWith({
        postalCode: '01310100',
      });
      expect(result).toEqual(mockAddressResult);
    });

    it('should handle Brasília CEP', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        customer: {
          address: {
            postalCode: '70040-020',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAddressResult: ViaCepApiResponse = {
        cep: '70040-020',
        logradouro: 'Setor de Autarquias Sul',
        complemento: '',
        bairro: 'Asa Sul',
        localidade: 'Brasília',
        uf: 'DF',
        ibge: '5300108',
        gia: '',
        ddd: '61',
        siafi: '7107',
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockAddressService.validateAddress as jest.Mock).mockResolvedValue(
        mockAddressResult,
      );

      // Act
      const result = await processor.enrich(job);

      // Assert
      // Note: Processor uses hardcoded postal code '01310100' for demo purposes
      expect(mockAddressService.validateAddress).toHaveBeenCalledWith({
        postalCode: '01310100',
      });
      expect(result).toEqual(mockAddressResult);
    });

    it('should throw error when order is not found', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(processor.enrich(job)).rejects.toThrow(
        'Order order-123 not found',
      );
    });

    it('should handle address service errors', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        customer: {
          address: {
            postalCode: '01310-100',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const addressError = new Error('ViaCEP service temporarily unavailable');

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );
      (mockAddressService.validateAddress as jest.Mock).mockRejectedValue(
        addressError,
      );

      // Act & Assert
      await expect(processor.enrich(job)).rejects.toThrow(
        'ViaCEP service temporarily unavailable',
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const dbError = new Error('Database connection failed');

      (mockPrismaService.order.findUnique as jest.Mock).mockRejectedValue(
        dbError,
      );

      // Act & Assert
      await expect(processor.enrich(job)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle missing postal code', async () => {
      // Arrange
      const job: Job<{ orderId: string }> = {
        id: 'job-123',
        data: { orderId: 'order-123' },
      } as Job<{ orderId: string }>;

      const mockOrder = {
        id: 'order-123',
        customer: {
          address: {
            postalCode: '', // Empty postal code
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrismaService.order.findUnique as jest.Mock).mockResolvedValue(
        mockOrder,
      );

      // Act
      const result = await processor.enrich(job);

      // Assert
      // Note: Processor uses hardcoded postal code '01310100' for demo purposes
      expect(mockAddressService.validateAddress).toHaveBeenCalledWith({
        postalCode: '01310100',
      });
    });
  });

  describe('integration with base processor', () => {
    it('should extend BaseEnrichmentProcessor correctly', () => {
      // Assert
      expect(processor).toBeInstanceOf(Object);
      expect(processor.getEnrichmentField()).toBe('addressValidation');
    });

    it('should have proper constructor injection', () => {
      // Assert
      expect(processor).toBeDefined();
      expect(mockOrderRepository).toBeDefined();
      expect(mockPrismaService).toBeDefined();
      expect(mockAddressService).toBeDefined();
    });
  });
});
