import '@testing-library/jest-dom'

// Mock Solana wallet adapter
jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: false,
    publicKey: null,
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn(),
  }),
  useConnection: () => ({
    connection: {
      getBalance: jest.fn(),
      getSignaturesForAddress: jest.fn(),
      getParsedTransaction: jest.fn(),
      confirmTransaction: jest.fn(),
    },
  }),
}))

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}))