import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { Program, BN } from '@coral-xyz/anchor';
import { 
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';
import { DefiVault } from '@/types/defi_vault';
import { PROGRAM_ID, INTEREST_RATES, MIN_DEPOSITS } from './constants';
import { sendTransactionWithErrorHandling } from './transaction-helpers';
import { toast } from 'sonner';

export interface VaultHelperOptions {
  connection: Connection;
  program: Program<DefiVault>;
  payer: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
}

/**
 * FIX #2: Standard SPL Token Migration
 * 
 * Ensures vault exists and creates it if needed using standard SPL token program.
 * Uses createAssociatedTokenAccountInstruction to avoid ATA creation failures.
 * 
 * Root cause: Mixed use of legacy TOKEN_PROGRAM_ID and Token-2022, causing InitializeImmutableOwner errors
 */
export async function ensureVaultExists(
  mint: PublicKey,
  options: VaultHelperOptions
): Promise<{ vaultPda: PublicKey; vaultTokenPda: PublicKey }> {
  const { connection, program, payer, signTransaction } = options;

  // Derive PDAs
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), mint.toBuffer()],
    PROGRAM_ID
  );

  const [vaultTokenPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault-token'), mint.toBuffer()],
    PROGRAM_ID
  );

  try {
    // Check if vault already exists
    await program.account.vault.fetch(vaultPda);
    return { vaultPda, vaultTokenPda };
  } catch (error) {
    // Vault doesn't exist, create it
    console.log('Vault does not exist, initializing with standard SPL token...');
    
    try {
      // Get default interest rate and min deposit for the token
      const tokenSymbol = getTokenSymbolFromMint(mint.toString());
      const interestRate = INTEREST_RATES[tokenSymbol as keyof typeof INTEREST_RATES] || 500;
      const minDeposit = (MIN_DEPOSITS[tokenSymbol as keyof typeof MIN_DEPOSITS] || 1) * Math.pow(10, 6);

      const transaction = new Transaction();

      // Add initialize vault instruction using standard SPL token
      const initializeInstruction = await program.methods
        .initializeVault(new BN(interestRate), new BN(minDeposit))
        .accounts({
          vault: vaultPda,
          authority: payer,
          tokenMint: mint,
          tokenVault: vaultTokenPda,
          tokenProgram: TOKEN_PROGRAM_ID, // Use standard SPL token program
          systemProgram: SystemProgram.programId,
          rent: SystemProgram.programId,
        })
        .instruction();

      transaction.add(initializeInstruction);

      // Send transaction with error handling
      const txid = await sendTransactionWithErrorHandling(connection, transaction, signTransaction);
      
      console.log('✅ Vault initialized successfully with standard SPL token:', txid);
      toast.success('Vault initialized successfully!');
      
      return { vaultPda, vaultTokenPda };
    } catch (initError) {
      console.error('Failed to initialize vault:', initError);
      toast.error('Failed to initialize vault. Please try again.');
      throw initError;
    }
  }
}

/**
 * Creates or gets existing standard SPL token associated token account
 * Uses standard instruction to avoid failures if account already exists
 */
export async function ensureTokenAccountExists(
  mint: PublicKey,
  owner: PublicKey,
  connection: Connection
): Promise<{ tokenAccount: PublicKey; needsCreation: boolean; instructions: any[] }> {
  // Use standard SPL token program for ATA address calculation
  const tokenAccount = await getAssociatedTokenAddress(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID
  );

  const instructions = [];
  let needsCreation = false;

  try {
    // Check if account exists using standard SPL token program
    await getAccount(connection, tokenAccount, 'confirmed', TOKEN_PROGRAM_ID);
  } catch (error) {
    needsCreation = true;
    
    // Create ATA instruction using standard SPL token
    const createATAInstruction = createAssociatedTokenAccountInstruction(
      owner, // payer
      tokenAccount, // ata
      owner, // owner
      mint, // mint
      TOKEN_PROGRAM_ID, // token program
      ASSOCIATED_TOKEN_PROGRAM_ID // associated token program
    );
    instructions.push(createATAInstruction);
  }

  return { tokenAccount, needsCreation, instructions };
}

function getTokenSymbolFromMint(mint: string): string {
  // Map mint addresses to token symbols
  const mintToSymbol: { [key: string]: string } = {
    'So11111111111111111111111111111111111111112': 'SOL',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  };
  
  return mintToSymbol[mint] || 'UNKNOWN';
}

export function handleTransactionError(error: any): void {
  console.error('Transaction error:', error);
  
  if (error?.logs) {
    console.error('Transaction logs:', error.logs.join('\n'));
  }
  
  let errorMessage = 'Transaction failed. Please try again.';
  
  if (error?.message) {
    if (error.message.includes('User rejected')) {
      errorMessage = 'Transaction cancelled – please approve in Phantom 🔮';
    } else if (error.message.includes('Insufficient funds')) {
      errorMessage = 'Insufficient funds for transaction.';
    } else if (error.message.includes('Simulation failed')) {
      errorMessage = 'Transaction simulation failed. Please check your inputs.';
    }
  }
  
  toast.error(errorMessage);
}