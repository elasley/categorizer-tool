-- Fix embedding dimensions from 768 to 384 for MiniLM-v2
-- Run this to make the database compatible with the MiniLM model

-- Drop existing embedding columns
ALTER TABLE categories DROP COLUMN IF EXISTS embedding;
ALTER TABLE subcategories DROP COLUMN IF EXISTS embedding;
ALTER TABLE parttypes DROP COLUMN IF EXISTS embedding;
ALTER TABLE products DROP COLUMN IF EXISTS embedding;

-- Add new embedding columns with correct dimensions (384)
ALTER TABLE categories ADD COLUMN embedding vector(384);
ALTER TABLE subcategories ADD COLUMN embedding vector(384);
ALTER TABLE parttypes ADD COLUMN embedding vector(384);
ALTER TABLE products ADD COLUMN embedding vector(384);

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_categories_embedding ON categories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_subcategories_embedding ON subcategories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_parttypes_embedding ON parttypes USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_products_embedding ON products USING ivfflat (embedding vector_cosine_ops);
