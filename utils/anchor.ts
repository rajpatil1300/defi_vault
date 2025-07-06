import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { DefiVault } from '@/types/defi_vault';
import { PROGRAM_ID } from './constants';
import { getConnection } from './solana';
import IDL from '@/idl/defi_vault.json';

export function getVaultProgram(
  connection = getConnection(),
  publicKey?: PublicKey
) {
  // Create a minimal wallet for read-only operations
  const wallet: Wallet = {
    publicKey: publicKey || PublicKey.default,
    signTransaction: async () => { throw new Error('Read-only wallet'); },
    signAllTransactions: async () => { throw new Error('Read-only wallet'); },
  };

  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  return new Program<DefiVault>(IDL as any, PROGRAM_ID, provider);
}