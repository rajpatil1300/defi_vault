/**
 * Jest Test: Compute Budget Version Detection
 * 
 * Tests that addComputeBudgetIfSupported correctly handles different RPC versions
 */

import { Connection, Transaction } from '@solana/web3.js';
import { addComputeBudgetIfSupported, compareVersions } from '../utils/transaction-helpers';

// Mock the connection
jest.mock('@solana/web3.js', () => ({
  ...jest.requireActual('@solana/web3.js'),
  Connection: jest.fn(),
  ComputeBudgetProgram: {
    setComputeUnitLimit: jest.fn(() => ({ keys: [], programId: 'mock', data: Buffer.alloc(0) })),
    setComputeUnitPrice: jest.fn(() => ({ keys: [], programId: 'mock', data: Buffer.alloc(0) })),
  },
}));

describe('Transaction Helpers', () => {
  let mockConnection: jest.Mocked<Connection>;
  let transaction: Transaction;

  beforeEach(() => {
    mockConnection = {
      getVersion: jest.fn(),
    } as any;
    
    transaction = new Transaction();
    jest.clearAllMocks();
  });

  describe('addComputeBudgetIfSupported', () => {
    it('should add compute budget instructions for supported versions (>= 1.14)', async () => {
      // Mock RPC version >= 1.14
      mockConnection.getVersion.mockResolvedValue({
        'solana-core': '1.16.0',
        'feature-set': 123456789
      });

      const initialInstructionCount = transaction.instructions.length;
      
      await addComputeBudgetIfSupported(mockConnection as any, transaction);
      
      // Should add 2 instructions (compute unit limit + priority fee)
      expect(transaction.instructions.length).toBe(initialInstructionCount + 2);
    });

    it('should skip compute budget instructions for old versions (< 1.14)', async () => {
      // Mock old RPC version < 1.14
      mockConnection.getVersion.mockResolvedValue({
        'solana-core': '1.13.5',
        'feature-set': 123456789
      });

      const initialInstructionCount = transaction.instructions.length;
      
      await addComputeBudgetIfSupported(mockConnection as any, transaction);
      
      // Should not add any instructions
      expect(transaction.instructions.length).toBe(initialInstructionCount);
    });

    it('should handle version check errors gracefully', async () => {
      // Mock version check failure
      mockConnection.getVersion.mockRejectedValue(new Error('Network error'));

      const initialInstructionCount = transaction.instructions.length;
      
      await addComputeBudgetIfSupported(mockConnection as any, transaction);
      
      // Should not add instructions and not throw
      expect(transaction.instructions.length).toBe(initialInstructionCount);
    });
  });

  describe('compareVersions', () => {
    it('should correctly compare version strings', () => {
      expect(compareVersions('1.16.0', '1.14.0')).toBe(1);
      expect(compareVersions('1.14.0', '1.16.0')).toBe(-1);
      expect(compareVersions('1.14.0', '1.14.0')).toBe(0);
      expect(compareVersions('1.14.1', '1.14.0')).toBe(1);
      expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    });
  });
});