'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Program, web3, BN } from '@coral-xyz/anchor';
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

// Helper function to calculate interest (matches the smart contract logic)
function calculateInterest(principal: number, interestRateBps: number, timeElapsed: number): number {
  if (principal === 0 || timeElapsed <= 0) {
    return 0;
  }
  
  const secondsPerYear = 365 * 24 * 60 * 60;
  const interest = (principal * interestRateBps * timeElapsed) / (10000 * secondsPerYear);
  
  return Math.floor(interest);
}

export function useVault(tokenSymbol: string) {
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const connection = getConnection();
  
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const token = SUPPORTED_TOKENS.find(t => t.symbol === tokenSymbol);

  const getCorrectTokenProgramId = useCallback(() => {
    // Default to TOKEN_PROGRAM_ID for safety, but use 2022 if specified (and not SOL)
    if (token && token.symbol !== 'SOL' && token.programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
        return TOKEN_2022_PROGRAM_ID;
    }
    return TOKEN_PROGRAM_ID;
  }, [token]);

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
      
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), tokenMint.toBuffer()],
        PROGRAM_ID
      );

      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user-position'), vaultPda.toBuffer(), publicKey.toBuffer()],
        PROGRAM_ID
      );

      // Fetch vault and user position data
      const vaultCacheKey = `vault-${vaultPda.toString()}`;
      const vaultAccount = await rpcThrottle.throttle(
        vaultCacheKey,
        () => program.account.vault.fetch(vaultPda).catch(() => null),
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

        const positionCacheKey = `position-${userPositionPda.toString()}`;
        const userPositionAccount = await rpcThrottle.throttle(
          positionCacheKey,
          () => program.account.userPosition.fetch(userPositionPda).catch(() => null),
          15000 // Cache for 15 seconds
        );
        
        if (mountedRef.current && userPositionAccount) {
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
        } else if (mountedRef.current) {
          setUserPosition(null);
        }
      } else if (mountedRef.current) {
        console.log(`🏗️ Vault not initialized yet for ${tokenSymbol}`);
        setVaultInfo(null);
        setUserPosition(null);
      }
    } catch (err: any) {
      if (!err.message?.includes('429')) {
        console.error('❌ Error fetching vault data:', err);
        if (mountedRef.current) setError(`Failed to fetch vault data for ${tokenSymbol}`);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [publicKey, token, connection, tokenSymbol]);

  const extractErrorMessage = useCallback((error: any): string => {
    if (error.name === 'WalletSendTransactionError' || error.name === 'WalletSignTransactionError') {
        if (error.message.includes('User rejected the request')) {
            return 'Transaction cancelled by user.';
        }
    }
    if (error.message) {
        if (error.message.includes('blockhash not found')) return 'Transaction expired. Please try again.';
        if (error.message.includes('insufficient funds')) return 'Insufficient SOL for transaction fees.';
        return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
  }, []);

  const buildAndSendTransaction = useCallback(async (
    instructions: TransactionInstruction[],
    description: string
  ): Promise<string> => {
    if (!publicKey) throw new Error('Wallet not connected');

    console.log(`🔨 Building transaction: ${description} with ${instructions.length} instructions.`);
    
    const transaction = new Transaction();
    instructions.forEach(instruction => transaction.add(instruction));

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    console.log(`✅ Transaction built successfully. Fee payer: ${publicKey.toString()}`);

    try {
        // First, simulate the transaction to get better error details
        console.log('🔍 Simulating transaction...');
        try {
            const simulation = await connection.simulateTransaction(transaction);
            
            if (simulation.value.err) {
                console.error('❌ Transaction simulation failed:', simulation.value.err);
                console.error('📋 Simulation logs:', simulation.value.logs);
                throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
            }
            
            console.log('✅ Transaction simulation successful');
            console.log('📋 Simulation logs:', simulation.value.logs);
        } catch (simError: any) {
            console.error('❌ Simulation error:', simError);
            // Continue with actual transaction even if simulation fails
        }

        const signature = await sendTransaction(transaction, connection, {
            skipPreflight: false, // Keep preflight for better error detection
            preflightCommitment: 'confirmed',
        });

        console.log(`📝 Transaction signature: ${signature}`);
        console.log('⏳ Confirming transaction...');
        
        const confirmation = await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
        }, 'confirmed');

        if (confirmation.value.err) {
            throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log(`✅ Transaction confirmed: ${signature}`);
        return signature;

    } catch (error: any) {
        console.error('❌ Transaction failed:', error);
        console.error('❌ Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            type: typeof error
        });
        
        // Log additional error properties
        if (error.logs) {
            console.error('📋 Error logs:', error.logs);
        }
        
        const errorMessage = extractErrorMessage(error);
        throw new Error(errorMessage);
    }
  }, [publicKey, connection, sendTransaction, signTransaction, extractErrorMessage]);

  const ensureVaultExists = useCallback(async (tokenMint: PublicKey): Promise<TransactionInstruction[]> => {
    if (!publicKey) throw new Error('Wallet not connected');

    const program = getVaultProgram(connection, publicKey);
    const instructions: TransactionInstruction[] = [];

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), tokenMint.toBuffer()],
      PROGRAM_ID
    );

    try {
      await rpcThrottle.throttle(`vault-check-${vaultPda.toString()}`, () => program.account.vault.fetch(vaultPda), 10000);
      console.log(`✅ Vault already exists for ${tokenSymbol}`);
    } catch (error) {
      console.log(`🏗️ Vault for ${tokenSymbol} does not exist. Creating initialization instruction.`);
      
      const interestRate = INTEREST_RATES[tokenSymbol as keyof typeof INTEREST_RATES] || 500;
      const minDeposit = new BN((MIN_DEPOSITS[tokenSymbol as keyof typeof MIN_DEPOSITS] || 1) * Math.pow(10, token?.decimals || 6));
      const tokenProgramId = getCorrectTokenProgramId();

      const [vaultTokenPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault-token'), tokenMint.toBuffer()],
          PROGRAM_ID
      );

      instructions.push(
        await program.methods
          .initializeVault(new BN(interestRate), minDeposit)
          .accounts({
            vault: vaultPda,
            authority: publicKey,
            tokenMint: tokenMint,
            tokenVault: vaultTokenPda,
            tokenProgram: tokenProgramId,
            systemProgram: SystemProgram.programId,
            rent: web3.SYSVAR_RENT_PUBKEY,
          })
          .instruction()
      );
    }
    return instructions;
  }, [publicKey, connection, token, tokenSymbol, getCorrectTokenProgramId]);

  const deposit = useCallback(async (amount: number) => {
    if (!publicKey || !token) throw new Error('Wallet not connected or token not supported');

    const loadingToast = toast.loading('Preparing deposit transaction...');
    
    try {
        const amountInBaseUnits = new BN(amount * Math.pow(10, token.decimals));
        console.log(`💰 Depositing ${amount} ${token.symbol} (${amountInBaseUnits.toString()} base units)`);

        const program = getVaultProgram(connection, publicKey);
        const tokenMint = new PublicKey(token.mint);
        
        // This is the key change: DO NOT create ATA for native SOL
        // The setup instructions will only create the vault if needed.
        const setupInstructions = await ensureVaultExists(tokenMint);
        const allInstructions = [...setupInstructions];
        
        const tokenProgramId = getCorrectTokenProgramId();
        
        // Get PDAs
        const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault'), tokenMint.toBuffer()], PROGRAM_ID);
        const [vaultTokenPda] = PublicKey.findProgramAddressSync([Buffer.from('vault-token'), tokenMint.toBuffer()], PROGRAM_ID);
        const [userPositionPda] = PublicKey.findProgramAddressSync([Buffer.from('user-position'), vaultPda.toBuffer(), publicKey.toBuffer()], PROGRAM_ID);

        // Get or create the user's Associated Token Account (ATA) only for SPL tokens.
        if (token.symbol !== 'SOL') {
            const userTokenAccount = getAssociatedTokenAddressSync(tokenMint, publicKey, false, tokenProgramId);
            const accountInfo = await connection.getAccountInfo(userTokenAccount);
            if (!accountInfo) {
                console.log(`🏗️ Creating token account for ${tokenSymbol}`);
                allInstructions.push(
                    createAssociatedTokenAccountInstruction(publicKey, userTokenAccount, publicKey, tokenMint, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID)
                );
            }
        }
        
        // The userTokenAccount for the deposit instruction should be the user's public key for SOL
        // and their ATA for SPL tokens. The program should handle this distinction.
        const userTokenAccount = (token.symbol === 'SOL')
            ? publicKey
            : getAssociatedTokenAddressSync(tokenMint, publicKey, false, tokenProgramId);

        allInstructions.push(
            await program.methods
                .deposit(amountInBaseUnits)
                .accounts({
                    vault: vaultPda,
                    userPosition: userPositionPda,
                    user: publicKey,
                    userTokenAccount: userTokenAccount, // This now correctly points to the user's wallet for SOL
                    vaultTokenAccount: vaultTokenPda,
                    tokenProgram: tokenProgramId,
                    systemProgram: SystemProgram.programId,
                    rent: web3.SYSVAR_RENT_PUBKEY,
                })
                .instruction()
        );

        toast.dismiss(loadingToast);
        const approvalToast = toast.loading('Waiting for approval in your wallet...');

        const signature = await buildAndSendTransaction(allInstructions, `Deposit ${amount} ${token.symbol}`);

        toast.dismiss(approvalToast);
        toast.success(`✅ Deposited ${amount} ${token.symbol} successfully!`);
        
        // Clear caches and refresh data
        rpcThrottle.clearCache(`vault-${vaultPda.toString()}`);
        rpcThrottle.clearCache(`position-${userPositionPda.toString()}`);
        setTimeout(() => refreshData(), 2000);

        return signature;
    } catch (error: any) {
        toast.dismiss(loadingToast);
        console.error('❌ Deposit failed:', error);
        toast.error(`Deposit failed: ${error.message}`);
        throw error;
    }
  }, [publicKey, token, connection, refreshData, ensureVaultExists, buildAndSendTransaction, getCorrectTokenProgramId]);

  const withdraw = useCallback(async (amount: number) => {
    if (!publicKey || !token) throw new Error('Wallet not connected or token not supported');

    const loadingToast = toast.loading('Preparing withdrawal transaction...');

    try {
        const amountInBaseUnits = new BN(amount * Math.pow(10, token.decimals));
        console.log(`💸 Withdrawing ${amount} ${token.symbol}`);

        const program = getVaultProgram(connection, publicKey);
        const tokenMint = new PublicKey(token.mint);
        const tokenProgramId = getCorrectTokenProgramId();

        const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault'), tokenMint.toBuffer()], PROGRAM_ID);
        const [vaultTokenPda] = PublicKey.findProgramAddressSync([Buffer.from('vault-token'), tokenMint.toBuffer()], PROGRAM_ID);
        const [userPositionPda] = PublicKey.findProgramAddressSync([Buffer.from('user-position'), vaultPda.toBuffer(), publicKey.toBuffer()], PROGRAM_ID);
        
        const userTokenAccount = (token.symbol === 'SOL')
            ? publicKey
            : getAssociatedTokenAddressSync(tokenMint, publicKey, false, tokenProgramId);

        const withdrawInstruction = await program.methods
            .withdraw(amountInBaseUnits)
            .accounts({
                vault: vaultPda,
                userPosition: userPositionPda,
                user: publicKey,
                userTokenAccount: userTokenAccount,
                vaultTokenAccount: vaultTokenPda,
                tokenProgram: tokenProgramId,
            })
            .instruction();

        toast.dismiss(loadingToast);
        const approvalToast = toast.loading('Waiting for approval in your wallet...');

        const signature = await buildAndSendTransaction([withdrawInstruction], `Withdraw ${amount} ${token.symbol}`);

        toast.dismiss(approvalToast);
        toast.success(`✅ Withdrew ${amount} ${token.symbol} successfully!`);
        
        rpcThrottle.clearCache(`vault-${vaultPda.toString()}`);
        rpcThrottle.clearCache(`position-${userPositionPda.toString()}`);
        setTimeout(() => refreshData(), 2000);

        return signature;
    } catch (error: any) {
        toast.dismiss(loadingToast);
        console.error('❌ Withdraw failed:', error);
        toast.error(`Withdrawal failed: ${error.message}`);
        throw error;
    }
  }, [publicKey, token, connection, refreshData, buildAndSendTransaction, getCorrectTokenProgramId]);

  const manualRefresh = useCallback(() => {
    if (publicKey && token) {
        const tokenMint = new PublicKey(token.mint);
        const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault'), tokenMint.toBuffer()], PROGRAM_ID);
        const [userPositionPda] = PublicKey.findProgramAddressSync([Buffer.from('user-position'), vaultPda.toBuffer(), publicKey.toBuffer()], PROGRAM_ID);
        rpcThrottle.clearCache(`vault-${vaultPda.toString()}`);
        rpcThrottle.clearCache(`position-${userPositionPda.toString()}`);
    }
    refreshData();
  }, [refreshData, publicKey, token]);
  
  useEffect(() => {
    mountedRef.current = true;
    refreshData();

    // Set up polling
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
        if (mountedRef.current) refreshData();
    }, 180000); // 3 minutes

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshData]);

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