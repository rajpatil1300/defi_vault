import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');

// Minimum Solana version that supports ComputeBudgetProgram
export const MIN_COMPUTE_BUDGET_VERSION = '1.14.0';

export const SUPPORTED_TOKENS = [
  {
    symbol: 'SOL',
    name: 'Wrapped SOL',
    mint: 'So11111111111111111111111111111111111111112', // Wrapped SOL (WSOL)
    decimals: 9,
    color: '#9945FF',
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Standard Token Program
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mainnet mint (works on devnet too)
    decimals: 6,
    color: '#2775CA',
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Standard Token Program
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT mainnet mint (works on devnet too)
    decimals: 6,
    color: '#26A17B',
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Standard Token Program
  },
];

export const CLUSTER = 'devnet';

export const INTEREST_RATES = {
  SOL: 500, // 5% APY
  USDC: 800, // 8% APY
  USDT: 750, // 7.5% APY
};

export const MIN_DEPOSITS = {
  SOL: 0.1, // 0.1 SOL
  USDC: 10, // 10 USDC
  USDT: 10, // 10 USDT
};

// RPC Configuration
export const RPC_ENDPOINTS = {
  devnet: 'https://api.devnet.solana.com',
  mainnet: 'https://api.mainnet-beta.solana.com',
  localnet: 'http://localhost:8899',
};