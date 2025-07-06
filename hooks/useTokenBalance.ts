'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { SUPPORTED_TOKENS } from '@/utils/constants';
import { getConnection } from '@/utils/solana';
import { rpcThrottle } from '@/utils/rpc-throttle';

export function useTokenBalance(tokenSymbol: string) {
  const { publicKey } = useWallet();
  const connection = getConnection();

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track if component is mounted
  const mountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const token = SUPPORTED_TOKENS.find(t => t.symbol === tokenSymbol);

  const fetchBalance = useCallback(async () => {
    if (!publicKey || !token || !mountedRef.current) {
      setBalance(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (token.symbol === 'SOL') {
        // Native SOL balance with throttling
        const cacheKey = `sol-balance-${publicKey.toString()}`;
        const lamports = await rpcThrottle.throttle(
          cacheKey,
          () => connection.getBalance(publicKey),
          20000 // Cache for 20 seconds
        );
        
        if (mountedRef.current) {
          const solBalance = lamports / 1e9; // lamports → SOL
          setBalance(solBalance);
          console.log(`💰 SOL Balance: ${solBalance} SOL (cached)`);
        }
      } else {
        // SPL token balance with throttling - use appropriate token program
        const tokenMint = new PublicKey(token.mint);
        const tokenProgram = token.symbol === 'SOL' ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
        
        const userTokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          publicKey,
          false,
          tokenProgram
        );

        const cacheKey = `token-balance-${userTokenAccount.toString()}`;
        
        try {
          const account = await rpcThrottle.throttle(
            cacheKey,
            () => getAccount(
              connection,
              userTokenAccount,
              'confirmed',
              tokenProgram
            ),
            20000 // Cache for 20 seconds
          );

          if (mountedRef.current) {
            // Convert from token's base units to display units
            const balanceInBaseUnits = Number(account.amount);
            const balanceInDisplayUnits = balanceInBaseUnits / Math.pow(10, token.decimals);
            setBalance(balanceInDisplayUnits);
            console.log(`💰 ${token.symbol} Balance: ${balanceInDisplayUnits} ${token.symbol} (cached)`);
          }
        } catch (err) {
          // Token account doesn't exist, balance is 0
          if (mountedRef.current) {
            console.log(`📭 Token account doesn't exist for ${token.symbol}, balance = 0`);
            setBalance(0);
          }
        }
      }
    } catch (err: any) {
      console.error('❌ Error fetching token balance:', err);
      if (mountedRef.current) {
        // Don't show error for rate limiting - just use cached data
        if (!err.message?.includes('429') && !err.message?.includes('Too many requests')) {
          setError(`Failed to fetch ${token.symbol} balance`);
        }
        setBalance(0);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [publicKey, token, connection, tokenSymbol]);

  // Manual refresh function
  const refresh = useCallback(() => {
    // Clear cache for this token to force fresh data
    if (publicKey && token) {
      const tokenProgram = token.symbol === 'SOL' ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
      const cacheKey = token.symbol === 'SOL' 
        ? `sol-balance-${publicKey.toString()}`
        : `token-balance-${getAssociatedTokenAddressSync(
            new PublicKey(token.mint),
            publicKey,
            false,
            tokenProgram
          ).toString()}`;
      
      rpcThrottle.clearCache(cacheKey);
    }
    fetchBalance();
  }, [fetchBalance, publicKey, token]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Initial fetch
    fetchBalance();
    
    // Set up polling with longer interval to avoid rate limiting
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        fetchBalance();
      }
    }, 120000); // Fetch every 2 minutes instead of 1 minute

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchBalance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    balance,
    loading,
    error,
    refresh,
  };
}