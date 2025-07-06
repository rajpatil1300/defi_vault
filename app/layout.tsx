import './globals.css';
import type { Metadata } from 'next';
import { WalletContextProvider } from '@/components/WalletContextProvider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'Solana DeFi Vault',
  description: 'Earn interest on your SPL tokens with our secure DeFi vault',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
        <Toaster />
      </body>
    </html>
  );
}