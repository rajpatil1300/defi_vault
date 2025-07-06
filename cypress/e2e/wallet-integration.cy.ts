/**
 * Cypress E2E Test: Phantom Wallet Integration
 * 
 * Tests wallet connection, transaction approval, and cancellation scenarios
 */

describe('Phantom Wallet Integration', () => {
  beforeEach(() => {
    // Mock Phantom wallet
    cy.window().then((win) => {
      (win as any).phantom = {
        solana: {
          isPhantom: true,
          connect: cy.stub().resolves({
            publicKey: {
              toString: () => 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'
            }
          }),
          signTransaction: cy.stub().resolves({}),
          signAllTransactions: cy.stub().resolves([]),
        }
      };
    });

    cy.visit('/');
  });

  it('should connect to Phantom wallet successfully', () => {
    // Should show connect button initially
    cy.contains('Connect Phantom').should('be.visible');
    
    // Click connect button
    cy.contains('Connect Phantom').click();
    
    // Should show connected state (mocked)
    cy.get('[data-testid="wallet-connected"]').should('be.visible');
  });

  it('should handle transaction approval flow', () => {
    // Mock successful transaction
    cy.window().then((win) => {
      (win as any).phantom.solana.signTransaction = cy.stub().resolves({
        serialize: () => new Uint8Array([1, 2, 3])
      });
    });

    // Connect wallet first
    cy.contains('Connect Phantom').click();
    
    // Try to make a deposit
    cy.get('[data-testid="deposit-amount"]').type('1');
    cy.get('[data-testid="deposit-button"]').click();
    
    // Should show success message
    cy.contains('Transaction successful').should('be.visible');
  });

  it('should handle transaction cancellation with toast', () => {
    // Mock user rejection
    cy.window().then((win) => {
      (win as any).phantom.solana.signTransaction = cy.stub().rejects(
        new Error('User rejected the request')
      );
    });

    // Connect wallet first
    cy.contains('Connect Phantom').click();
    
    // Try to make a deposit
    cy.get('[data-testid="deposit-amount"]').type('1');
    cy.get('[data-testid="deposit-button"]').click();
    
    // Should show cancellation toast
    cy.contains('Transaction cancelled – please approve in Phantom 🔮')
      .should('be.visible');
  });

  it('should show "Get Phantom" link when not installed', () => {
    // Remove Phantom from window
    cy.window().then((win) => {
      delete (win as any).phantom;
    });

    cy.reload();
    
    // Should show "Get Phantom" button
    cy.contains('Get Phantom').should('be.visible');
    
    // Should link to Phantom website
    cy.contains('Get Phantom').should('have.attr', 'href', 'https://phantom.app/');
  });
});