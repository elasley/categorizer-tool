// src/utils/categoryMatcher.js - Simplified version that works with your existing structure

import { acesCategories } from '../data/acesCategories';

// Simple brand rules (you can expand this later)
const simpleBrandRules = {
  '3m': {
    'sandpaper|sanding disc|body work': {
      category: 'Fluids & Chemicals',
      subcategory: 'Body & Paint Supplies',
      partType: 'Sandpaper',
      confidence: 90
    }
  },
  'loctite': {
    'threadlocker|thread locker': {
      category: 'Fluids & Chemicals',
      subcategory: 'Adhesives & Sealants',
      partType: 'Thread Sealants',
      confidence: 90
    }
  },
  'gates': {
    'timing belt|belt': {
      category: 'Engine',
      subcategory: 'Timing Components',
      partType: 'Timing Belts',
      confidence: 85
    }
  },
  'bendix': {
    'brake pad|brake pads': {
      category: 'Brake System',
      subcategory: 'Brake Components',
      partType: 'Brake Pads',
      confidence: 90
    }
  }
};

/**
 * Main categorization function
 */
export const suggestCategory = (productName, description = '', brand = '', title = '') => {
  const text = `${productName} ${title} ${description} ${brand}`.toLowerCase().trim();
  
  if (!text) {
    return {
      category: '',
      subcategory: '',
      partType: '',
      confidence: 0,
      matchReasons: ['No text provided']
    };
  }

  // 1. Try brand-specific rules first
  const brandMatch = checkBrandRules(text, brand);
  if (brandMatch && brandMatch.confidence > 75) {
    return brandMatch;
  }

  // 2. Try keyword matching
  const keywordMatch = findKeywordMatches(text);
  if (keywordMatch && keywordMatch.confidence > 40) {
    return keywordMatch;
  }

  // 3. Return brand match even if lower confidence
  if (brandMatch) {
    return brandMatch;
  }

  return {
    category: '',
    subcategory: '',
    partType: '',
    confidence: 0,
    matchReasons: ['No matching patterns found']
  };
};

/**
 * Check brand-specific rules
 */
const checkBrandRules = (text, brand) => {
  // Try explicit brand first
  let detectedBrand = brand ? brand.toLowerCase() : null;
  
  // If no explicit brand, try to detect from text
  if (!detectedBrand) {
    detectedBrand = Object.keys(simpleBrandRules).find(b => text.includes(b));
  }
  
  if (!detectedBrand || !simpleBrandRules[detectedBrand]) {
    return null;
  }
  
  const rules = simpleBrandRules[detectedBrand];
  
  for (const [keywords, rule] of Object.entries(rules)) {
    const keywordRegex = new RegExp(keywords, 'i');
    if (keywordRegex.test(text)) {
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        partType: rule.partType,
        confidence: rule.confidence,
        matchReasons: [`Brand rule: ${detectedBrand} - ${keywords.split('|')[0]}`]
      };
    }
  }
  
  return null;
};

/**
 * Find keyword matches
 */
const findKeywordMatches = (text) => {
  const words = text.split(/\s+/).filter(w => w.length > 2);
  let bestMatch = null;
  let bestScore = 0;

  Object.entries(acesCategories).forEach(([category, subcategories]) => {
    Object.entries(subcategories).forEach(([subcategory, partTypes]) => {
      partTypes.forEach(partType => {
        const score = calculateScore(partType, words, text);
        
        if (score > bestScore && score > 20) {
          bestScore = score;
          bestMatch = {
            category,
            subcategory,
            partType,
            confidence: Math.min(85, score),
            matchReasons: [`Keyword match: "${partType}"`]
          };
        }
      });
    });
  });

  return bestMatch;
};

/**
 * Calculate simple scoring
 */
const calculateScore = (partType, words, fullText) => {
  const partWords = partType.toLowerCase().split(/\s+/);
  let score = 0;

  // Exact phrase match (highest score)
  if (fullText.includes(partType.toLowerCase())) {
    return 80;
  }

  // Word matching
  partWords.forEach(partWord => {
    if (words.includes(partWord)) {
      if (partWord.length > 6) {
        score += 20; // Long words are more specific
      } else if (partWord.length > 4) {
        score += 15;
      } else {
        score += 10;
      }
    }
  });

  // Bonus for multiple word matches
  const matchedWords = partWords.filter(word => words.includes(word));
  if (matchedWords.length > 1) {
    score += matchedWords.length * 5;
  }

  return score;
};

/**
 * Batch processing function
 */
export const batchCategorize = async (products, onProgress) => {
  const results = [];
  const batchSize = 100;
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    
    const batchResults = batch.map(product => {
      const productName = product.name || product.Name || '';
      const description = product.description || product.Description || '';
      const brand = product.brand || product.Brand || '';
      const title = product.title || product.Title || '';
      
      const suggestion = suggestCategory(productName, description, brand, title);
      
      let status = 'low-confidence';
      if (suggestion.confidence > 70) {
        status = 'high-confidence';
      } else if (suggestion.confidence > 40) {
        status = 'needs-review';
      }
      
      return {
        ...product,
        suggestedCategory: suggestion.category,
        suggestedSubcategory: suggestion.subcategory,
        suggestedPartType: suggestion.partType,
        confidence: suggestion.confidence,
        matchReasons: suggestion.matchReasons || [],
        status
      };
    });
    
    results.push(...batchResults);
    
    // Update progress
    if (onProgress) {
      onProgress(results.length, products.length);
    }
    
    // Small delay to prevent blocking
    if (i + batchSize < products.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  return results;
};