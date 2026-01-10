/**
 * IndexedDB Storage Utility for Large Product Datasets
 * Replaces sessionStorage with IndexedDB for better performance and larger capacity
 * 
 * Benefits:
 * - sessionStorage: ~5-10MB limit
 * - IndexedDB: 50MB+ capacity
 * - Async operations (non-blocking)
 * - Better for large datasets (996+ products)
 */

const DB_NAME = 'CategorizerDB';
const DB_VERSION = 1;
const STORE_NAME = 'products';

let dbInstance = null;

/**
 * Initialize IndexedDB connection
 */
const initDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('❌ IndexedDB failed to open:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('✅ IndexedDB opened successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('✅ IndexedDB object store created');
      }
    };
  });
};

/**
 * Save all products to IndexedDB
 * @param {Array} products - Array of product objects
 * @returns {Promise<boolean>} - Success status
 */
export const saveAllProductsToDB = async (products) => {
  try {
    console.log(`💾 Attempting to save ${products.length} products to IndexedDB...`);
    const startTime = Date.now();
    
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Save products
    await new Promise((resolve, reject) => {
      const putRequest = store.put({
        key: 'all_products',
        data: products,
        timestamp: Date.now(),
        count: products.length
      });

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });

    // Save metadata
    await new Promise((resolve, reject) => {
      const metaRequest = store.put({
        key: 'meta',
        total: products.length,
        lastUpdated: Date.now()
      });

      metaRequest.onsuccess = () => resolve();
      metaRequest.onerror = () => reject(metaRequest.error);
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Successfully saved ${products.length} products to IndexedDB in ${duration}ms`);
    return true;
  } catch (error) {
    console.error('❌ Failed to save to IndexedDB:', error);
    return false;
  }
};

/**
 * Get all products from IndexedDB
 * @returns {Promise<Array>} - Array of products
 */
export const getAllProductsFromDB = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get('all_products');

      request.onsuccess = () => {
        if (request.result && request.result.data) {
          console.log(`📦 Retrieved ${request.result.data.length} products from IndexedDB`);
          resolve(request.result.data);
        } else {
          resolve([]);
        }
      };

      request.onerror = () => {
        console.error('❌ Failed to retrieve from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('❌ Failed to load from IndexedDB:', error);
    return [];
  }
};

/**
 * Get metadata from IndexedDB
 * @returns {Promise<Object>} - Metadata object
 */
export const getMetaFromDB = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get('meta');

      request.onsuccess = () => {
        if (request.result) {
          resolve({
            total: request.result.total || 0,
            lastUpdated: request.result.lastUpdated || 0
          });
        } else {
          resolve({ total: 0, lastUpdated: 0 });
        }
      };

      request.onerror = () => {
        console.error('❌ Failed to retrieve meta from IndexedDB:', request.error);
        resolve({ total: 0, lastUpdated: 0 });
      };
    });
  } catch (error) {
    console.error('❌ Failed to load meta from IndexedDB:', error);
    return { total: 0, lastUpdated: 0 };
  }
};

/**
 * Load a specific page of products
 * @param {number} pageNum - Page number (1-based)
 * @param {number} itemsPerPage - Items per page
 * @returns {Promise<Array>} - Page of products
 */
export const loadPageFromDB = async (pageNum, itemsPerPage = 50) => {
  try {
    const allProducts = await getAllProductsFromDB();
    const start = (pageNum - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageChunk = allProducts.slice(start, end);
    
    console.log(`📄 Loading page ${pageNum}: ${pageChunk.length} products from IndexedDB`);
    return pageChunk;
  } catch (error) {
    console.error('❌ Failed to load page from IndexedDB:', error);
    return [];
  }
};

/**
 * Clear all data from IndexedDB
 */
export const clearDB = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        console.log('🗑️ IndexedDB cleared successfully');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('❌ Failed to clear IndexedDB:', error);
  }
};

/**
 * Delete the entire database (for debugging)
 */
export const deleteDB = () => {
  return new Promise((resolve, reject) => {
    dbInstance = null;
    const request = indexedDB.deleteDatabase(DB_NAME);
    
    request.onsuccess = () => {
      console.log('🗑️ IndexedDB deleted successfully');
      resolve();
    };
    
    request.onerror = () => {
      console.error('❌ Failed to delete IndexedDB');
      reject(request.error);
    };
  });
};

/**
 * Get database size estimate
 */
export const getDBSize = async () => {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        usageMB: (estimate.usage / 1024 / 1024).toFixed(2),
        quotaMB: (estimate.quota / 1024 / 1024).toFixed(2),
        percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(1)
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to get storage estimate:', error);
    return null;
  }
};
