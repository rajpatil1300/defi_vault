/**
 * RPC Request Throttling Utilities
 * 
 * Prevents rate limiting by controlling the frequency of RPC calls
 */

interface ThrottleEntry {
  lastCall: number;
  data: any;
  promise?: Promise<any>;
}

class RPCThrottle {
  private cache = new Map<string, ThrottleEntry>();
  private readonly minInterval: number;

  constructor(minIntervalMs: number = 2000) {
    this.minInterval = minIntervalMs;
  }

  /**
   * Throttle an async function call
   */
  async throttle<T>(
    key: string,
    fn: () => Promise<T>,
    cacheTimeMs: number = 30000
  ): Promise<T> {
    const now = Date.now();
    const entry = this.cache.get(key);

    // Return cached data if still fresh
    if (entry && (now - entry.lastCall) < cacheTimeMs) {
      console.log(`📋 Using cached data for ${key}`);
      return entry.data;
    }

    // Return existing promise if one is in flight
    if (entry?.promise) {
      console.log(`⏳ Waiting for existing request: ${key}`);
      return entry.promise;
    }

    // Check if we need to wait before making a new request
    if (entry && (now - entry.lastCall) < this.minInterval) {
      const waitTime = this.minInterval - (now - entry.lastCall);
      console.log(`🕐 Throttling ${key}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Make the request
    console.log(`🌐 Making RPC request: ${key}`);
    const promise = fn();
    
    // Store the promise to prevent duplicate requests
    this.cache.set(key, {
      lastCall: Date.now(),
      data: null,
      promise
    });

    try {
      const result = await promise;
      
      // Cache the result
      this.cache.set(key, {
        lastCall: Date.now(),
        data: result,
        promise: undefined
      });

      return result;
    } catch (error) {
      // Remove failed request from cache
      this.cache.delete(key);
      throw error;
    }
  }

  /**
   * Clear cache for a specific key
   */
  clearCache(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached data
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Global throttle instance
export const rpcThrottle = new RPCThrottle(1500); // Minimum 1.5 seconds between requests

/**
 * Throttled wrapper for common RPC calls
 */
export class ThrottledRPC {
  private connection: any;

  constructor(connection: any) {
    this.connection = connection;
  }

  async getBalance(publicKey: any): Promise<number> {
    const key = `balance-${publicKey.toString()}`;
    return rpcThrottle.throttle(
      key,
      () => this.connection.getBalance(publicKey),
      15000 // Cache for 15 seconds
    );
  }

  async getTokenAccountBalance(tokenAccount: any): Promise<any> {
    const key = `token-balance-${tokenAccount.toString()}`;
    return rpcThrottle.throttle(
      key,
      () => this.connection.getTokenAccountBalance(tokenAccount),
      15000 // Cache for 15 seconds
    );
  }

  async getAccountInfo(publicKey: any, commitment?: string): Promise<any> {
    const key = `account-${publicKey.toString()}-${commitment || 'confirmed'}`;
    return rpcThrottle.throttle(
      key,
      () => this.connection.getAccountInfo(publicKey, commitment),
      20000 // Cache for 20 seconds
    );
  }

  async getProgramAccounts(programId: any, config?: any): Promise<any> {
    const key = `program-accounts-${programId.toString()}-${JSON.stringify(config)}`;
    return rpcThrottle.throttle(
      key,
      () => this.connection.getProgramAccounts(programId, config),
      30000 // Cache for 30 seconds
    );
  }
}