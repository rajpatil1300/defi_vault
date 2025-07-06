'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Shield, 
  Coins, 
  Clock, 
  Zap, 
  Users, 
  BarChart3,
  ArrowRight,
  Star,
  CheckCircle
} from 'lucide-react';

// Dynamically import wallet-dependent components to prevent hydration issues
const WalletButton = dynamic(() => import('@/components/WalletButton').then(mod => ({ default: mod.WalletButton })), {
  ssr: false,
  loading: () => (
    <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl animate-pulse">
      Loading...
    </div>
  )
});

const VaultDashboard = dynamic(() => import('@/components/VaultDashboard').then(mod => ({ default: mod.VaultDashboard })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      <span className="ml-4 text-gray-600 text-lg">Loading dashboard...</span>
    </div>
  )
});

const TransactionHistory = dynamic(() => import('@/components/TransactionHistory'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      <span className="ml-4 text-gray-600 text-lg">Loading transaction history...</span>
    </div>
  )
});

const Analytics = dynamic(() => import('@/components/Analytics'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      <span className="ml-4 text-gray-600 text-lg">Loading analytics...</span>
    </div>
  )
});

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const features = [
    {
      icon: Shield,
      title: 'Bank-Grade Security',
      description: 'Audited smart contracts with multi-signature protection and insurance coverage',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      icon: Zap,
      title: 'Instant Transactions',
      description: 'Lightning-fast deposits and withdrawals powered by Solana\'s high-speed blockchain',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      icon: TrendingUp,
      title: 'Competitive Yields',
      description: 'Earn up to 8% APY on your crypto holdings with our optimized yield strategies',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      icon: Coins,
      title: 'Multi-Asset Support',
      description: 'Deposit SOL, USDC, USDT and other popular tokens in a single unified platform',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-3 rounded-xl shadow-lg">
                <TrendingUp className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  DeFi Vault
                </h1>
                <p className="text-sm text-gray-600">Earn on Solana</p>
              </div>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-blue-600/10" />
        <div className="container mx-auto px-4 text-center relative">
          <Badge className="mb-6 bg-purple-100 text-purple-700 hover:bg-purple-200 px-4 py-2">
            <Star className="h-4 w-4 mr-2" />
            Trusted by 1,200+ users
          </Badge>
          
          <h2 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            Secure DeFi Yields on
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent block">
              Solana
            </span>
          </h2>
          
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Deposit your SPL tokens and earn competitive interest rates with our battle-tested smart contracts. 
            Start earning passive income on your crypto today.
          </p>
          
          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {features.map((feature, index) => (
              <Card key={index} className="text-left hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm group">
                <CardHeader className="pb-4">
                  <div className={`${feature.bgColor} ${feature.color} p-3 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* CTA Button */}
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            onClick={() => setActiveTab('dashboard')}
          >
            Start Earning Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 pb-20">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="grid w-full max-w-md grid-cols-3 bg-white/80 backdrop-blur-sm border shadow-lg rounded-xl p-1">
              <TabsTrigger 
                value="dashboard" 
                className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white transition-all duration-300"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger 
                value="analytics"
                className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white transition-all duration-300"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger 
                value="history"
                className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white transition-all duration-300"
              >
                <Clock className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="dashboard" className="space-y-8">
            <VaultDashboard />
          </TabsContent>
          
          <TabsContent value="analytics" className="space-y-8">
            <Analytics />
          </TabsContent>
          
          <TabsContent value="history" className="space-y-8">
            <TransactionHistory />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-lg py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-2 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-lg">DeFi Vault</span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                The most trusted DeFi platform on Solana. Earn competitive yields on your crypto holdings.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-purple-600 transition-colors">Dashboard</a></li>
                <li><a href="#" className="hover:text-purple-600 transition-colors">Analytics</a></li>
                <li><a href="#" className="hover:text-purple-600 transition-colors">History</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-purple-600 transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-purple-600 transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-purple-600 transition-colors">Support</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Community</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-purple-600 transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-purple-600 transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-purple-600 transition-colors">GitHub</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t pt-8 text-center text-gray-600 text-sm">
            <p>&copy; 2025 Solana DeFi Vault. Built with Anchor and Next.js. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}