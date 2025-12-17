-- Create function to find similar product classifications using vector similarity
-- This enables cache lookup for products with similar embeddings

CREATE OR REPLACE FUNCTION match_product_classifications(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.85,
  match_count int DEFAULT 1
)
RETURNS TABLE (
  id uuid,
  product_name text,
  product_description text,
  product_hash text,
  suggested_category text,
  suggested_subcategory text,
  suggested_parttype text,
  confidence integer,
  validation_reason text,
  embedding vector(384),
  created_at timestamptz,
  updated_at timestamptz,
  usage_count integer,
  last_used_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id,
    pc.product_name,
    pc.product_description,
    pc.product_hash,
    pc.suggested_category,
    pc.suggested_subcategory,
    pc.suggested_parttype,
    pc.confidence,
    pc.validation_reason,
    pc.embedding,
    pc.created_at,
    pc.updated_at,
    pc.usage_count,
    pc.last_used_at,
    1 - (pc.embedding <=> query_embedding) as similarity
  FROM product_classifications pc
  WHERE 1 - (pc.embedding <=> query_embedding) >= match_threshold
  ORDER BY pc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users and service roles
GRANT EXECUTE ON FUNCTION match_product_classifications(vector(384), float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION match_product_classifications(vector(384), float, int) TO service_role;
GRANT EXECUTE ON FUNCTION match_product_classifications(vector(384), float, int) TO anon;
GRANT EXECUTE ON FUNCTION match_product_classifications(vector(384), float, int) TO postgres;

-- Also grant with just the embedding parameter (for simpler calls)
GRANT EXECUTE ON FUNCTION match_product_classifications(vector(384)) TO authenticated;
GRANT EXECUTE ON FUNCTION match_product_classifications(vector(384)) TO service_role;
GRANT EXECUTE ON FUNCTION match_product_classifications(vector(384)) TO anon;

-- Add comment
COMMENT ON FUNCTION match_product_classifications IS 'Find similar product classifications using cosine similarity on embeddings. Returns products with similarity >= match_threshold, ordered by similarity.';
