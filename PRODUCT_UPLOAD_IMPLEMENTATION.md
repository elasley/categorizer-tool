# Product Upload to Supabase - Implementation Complete

## Overview

Added functionality to upload products to Supabase with embedding-based category assignment using Edge Functions (no OpenAI required).

## Features Added

### 1. Product Upload Flow

- Upload products CSV file
- Click **"Categories Assign"** button to auto-assign categories using embeddings
- Click **"Upload to Supabase"** button to save products to database
- Products persist in Redux and survive page refresh

### 2. Redux State Management

New state fields in `categorizerSlice.js`:

- `productsReadyForUpload`: Boolean flag when products are ready
- `uploadingProducts`: Boolean flag during upload process

### 3. New Buttons

- **Categories Assign** (Teal button): Calls edge function to assign categories based on embeddings
- **Upload to Supabase** (Indigo button): Uploads categorized products to database

## Database Schema

Your `products` table schema is already correct:

```sql
create table public.products (
  id uuid not null default extensions.uuid_generate_v4(),
  name text not null,
  description text null,
  sku text null,
  category_id uuid not null,
  subcategory_id uuid not null,
  parttype_id uuid not null,
  embedding public.vector null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint products_pkey primary key (id),
  constraint products_sku_key unique (sku),
  constraint products_category_id_fkey foreign key (category_id) references categories (id) on delete set null,
  constraint products_parttype_id_fkey foreign key (parttype_id) references parttypes (id) on delete set null,
  constraint products_subcategory_id_fkey foreign key (subcategory_id) references subcategories (id) on delete set null
) tablespace pg_default;
```

## Supabase Edge Function Deployment

### Prerequisites

1. Install Supabase CLI:

```bash
npm install -g supabase
```

2. Login to Supabase:

```bash
supabase login
```

3. Link your project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Deploy Edge Function

Navigate to your project directory and deploy:

```bash
# Deploy the edge function
supabase functions deploy assign-categories

# Or with environment variables
supabase functions deploy assign-categories --no-verify-jwt
```

### Test the Edge Function

```bash
# Test locally
supabase functions serve assign-categories

# Invoke locally
curl -i --location --request POST 'http://localhost:54321/functions/v1/assign-categories' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "products": [
      {
        "id": "1",
        "name": "Brake Pad",
        "description": "Front brake pad for sedan"
      }
    ]
  }'
```

## How It Works

### 1. Upload Products CSV

User uploads a CSV file with columns:

- `name` or `productName`
- `description`
- `sku` or `partNumber` (optional)

### 2. Categories Assign (Edge Function)

- Generates 768-dimensional embeddings for each product (name + description)
- Compares against all categories/subcategories/parttypes using cosine similarity
- Returns best matches with confidence scores
- Updates products in Redux with assigned categories

### 3. Upload to Supabase

- Looks up category/subcategory/parttype IDs from Supabase
- Generates embeddings for each product
- Inserts products into `products` table
- Shows success/error toast notifications

## Code Changes

### Files Modified

1. `src/store/slices/categorizerSlice.js`

   - Added `productsReadyForUpload`
   - Added `uploadingProducts`
   - Added `setProductsReadyForUpload`
   - Added `setUploadingProducts`

2. `src/components/AcesPiesCategorizationTool.jsx`
   - Added `uploadProductsToSupabase()` function
   - Added `assignCategoriesViaEdgeFunction()` function
   - Added "Categories Assign" button
   - Added conditional "Upload to Supabase" button for products
   - Updated useEffect to reset upload states

### Files Created

1. `supabase/functions/assign-categories/index.ts`
   - Edge function for embedding-based categorization
   - Uses cosine similarity to match products to categories
   - Returns categorized products with confidence scores

## Usage Instructions

### For Users:

1. **Upload Categories** (if custom categories needed)

   - Click "Upload Categories" button
   - Select categories CSV file
   - Click "Upload to Supabase" to save categories

2. **Upload Products**

   - Click "Upload Products" button
   - Select products CSV file
   - Products appear in the table

3. **Assign Categories**

   - Click "Categories Assign" button (teal)
   - Edge function assigns categories based on embeddings
   - Products update with suggested categories

4. **Upload to Supabase**
   - After categories are assigned, "Upload to Supabase" button appears (indigo)
   - Click to upload all products to database
   - Success message shows count of uploaded products

### Product CSV Format

```csv
name,description,sku
"Brake Pad Front","Front brake pad for Honda Civic","BP-CIVIC-001"
"Oil Filter","Engine oil filter 10W-30","OF-10W30-002"
"Spark Plug","NGK spark plug for 4-cylinder engine","SP-NGK-003"
```

## Benefits

### No OpenAI Required

- Uses hash-based TF-IDF embeddings (same as frontend)
- Cosine similarity for matching
- Fast and cost-free
- Works offline once categories are loaded

### Persistent State

- Redux persistence keeps uploaded files across navigation
- Files remain even during Supabase upload
- Close icons to remove files when needed

### Better UX

- Clear visual feedback for each step
- Separate buttons for assign vs upload
- Toast notifications for success/errors
- Progress indicators during operations

## Testing Checklist

- [ ] Upload categories CSV → Categories saved to Supabase
- [ ] Upload products CSV → Products appear in table
- [ ] Click "Categories Assign" → Products get categories assigned
- [ ] Click "Upload to Supabase" → Products saved to database
- [ ] Check Supabase dashboard → Products table has records
- [ ] Refresh page → State persists in Redux
- [ ] Click X on file badges → Files removed from state
- [ ] Navigate between tabs → Upload continues in background

## Troubleshooting

### Edge Function Not Found

```bash
# Redeploy the function
supabase functions deploy assign-categories
```

### CORS Errors

The edge function includes CORS headers. If issues persist:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
```

### Missing Category IDs

Ensure categories/subcategories/parttypes are uploaded to Supabase first before uploading products.

### Embedding Mismatch

The edge function uses the same hash-based TF-IDF implementation as the frontend. Both generate 768-dimensional vectors.

## Next Steps

1. Deploy edge function to Supabase
2. Test with sample products CSV
3. Verify products are inserted correctly
4. Add error handling for edge cases
5. Consider batch processing for large datasets

## Support

For issues or questions, check:

- Supabase edge function logs: `supabase functions logs assign-categories`
- Browser console for frontend errors
- Network tab for API responses
