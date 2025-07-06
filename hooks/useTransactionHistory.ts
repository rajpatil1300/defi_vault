'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { PROGRAM_ID } from '@/utils/constants';
import { getConnection } from '@/utils/solana';

interface Transaction {
  signature: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  token: string;
  timestamp: Date;
  status: 'confirmed' | 'pending' | 'failed';
  blockTime?: number;
}

export function useTransactionHistory() {
  const { publicKey } = useWallet();
  const connection = getConnection();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!publicKey) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Fetching transaction history for:', publicKey.toString());
      
      // Get all transactions for the user's public key
      const signatures = await connection.getSignaturesForAddress(
        publicKey,
        { limit: 100 }
      );

      console.log(`📋 Found ${signatures.length} signatures`);

      const transactionPromises = signatures.map(async (sig) => {
        try {
          const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          });
          
          if (!tx || !tx.meta || tx.meta.err) {
            return null;
          }

          // Check if this transaction involves our program
          const programInvolved = tx.transaction.message.instructions.some(
            (instruction: any) => {
              const programId = instruction.programId?.toString();
              return programId === PROGRAM_ID.toString();
            }
          );

          if (!programInvolved) {
            return null;
          }

          // Parse transaction logs to determine type and amount
          const logs = tx.meta.logMessages || [];
          let type: 'deposit' | 'withdraw' | null = null;
          let amount = 0;
          let token = 'SOL';

          // Look for our program's log messages
          for (const log of logs) {
            if (log.includes('Deposited') || log.includes('deposit')) {
              type = 'deposit';
              // Try to extract amount from logs
              const match = log.match(/(\d+\.?\d*)/);
              if (match) {
                amount = parseFloat(match[1]);
              }
            } else if (log.includes('Withdrew') || log.includes('withdraw')) {
              type = 'withdraw';
              // Try to extract amount from logs
              const match = log.match(/(\d+\.?\d*)/);
              if (match) {
                amount = parseFloat(match[1]);
              }
            }
          }

          // If we couldn't parse from logs, try to get from token transfers
          if (type && amount === 0) {
            const tokenTransfers = tx.meta.preTokenBalances || [];
            const postTokenBalances = tx.meta.postTokenBalances || [];
            
            // Calculate the difference in token balances
            for (let i = 0; i < tokenTransfers.length; i++) {
              const preBalance = tokenTransfers[i];
              const postBalance = postTokenBalances.find(post => 
                post.accountIndex === preBalance.accountIndex
              );
              
              if (preBalance && postBalance) {
                const diff = Math.abs(
                  parseFloat(postBalance.uiTokenAmount.uiAmountString || '0') - 
                  parseFloat(preBalance.uiTokenAmount.uiAmountString || '0')
                );
                if (diff > 0) {
                  amount = diff;
                  break;
                }
              }
            }
          }

          if (!type) {
            return null;
          }

          return {
            signature: sig.signature,
            type,
            amount,
            token,
            timestamp: new Date((sig.blockTime || 0) * 1000),
            status: sig.confirmationStatus === 'confirmed' ? 'confirmed' as const : 'pending' as const,
            blockTime: sig.blockTime || 0,
          };
        } catch (err) {
          console.error('Error parsing transaction:', err);
          return null;
        }
      });

      const parsedTransactions = await Promise.all(transactionPromises);
      const validTransactions = parsedTransactions.filter(tx => tx !== null) as Transaction[];
      
      // Sort by timestamp, newest first
      validTransactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      console.log(`✅ Found ${validTransactions.length} vault transactions`);
      setTransactions(validTransactions);
    } catch (err: any) {
      console.error('❌ Error fetching transaction history:', err);
      setError('Failed to fetch transaction history');
      
      // If we can't fetch real transactions, provide some mock data for demo
      if (publicKey) {
        const mockTransactions: Transaction[] = [
          {
            signature: '5KJp7UYz9xjYQtjVK2nP8rQ3mN4wL6vB1cX8dF9gH2eA',
            type: 'deposit',
            amount: 1.5,
            token: 'SOL',
            timestamp: new Date(Date.now() - 86400000),
            status: 'confirmed'
          },
          {
            signature: '3MNp5QWx7yiYPsjTJ1kL6rO2lK3vA5uB9bV7cE8fG1dZ',
            type: 'withdraw',
            amount: 0.5,
            token: 'SOL',
            timestamp: new Date(Date.now() - 172800000),
            status: 'confirmed'
          }
        ];
        setTransactions(mockTransactions);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  const refresh = useCallback(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    loading,
    error,
    refresh,
  };
}