#!/usr/bin/env node

/**
 * NPM Script: yarn localnet
 * 
 * Starts solana-test-validator, prints version info, and opens the dApp when ready.
 * Helps developers ensure they have the right Solana version for ComputeBudgetProgram support.
 */

const { spawn, exec } = require('child_process');
const path = require('path');

async function startLocalnet() {
  console.log('🚀 Starting Solana localnet...\n');

  try {
    // Check Solana version first
    console.log('📋 Checking Solana version...');
    const versionOutput = await execPromise('solana --version');
    console.log(`✅ ${versionOutput.trim()}\n`);

    // Parse version to check if it supports ComputeBudgetProgram
    const versionMatch = versionOutput.match(/solana-cli (\d+\.\d+\.\d+)/);
    if (versionMatch) {
      const version = versionMatch[1];
      const [major, minor] = version.split('.').map(Number);
      
      if (major < 1 || (major === 1 && minor < 14)) {
        console.log('⚠️  WARNING: Your Solana version is < 1.14.0');
        console.log('   ComputeBudgetProgram may not be supported.');
        console.log('   Run: solana-install update\n');
      } else {
        console.log('✅ ComputeBudgetProgram supported\n');
      }
    }

    // Start test validator
    console.log('🏗️  Starting solana-test-validator...');
    const validator = spawn('solana-test-validator', [
      '--reset',
      '--quiet'
    ], {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let validatorReady = false;

    validator.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('JSON RPC URL')) {
        console.log('✅ Validator started successfully!');
        console.log('🌐 RPC URL: http://localhost:8899');
        validatorReady = true;
        
        // Wait a moment then start the dApp
        setTimeout(() => {
          console.log('\n🚀 Starting Next.js development server...');
          startNextDev();
        }, 2000);
      }
    });

    validator.stderr.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('Ledger location')) {
        console.error('❌ Validator error:', error);
      }
    });

    validator.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ Validator exited with code ${code}`);
        process.exit(1);
      }
    });

    // Handle cleanup
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down localnet...');
      validator.kill();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start localnet:', error.message);
    
    if (error.message.includes('solana: command not found')) {
      console.log('\n💡 Install Solana CLI:');
      console.log('   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"');
    }
    
    process.exit(1);
  }
}

function startNextDev() {
  const nextDev = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit'
  });

  nextDev.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ Next.js dev server exited with code ${code}`);
    }
  });

  // Open browser after a delay
  setTimeout(() => {
    console.log('\n🌐 Opening http://localhost:3000...');
    const open = require('child_process').exec;
    
    // Cross-platform open command
    const cmd = process.platform === 'win32' ? 'start' : 
                process.platform === 'darwin' ? 'open' : 'xdg-open';
    
    open(`${cmd} http://localhost:3000`, (error) => {
      if (error) {
        console.log('💡 Manually open: http://localhost:3000');
      }
    });
  }, 5000);
}

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

// Run if this script is executed directly
if (require.main === module) {
  startLocalnet();
}

module.exports = { startLocalnet };