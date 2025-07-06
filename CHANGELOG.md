# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🏦 Token-2022 migration & vault-init hotfix

#### Added
- **Token-2022 Support**: Migrated all SPL-Token operations to use Token-2022 program (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`)
- **Automatic Vault Initialization**: Added `ensureVaultExists()` helper that automatically initializes vaults when they don't exist
- **Enhanced Error Handling**: Comprehensive error handling for `SendTransactionError` with detailed logging and user-friendly toast notifications
- **Vault Helper Utilities**: New utility functions for managing vault operations and token account creation
- **Compute Budget Support**: Added `addComputeBudgetIfSupported()` that detects RPC version and conditionally adds ComputeBudgetProgram instructions
- **Phantom-Only Wallet Integration**: Streamlined wallet integration supporting only Phantom wallet with auto-detection
- **Transaction Error Handling**: Comprehensive error handling with user-friendly messages for common scenarios (user rejection, insufficient funds, etc.)
- **Local Development Tools**: Added `npm run localnet` script that starts validator, checks version, and opens browser
- **Testing Infrastructure**: Added Jest tests for compute budget detection and Cypress E2E tests for wallet integration

#### Changed
- **Breaking**: Upgraded `@solana/spl-token` to `@solana/spl-token-2022 ^0.4.0` for Token-2022 compatibility
- **Breaking**: Replaced all `TOKEN_PROGRAM_ID` references with `TOKEN_2022_PROGRAM_ID`
- **Breaking**: Removed MetaMask and other non-Phantom wallet adapters
- **Smart Contract**: Updated Anchor program to use `anchor_spl::token_2022` instead of legacy token program
- **Frontend**: Enhanced deposit flow to automatically initialize vaults before transactions
- **ATA Creation**: Uses `createAssociatedTokenAccountIdempotentInstruction` to prevent creation failures
- **Tests**: Updated all test cases to use Token-2022 program and functions

#### Fixed
- **Compute Budget Errors**: Resolved `SendTransactionError: Instruction X: Unsupported program id` for ComputeBudget111... on older RPC endpoints
- **Token-2022 Compatibility**: Fixed `InitializeImmutableOwner` instruction errors by using Token-2022 program exclusively
- **Vault Fetching**: Fixed `Error: Account does not exist or has no data` by implementing automatic vault initialization
- **Wallet Rejection Handling**: Improved user experience when transactions are cancelled with clear toast messages
- **Transaction Errors**: Enhanced error handling and user feedback for failed transactions

#### Technical Details
- All Associated Token Accounts (ATAs) now created with `getAssociatedTokenAddressSync(..., TOKEN_2022_PROGRAM_ID)`
- Smart contract uses `anchor_spl::token_2022` for all token operations
- Automatic RPC version detection prevents ComputeBudget errors on older validators
- Enhanced transaction logging with `error.logs?.join('\n')` for debugging
- Phantom wallet auto-detection with "Get Phantom" fallback for non-installed users

#### Migration Notes
- Existing vaults will need to be reinitialized with Token-2022 program
- Users may need to create new token accounts compatible with Token-2022
- All mint operations should use Token-2022 program for consistency
- Run `solana-install update` to ensure ComputeBudgetProgram support
- Only Phantom wallet is supported - other wallets have been removed

#### Developer Experience
- Added `npm run lint:fix` for automatic code formatting
- Added `npm run localnet` for streamlined local development
- Enhanced error messages with actionable solutions
- Comprehensive test coverage for edge cases
- Clear inline documentation explaining each fix

---

## [0.1.0] - 2025-01-XX

### Added
- Initial release of Solana DeFi Vault
- Multi-token support (SOL, USDC, USDT)
- Interest accrual system with configurable APY rates
- Secure deposit and withdrawal functionality
- Real-time transaction history with filtering and export
- Responsive web interface with wallet integration
- Comprehensive test suite for smart contracts
- Docker support for containerized deployment
- CI/CD pipeline with automated testing and deployment