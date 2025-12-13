-- ============================================
-- COMPLETE SETUP - COPY AND RUN THIS ENTIRE SCRIPT
-- ============================================
-- This script creates everything needed for file uploads
-- Run in: Supabase Dashboard → SQL Editor → New Query

BEGIN;

-- 1. Create upload_history table
CREATE TABLE IF NOT EXISTS upload_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT,
  description TEXT,
  products_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add columns to products table
DO $$ 
BEGIN
  -- Add upload_history_id column with foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'products' 
    AND column_name = 'upload_history_id'
  ) THEN
    ALTER TABLE public.products 
    ADD COLUMN upload_history_id UUID;
    
    -- Add foreign key constraint
    ALTER TABLE public.products 
    ADD CONSTRAINT products_upload_history_id_fkey 
    FOREIGN KEY (upload_history_id) 
    REFERENCES upload_history(id) 
    ON DELETE SET NULL;
  END IF;
  
  -- Add file_url column to store storage path
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'products' 
    AND column_name = 'file_url'
  ) THEN
    ALTER TABLE public.products 
    ADD COLUMN file_url TEXT;
  END IF;
END $$;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_upload_history ON products(upload_history_id);
CREATE INDEX IF NOT EXISTS idx_products_file_url ON products(file_url);
CREATE INDEX IF NOT EXISTS idx_upload_history_user ON upload_history(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_history_created ON upload_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_history_status ON upload_history(status);

-- 4. Enable RLS
ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for upload_history
DROP POLICY IF EXISTS "Allow all authenticated to view upload_history" ON upload_history;
DROP POLICY IF EXISTS "Allow all authenticated to insert upload_history" ON upload_history;
DROP POLICY IF EXISTS "Allow all authenticated to update upload_history" ON upload_history;

CREATE POLICY "Allow all authenticated to view upload_history"
ON upload_history FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow all authenticated to insert upload_history"
ON upload_history FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow all authenticated to update upload_history"
ON upload_history FOR UPDATE
TO authenticated
USING (true);

-- 6. Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-uploads', 'product-uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 7. Create storage policies
DROP POLICY IF EXISTS "Allow authenticated uploads to product-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from product-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to product-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from product-uploads" ON storage.objects;

CREATE POLICY "Allow authenticated uploads to product-uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-uploads');

CREATE POLICY "Allow authenticated reads from product-uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'product-uploads');

CREATE POLICY "Allow authenticated updates to product-uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-uploads');

CREATE POLICY "Allow authenticated deletes from product-uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-uploads');

-- 8. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_upload_history_updated_at ON upload_history;
CREATE TRIGGER update_upload_history_updated_at
BEFORE UPDATE ON upload_history
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- Verify everything was created
SELECT 'Setup Complete!' as message;
SELECT 'upload_history table' as component, COUNT(*) as rows FROM upload_history;
SELECT 'storage bucket' as component, name, public FROM storage.buckets WHERE id = 'product-uploads';
SELECT 'RLS policies' as component, COUNT(*) as count FROM pg_policies WHERE tablename = 'upload_history';

-- Success! You can now upload products with file storage.
