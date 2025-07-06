export function formatTokenAmount(amount: number, decimals: number = 6): string {
  // Handle the case where amount is already in display units
  let value: number;
  
  if (amount > 1000000) {
    // Likely in base units, convert to display units
    value = amount / Math.pow(10, decimals);
  } else {
    // Already in display units
    value = amount;
  }
  
  if (value < 0.000001) {
    return '0.000000';
  } else if (value < 0.01) {
    return value.toFixed(6);
  } else if (value < 1) {
    return value.toFixed(4);
  } else if (value < 1000) {
    return value.toFixed(2);
  } else {
    return value.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  }
}

export function formatPercentage(value: number): string {
  return (value / 100).toFixed(2);
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}