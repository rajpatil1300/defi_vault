'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, ExternalLink, CheckCircle, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * WALLET INTEGRATION: Phantom-only with auto-detection
 * 
 * Shows "Get Phantom" link if Phantom is not installed.
 * Auto-detects Phantom using wallet-standard.
 */
export function WalletButton() {
  const { connected, publicKey, wallet } = useWallet();
  const [isPhantomInstalled, setIsPhantomInstalled] = useState(false);

  useEffect(() => {
    // Check if Phantom is installed
    const checkPhantom = () => {
      if (typeof window !== 'undefined') {
        const isInstalled = !!(window as any).phantom?.solana?.isPhantom;
        setIsPhantomInstalled(isInstalled);
      }
    };

    checkPhantom();
    
    // Re-check after a short delay in case Phantom loads asynchronously
    const timer = setTimeout(checkPhantom, 1000);
    return () => clearTimeout(timer);
  }, []);

  // If Phantom is not installed, show "Get Phantom" button
  if (!isPhantomInstalled) {
    return (
      <Button
        onClick={() => window.open('https://phantom.app/', '_blank')}
        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Get Phantom
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {connected && publicKey ? (
        <>
          <div className="hidden sm:flex items-center gap-2">
            <Badge className="bg-green-100 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
            <div className="text-sm text-gray-600 font-mono">
              {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
            </div>
          </div>
          <WalletMultiButton className="!bg-gradient-to-r !from-purple-600 !to-blue-600 !text-white hover:!from-purple-700 hover:!to-blue-700 !rounded-xl !px-6 !py-3 !text-sm !font-medium !transition-all !duration-300 !shadow-lg hover:!shadow-xl" />
        </>
      ) : (
        <>
          <Button
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            onClick={() => {
              // This will trigger the wallet modal
              const walletButton = document.querySelector('.wallet-adapter-button') as HTMLElement;
              walletButton?.click();
            }}
          >
            <Zap className="h-4 w-4 mr-2" />
            Connect Phantom
          </Button>
          <WalletMultiButton className="hidden" />
        </>
      )}
    </div>
  );
}