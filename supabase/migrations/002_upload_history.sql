-- Create upload_history table to track file uploads
CREATE TABLE IF NOT EXISTS upload_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT,
  description TEXT,
  products_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage bucket for product uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-uploads', 'product-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for product-uploads bucket
-- Allow all authenticated users to upload
CREATE POLICY "Anyone authenticated can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-uploads');

-- Allow all authenticated users to read
CREATE POLICY "Anyone authenticated can view uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'product-uploads');

-- Allow all authenticated users to update
CREATE POLICY "Anyone authenticated can update uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-uploads');

-- Allow all authenticated users to delete
CREATE POLICY "Anyone authenticated can delete uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-uploads');

-- Add new columns to products table if they don't exist
DO $$ 
BEGIN
  -- Add upload_history_id with foreign key constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'upload_history_id'
  ) THEN
    ALTER TABLE products ADD COLUMN upload_history_id UUID REFERENCES upload_history(id) ON DELETE SET NULL;
  END IF;
  
  -- Add file_url column to store the file path in storage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE products ADD COLUMN file_url TEXT;
  END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_products_upload_history ON products(upload_history_id);
CREATE INDEX IF NOT EXISTS idx_products_file_url ON products(file_url);
CREATE INDEX IF NOT EXISTS idx_upload_history_user ON upload_history(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_history_created ON upload_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_history_status ON upload_history(status);

-- Add RLS policies for upload_history (simplified for easier access)
ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view all upload history
CREATE POLICY "Authenticated users can view upload history"
ON upload_history FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to insert upload history
CREATE POLICY "Authenticated users can insert upload history"
ON upload_history FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to update upload history
CREATE POLICY "Authenticated users can update upload history"
ON upload_history FOR UPDATE
TO authenticated
USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for upload_history
DROP TRIGGER IF EXISTS update_upload_history_updated_at ON upload_history;
CREATE TRIGGER update_upload_history_updated_at
BEFORE UPDATE ON upload_history
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE upload_history IS 'Tracks all product upload operations with file references';
COMMENT ON COLUMN upload_history.file_url IS 'Path to the uploaded file in storage bucket';
COMMENT ON COLUMN upload_history.products_count IS 'Number of products successfully uploaded';
COMMENT ON COLUMN upload_history.status IS 'Upload status: processing, success, or failed';
