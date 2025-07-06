import { Connection, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { MIN_COMPUTE_BUDGET_VERSION } from './constants';
import { toast } from 'sonner';

/**
 * FIX #1: Compute Budget Error
 * 
 * Some RPC endpoints (especially older local validators) don't support ComputeBudgetProgram.
 * This helper checks the RPC version and only adds compute budget instructions when supported.
 * 
 * Root cause: ComputeBudget111... program ID not recognized by older Solana versions < 1.14
 */
export async function addComputeBudgetIfSupported(
  connection: Connection,
  transaction: Transaction,
  computeUnits: number = 300_000,
  priorityFee: number = 1000
): Promise<void> {
  try {
    const version = await connection.getVersion();
    const versionNumber = version['solana-core'];
    
    // Parse version string (e.g., "1.16.0" -> [1, 16, 0])
    const [major, minor] = versionNumber.split('.').map(Number);
    const [minMajor, minMinor] = MIN_COMPUTE_BUDGET_VERSION.split('.').map(Number);
    
    const supportsComputeBudget = major > minMajor || (major === minMajor && minor >= minMinor);
    
    if (supportsComputeBudget) {
      // Add compute unit limit
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: computeUnits,
        })
      );
      
      // Add priority fee
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFee,
        })
      );
      
      console.log(`✅ Added compute budget instructions (RPC version: ${versionNumber})`);
    } else {
      console.log(`⚠️ Skipping compute budget instructions (RPC version: ${versionNumber} < ${MIN_COMPUTE_BUDGET_VERSION})`);
    }
  } catch (error) {
    console.warn('Failed to check RPC version, skipping compute budget:', error);
  }
}

/**
 * FIX #3: Wallet Sign Transaction Error
 * 
 * Wraps sendTransaction with user-friendly error handling for common wallet rejection scenarios.
 * 
 * Root cause: Users cancel transactions in Phantom, causing cryptic WalletSignTransactionError
 */
export async function sendTransactionWithErrorHandling(
  connection: Connection,
  transaction: Transaction,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  try {
    // Add compute budget if supported by RPC
    await addComputeBudgetIfSupported(connection, transaction);
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign transaction
    const signedTransaction = await signTransaction(transaction);
    
    // Send transaction
    const txid = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    // Confirm transaction
    await connection.confirmTransaction(txid, 'confirmed');
    
    return txid;
  } catch (error: any) {
    console.error('Transaction failed:', error);
    
    // Handle specific wallet errors
    if (error?.message?.includes('User rejected') || 
        error?.message?.includes('rejected the request') ||
        error?.name === 'WalletSignTransactionError') {
      toast.error('Transaction cancelled – please approve in Phantom 🔮');
      throw new Error('Transaction cancelled by user');
    }
    
    // Handle simulation errors
    if (error?.message?.includes('Simulation failed')) {
      toast.error('Transaction simulation failed. Please check your inputs.');
      throw error;
    }
    
    // Handle insufficient funds
    if (error?.message?.includes('Insufficient funds')) {
      toast.error('Insufficient SOL for transaction fees.');
      throw error;
    }
    
    // Generic error
    toast.error('Transaction failed. Please try again.');
    throw error;
  }
}

/**
 * Utility to compare version strings
 */
export function compareVersions(version1: string, version2: string): number {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
}