'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { DefiVault } from '@/types/defi_vault';
import { PROGRAM_ID, SUPPORTED_TOKENS, INTEREST_RATES, MIN_DEPOSITS } from '@/utils/constants';
import { getVaultProgram } from '@/utils/anchor';
import { getConnection } from '@/utils/solana';
import { rpcThrottle } from '@/utils/rpc-throttle';
import { toast } from 'sonner';

interface UserPosition {
  deposited_amount: number;
  accrued_interest: number;
  last_update_time: number;
  deposit_count: number;
  withdraw_count: number;
}

interface VaultInfo {
  authority: PublicKey;
  token_mint: PublicKey;
  interest_rate: number;
  min_deposit: number;
  total_deposited: number;
  created_at: number;
}

export function useVault(tokenSymbol: string) {
  const { publicKey, sendTransaction, signTransaction, signAllTransactions } = useWallet();
  const connection = getConnection();
  
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track if component is mounted
  const mountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const token = SUPPORTED_TOKENS.find(t => t.symbol === tokenSymbol);

  const refreshData = useCallback(async () => {
    if (!publicKey || !token || !mountedRef.current) {
      setUserPosition(null);
      setVaultInfo(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const program = getVaultProgram(connection, publicKey);
      const tokenMint = new PublicKey(token.mint);
      
      // Get vault PDA
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), tokenMint.toBuffer()],
        PROGRAM_ID
      );

      // Get user position PDA
      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user-position'), vaultPda.toBuffer(), publicKey.toBuffer()],
        PROGRAM_ID
      );

      try {
        // Try to fetch vault info with throttling
        const vaultCacheKey = `vault-${vaultPda.toString()}`;
        const vaultAccount = await rpcThrottle.throttle(
          vaultCacheKey,
          () => program.account.vault.fetch(vaultPda),
          30000 // Cache for 30 seconds
        );

        if (mountedRef.current && vaultAccount) {
          setVaultInfo({
            authority: vaultAccount.authority,
            token_mint: vaultAccount.tokenMint,
            interest_rate: vaultAccount.interestRate.toNumber(),
            min_deposit: vaultAccount.minDeposit.toNumber(),
            total_deposited: vaultAccount.totalDeposited.toNumber(),
            created_at: vaultAccount.createdAt.toNumber(),
          });

          // Try to fetch user position with throttling
          try {
            const positionCacheKey = `position-${userPositionPda.toString()}`;
            const userPositionAccount = await rpcThrottle.throttle(
              positionCacheKey,
              () => program.account.userPosition.fetch(userPositionPda),
              15000 // Cache for 15 seconds
            );
            
            if (mountedRef.current) {
              // Calculate current accrued interest - only if vaultAccount exists
              const currentTime = Math.floor(Date.now() / 1000);
              const timeElapsed = currentTime - userPositionAccount.lastUpdateTime.toNumber();
              const additionalInterest = calculateInterest(
                userPositionAccount.depositedAmount.toNumber(),
                vaultAccount.interestRate.toNumber(),
                timeElapsed
              );

              setUserPosition({
                deposited_amount: userPositionAccount.depositedAmount.toNumber(),
                accrued_interest: userPositionAccount.accruedInterest.toNumber() + additionalInterest,
                last_update_time: userPositionAccount.lastUpdateTime.toNumber(),
                deposit_count: userPositionAccount.depositCount.toNumber(),
                withdraw_count: userPositionAccount.withdrawCount.toNumber(),
              });
            }
          } catch (err) {
            // User position doesn't exist yet - this is normal for new users
            if (mountedRef.current) {
              console.log(`📭 No user position found for ${tokenSymbol}`);
              setUserPosition(null);
            }
          }
        }
      } catch (err: any) {
        // Vault doesn't exist yet - this is normal and will be created on first deposit
        if (err.message?.includes('Account does not exist') || err.message?.includes('has no data')) {
          if (mountedRef.current) {
            console.log(`🏗️ Vault not initialized yet for ${tokenSymbol}`);
            setVaultInfo(null);
            setUserPosition(null);
          }
        } else if (!err.message?.includes('429') && !err.message?.includes('Too many requests')) {
          console.error('❌ Error fetching vault data:', err);
          if (mountedRef.current) {
            setError(`Failed to fetch vault data for ${tokenSymbol}`);
          }
        }
      }
    } catch (err: any) {
      console.error('❌ Error in refreshData:', err);
      if (mountedRef.current && !err.message?.includes('429')) {
        setError('Failed to fetch vault data');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [publicKey, token, connection, tokenSymbol]);

  /**
   * Enhanced error message extraction function
   */
  const extractErrorMessage = useCallback((error: any): string => {
    // If we have a clear, specific error message, use it
    if (error?.message && 
        error.message !== 'Unexpected error' && 
        error.message !== 'Error' &&
        error.message.trim() !== '') {
      return error.message;
    }
    
    // Try to get error name
    if (error?.name && error.name !== 'Error') {
      return error.name;
    }
    
    // Try to get error code with description
    if (error?.code) {
      switch (error.code) {
        case 4001:
          return 'Transaction cancelled by user';
        case 4100:
          return 'Unauthorized request';
        case 4200:
          return 'Unsupported method';
        case -32603:
          return 'Internal JSON-RPC error';
        case -32602:
          return 'Invalid request parameters';
        default:
          return `Error code: ${error.code}`;
      }
    }
    
    // Try toString if it provides useful information
    if (error?.toString && typeof error.toString === 'function') {
      const stringified = error.toString();
      if (stringified !== '[object Object]' && 
          stringified !== 'Error' && 
          stringified !== 'Unexpected error') {
        return stringified;
      }
    }
    
    // Check for specific error types
    if (error?.type) {
      return `${error.type} error`;
    }
    
    // Last resort - return a generic but helpful message
    return 'Transaction failed. Please try again.';
  }, []);

  /**
   * Enhanced transaction building and sending with proper error handling
   */
  const buildAndSendTransaction = useCallback(async (
    instructions: TransactionInstruction[],
    description: string
  ): Promise<string> => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    console.log(`🔨 Building transaction: ${description}`);
    console.log(`📋 Instructions count: ${instructions.length}`);

    try {
      // Build transaction with all required properties
      const transaction = new Transaction();
      
      // Add all instructions
      instructions.forEach((instruction, index) => {
        console.log(`➕ Adding instruction ${index + 1}: ${instruction.programId.toString()}`);
        transaction.add(instruction);
      });

      // Get latest blockhash
      console.log('🔗 Fetching latest blockhash...');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      
      // Set transaction properties
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      console.log(`✅ Transaction built successfully:`);
      console.log(`   - Blockhash: ${blockhash}`);
      console.log(`   - Fee payer: ${publicKey.toString()}`);
      console.log(`   - Instructions: ${transaction.instructions.length}`);
      console.log(`   - Last valid block height: ${lastValidBlockHeight}`);

      // Try different signing methods based on wallet capabilities
      let signature: string;

      if (sendTransaction) {
        console.log('📤 Using wallet.sendTransaction...');
        signature = await sendTransaction(transaction, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      } else if (signTransaction) {
        console.log('✍️ Using wallet.signTransaction + connection.sendRawTransaction...');
        const signedTransaction = await signTransaction(transaction);
        
        // Serialize and send
        const rawTransaction = signedTransaction.serialize();
        signature = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      } else {
        throw new Error('Wallet does not support transaction signing');
      }

      console.log(`📝 Transaction signature: ${signature}`);

      // Confirm transaction with detailed logging
      console.log('⏳ Confirming transaction...');
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        console.error('❌ Transaction failed on-chain:', confirmation.value.err);
        
        // Get transaction details for better error reporting
        try {
          const txDetails = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
          });
          
          if (txDetails?.meta?.logMessages) {
            console.error('📋 Transaction logs:');
            txDetails.meta.logMessages.forEach((log, index) => {
              console.error(`   ${index + 1}: ${log}`);
            });
            
            // Surface specific error messages
            const errorLogs = txDetails.meta.logMessages.filter(log => 
              log.includes('Error') || log.includes('failed') || log.includes('insufficient')
            );
            
            if (errorLogs.length > 0) {
              throw new Error(`Transaction failed: ${errorLogs.join('; ')}`);
            }
          }
        } catch (logError) {
          console.warn('Could not fetch transaction logs:', logError);
        }
        
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log(`✅ Transaction confirmed: ${signature}`);
      return signature;

    } catch (error: any) {
      console.error('❌ Transaction failed:', error);
      
      // Use enhanced error message extraction
      const errorMessage = extractErrorMessage(error);
      
      // Handle specific error types with enhanced detection
      if (errorMessage.includes('User rejected') || 
          errorMessage.includes('rejected the request') ||
          errorMessage.includes('cancelled by user') ||
          errorMessage.includes('Transaction cancelled') ||
          error?.name === 'WalletSignTransactionError') {
        throw new Error('Transaction cancelled by user');
      }
      
      if (errorMessage.includes('insufficient funds') ||
          errorMessage.includes('Insufficient funds')) {
        throw new Error('Insufficient SOL for transaction fees');
      }
      
      if (errorMessage.includes('Blockhash not found') ||
          errorMessage.includes('blockhash not found')) {
        throw new Error('Transaction expired. Please try again.');
      }
      
      if (errorMessage.includes('Instruction') && errorMessage.includes('missing signature')) {
        throw new Error('Transaction missing required signature');
      }
      
      if (errorMessage.includes('Simulation failed')) {
        throw new Error('Transaction simulation failed. Please check your inputs.');
      }
      
      if (errorMessage.includes('429') || errorMessage.includes('Too many requests')) {
        throw new Error('RPC rate limit exceeded. Please wait and try again.');
      }
      
      // Return the extracted error message
      throw new Error(`Transaction failed: ${errorMessage}`);
    }
  }, [publicKey, connection, sendTransaction, signTransaction, extractErrorMessage]);

  const ensureVaultExists = useCallback(async (tokenMint: PublicKey): Promise<TransactionInstruction[]> => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    const program = getVaultProgram(connection, publicKey);
    const instructions: TransactionInstruction[] = [];

    // Derive PDAs
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), tokenMint.toBuffer()],
      PROGRAM_ID
    );

    const [vaultTokenPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault-token'), tokenMint.toBuffer()],
      PROGRAM_ID
    );

    // Check if vault exists (use throttled cache)
    try {
      const cacheKey = `vault-check-${vaultPda.toString()}`;
      await rpcThrottle.throttle(
        cacheKey,
        () => program.account.vault.fetch(vaultPda),
        10000 // Cache for 10 seconds
      );
      console.log(`✅ Vault already exists for ${tokenSymbol}`);
    } catch (error) {
      // Vault doesn't exist, add initialization instruction
      console.log(`🏗️ Creating vault for ${tokenSymbol}`);
      
      // Get default values for this token
      const interestRate = INTEREST_RATES[tokenSymbol as keyof typeof INTEREST_RATES] || 500;
      const minDepositInDisplayUnits = MIN_DEPOSITS[tokenSymbol as keyof typeof MIN_DEPOSITS] || 1;
      const minDeposit = Math.floor(minDepositInDisplayUnits * Math.pow(10, token?.decimals || 6));

      // Use appropriate token program based on token type
      const tokenProgram = token?.symbol === 'SOL' ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;

      const initializeInstruction = await program.methods
        .initializeVault(new BN(interestRate), new BN(minDeposit))
        .accounts({
          vault: vaultPda,
          authority: publicKey,
          tokenMint: tokenMint,
          tokenVault: vaultTokenPda,
          tokenProgram: tokenProgram,
          systemProgram: SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        })
        .instruction();

      instructions.push(initializeInstruction);
    }

    // Check if user's ATA exists and create if needed
    const tokenProgram = token?.symbol === 'SOL' ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
    const userTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      publicKey,
      false,
      tokenProgram
    );

    try {
      const cacheKey = `ata-check-${userTokenAccount.toString()}`;
      await rpcThrottle.throttle(
        cacheKey,
        () => getAccount(connection, userTokenAccount, 'confirmed', tokenProgram),
        10000 // Cache for 10 seconds
      );
      console.log(`✅ User token account exists for ${tokenSymbol}`);
    } catch (error) {
      // ATA doesn't exist, create it
      console.log(`🏗️ Creating token account for ${tokenSymbol}`);
      const createATAInstruction = createAssociatedTokenAccountInstruction(
        publicKey, // payer
        userTokenAccount, // ata
        publicKey, // owner
        tokenMint, // mint
        tokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      instructions.push(createATAInstruction);
    }

    return instructions;
  }, [publicKey, connection, token, tokenSymbol]);

  const deposit = useCallback(async (amount: number) => {
    if (!publicKey || !token) {
      throw new Error('Wallet not connected');
    }

    // Show loading toast
    const loadingToast = toast.loading('Preparing deposit transaction...');

    try {
      const tokenMint = new PublicKey(token.mint);
      
      // Convert amount to base units (e.g., 1.5 SOL → 1500000000 lamports)
      const amountInBaseUnits = Math.floor(amount * Math.pow(10, token.decimals));
      const amountBN = new BN(amountInBaseUnits);

      console.log(`💰 Depositing ${amount} ${token.symbol} (${amountInBaseUnits} base units)`);

      // Get all required instructions
      const setupInstructions = await ensureVaultExists(tokenMint);
      const program = getVaultProgram(connection, publicKey);

      // Get PDAs
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), tokenMint.toBuffer()],
        PROGRAM_ID
      );

      const [vaultTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault-token'), tokenMint.toBuffer()],
        PROGRAM_ID
      );

      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user-position'), vaultPda.toBuffer(), publicKey.toBuffer()],
        PROGRAM_ID
      );

      // Get user's token account with appropriate token program
      const tokenProgram = token.symbol === 'SOL' ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
      const userTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        publicKey,
        false,
        tokenProgram
      );

      // Add deposit instruction
      const depositInstruction = await program.methods
        .deposit(amountBN)
        .accounts({
          vault: vaultPda,
          userPosition: userPositionPda,
          user: publicKey,
          userTokenAccount: userTokenAccount,
          vaultTokenAccount: vaultTokenPda,
          tokenProgram: tokenProgram,
          systemProgram: SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        })
        .instruction();

      // Combine all instructions
      const allInstructions = [...setupInstructions, depositInstruction];

      // Update toast
      toast.dismiss(loadingToast);
      const approvalToast = toast.loading('Waiting for approval in Phantom...');

      // Build and send transaction
      const signature = await buildAndSendTransaction(
        allInstructions,
        `Deposit ${amount} ${token.symbol}`
      );

      // Dismiss approval toast
      toast.dismiss(approvalToast);

      // Clear relevant caches to force fresh data
      rpcThrottle.clearCache(`vault-${vaultPda.toString()}`);
      rpcThrottle.clearCache(`position-${userPositionPda.toString()}`);

      // Refresh data and show success
      setTimeout(() => {
        refreshData();
      }, 3000); // Wait 3 seconds for transaction to propagate
      
      toast.success(`✅ Deposited ${amount} ${token.symbol} successfully!`);

      return signature;
    } catch (error: any) {
      // Dismiss any active toasts
      toast.dismiss(loadingToast);

      console.error('❌ Deposit failed:', error);
      
      // Use enhanced error message extraction
      const errorMessage = extractErrorMessage(error);
      
      // Handle specific errors with user-friendly messages
      if (errorMessage.includes('Transaction cancelled by user')) {
        toast.error('Deposit cancelled – please approve in Phantom 🔮');
        throw new Error(errorMessage);
      }
      
      if (errorMessage.includes('Insufficient SOL for transaction fees')) {
        toast.error('Insufficient SOL for transaction fees');
        throw new Error(errorMessage);
      }
      
      if (errorMessage.includes('Transaction expired')) {
        toast.error('Transaction expired. Please try again.');
        throw new Error(errorMessage);
      }
      
      if (errorMessage.includes('RPC rate limit')) {
        toast.error('Network busy. Please wait a moment and try again.');
        throw new Error(errorMessage);
      }
      
      // Show the extracted error message
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
  }, [publicKey, token, connection, refreshData, ensureVaultExists, buildAndSendTransaction, extractErrorMessage]);

  const withdraw = useCallback(async (amount: number) => {
    if (!publicKey || !token) {
      throw new Error('Wallet not connected');
    }

    // Show loading toast
    const loadingToast = toast.loading('Preparing withdrawal transaction...');

    try {
      const tokenMint = new PublicKey(token.mint);
      
      // Convert amount to base units
      const amountInBaseUnits = Math.floor(amount * Math.pow(10, token.decimals));
      const amountBN = new BN(amountInBaseUnits);

      console.log(`💸 Withdrawing ${amount} ${token.symbol} (${amountInBaseUnits} base units)`);

      const program = getVaultProgram(connection, publicKey);

      // Get PDAs
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), tokenMint.toBuffer()],
        PROGRAM_ID
      );

      const [vaultTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault-token'), tokenMint.toBuffer()],
        PROGRAM_ID
      );

      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user-position'), vaultPda.toBuffer(), publicKey.toBuffer()],
        PROGRAM_ID
      );

      // Get user's token account with appropriate token program
      const tokenProgram = token.symbol === 'SOL' ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
      const userTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        publicKey,
        false,
        tokenProgram
      );

      // Build withdraw instruction
      const withdrawInstruction = await program.methods
        .withdraw(amountBN)
        .accounts({
          vault: vaultPda,
          userPosition: userPositionPda,
          user: publicKey,
          userTokenAccount: userTokenAccount,
          vaultTokenAccount: vaultTokenPda,
          tokenProgram: tokenProgram,
        })
        .instruction();

      // Update toast
      toast.dismiss(loadingToast);
      const approvalToast = toast.loading('Waiting for approval in Phantom...');

      // Build and send transaction
      const signature = await buildAndSendTransaction(
        [withdrawInstruction],
        `Withdraw ${amount} ${token.symbol}`
      );

      // Dismiss approval toast
      toast.dismiss(approvalToast);

      // Clear relevant caches to force fresh data
      rpcThrottle.clearCache(`vault-${vaultPda.toString()}`);
      rpcThrottle.clearCache(`position-${userPositionPda.toString()}`);

      // Refresh data and show success
      setTimeout(() => {
        refreshData();
      }, 3000); // Wait 3 seconds for transaction to propagate
      
      toast.success(`✅ Withdrew ${amount} ${token.symbol} successfully!`);

      return signature;
    } catch (error: any) {
      // Dismiss any active toasts
      toast.dismiss(loadingToast);

      console.error('❌ Withdraw failed:', error);
      
      // Use enhanced error message extraction
      const errorMessage = extractErrorMessage(error);
      
      // Handle specific errors with user-friendly messages
      if (errorMessage.includes('Transaction cancelled by user')) {
        toast.error('Withdrawal cancelled – please approve in Phantom 🔮');
        throw new Error(errorMessage);
      }
      
      if (errorMessage.includes('Insufficient SOL for transaction fees')) {
        toast.error('Insufficient SOL for transaction fees');
        throw new Error(errorMessage);
      }
      
      if (errorMessage.includes('Transaction expired')) {
        toast.error('Transaction expired. Please try again.');
        throw new Error(errorMessage);
      }
      
      if (errorMessage.includes('RPC rate limit')) {
        toast.error('Network busy. Please wait a moment and try again.');
        throw new Error(errorMessage);
      }
      
      if (errorMessage.includes('Insufficient balance')) {
        toast.error('Insufficient vault balance for withdrawal');
        throw new Error(errorMessage);
      }
      
      // Show the extracted error message
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
  }, [publicKey, token, connection, refreshData, buildAndSendTransaction, extractErrorMessage]);

  // Manual refresh function
  const manualRefresh = useCallback(() => {
    // Clear relevant caches to force fresh data
    if (publicKey && token) {
      const tokenMint = new PublicKey(token.mint);
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), tokenMint.toBuffer()],
        PROGRAM_ID
      );
      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user-position'), vaultPda.toBuffer(), publicKey.toBuffer()],
        PROGRAM_ID
      );
      
      rpcThrottle.clearCache(`vault-${vaultPda.toString()}`);
      rpcThrottle.clearCache(`position-${userPositionPda.toString()}`);
    }
    refreshData();
  }, [refreshData, publicKey, token]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Initial fetch
    refreshData();
    
    // Set up polling with longer interval to avoid rate limiting
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        refreshData();
      }
    }, 180000); // Fetch every 3 minutes instead of 1 minute

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refreshData]);

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
    userPosition,
    vaultInfo,
    loading,
    error,
    deposit,
    withdraw,
    refreshData: manualRefresh,
  };
}

// Helper function to calculate interest (matches the smart contract logic)
function calculateInterest(principal: number, interestRateBps: number, timeElapsed: number): number {
  if (principal === 0 || timeElapsed <= 0) {
    return 0;
  }
  
  const secondsPerYear = 365 * 24 * 60 * 60;
  const interest = (principal * interestRateBps * timeElapsed) / (10000 * secondsPerYear);
  
  return Math.floor(interest);
}