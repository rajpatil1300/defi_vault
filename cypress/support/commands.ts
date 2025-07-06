// Custom Cypress commands for wallet testing

Cypress.Commands.add('connectPhantom', () => {
  cy.window().then((win) => {
    // Mock Phantom wallet connection
    (win as any).phantom = {
      solana: {
        isPhantom: true,
        connect: cy.stub().resolves({
          publicKey: {
            toString: () => 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'
          }
        }),
        signTransaction: cy.stub().resolves({
          serialize: () => new Uint8Array([1, 2, 3])
        }),
        signAllTransactions: cy.stub().resolves([]),
      }
    };
  });
});

Cypress.Commands.add('mockPhantomWallet', () => {
  cy.window().then((win) => {
    (win as any).phantom = {
      solana: {
        isPhantom: true,
        publicKey: {
          toString: () => 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'
        },
        connect: cy.stub().resolves(),
        disconnect: cy.stub().resolves(),
        signTransaction: cy.stub().resolves(),
        signAllTransactions: cy.stub().resolves(),
      }
    };
  });
});