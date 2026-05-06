-- Database initialization script for orders_db
-- This script runs when the PostgreSQL container starts for the first time

-- Enable UUID extension if needed (though we're using cuid() for IDs)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for better performance (these will be created by Prisma anyway)
-- The following indexes are handled by Prisma schema:
-- CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON orders(external_order_id);
-- CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);
-- CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
-- CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
-- CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at);
-- CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
-- CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(sku);
-- CREATE INDEX IF NOT EXISTS idx_order_enrichments_order_id ON order_enrichments(order_id);
-- CREATE INDEX IF NOT EXISTS idx_order_enrichments_enrichment_status ON order_enrichments(enrichment_status);

-- Set timezone to UTC for consistent timestamp handling
SET timezone = 'UTC';

-- Create a simple function to validate JSON structure (optional)
CREATE OR REPLACE FUNCTION validate_json_structure(json_data JSONB, required_keys TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT COUNT(*) = ARRAY_LENGTH(required_keys, 1)
          FROM jsonb_object_keys(json_data) 
          WHERE key = ANY(required_keys));
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to the postgres user (already done by default)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'Database orders_db initialized successfully';
END
$$;
