const { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet, BN } = require('@coral-xyz/anchor');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Load IDL
const idl = JSON.parse(fs.readFileSync(path.join(__dirname, '../idl/defi_vault.json'), 'utf8'));

const PROGRAM_ID = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');

// Supported tokens with their mints on Devnet (standard SPL token compatible)
const TOKENS = [
  {
    symbol: 'SOL',
    name: 'Wrapped SOL',
    mint: 'So11111111111111111111111111111111111111112', // Wrapped SOL
    decimals: 9,
    interestRate: 500, // 5% APY
    minDeposit: 100_000_000, // 0.1 SOL
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    interestRate: 800, // 8% APY
    minDeposit: 10_000_000, // 10 USDC
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    interestRate: 750, // 7.5% APY
    minDeposit: 10_000_000, // 10 USDT
  },
];

async function initializeVaults() {
  console.log('🏗️  Initializing vaults on Devnet with standard SPL token...');
  
  try {
    // Connect to Devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Load wallet (you should have your keypair in ~/.config/solana/id.json)
    const walletPath = path.join(require('os').homedir(), '.config', 'solana', 'id.json');
    
    let walletKeypair;
    try {
      walletKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
      );
    } catch (error) {
      console.error('❌ Could not load wallet keypair from:', walletPath);
      console.error('💡 Make sure you have generated a Solana keypair with: solana-keygen new');
      process.exit(1);
    }
    
    const wallet = new Wallet(walletKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    const program = new Program(idl, PROGRAM_ID, provider);
    
    console.log('👛 Using wallet:', wallet.publicKey.toString());
    console.log('🔧 Using standard SPL Token Program ID:', TOKEN_PROGRAM_ID.toString());
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log('💰 Wallet balance:', balance / 1e9, 'SOL');
    
    if (balance < 0.1 * 1e9) {
      console.error('❌ Insufficient SOL balance. You need at least 0.1 SOL for transaction fees.');
      console.error('💡 Get some SOL with: solana airdrop 2');
      process.exit(1);
    }
    
    // Initialize vault for each supported token
    for (const token of TOKENS) {
      console.log(`\n🏛️  Initializing ${token.symbol} vault...`);
      
      const tokenMint = new PublicKey(token.mint);
      
      // Derive PDAs
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), tokenMint.toBuffer()],
        PROGRAM_ID
      );
      
      const [tokenVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault-token'), tokenMint.toBuffer()],
        PROGRAM_ID
      );
      
      // Check if vault already exists
      try {
        await program.account.vault.fetch(vaultPda);
        console.log(`✅ ${token.symbol} vault already exists at: ${vaultPda.toString()}`);
        continue;
      } catch (error) {
        // Vault doesn't exist, create it
        console.log(`🔨 Creating ${token.symbol} vault with standard SPL token...`);
      }
      
      try {
        const tx = await program.methods
          .initializeVault(new BN(token.interestRate), new BN(token.minDeposit))
          .accounts({
            vault: vaultPda,
            authority: wallet.publicKey,
            tokenMint: tokenMint,
            tokenVault: tokenVaultPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        
        console.log(`✅ ${token.symbol} vault initialized!`);
        console.log(`   Vault PDA: ${vaultPda.toString()}`);
        console.log(`   Token Vault: ${tokenVaultPda.toString()}`);
        console.log(`   Transaction: ${tx}`);
        
        // Confirm transaction
        await connection.confirmTransaction(tx, 'confirmed');
        console.log(`✅ ${token.symbol} vault transaction confirmed!`);
        
      } catch (error) {
        console.error(`❌ Failed to initialize ${token.symbol} vault:`, error.message);
        if (error.logs) {
          console.error('Transaction logs:', error.logs);
        }
      }
    }
    
    console.log('\n🎉 Vault initialization complete!');
    console.log('🔧 All vaults are now using standard SPL token program');
    console.log('💡 You can now use the web app to deposit and earn interest!');
    console.log('🔄 Refresh your browser to see the vaults.');
    
  } catch (error) {
    console.error('❌ Vault initialization failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run initialization if this script is executed directly
if (require.main === module) {
  initializeVaults();
}

module.exports = { initializeVaults };