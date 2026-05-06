import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { OrderQueryDto } from './order-query.dto';
import { OrderStatus } from '@prisma/client';

describe('OrderQueryDto', () => {
  describe('validation', () => {
    it('should pass validation with empty object (all optional)', async () => {
      // Arrange
      const validData = {};

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });

    it('should pass validation with valid status filter', async () => {
      // Arrange
      const validData = {
        status: OrderStatus.RECEIVED,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.status).toBe(OrderStatus.RECEIVED);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });

    it('should pass validation with valid pagination', async () => {
      // Arrange
      const validData = {
        page: 2,
        limit: 10,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(10);
    });

    it('should pass validation with all valid fields', async () => {
      // Arrange
      const validData = {
        status: OrderStatus.ENRICHED,
        page: 3,
        limit: 50,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.status).toBe(OrderStatus.ENRICHED);
      expect(dto.page).toBe(3);
      expect(dto.limit).toBe(50);
    });

    it('should fail validation with invalid status', async () => {
      // Arrange
      const invalidData = {
        status: 'INVALID_STATUS',
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('should fail validation with negative page', async () => {
      // Arrange
      const invalidData = {
        page: -1,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('should fail validation with zero page', async () => {
      // Arrange
      const invalidData = {
        page: 0,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('should fail validation with negative limit', async () => {
      // Arrange
      const invalidData = {
        limit: -1,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });

    it('should fail validation with zero limit', async () => {
      // Arrange
      const invalidData = {
        limit: 0,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });
  });

  describe('type transformation', () => {
    it('should transform string page to number', async () => {
      // Arrange
      const validData = {
        page: '5',
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(5);
      expect(typeof dto.page).toBe('number');
    });

    it('should transform string limit to number', async () => {
      // Arrange
      const validData = {
        limit: '25',
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(25);
      expect(typeof dto.limit).toBe('number');
    });

    it('should handle invalid string numbers gracefully', async () => {
      // Arrange
      const invalidData = {
        page: 'not-a-number',
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('should handle decimal string numbers', async () => {
      // Arrange
      const invalidData = {
        page: '3.5',
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
      expect(errors[0].constraints).toHaveProperty('isInt');
    });
  });

  describe('default values', () => {
    it('should use default page when not provided', async () => {
      // Arrange
      const validData = {};

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
    });

    it('should use default limit when not provided', async () => {
      // Arrange
      const validData = {};

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(20);
    });

    it('should not override provided values with defaults', async () => {
      // Arrange
      const validData = {
        page: 5,
        limit: 10,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(5);
      expect(dto.limit).toBe(10);
    });
  });

  describe('status validation', () => {
    it('should accept all valid OrderStatus values', async () => {
      // Arrange
      const validStatuses = [
        OrderStatus.RECEIVED,
        OrderStatus.ENRICHING,
        OrderStatus.ENRICHED,
        OrderStatus.FAILED_ENRICHMENT,
      ];

      for (const status of validStatuses) {
        // Act
        const dto = plainToInstance(OrderQueryDto, { status });
        const errors = await validate(dto);

        // Assert
        expect(errors).toHaveLength(0);
        expect(dto.status).toBe(status);
      }
    });

    it('should reject invalid status strings', async () => {
      // Arrange
      const invalidStatuses = [
        'received',
        'enriching',
        'enriched',
        'failed_enrichment',
        'INVALID',
        '',
        null,
        undefined,
      ];

      for (const status of invalidStatuses) {
        // Act
        const dto = plainToInstance(OrderQueryDto, { status });
        const errors = await validate(dto);

        // Assert
        if (status !== null && status !== undefined) {
          expect(errors.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('pagination edge cases', () => {
    it('should accept very large page numbers', async () => {
      // Arrange
      const validData = {
        page: 999999,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(999999);
    });

    it('should accept very large limit numbers', async () => {
      // Arrange
      const validData = {
        limit: 999999,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(999999);
    });

    it('should accept minimum valid page number', async () => {
      // Arrange
      const validData = {
        page: 1,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
    });

    it('should accept minimum valid limit number', async () => {
      // Arrange
      const validData = {
        limit: 1,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(1);
    });

    it('should reject decimal page numbers', async () => {
      // Arrange
      const invalidData = {
        page: 2.5,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
      expect(errors[0].constraints).toHaveProperty('isInt');
    });

    it('should reject decimal limit numbers', async () => {
      // Arrange
      const invalidData = {
        limit: 15.7,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
      expect(errors[0].constraints).toHaveProperty('isInt');
    });
  });

  describe('combined validation scenarios', () => {
    it('should pass validation with status and pagination', async () => {
      // Arrange
      const validData = {
        status: OrderStatus.FAILED_ENRICHMENT,
        page: 10,
        limit: 5,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.status).toBe(OrderStatus.FAILED_ENRICHMENT);
      expect(dto.page).toBe(10);
      expect(dto.limit).toBe(5);
    });

    it('should report multiple validation errors', async () => {
      // Arrange
      const invalidData = {
        status: 'INVALID_STATUS',
        page: -1,
        limit: 0,
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(1);
      const errorProperties = errors.map((e) => e.property);
      expect(errorProperties).toContain('status');
      expect(errorProperties).toContain('page');
      expect(errorProperties).toContain('limit');
    });

    it('should handle partial invalid data', async () => {
      // Arrange
      const invalidData = {
        status: OrderStatus.RECEIVED, // Valid
        page: -5, // Invalid
        limit: 25, // Valid
      };

      // Act
      const dto = plainToInstance(OrderQueryDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });
  });
});
