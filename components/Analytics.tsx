'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Percent,
  Calendar,
  RefreshCw,
  Target,
  Zap,
  Award
} from 'lucide-react';
import { useVault } from '@/hooks/useVault';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { SUPPORTED_TOKENS } from '@/utils/constants';
import { formatTokenAmount, formatPercentage } from '@/utils/format';

interface AnalyticsData {
  totalEarnings: number;
  averageAPY: number;
  bestPerformingToken: string;
  totalDeposits: number;
  projectedYearlyEarnings: number;
  efficiency: number;
  totalTransactions: number;
  depositCount: number;
  withdrawCount: number;
}

export default function Analytics() {
  const { connected, publicKey } = useWallet();
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  // Get vault data for all supported tokens
  const solVault = useVault('SOL');
  const usdcVault = useVault('USDC');
  const usdtVault = useVault('USDT');

  // Get transaction history
  const { transactions } = useTransactionHistory();

  const vaults = [
    { symbol: 'SOL', ...solVault },
    { symbol: 'USDC', ...usdcVault },
    { symbol: 'USDT', ...usdtVault }
  ];

  const calculateAnalytics = useCallback(() => {
    setLoading(true);

    try {
      let totalEarnings = 0;
      let totalDeposits = 0;
      let weightedAPY = 0;
      let bestPerformingToken = 'SOL';
      let maxEarnings = 0;

      // Calculate from vault positions
      vaults.forEach(vault => {
        if (vault.userPosition) {
          const token = SUPPORTED_TOKENS.find(t => t.symbol === vault.symbol);
          const decimals = token?.decimals || 6;
          
          const depositedAmount = vault.userPosition.deposited_amount / Math.pow(10, decimals);
          const accruedInterest = vault.userPosition.accrued_interest / Math.pow(10, decimals);
          
          totalDeposits += depositedAmount;
          totalEarnings += accruedInterest;
          
          if (vault.vaultInfo) {
            const apy = vault.vaultInfo.interest_rate / 100;
            weightedAPY += apy * depositedAmount;
            
            if (accruedInterest > maxEarnings) {
              maxEarnings = accruedInterest;
              bestPerformingToken = vault.symbol;
            }
          }
        }
      });

      // Calculate transaction statistics
      const depositCount = transactions.filter(tx => tx.type === 'deposit').length;
      const withdrawCount = transactions.filter(tx => tx.type === 'withdraw').length;
      const totalTransactions = transactions.length;

      const averageAPY = totalDeposits > 0 ? weightedAPY / totalDeposits : 0;
      const projectedYearlyEarnings = totalDeposits * (averageAPY / 100);
      const efficiency = totalDeposits > 0 ? (totalEarnings / totalDeposits) * 100 : 0;

      setAnalyticsData({
        totalEarnings,
        averageAPY,
        bestPerformingToken,
        totalDeposits,
        projectedYearlyEarnings,
        efficiency,
        totalTransactions,
        depositCount,
        withdrawCount
      });
    } catch (error) {
      console.error('Error calculating analytics:', error);
      // Set default values to prevent errors
      setAnalyticsData({
        totalEarnings: 0,
        averageAPY: 0,
        bestPerformingToken: 'SOL',
        totalDeposits: 0,
        projectedYearlyEarnings: 0,
        efficiency: 0,
        totalTransactions: 0,
        depositCount: 0,
        withdrawCount: 0
      });
    } finally {
      setLoading(false);
    }
  }, [vaults, transactions]);

  useEffect(() => {
    if (!connected || !publicKey) {
      setAnalyticsData(null);
      return;
    }

    calculateAnalytics();
  }, [connected, publicKey, solVault.userPosition, usdcVault.userPosition, usdtVault.userPosition, transactions, calculateAnalytics]);

  const refreshAnalytics = () => {
    vaults.forEach(vault => {
      if (vault.refreshData) {
        vault.refreshData();
      }
    });
    setTimeout(calculateAnalytics, 1000);
  };

  if (!connected) {
    return (
      <Card className="text-center py-16">
        <CardContent>
          <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics Dashboard</h3>
          <p className="text-gray-600">
            Connect your wallet to view detailed analytics and performance insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Analytics Dashboard
          </h2>
          <p className="text-gray-600 mt-1">
            Track your DeFi performance and earnings for {publicKey?.toString().slice(0, 8)}...
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={refreshAnalytics}
            disabled={loading}
            className="px-4"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">
              ${(analyticsData?.totalEarnings || 0).toFixed(4)}
            </div>
            <p className="text-xs text-green-600 mt-1">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              All-time interest earned
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Average APY</CardTitle>
            <Percent className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">
              {(analyticsData?.averageAPY || 0).toFixed(2)}%
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Weighted by deposit amount
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Best Performer</CardTitle>
            <Award className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">
              {analyticsData?.bestPerformingToken || 'SOL'}
            </div>
            <p className="text-xs text-purple-600 mt-1">
              Highest earning token
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Efficiency</CardTitle>
            <Target className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">
              {(analyticsData?.efficiency || 0).toFixed(3)}%
            </div>
            <p className="text-xs text-orange-600 mt-1">
              Earnings vs deposits ratio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Statistics */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-700">Total Transactions</CardTitle>
            <BarChart3 className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-900">
              {analyticsData?.totalTransactions || 0}
            </div>
            <p className="text-xs text-indigo-600 mt-1">
              All vault interactions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Deposits</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">
              {analyticsData?.depositCount || 0}
            </div>
            <p className="text-xs text-green-600 mt-1">
              Total deposit transactions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Withdrawals</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">
              {analyticsData?.withdrawCount || 0}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Total withdrawal transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Overview */}
      <div className="grid lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              Portfolio Breakdown
            </CardTitle>
            <CardDescription>
              Your token distribution and performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {vaults.map(vault => {
              const token = SUPPORTED_TOKENS.find(t => t.symbol === vault.symbol);
              if (!vault.userPosition || !token) return null;

              const depositedAmount = vault.userPosition.deposited_amount / Math.pow(10, token.decimals);
              const accruedInterest = vault.userPosition.accrued_interest / Math.pow(10, token.decimals);
              const apy = vault.vaultInfo ? vault.vaultInfo.interest_rate / 100 : 0;

              return (
                <div key={vault.symbol} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: token.color }}
                    />
                    <div>
                      <div className="font-medium">{token.name}</div>
                      <div className="text-sm text-gray-600">
                        {formatTokenAmount(depositedAmount, token.decimals)} {token.symbol}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-green-600">
                      +{formatTokenAmount(accruedInterest, token.decimals)} {token.symbol}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {formatPercentage(apy)}% APY
                    </Badge>
                  </div>
                </div>
              );
            })}
            {vaults.every(vault => !vault.userPosition) && (
              <div className="text-center py-8 text-gray-500">
                <p>No deposits found. Start depositing to see your portfolio breakdown.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Projections
            </CardTitle>
            <CardDescription>
              Estimated future earnings based on current rates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                <div>
                  <div className="text-sm text-blue-600 font-medium">Projected Monthly</div>
                  <div className="text-lg font-bold text-blue-900">
                    ${((analyticsData?.projectedYearlyEarnings || 0) / 12).toFixed(2)}
                  </div>
                </div>
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>

              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <div>
                  <div className="text-sm text-green-600 font-medium">Projected Yearly</div>
                  <div className="text-lg font-bold text-green-900">
                    ${(analyticsData?.projectedYearlyEarnings || 0).toFixed(2)}
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">Performance Summary</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Deposited:</span>
                    <span className="font-medium">${(analyticsData?.totalDeposits || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Earned:</span>
                    <span className="font-medium text-green-600">${(analyticsData?.totalEarnings || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ROI:</span>
                    <span className="font-medium text-purple-600">
                      {(analyticsData?.efficiency || 0).toFixed(3)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Transactions:</span>
                    <span className="font-medium">{analyticsData?.totalTransactions || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Tips */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-purple-900">💡 Performance Tips</CardTitle>
          <CardDescription className="text-purple-700">
            Optimize your DeFi strategy for better returns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-purple-900">Diversification</h4>
              <p className="text-sm text-purple-700">
                Spread your deposits across multiple tokens to reduce risk and optimize returns.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-purple-900">Compound Interest</h4>
              <p className="text-sm text-purple-700">
                Regularly reinvest your earnings to take advantage of compound growth.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-purple-900">Market Timing</h4>
              <p className="text-sm text-purple-700">
                Monitor APY rates and consider rebalancing when rates change significantly.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-purple-900">Long-term Strategy</h4>
              <p className="text-sm text-purple-700">
                DeFi yields work best with a long-term approach. Avoid frequent withdrawals.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}