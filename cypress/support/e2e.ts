// Cypress support file for E2E tests

import './commands';

// Hide fetch/XHR requests from command log
Cypress.on('window:before:load', (win) => {
  // Mock console.error to avoid noise in tests
  cy.stub(win.console, 'error').as('consoleError');
});

// Add custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      connectPhantom(): Chainable<void>;
      mockPhantomWallet(): Chainable<void>;
    }
  }
}