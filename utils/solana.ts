import { Connection, ConnectionConfig } from '@solana/web3.js';
import { RPC_ENDPOINTS } from './constants';

// Connection pool to reuse connections
let connectionInstance: Connection | null = null;

/**
 * Enhanced Solana RPC connection with rate limiting protection
 * 
 * Features:
 * - Connection pooling to reuse connections
 * - Optimized commitment levels
 * - Extended timeouts for better reliability
 * - Support for private RPC endpoints
 */
export function getConnection(): Connection {
  if (connectionInstance) {
    return connectionInstance;
  }

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 
                 process.env.NEXT_PUBLIC_RPC_ENDPOINT || 
                 RPC_ENDPOINTS.devnet;
  
  console.log('🌐 Initializing RPC connection:', rpcUrl);
  
  // Optimized connection config to reduce RPC calls
  const config: ConnectionConfig = {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
    disableRetryOnRateLimit: false,
    httpHeaders: {
      'Content-Type': 'application/json',
    },
  };

  // Add rate limiting headers if using a private RPC
  if (rpcUrl.includes('helius') || rpcUrl.includes('quicknode') || rpcUrl.includes('alchemy')) {
    console.log('🚀 Using private RPC endpoint for better performance');
  } else {
    console.log('⚠️ Using public RPC - consider upgrading to private RPC for production');
  }

  connectionInstance = new Connection(rpcUrl, config);
  return connectionInstance;
}

/**
 * Get cluster name from RPC URL
 */
export function getCluster(): string {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 
                 process.env.NEXT_PUBLIC_RPC_ENDPOINT || 
                 RPC_ENDPOINTS.devnet;
  
  if (rpcUrl.includes('devnet')) return 'devnet';
  if (rpcUrl.includes('mainnet')) return 'mainnet-beta';
  if (rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1')) return 'localnet';
  
  return 'devnet'; // default
}

/**
 * Reset connection instance (useful for testing or switching endpoints)
 */
export function resetConnection(): void {
  connectionInstance = null;
}