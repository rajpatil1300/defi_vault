'use client';

import { FC, ReactNode, useMemo, useCallback } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { getConnection } from '@/utils/solana';
import { toast } from 'sonner';

// Default styles that can be overridden by your app
require('@solana/wallet-adapter-react-ui/styles.css');

interface Props {
  children: ReactNode;
}

/**
 * WALLET INTEGRATION: Only Phantom Support
 * 
 * This provider only integrates Phantom wallet as requested.
 * Uses centralized connection from utils/solana.ts
 */
export const WalletContextProvider: FC<Props> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Devnet;

  // Use centralized connection
  const connection = getConnection();
  const endpoint = connection.rpcEndpoint;

  // Only include Phantom wallet adapter
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter({ network }),
    ],
    [network]
  );

  // Enhanced error handler to provide more specific error messages
  const onError = useCallback((error: any) => {
    // Extract a meaningful error message
    let errorMessage = 'Wallet connection error occurred';
    
    if (error?.message && error.message !== 'Unexpected error') {
      errorMessage = error.message;
    } else if (error?.name) {
      errorMessage = error.name;
    } else if (error?.toString && typeof error.toString === 'function') {
      const stringified = error.toString();
      if (stringified !== '[object Object]' && stringified !== 'Error') {
        errorMessage = stringified;
      }
    }
    
    // Handle specific wallet error types
    if (error?.code === 4001 || errorMessage.includes('User rejected')) {
      errorMessage = 'Connection cancelled by user';
    } else if (errorMessage.includes('not found') || errorMessage.includes('not installed')) {
      errorMessage = 'Phantom wallet not found. Please install Phantom wallet.';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      errorMessage = 'Connection timeout. Please try again.';
    } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
      errorMessage = 'Network connection error. Please check your internet connection.';
    }
    
    // Log detailed error for debugging (but not the full wallet object)
    console.error('Wallet Error Details:', {
      message: error?.message,
      name: error?.name,
      code: error?.code,
      type: typeof error
    });
    
    // Show user-friendly toast notification
    toast.error('Wallet Error', {
      description: errorMessage,
    });
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};