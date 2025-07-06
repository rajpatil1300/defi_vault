'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet as WalletIcon,
  DollarSign,
  Clock,
  Percent,
  RefreshCw,
  Sparkles,
  Target,
  Zap
} from 'lucide-react';
import { useVault } from '@/hooks/useVault';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { SUPPORTED_TOKENS } from '@/utils/constants';
import { formatTokenAmount, formatPercentage } from '@/utils/format';
import { rpcThrottle } from '@/utils/rpc-throttle';
import { toast } from 'sonner';

export function VaultDashboard() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  
  const [selectedToken, setSelectedToken] = useState('SOL');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const { 
    userPosition, 
    vaultInfo, 
    loading: vaultLoading, 
    deposit, 
    withdraw, 
    refreshData 
  } = useVault(selectedToken);
  
  const { balance: tokenBalance, loading: balanceLoading, refresh: refreshBalance } = useTokenBalance(selectedToken);

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid deposit amount');
      return;
    }

    const depositAmountNum = parseFloat(depositAmount);
    
    // Check if user has sufficient balance (leave some for transaction fees)
    const requiredBalance = selectedToken === 'SOL' ? depositAmountNum + 0.01 : depositAmountNum;
    if (requiredBalance > tokenBalance) {
      toast.error(`Insufficient balance. You have ${tokenBalance.toFixed(6)} ${selectedToken}`);
      return;
    }

    setIsDepositing(true);
    try {
      await deposit(depositAmountNum);
      setDepositAmount('');
      // Refresh balance after successful deposit
      setTimeout(() => {
        refreshBalance();
      }, 3000); // Wait 3 seconds for transaction to propagate
    } catch (error) {
      // Error handling is done in the hook
      console.error('Deposit failed:', error);
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Please enter a valid withdraw amount');
      return;
    }

    const withdrawAmountNum = parseFloat(withdrawAmount);
    const token = SUPPORTED_TOKENS.find(t => t.symbol === selectedToken);
    
    // Calculate total available balance (principal + interest) in display units
    const totalBalanceInBaseUnits = userPosition ? userPosition.deposited_amount + userPosition.accrued_interest : 0;
    const totalBalanceInDisplayUnits = totalBalanceInBaseUnits / Math.pow(10, token?.decimals || 6);
    
    if (withdrawAmountNum > totalBalanceInDisplayUnits) {
      toast.error(`Insufficient vault balance. You have ${totalBalanceInDisplayUnits.toFixed(6)} ${selectedToken} available`);
      return;
    }

    setIsWithdrawing(true);
    try {
      await withdraw(withdrawAmountNum);
      setWithdrawAmount('');
      // Refresh balance after successful withdrawal
      setTimeout(() => {
        refreshBalance();
      }, 3000); // Wait 3 seconds for transaction to propagate
    } catch (error) {
      // Error handling is done in the hook
      console.error('Withdraw failed:', error);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleRefresh = async () => {
    // Clear all caches to force fresh data
    rpcThrottle.clearAllCache();
    
    await Promise.all([refreshData(), refreshBalance()]);
    toast.success('Data refreshed!');
  };

  if (!connected) {
    return (
      <Card className="text-center py-16 bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardContent>
          <WalletIcon className="h-20 w-20 text-purple-400 mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-purple-900 mb-3">Connect Your Wallet</h3>
          <p className="text-purple-700 text-lg">
            Please connect your Phantom wallet to start earning interest on your tokens.
          </p>
          <div className="mt-6 p-4 bg-white/50 rounded-lg max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 text-purple-600 mb-2">
              <Sparkles className="h-5 w-5" />
              <span className="font-medium">Why Connect?</span>
            </div>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>• Earn up to 8% APY on your crypto</li>
              <li>• Secure, audited smart contracts</li>
              <li>• Instant deposits and withdrawals</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  const token = SUPPORTED_TOKENS.find(t => t.symbol === selectedToken);
  
  // Calculate balances in display units
  const totalBalanceInBaseUnits = userPosition ? userPosition.deposited_amount + userPosition.accrued_interest : 0;
  const totalBalanceInDisplayUnits = totalBalanceInBaseUnits / Math.pow(10, token?.decimals || 6);
  
  const depositedAmountInDisplayUnits = userPosition ? userPosition.deposited_amount / Math.pow(10, token?.decimals || 6) : 0;
  const accruedInterestInDisplayUnits = userPosition ? userPosition.accrued_interest / Math.pow(10, token?.decimals || 6) : 0;
  
  const interestRate = vaultInfo ? vaultInfo.interest_rate / 100 : 0; // Convert from basis points

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Vault Dashboard
          </h2>
          <p className="text-gray-600 mt-1">Manage your deposits and track interest earnings</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={vaultLoading || balanceLoading}
          className="bg-white/80 backdrop-blur-sm border-purple-200 hover:bg-purple-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${(vaultLoading || balanceLoading) ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">
              {totalBalanceInDisplayUnits.toFixed(6)} {selectedToken}
            </div>
            <p className="text-xs text-green-600 mt-1">
              Principal + Interest
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Deposited</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">
              {depositedAmountInDisplayUnits.toFixed(6)} {selectedToken}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Your principal amount
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Interest Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">
              {accruedInterestInDisplayUnits.toFixed(6)} {selectedToken}
            </div>
            <p className="text-xs text-purple-600 mt-1">
              Accrued interest
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">APY</CardTitle>
            <Percent className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">
              {formatPercentage(interestRate)}%
            </div>
            <p className="text-xs text-orange-600 mt-1">
              Annual interest rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interest Accrual Progress */}
      {userPosition && depositedAmountInDisplayUnits > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Clock className="h-5 w-5 text-blue-600" />
              Interest Accrual Progress
            </CardTitle>
            <CardDescription className="text-blue-700">
              Interest is calculated continuously based on time elapsed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">Principal</span>
                <span className="font-medium text-blue-900">{depositedAmountInDisplayUnits.toFixed(6)} {selectedToken}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">Interest Earned</span>
                <span className="font-medium text-purple-600">+{accruedInterestInDisplayUnits.toFixed(6)} {selectedToken}</span>
              </div>
              <Progress 
                value={(accruedInterestInDisplayUnits / (depositedAmountInDisplayUnits * 0.1)) * 100} 
                className="h-3 bg-blue-100"
              />
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Interest accrues every second at {formatPercentage(interestRate)}% APY
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Actions */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Deposit Section */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <ArrowUpCircle className="h-5 w-5 text-green-600" />
              Deposit Tokens
            </CardTitle>
            <CardDescription className="text-green-700">
              Deposit your tokens to start earning interest
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token-select" className="text-green-800">Select Token</Label>
              <Select value={selectedToken} onValueChange={setSelectedToken}>
                <SelectTrigger className="bg-white/80 border-green-300">
                  <SelectValue placeholder="Select a token" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_TOKENS.map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: token.color }}
                        />
                        {token.name} ({token.symbol})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit-amount" className="text-green-800">Amount</Label>
              <div className="relative">
                <Input
                  id="deposit-amount"
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  step="0.000001"
                  min="0"
                  disabled={isDepositing}
                  data-testid="deposit-amount"
                  className="bg-white/80 border-green-300 pr-16"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-green-600 font-medium">
                  {selectedToken}
                </div>
              </div>
              <div className="flex justify-between text-sm text-green-700">
                <span>Available: {tokenBalance.toFixed(6)} {selectedToken}</span>
                <button 
                  onClick={() => {
                    // Leave some SOL for transaction fees
                    const maxAmount = selectedToken === 'SOL' ? Math.max(0, tokenBalance - 0.01) : tokenBalance;
                    setDepositAmount(maxAmount.toString());
                  }}
                  className="text-green-600 hover:text-green-700 font-medium"
                  disabled={isDepositing}
                >
                  Max
                </button>
              </div>
            </div>

            <Button 
              onClick={handleDeposit}
              disabled={isDepositing || !depositAmount || vaultLoading || balanceLoading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
              data-testid="deposit-button"
            >
              {isDepositing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Deposit & Earn
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Withdraw Section */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <ArrowDownCircle className="h-5 w-5 text-blue-600" />
              Withdraw Tokens
            </CardTitle>
            <CardDescription className="text-blue-700">
              Withdraw your tokens and earned interest
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount" className="text-blue-800">Amount</Label>
              <div className="relative">
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  step="0.000001"
                  min="0"
                  disabled={isWithdrawing}
                  className="bg-white/80 border-blue-300 pr-16"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-600 font-medium">
                  {selectedToken}
                </div>
              </div>
              <div className="flex justify-between text-sm text-blue-700">
                <span>Available: {totalBalanceInDisplayUnits.toFixed(6)} {selectedToken}</span>
                <button 
                  onClick={() => setWithdrawAmount(totalBalanceInDisplayUnits.toString())}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                  disabled={isWithdrawing}
                >
                  Max
                </button>
              </div>
            </div>

            <div className="p-4 bg-white/60 rounded-lg border border-blue-200">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-blue-700">
                  <span>Principal:</span>
                  <span className="font-medium">{depositedAmountInDisplayUnits.toFixed(6)} {selectedToken}</span>
                </div>
                <div className="flex justify-between text-blue-700">
                  <span>Interest:</span>
                  <span className="font-medium text-purple-600">
                    {accruedInterestInDisplayUnits.toFixed(6)} {selectedToken}
                  </span>
                </div>
                <div className="border-t border-blue-200 pt-2 flex justify-between font-medium text-blue-900">
                  <span>Total:</span>
                  <span>{totalBalanceInDisplayUnits.toFixed(6)} {selectedToken}</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleWithdraw}
              disabled={isWithdrawing || !withdrawAmount || vaultLoading || totalBalanceInDisplayUnits === 0}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg"
            >
              {isWithdrawing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowDownCircle className="h-4 w-4 mr-2" />
                  Withdraw
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Vault Stats */}
      {vaultInfo && (
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardHeader>
            <CardTitle className="text-purple-900">Vault Statistics</CardTitle>
            <CardDescription className="text-purple-700">
              Information about the {selectedToken} vault
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2 text-center p-4 bg-white/60 rounded-lg">
                <div className="text-sm text-purple-600 font-medium">Total Value Locked</div>
                <div className="text-2xl font-bold text-purple-900">
                  {(vaultInfo.total_deposited / Math.pow(10, token?.decimals || 6)).toFixed(2)} {selectedToken}
                </div>
              </div>
              <div className="space-y-2 text-center p-4 bg-white/60 rounded-lg">
                <div className="text-sm text-purple-600 font-medium">Interest Rate</div>
                <div className="text-2xl font-bold text-purple-900">
                  {formatPercentage(interestRate)}% APY
                </div>
              </div>
              <div className="space-y-2 text-center p-4 bg-white/60 rounded-lg">
                <div className="text-sm text-purple-600 font-medium">Minimum Deposit</div>
                <div className="text-2xl font-bold text-purple-900">
                  {(vaultInfo.min_deposit / Math.pow(10, token?.decimals || 6)).toFixed(6)} {selectedToken}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet Connection Status */}
      {connected && publicKey && (
        <div data-testid="wallet-connected" className="hidden">
          Connected to {publicKey.toString()}
        </div>
      )}
    </div>
  );
}