# Production-Ready Semantic Categorization System

## Overview

This system uses **MiniLM-v2 embeddings** for semantic product categorization with **pure cosine similarity matching**. NO keyword matching, NO TF-IDF, NO regex rules.

## Architecture

### Model Specifications

- **Model**: `Xenova/all-MiniLM-L6-v2` via `@xenova/transformers`
- **Dimensions**: 384 (mean-pooled, L2-normalized)
- **Storage**: PostgreSQL with pgvector(384)
- **Matching**: Pure cosine similarity

### Key Principles

1. ✅ **ALL embedding generation happens in Node.js** (never in Edge Functions)
2. ✅ **Edge Functions ONLY load pre-computed embeddings** from database
3. ✅ **Hierarchical matching**: Category → Subcategory → Part Type
4. ✅ **Professional part type fix**: Check parent category's subcategories before global fallback
5. ✅ **Weighted confidence**: Category 20%, Subcategory 30%, Part Type 50%

## Text Formatting Standards

### Taxonomy Embeddings

```javascript
Category:     "Category: {name}"
Subcategory:  "Subcategory: {name}"
Part Type:    "Part type: {name}"
```

### Product Embeddings

```javascript
Product: "Product title: {name} Product description: {description}";
```

## Database Schema

All taxonomy and product tables must have `embedding vector(384)` column:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Subcategories
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Part Types
ALTER TABLE parttypes ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Products
ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(384);
```

## Workflow

### 1. Generate Taxonomy Embeddings (One-time setup)

```bash
npm run generate-taxonomy-embeddings
```

This script:

- Loads all categories, subcategories, and part types from database
- Generates MiniLM embeddings with proper prefixes
- Updates database with 384-dimensional vectors
- Uses model caching for performance

**Files**: `scripts/generate-taxonomy-embeddings.mjs`

### 2. Generate Product Embeddings (Before categorization)

```bash
npm run generate-product-embeddings
```

This script:

- Fetches products in batches (default: 100)
- Generates embeddings from product title + description
- Updates database with embeddings
- Processes thousands of products efficiently

**Files**: `scripts/generate-product-embeddings.mjs`

### 3. Categorize Products (Supabase Edge Function)

The Edge Function `assign-categories`:

- **ONLY loads pre-computed embeddings** from database
- Computes cosine similarity between product and taxonomy
- Applies hierarchical matching with professional part type fix
- Returns categorized products with confidence scores

```json
{
  "categorizedProducts": [
    {
      "id": "product-uuid",
      "category": "Adhesives & Sealants",
      "subcategory": "Industrial Tapes",
      "partType": "Repair Tape",
      "confidence": 87
    }
  ]
}
```

## Hierarchical Matching Algorithm

### Step 1: Find Best Category

```typescript
for each category:
  similarity = cosineSimilarity(productEmbedding, categoryEmbedding)
  track best match
```

### Step 2: Find Best Subcategory

```typescript
// First try within selected category's subcategories
for each subcategory in category:
  similarity = cosineSimilarity(productEmbedding, subcategoryEmbedding)
  track best match

// Fallback: search all subcategories if match is weak
if similarity < 0.3:
  for each subcategory globally:
    find best match
```

### Step 3: Find Best Part Type (with professional fix)

```typescript
// First try within selected subcategory's part types
for each partType in subcategory:
  similarity = cosineSimilarity(productEmbedding, partTypeEmbedding)
  track best match

// Professional Fix: Check parent category's other subcategories
if similarity < 0.35:
  for each other_subcategory in category:
    for each partType in other_subcategory:
      find best match

// Final fallback: search all part types
if similarity < 0.3:
  for each partType globally:
    find best match
```

### Step 4: Calculate Weighted Confidence

```typescript
confidence =
  (categorySimilarity * 0.2 + // Category: 20%
    subcategorySimilarity * 0.3 + // Subcategory: 30%
    partTypeSimilarity * 0.5) * // Part Type: 50% (most specific)
  100;
```

## File Structure

```
categorizer-tool/
├── utils/
│   └── miniLmEmbeddings.mjs          # MiniLM embedding utilities
├── scripts/
│   ├── generate-taxonomy-embeddings.mjs   # Generate taxonomy embeddings
│   ├── generate-product-embeddings.mjs    # Generate product embeddings
│   └── test-categorization.mjs           # Test categorization
├── supabase/
│   └── functions/
│       └── assign-categories/
│           └── index.ts              # Edge Function (NO embedding generation!)
└── package.json                      # npm scripts
```

## Utility Functions

### `miniLmEmbeddings.mjs`

```javascript
// Model caching (loads once per process)
await preloadModel();

