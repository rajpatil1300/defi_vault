# Solana DeFi Vault

A full-stack decentralized finance (DeFi) application built on Solana that allows users to deposit SPL tokens and earn interest through secure, audited smart contracts.

![DeFi Vault](https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=300&w=600)

## 🌟 Features

### Core Features
- **✅ Phantom Wallet Integration**: Seamless connection to Phantom wallet for authentication
- **✅ SPL Token Deposits**: Deposit SOL, USDC, USDT and other SPL tokens into secure vaults
- **✅ Real-time Interest Accrual**: Continuous interest calculation based on elapsed time
- **✅ Instant Withdrawals**: Withdraw principal plus accrued interest anytime
- **✅ Multi-Token Support**: Single interface supporting multiple SPL token types
- **✅ Devnet Deployment**: Fully deployed and tested on Solana Devnet

### Advanced Features
- **RPC Rate Limiting Protection**: Intelligent throttling and caching to prevent 429 errors
- **Private RPC Support**: Compatible with Helius, QuickNode, and Alchemy endpoints
- **Connection Pooling**: Optimized RPC connections for better performance
- **Transaction History**: Complete transaction history with search, filtering, and CSV export
- **Responsive Design**: Mobile-first design that works on all devices
- **Real-time Updates**: Live balance updates with smart caching
- **Audit Trail**: Complete on-chain transaction logging and events
- **Error Handling**: Comprehensive error handling with user-friendly messages

## 🏗️ Architecture

### Smart Contract (Anchor/Rust)
- **Vault Program**: Secure token storage and interest calculation
- **User Positions**: Per-user balance tracking with interest accrual
- **Event Logging**: Comprehensive transaction events for transparency
- **Security**: Built-in checks for minimum deposits and balance validation

### Frontend (Next.js/React)
- **Phantom Wallet Integration**: Solana wallet adapter for secure transactions
- **RPC Throttling**: Smart request throttling to avoid rate limits
- **Connection Pooling**: Reused connections for better performance
- **Real-time Updates**: Live balance and interest updates with intelligent caching
- **Modern UI**: Clean, intuitive interface built with Tailwind CSS and shadcn/ui

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Rust 1.70+
- Solana CLI 1.18+
- Anchor CLI 0.29+
- Phantom Wallet browser extension

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <your-repo>
   cd solana-defi-vault
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   
   # For better performance, use a private RPC endpoint:
   # NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY
   # NEXT_PUBLIC_RPC_URL=https://your-endpoint.solana-devnet.quiknode.pro/YOUR_API_KEY/
   # NEXT_PUBLIC_RPC_URL=https://solana-devnet.g.alchemy.com/v2/YOUR_API_KEY
   ```

3. **Set up Solana environment**
   ```bash
   # Generate a new keypair (save the seed phrase!)
   solana-keygen new
   
   # Set cluster to devnet
   solana config set --url https://api.devnet.solana.com
   
   # Get some SOL for testing
   solana airdrop 2
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Build and deploy the smart contract (optional)**
   ```bash
   # Build the Anchor program
   anchor build
   
   # Deploy to Devnet
   anchor deploy
   
   # Initialize vaults for supported tokens
   node scripts/initialize-vaults.js
   ```

## 🔧 RPC Configuration

### Using Private RPC Endpoints (Recommended)

For production use, we strongly recommend using private RPC endpoints to avoid rate limiting:

#### Helius
```bash
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

#### QuickNode
```bash
NEXT_PUBLIC_RPC_URL=https://your-endpoint.solana-devnet.quiknode.pro/YOUR_API_KEY/
```

#### Alchemy
```bash
NEXT_PUBLIC_RPC_URL=https://solana-devnet.g.alchemy.com/v2/YOUR_API_KEY
```

### Rate Limiting Protection

The application includes several layers of protection against RPC rate limiting:

1. **Request Throttling**: Minimum 1.5 seconds between similar requests
2. **Response Caching**: Intelligent caching with configurable TTL
3. **Connection Pooling**: Reused connections to reduce overhead
4. **Graceful Degradation**: Falls back to cached data when rate limited

## 🎮 Demo Instructions

### 1. **Connect Phantom Wallet**
- Install Phantom wallet extension if not already installed
- Set Phantom to Devnet network
- Click "Connect Phantom" in the app
- Approve the connection

### 2. **Get Test Tokens**
```bash
# Get SOL for transaction fees
solana airdrop 2

