# Quick Start Guide - Semantic Categorization

## 🚀 Setup (One-time)

### 1. Install Dependencies

```bash
npm install
```

### 2. Verify Environment Variables

Create `.env` file with:

```
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Generate Taxonomy Embeddings

```bash
npm run generate-taxonomy-embeddings
```

**Expected Output**:

```
🚀 Starting taxonomy embedding generation with MiniLM-v2
Model: Xenova/all-MiniLM-L6-v2 (384 dimensions)
🔄 Loading MiniLM-L6-v2 model...
✅ MiniLM model loaded and cached

📦 Generating category embeddings...
Found 21 categories
  Progress: 1/21
  ...
✅ Generated embeddings for 21 categories

📦 Generating subcategory embeddings...
Found 256 subcategories
  ...
✅ Generated embeddings for 256 subcategories

📦 Generating part type embeddings...
Found 392 part types
  ...
✅ Generated embeddings for 392 part types

✅ All taxonomy embeddings generated successfully!
```

## 📦 Product Categorization Workflow

### Step 1: Generate Product Embeddings

```bash
npm run generate-product-embeddings
```

This generates 384-dimensional MiniLM embeddings for all products in your database.

**What it does**:

- Fetches products in batches (100 at a time)
- Formats text as: `"Product title: {name} Product description: {description}"`
- Generates MiniLM embedding (384 dimensions)
- Updates `products.embedding` column in database

### Step 2: Call Categorization Edge Function

**From UI**: Upload CSV → Products automatically categorized

**From Code**:

```javascript
const { data, error } = await supabase.functions.invoke('assign-categories', {
  body: {
    products: [
      {
        id: 'uuid-123',
        name: '3M™ Nameplate Repair Tape',
        description: 'Durable adhesive tape for nameplate repairs',
        embedding: [...] // 384-dimensional vector (required!)
      }
    ]
  }
});

// Result:
console.log(data.categorizedProducts);
// [
//   {
//     id: 'uuid-123',
//     category: 'Adhesives & Sealants',
//     subcategory: 'Industrial Tapes',
//     partType: 'Repair Tape',
//     confidence: 87
//   }
// ]
```

## 🔄 When to Regenerate Embeddings

### Regenerate Taxonomy Embeddings When:

- ✅ Adding new categories/subcategories/part types
- ✅ Renaming taxonomy items
- ✅ Changing taxonomy structure

```bash
npm run generate-taxonomy-embeddings
```

### Regenerate Product Embeddings When:

- ✅ Uploading new products
- ✅ Updating product names/descriptions
- ✅ Before running categorization

```bash
npm run generate-product-embeddings
```

## 🎯 How It Works

### Text Formatting

```javascript
// Taxonomy uses prefixes
Category:     "Category: Adhesives & Sealants"
Subcategory:  "Subcategory: Industrial Tapes"
Part Type:    "Part type: Repair Tape"

// Products use title + description format
Product:      "Product title: 3M™ Nameplate Repair Tape Product description: Durable adhesive..."
```

### Matching Algorithm

```
1. Compare product embedding with ALL category embeddings
   → Select best category (e.g., "Adhesives & Sealants")

2. Compare with subcategories in that category
   → Select best subcategory (e.g., "Industrial Tapes")
   → If no good match, search ALL subcategories

3. Compare with part types in that subcategory
   → Select best part type (e.g., "Repair Tape")
   → If no good match, check other subcategories in same category
   → Final fallback: search ALL part types

4. Calculate weighted confidence:
   confidence = category_similarity × 20% +
                subcategory_similarity × 30% +
                parttype_similarity × 50%
```

### Confidence Scores

- **High (≥70%)**: 🟢 Production-ready, automatic assignment
- **Medium (50-69%)**: 🟡 Good match, review recommended
- **Low (<50%)**: 🔴 Manual verification required

## 🛠️ Troubleshooting

### Issue: All products getting same category

**Solution**:

```bash
# 1. Regenerate taxonomy embeddings
npm run generate-taxonomy-embeddings

# 2. Regenerate product embeddings
npm run generate-product-embeddings

