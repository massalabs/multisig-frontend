import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { getWallets, Wallet } from '@massalabs/wallet-provider';
import { Provider, Network } from '@massalabs/massa-web3';

interface WalletContextType {
  availableWallets: Wallet[]
  wallet: Wallet | null
  provider: Provider | null
  providers: Provider[]
  network: Network | null
  balance: bigint | null
  isConnecting: boolean
  isLoadingWallets: boolean
  isWalletModalOpen: boolean
  error: string | null
  openWalletModal: () => void
  closeWalletModal: () => void
  refreshWallets: () => Promise<void>
  refreshBalance: () => Promise<void>
  connectWallet: (wallet: Wallet) => Promise<void>
  disconnect: () => void
  selectProvider: (provider: Provider) => void
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [availableWallets, setAvailableWallets] = useState<Wallet[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [network, setNetwork] = useState<Network | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingWallets, setIsLoadingWallets] = useState(true);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openWalletModal = useCallback(() => {
    setIsWalletModalOpen(true);
  }, []);

  const closeWalletModal = useCallback(() => {
    setIsWalletModalOpen(false);
  }, []);

  // Refresh available wallets
  const refreshWallets = useCallback(async () => {
    setIsLoadingWallets(true);
    try {
      const wallets = await getWallets();
      setAvailableWallets(wallets);
    } catch (err) {
      console.error('Failed to get wallets:', err);
      setAvailableWallets([]);
    } finally {
      setIsLoadingWallets(false);
    }
  }, []);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!provider) {
      setBalance(null);
      return;
    }
    try {
      const bal = await provider.balance(true);
      setBalance(bal);
    } catch (err) {
      console.error('Failed to get balance:', err);
      setBalance(null);
    }
  }, [provider]);

  // Load wallets on mount
  useEffect(() => {
    refreshWallets();
  }, [refreshWallets]);

  // Fetch network and balance when provider changes
  useEffect(() => {
    if (provider) {
      // Fetch network info
      provider.networkInfos().then(setNetwork).catch(console.error);
      // Fetch balance
      refreshBalance();
    } else {
      setNetwork(null);
      setBalance(null);
    }
  }, [provider, refreshBalance]);

  // Connect to a specific wallet
  const connectWallet = useCallback(async (selectedWallet: Wallet) => {
    setIsConnecting(true);
    setError(null);

    try {
      // Connect to the wallet
      await selectedWallet.connect();

      setWallet(selectedWallet);

      // Get network info from wallet
      const networkInfo = await selectedWallet.networkInfos();
      setNetwork(networkInfo);

      const walletProviders = await selectedWallet.accounts();

      if (walletProviders.length === 0) {
        throw new Error('No accounts found in wallet. Please create an account.');
      }

      setProviders(walletProviders);
      setProvider(walletProviders[0]);
      setIsWalletModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (wallet) {
      try {
        await wallet.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
    setWallet(null);
    setProvider(null);
    setProviders([]);
    setNetwork(null);
    setBalance(null);
    setError(null);
  }, [wallet]);

  const selectProvider = useCallback((selectedProvider: Provider) => {
    setProvider(selectedProvider);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        availableWallets,
        wallet,
        provider,
        providers,
        network,
        balance,
        isConnecting,
        isLoadingWallets,
        isWalletModalOpen,
        error,
        openWalletModal,
        closeWalletModal,
        refreshWallets,
        refreshBalance,
        connectWallet,
        disconnect,
        selectProvider,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