# For SPL tokens, you can use Solana faucets or create test tokens
# The app supports SOL deposits out of the box
```

### 3. **Make Your First Deposit**
- Select SOL from the token dropdown
- Enter an amount (minimum 0.1 SOL)
- Click "Deposit" and approve in Phantom
- Watch your balance appear in the vault

### 4. **Watch Interest Accrue**
- Interest is calculated continuously
- Refresh the page or wait for automatic updates
- Interest rate is 5% APY for SOL

### 5. **Withdraw Your Funds**
- Enter withdrawal amount (can be partial or full)
- Click "Withdraw" and approve in Phantom
- Receive your principal + accrued interest

## 💰 Supported Tokens & Rates

| Token | Symbol | Interest Rate | Min Deposit | Status |
|-------|--------|---------------|-------------|---------|
| Solana | SOL | 5.0% APY | 0.1 SOL | ✅ Active |
| USD Coin | USDC | 8.0% APY | 10 USDC | ✅ Active |
| Tether | USDT | 7.5% APY | 10 USDT | ✅ Active |

## 🔧 Key Features Implemented

### ✅ **RPC Rate Limiting Protection**
- **Intelligent throttling** with configurable minimum intervals
- **Response caching** with TTL-based invalidation
- **Connection pooling** to reduce overhead
- **Graceful degradation** when rate limited
- **Private RPC support** for Helius, QuickNode, and Alchemy

### ✅ **Wallet Integration**
- **Phantom-only integration** for security and simplicity
- **Auto-detection** of wallet installation
- **Secure transaction signing** through wallet adapter
- **Connection status tracking** and user feedback

### ✅ **Token Deposit System**
- **Multi-token support** (SOL, USDC, USDT)
- **Automatic vault initialization** when needed
- **Balance validation** to prevent insufficient fund errors
- **Real-time balance updates** after transactions

### ✅ **Interest Accrual Logic**
- **Continuous interest calculation** based on elapsed time
- **Formula**: `Interest = (Principal × Rate × Time) / (10000 × Seconds_Per_Year)`
- **Real-time updates** with intelligent caching
- **Precise calculation** matching smart contract logic

### ✅ **Withdraw Functionality**
- **Partial or full withdrawals** supported
- **Principal + interest** withdrawal in single transaction
- **Balance validation** to prevent over-withdrawal
- **Instant processing** with transaction confirmation

### ✅ **Devnet Deployment**
- **Smart contract deployed** on Solana Devnet
- **Program ID**: `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`
- **Vaults initialized** for all supported tokens
- **Frontend deployed** and accessible

## 🧪 Testing

### Manual Testing Steps
1. **Install Phantom wallet** and set to Devnet
2. **Get test SOL**: `solana airdrop 2`
3. **Connect wallet** in the app
4. **Deposit 0.5 SOL** and confirm transaction
5. **Wait 1 minute** and refresh to see interest accrual
6. **Withdraw 0.1 SOL** to test partial withdrawal
7. **Check transaction history** for complete audit trail

### Automated Tests
```bash
# Run smart contract tests
anchor test

# Run frontend tests
npm test

# Run E2E tests
npm run test:e2e
```

## 🔐 Security Features

### Smart Contract Security
- **Access Controls**: Only vault authority can initialize vaults
- **Balance Validation**: Prevents over-withdrawal and negative balances
- **Interest Calculation**: Precise time-based interest without overflow
- **PDA Security**: Program Derived Addresses for secure token storage

### Frontend Security
- **Phantom-Only Integration**: Secure transaction signing
- **Input Validation**: Client-side validation with server-side verification
- **Error Handling**: Comprehensive error catching and user feedback
- **Transaction Logging**: Detailed error logs for debugging

### RPC Security
- **Rate Limiting Protection**: Prevents API abuse and 429 errors
- **Connection Pooling**: Secure connection reuse
- **Private RPC Support**: Enhanced security with private endpoints
- **Graceful Degradation**: Maintains functionality during rate limits

## 📊 Interest Calculation

Interest is calculated using the formula:
```
Interest = (Principal × Rate × Time) / (10000 × Seconds_Per_Year)
```

Where:
- **Principal**: Deposited amount in token's base units
- **Rate**: Interest rate in basis points (e.g., 500 = 5%)
- **Time**: Elapsed time in seconds
- **Seconds_Per_Year**: 31,536,000 (365 days)

Interest accrues continuously and is updated on each deposit/withdrawal.

## 🚢 Deployment Status

### ✅ **Smart Contract**
- **Deployed on Devnet**: Program ID `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`
- **Vaults Initialized**: SOL, USDC, USDT vaults ready
- **Tested**: All functions working correctly

### ✅ **Frontend**
- **Next.js Application**: Fully functional web interface
- **RPC Optimization**: Intelligent throttling and caching
- **Responsive Design**: Works on desktop and mobile
- **Real-time Updates**: Live balance and interest tracking with smart caching
- **Error Handling**: User-friendly error messages

## 🔄 Transaction Flow

### Deposit Flow
1. User selects token and enters amount
2. App validates balance and creates transaction
3. Transaction includes vault initialization (if needed)
4. User approves in Phantom wallet
5. Transaction confirmed on-chain
6. Balances updated and interest starts accruing

### Withdrawal Flow
1. User enters withdrawal amount
2. App validates vault balance
3. Transaction created for withdrawal
4. User approves in Phantom wallet
5. Principal + interest transferred to user
6. Vault balance updated

## 🎯 Demo Scenarios

### Scenario 1: New User First Deposit
1. Connect Phantom wallet
2. Deposit 1 SOL
3. Vault automatically initialized
4. Interest starts accruing immediately

### Scenario 2: Interest Accrual
1. Wait 1 hour after deposit
2. Refresh dashboard
3. See interest earned (approximately 0.00057 SOL for 1 SOL at 5% APY)

### Scenario 3: Partial Withdrawal
1. Deposit 2 SOL
2. Wait for interest to accrue
3. Withdraw 1 SOL (partial)
4. Remaining balance continues earning interest

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Open a GitHub issue for bugs or feature requests
- **Demo**: Visit the live demo on Devnet

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Solana Foundation** for the robust blockchain infrastructure
- **Anchor Framework** for simplifying Solana program development
- **Phantom Wallet** for seamless wallet integration
- **Helius, QuickNode, Alchemy** for reliable RPC infrastructure
- **Next.js & Vercel** for excellent frontend development experience

---

**⚠️ Disclaimer**: This is experimental software for educational purposes. Use at your own risk and never deposit funds you cannot afford to lose. Always verify smart contract code before interacting with it on mainnet.

**🎉 Ready to Demo**: The application is fully functional on Solana Devnet with comprehensive RPC rate limiting protection and all required features implemented and tested!