# 3. Verify embeddings exist
node test-embeddings.js
```

### Issue: Products not getting assigned

**Check**:

1. Products have `embedding` column populated
2. Taxonomy has embeddings in database
3. Edge Function logs for errors: `supabase functions logs assign-categories`

### Issue: Low confidence scores

**Possible causes**:

- Product descriptions too short/vague
- Taxonomy names not semantically meaningful
- Missing relevant taxonomy items

**Solutions**:

- Add more detailed product descriptions
- Rename taxonomy items to be more specific
- Add missing categories/subcategories/part types

## 📊 Testing

### Test Embeddings

```bash
node test-embeddings.js
```

**Output**:

```
🔍 Testing Database Embeddings...

📁 Found 21 categories
1. Category: Adhesives & Sealants
   Embedding type: object
   Is array: true
   Length: 384
   Non-zero values: 384
   Sample: [0.0234, -0.0567, 0.0123, ...]
```

### Test Categorization

```bash
node scripts/test-categorization.mjs
```

## 🎨 Example: Categorizing 3M Products

```javascript
// Input Products
[
  { name: "3M™ Nameplate Repair Tape", description: "Durable repair tape..." },
  { name: "3M™ Roloc™ Disc Pad Assembly", description: "Quick-change disc..." },
  { name: "3M™ Scotch® Masking Tape", description: "General purpose..." },
][
  // Categorization Results
  ({
    product: "3M™ Nameplate Repair Tape",
    category: "Adhesives & Sealants",
    subcategory: "Industrial Tapes",
    partType: "Repair Tape",
    confidence: 87,
  },
  {
    product: "3M™ Roloc™ Disc Pad Assembly",
    category: "Tools & Equipment",
    subcategory: "Abrasives",
    partType: "Disc Pad Assemblies",
    confidence: 92,
  },
  {
    product: "3M™ Scotch® Masking Tape",
    category: "Adhesives & Sealants",
    subcategory: "Industrial Tapes",
    partType: "Masking Tapes",
    confidence: 89,
  })
];
```

## 🔧 NPM Scripts

```bash
# Generate all embeddings (taxonomy + products)
npm run generate-embeddings

# Generate taxonomy embeddings only
npm run generate-taxonomy-embeddings

# Generate product embeddings only
npm run generate-product-embeddings

# Start development server
npm start

# Build for production
npm build
```

## 📝 Important Notes

1. ⚠️ **Edge Function NEVER generates embeddings** - it only loads pre-computed ones
2. ⚠️ **Always generate product embeddings BEFORE categorization**
3. ⚠️ **Embeddings are 384-dimensional** (MiniLM-v2 specification)
4. ⚠️ **Text formatting matters** - use proper prefixes for taxonomy
5. ⚠️ **Model caching** - MiniLM loads once per script execution

## 🎯 Best Practices

1. ✅ Run `npm run generate-taxonomy-embeddings` after taxonomy changes
2. ✅ Run `npm run generate-product-embeddings` before categorizing new products
3. ✅ Monitor confidence scores and review low matches
4. ✅ Keep product descriptions detailed and specific
5. ✅ Use semantic taxonomy names (not codes or abbreviations)
6. ✅ Test with sample products before processing large batches
7. ✅ Check Edge Function logs for debugging

## 📚 Additional Resources

- **Full Documentation**: `SEMANTIC_CATEGORIZATION_GUIDE.md`
- **Edge Function Code**: `supabase/functions/assign-categories/index.ts`
- **Utility Functions**: `utils/miniLmEmbeddings.mjs`
- **Scripts**: `scripts/generate-*-embeddings.mjs`

## 🆘 Support

**Check logs**:

```bash
supabase functions logs assign-categories --tail
```

**Verify database**:

```sql
-- Check if embeddings exist
SELECT
  COUNT(*) as total,
  COUNT(embedding) as with_embeddings
FROM categories;

-- Should show: total = with_embeddings
```

**Test model locally**:

```bash
node -e "import('@xenova/transformers').then(m => console.log('✅ Transformers loaded'))"
```
