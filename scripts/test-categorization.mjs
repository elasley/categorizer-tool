#!/usr/bin/env node
/**
 * Test Semantic Categorization System
 * Tests the MiniLM-v2 based categorization with sample products
 * Run: node scripts/test-categorization.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateProductEmbedding, preloadModel } from '../utils/miniLmEmbeddings.js';

dotenv.config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test products with expected categorizations
const testProducts = [
  {
    id: 'test-1',
    name: '3M™ Nameplate Repair Tape',
    description: 'High-strength adhesive tape for industrial repairs',
    expected: {
      category: 'Adhesives & Sealants',
      subcategory: 'Industrial Tapes',
      partType: 'Repair Tape'
    }
  },
  {
    id: 'test-2',
    name: 'Bosch Professional Hammer Drill',
    description: 'Powerful corded hammer drill for concrete and masonry',
    expected: {
      category: 'Tools & Equipment',
      subcategory: 'Power Tools',
      partType: 'Drill'
    }
  },
  {
    id: 'test-3',
    name: 'Premium Engine Oil Filter',
    description: 'High-efficiency oil filter for automotive engines',
    expected: {
      category: 'Filters',
      subcategory: 'Engine Filters',
      partType: 'Oil Filter'
    }
  },
  {
    id: 'test-4',
    name: 'LED Work Light 5000 Lumens',
    description: 'Bright LED work light for automotive repair and maintenance',
    expected: {
      category: 'Lighting',
      subcategory: 'Work Lights',
      partType: 'LED Work Light'
    }
  },
  {
    id: 'test-5',
    name: 'Heavy-Duty Brake Pads',
    description: 'Ceramic brake pads for high-performance vehicles',
    expected: {
      category: 'Brake System',
      subcategory: 'Brake Components',
      partType: 'Brake Pads'
    }
  }
];

/**
 * Test the categorization system
 */
async function testCategorization() {
  console.log('🧪 Testing Semantic Categorization System\n');
  console.log('═'.repeat(70));
  
  try {
    // Preload model
    console.log('\n📦 Loading MiniLM model...');
    await preloadModel();

    // Generate embeddings for test products
    console.log('\n🔄 Generating embeddings for test products...');
    for (const product of testProducts) {
      product.embedding = await generateProductEmbedding(
        product.name,
        product.description
      );
      console.log(`  ✓ ${product.name}`);
    }

    // Call the Edge Function
    console.log('\n🚀 Calling categorization Edge Function...');
    const response = await fetch(`${supabaseUrl}/functions/v1/assign-categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        products: testProducts.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          embedding: p.embedding
        }))
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Edge Function error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();

    // Analyze results
    console.log('\n📊 Categorization Results:\n');
    console.log('═'.repeat(70));

    let correctCategory = 0;
    let correctSubcategory = 0;
    let correctPartType = 0;
    let totalConfidence = 0;

    result.categorizedProducts.forEach((categorized, index) => {
      const product = testProducts[index];
      const isCorrect = {
        category: categorized.category === product.expected.category,
        subcategory: categorized.subcategory === product.expected.subcategory,
        partType: categorized.partType === product.expected.partType
      };

      if (isCorrect.category) correctCategory++;
      if (isCorrect.subcategory) correctSubcategory++;
      if (isCorrect.partType) correctPartType++;
      totalConfidence += categorized.confidence;

      console.log(`\n${index + 1}. ${product.name}`);
      console.log(`   Confidence: ${categorized.confidence}%`);
      console.log(`   
   Category:     ${categorized.category} ${isCorrect.category ? '✅' : '❌ (expected: ' + product.expected.category + ')'}`);
      console.log(`   Subcategory:  ${categorized.subcategory} ${isCorrect.subcategory ? '✅' : '❌ (expected: ' + product.expected.subcategory + ')'}`);
      console.log(`   Part Type:    ${categorized.partType} ${isCorrect.partType ? '✅' : '❌ (expected: ' + product.expected.partType + ')'}`);
    });

    // Summary
    const total = testProducts.length;
    const avgConfidence = totalConfidence / total;

    console.log('\n' + '═'.repeat(70));
    console.log('\n📈 Test Summary:\n');
    console.log(`   Total Products:        ${total}`);
    console.log(`   Correct Categories:    ${correctCategory}/${total} (${(correctCategory/total*100).toFixed(1)}%)`);
    console.log(`   Correct Subcategories: ${correctSubcategory}/${total} (${(correctSubcategory/total*100).toFixed(1)}%)`);
    console.log(`   Correct Part Types:    ${correctPartType}/${total} (${(correctPartType/total*100).toFixed(1)}%)`);
    console.log(`   Average Confidence:    ${avgConfidence.toFixed(1)}%`);

    if (correctCategory === total && correctSubcategory === total && correctPartType === total) {
      console.log('\n✅ All tests passed! System is working correctly.\n');
    } else {
      console.log('\n⚠️  Some tests failed. Review the taxonomy or test expectations.\n');
    }

    console.log('═'.repeat(70));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run tests
testCategorization();
