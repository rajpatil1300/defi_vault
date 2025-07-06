const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function deployToDevnet() {
  console.log('🚀 Starting Devnet deployment...');
  
  try {
    // Check if Anchor is installed
    console.log('📦 Checking Anchor installation...');
    execSync('anchor --version', { stdio: 'inherit' });
    
    // Set Solana config to devnet
    console.log('🌐 Setting Solana config to Devnet...');
    execSync('solana config set --url https://api.devnet.solana.com', { stdio: 'inherit' });
    
    // Check balance
    console.log('💰 Checking SOL balance...');
    try {
      execSync('solana balance', { stdio: 'inherit' });
    } catch (error) {
      console.log('💸 Insufficient balance, requesting airdrop...');
      execSync('solana airdrop 2', { stdio: 'inherit' });
    }
    
    // Build the program
    console.log('🔨 Building Anchor program...');
    execSync('anchor build', { stdio: 'inherit' });
    
    // Deploy the program
    console.log('🚀 Deploying to Devnet...');
    execSync('anchor deploy', { stdio: 'inherit' });
    
    // Run tests
    console.log('🧪 Running tests...');
    try {
      execSync('anchor test --skip-deploy', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  Tests failed, but deployment successful');
    }
    
    console.log('✅ Deployment completed successfully!');
    console.log('🌐 Your program is now live on Solana Devnet');
    console.log('📱 You can now use the web app to interact with your vault');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment if this script is executed directly
if (require.main === module) {
  deployToDevnet();
}

module.exports = { deployToDevnet };