// Taxonomy embeddings (with prefixes)
generateCategoryEmbedding(name); // "Category: {name}"
generateSubcategoryEmbedding(name); // "Subcategory: {name}"
generatePartTypeEmbedding(name); // "Part type: {name}"

// Product embeddings (with title/description format)
generateProductEmbedding(name, desc); // "Product title: {name} Product description: {desc}"

// Similarity calculation
cosineSimilarity(vec1, vec2); // Returns 0-1
```

## Example Usage

### 1. Initial Setup

```bash
# Install dependencies
npm install

# Generate taxonomy embeddings (one-time)
npm run generate-taxonomy-embeddings
```

### 2. Before Categorizing New Products

```bash
# Generate embeddings for products
npm run generate-product-embeddings
```

### 3. Categorize Products

```typescript
// Call Edge Function with products (embeddings already in DB)
const response = await supabaseClient.functions.invoke('assign-categories', {
  body: {
    products: [
      { id: 'uuid-1', name: '3M™ Nameplate Repair Tape', description: 'Durable repair tape...', embedding: [...] },
      { id: 'uuid-2', name: '3M™ Roloc™ Disc Pad', description: 'Quick-change disc...', embedding: [...] }
    ]
  }
});

// Result:
// Product 1: Adhesives & Sealants → Industrial Tapes → Repair Tape (87% confidence)
// Product 2: Tools & Equipment → Abrasives → Disc Pads (92% confidence)
```

## Performance Optimization

### Model Caching

```javascript
// Model loads once per process (Node.js)
let cachedPipeline = null;

async function getEmbeddingPipeline() {
  if (!cachedPipeline) {
    console.log("🔄 Loading MiniLM model...");
    cachedPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return cachedPipeline;
}
```

### Batch Processing

```javascript
// Process products in batches
const batchSize = 100;
for (let offset = 0; offset < totalProducts; offset += batchSize) {
  const batch = await fetchProducts(offset, batchSize);
  await processBatch(batch);
}
```

### Database Indexing

```sql
-- Add indexes for performance
CREATE INDEX idx_categories_embedding ON categories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_subcategories_embedding ON subcategories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_parttypes_embedding ON parttypes USING ivfflat (embedding vector_cosine_ops);
```

## Quality Metrics

### Confidence Distribution

- **High (≥70%)**: Production-ready matches
- **Medium (50-69%)**: Review recommended
- **Low (<50%)**: Manual verification required

### Example Output

```
✅ Categorization complete: 1247/1250 products
📊 Confidence distribution: 1089 high (≥70%), 128 medium (50-69%), 30 low (<50%)
📈 Average confidence: 78.3%
```

## Troubleshooting

### Products not getting assigned

```bash
# Check if products have embeddings
node test-embeddings.js

# Regenerate product embeddings
npm run generate-product-embeddings
```

### All products getting same category

1. Verify taxonomy embeddings exist: `npm run generate-taxonomy-embeddings`
2. Check text formatting matches standard prefixes
3. Ensure product embeddings are pre-computed (not generated in Edge Function)

### Low confidence scores

1. Verify taxonomy completeness (all categories/subcategories/part types)
2. Check product descriptions are detailed enough
3. Review if taxonomy names are semantically meaningful

## Best Practices

1. ✅ Always generate embeddings in Node.js (never in Edge Functions)
2. ✅ Use proper text formatting with prefixes
3. ✅ Pre-compute all embeddings before categorization
4. ✅ Cache the MiniLM model in scripts
5. ✅ Process products in batches for efficiency
6. ✅ Monitor confidence scores and review low matches
7. ✅ Keep taxonomy well-structured and hierarchical

## API Reference

### Edge Function: `assign-categories`

**Endpoint**: `/functions/v1/assign-categories`

**Request**:

```json
{
  "products": [
    {
      "id": "uuid",
      "name": "Product Name",
      "description": "Product description",
      "embedding": [0.123, -0.456, ...]  // 384-dimensional vector (required!)
    }
  ]
}
```

**Response**:

```json
{
  "categorizedProducts": [
    {
      "id": "uuid",
      "category": "Category Name",
      "subcategory": "Subcategory Name",
      "partType": "Part Type Name",
      "confidence": 87
    }
  ],
  "totalProcessed": 1,
  "totalRequested": 1,
  "averageConfidence": 87.0,
  "confidenceDistribution": {
    "high": 1,
    "medium": 0,
    "low": 0
  }
}
```

## Support

For issues or questions:

1. Check Edge Function logs: `supabase functions logs assign-categories`
2. Test embeddings: `node test-embeddings.js`
3. Verify database schema includes `embedding vector(384)` columns
4. Ensure `@xenova/transformers@^2.17.2` is installed

## License

MIT
