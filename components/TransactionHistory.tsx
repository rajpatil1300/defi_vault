'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Download, 
  Search,
  RefreshCw,
  Calendar,
  ExternalLink,
  TrendingUp,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { formatTokenAmount } from '@/utils/format';
import { SUPPORTED_TOKENS } from '@/utils/constants';
import { toast } from 'sonner';

interface Transaction {
  signature: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  token: string;
  timestamp: Date;
  status: 'confirmed' | 'pending' | 'failed';
}

export default function TransactionHistory() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdraw'>('all');
  const [filterToken, setFilterToken] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const { 
    transactions, 
    loading, 
    error, 
    refresh 
  } = useTransactionHistory();

  // Filter transactions based on search and filters
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = searchTerm === '' || 
      tx.signature.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || tx.type === filterType;
    
    const matchesToken = filterToken === 'all' || tx.token === filterToken;
    
    return matchesSearch && matchesType && matchesToken;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  const exportToCSV = () => {
    if (filteredTransactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    const headers = ['Date', 'Type', 'Amount', 'Token', 'Transaction Hash', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredTransactions.map(tx => [
        format(tx.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        tx.type,
        tx.amount.toString(),
        tx.token,
        tx.signature,
        tx.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transaction-history-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Transaction history exported successfully');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Confirmed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'deposit' ? 
      <ArrowUpCircle className="h-4 w-4 text-green-600" /> : 
      <ArrowDownCircle className="h-4 w-4 text-blue-600" />;
  };

  const getClusterUrl = () => {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || '';
    if (rpcUrl.includes('devnet')) return 'devnet';
    if (rpcUrl.includes('mainnet')) return 'mainnet-beta';
    return 'devnet'; // default
  };

  if (!connected) {
    return (
      <Card className="text-center py-16 bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardContent>
          <Calendar className="h-20 w-20 text-purple-400 mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-purple-900 mb-3">Transaction History</h3>
          <p className="text-purple-700 text-lg">
            Connect your wallet to view your transaction history and track your DeFi activity.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl text-purple-900 flex items-center gap-2">
                <Calendar className="h-6 w-6" />
                Transaction History
              </CardTitle>
              <CardDescription className="text-purple-700 text-base">
                View and export your vault transaction history for {publicKey?.toString().slice(0, 8)}...
              </CardDescription>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading}
                className="bg-white/80 border-purple-300 hover:bg-purple-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={filteredTransactions.length === 0}
                className="bg-white/80 border-purple-300 hover:bg-purple-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by transaction hash..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposits</SelectItem>
                <SelectItem value="withdraw">Withdrawals</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterToken} onValueChange={setFilterToken}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by token" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tokens</SelectItem>
                {SUPPORTED_TOKENS.map(token => (
                  <SelectItem key={token.symbol} value={token.symbol}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: token.color }}
                      />
                      {token.symbol}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
              <span className="ml-4 text-gray-600 text-lg">Loading transactions...</span>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <div className="text-amber-600 mb-4">
                <p className="text-lg mb-2">⚠️ {error}</p>
                <p className="text-sm text-gray-600">Showing demo data for connected wallet</p>
              </div>
              <Button variant="outline" onClick={refresh}>
                Try Again
              </Button>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">No transactions found</p>
              <p className="text-sm text-gray-500 mt-2">
                {searchTerm || filterType !== 'all' || filterToken !== 'all' 
                  ? 'Try adjusting your filters' 
                  : 'Make your first deposit to see transactions here'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Date & Time</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Amount</TableHead>
                      <TableHead className="font-semibold">Token</TableHead>
                      <TableHead className="font-semibold">Transaction</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((tx) => {
                      const token = SUPPORTED_TOKENS.find(t => t.symbol === tx.token);
                      return (
                        <TableRow key={tx.signature} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{format(tx.timestamp, 'MMM dd, yyyy')}</div>
                              <div className="text-gray-500">{format(tx.timestamp, 'HH:mm:ss')}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(tx.type)}
                              <span className="capitalize font-medium">{tx.type}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {formatTokenAmount(tx.amount, token?.decimals || 6)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {token && (
                                <div 
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: token.color }}
                                />
                              )}
                              <span className="font-medium">{tx.token}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <a
                              href={`https://explorer.solana.com/tx/${tx.signature}?cluster=${getClusterUrl()}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-600 hover:text-purple-700 font-mono text-sm flex items-center gap-1 hover:underline"
                            >
                              {tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(tx.status)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-6 border-t bg-gray-50">
                  <div className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}