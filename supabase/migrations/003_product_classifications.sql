-- Create product_classifications table for caching AI responses with vectorization
CREATE TABLE IF NOT EXISTS public.product_classifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_name TEXT NOT NULL,
    product_description TEXT,
    product_hash TEXT NOT NULL UNIQUE, -- Hash of name+description for quick lookup
    suggested_category TEXT NOT NULL,
    suggested_subcategory TEXT NOT NULL,
    suggested_parttype TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    validation_reason TEXT,
    embedding vector(384), -- MiniLM-L6-v2 embeddings (384 dimensions)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    usage_count INTEGER DEFAULT 1, -- Track how many times this classification was reused
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_classifications_hash ON public.product_classifications(product_hash);
CREATE INDEX IF NOT EXISTS idx_product_classifications_name ON public.product_classifications(product_name);
CREATE INDEX IF NOT EXISTS idx_product_classifications_embedding ON public.product_classifications USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_product_classifications_last_used ON public.product_classifications(last_used_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_classifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at
DROP TRIGGER IF EXISTS update_product_classifications_timestamp ON public.product_classifications;
CREATE TRIGGER update_product_classifications_timestamp
    BEFORE UPDATE ON public.product_classifications
    FOR EACH ROW
    EXECUTE FUNCTION update_product_classifications_updated_at();

-- Enable RLS
ALTER TABLE public.product_classifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow authenticated users to read classifications" ON public.product_classifications
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert classifications" ON public.product_classifications
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update classifications" ON public.product_classifications
    FOR UPDATE TO authenticated USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.product_classifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.product_classifications TO service_role;

-- Add comment
COMMENT ON TABLE public.product_classifications IS 'Stores AI classification results with embeddings for fast lookup and reuse';
