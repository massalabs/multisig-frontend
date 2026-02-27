import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { Mas } from '@massalabs/massa-web3';

export default function Header() {
  const {
    availableWallets,
    provider,
    providers,
    network,
    balance,
    isConnecting,
    isLoadingWallets,
    isWalletModalOpen,
    openWalletModal,
    closeWalletModal,
    connectWallet,
    disconnect,
    selectProvider,
    refreshWallets,
    refreshBalance,
  } = useWallet();
  const location = useLocation();
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/deploy', label: 'Deploy' },
    { path: '/dashboard', label: 'Dashboard' },
  ];

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const formatBalance = (bal: bigint): string => {
    const masString = Mas.toString(bal, 4);
    return `${masString} MAS`;
  };

  const getNetworkName = (): string => {
    if (!network) return 'Unknown';
    const name = network.name || '';
    if (name.toLowerCase().includes('main')) return 'Mainnet';
    if (name.toLowerCase().includes('build')) return 'Buildnet';
    if (name.toLowerCase().includes('test')) return 'Testnet';
    return name || 'Unknown';
  };

  const getNetworkColor = (): string => {
    const name = getNetworkName().toLowerCase();
    if (name.includes('main')) return 'bg-green-500';
    if (name.includes('build')) return 'bg-yellow-500';
    if (name.includes('test')) return 'bg-blue-500';
    return 'bg-gray-500';
  };

  const handleSelectAccount = (selectedProvider: typeof provider) => {
    if (selectedProvider) {
      selectProvider(selectedProvider);
      setIsAccountDropdownOpen(false);
    }
  };

  const handleConnectWallet = async (selectedWallet: typeof availableWallets[0]) => {
    await connectWallet(selectedWallet);
  };

  const getWalletIcon = (walletName: string) => {
    const name = walletName.toLowerCase();
    if (name.includes('massa') || name.includes('station')) {
      return (
        <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
          M
        </div>
      );
    }
    if (name.includes('bearby')) {
      return (
        <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
          B
        </div>
      );
    }
    if (name.includes('metamask') || name.includes('snap')) {
      return (
        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
          MM
        </div>
      );
    }
    return (
      <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
        W
      </div>
    );
  };

  return (
    <>
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold text-white">
                Massa Multisig
              </Link>
              <nav className="hidden md:flex space-x-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === link.path
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center">
              {provider ? (
                <div className="flex items-center space-x-3">
                  {/* Network Badge */}
                  {network && (
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-gray-700/50 rounded-md">
                      <div className={`w-2 h-2 rounded-full ${getNetworkColor()}`} />
                      <span className="text-xs text-gray-300">{getNetworkName()}</span>
                    </div>
                  )}

                  {/* Account Selector with Balance */}
                  <div className="relative">
                    <button
                      onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                    >
                      <div className="text-left">
                        <div className="font-mono text-xs">{formatAddress(provider.address)}</div>
                        {balance !== null && (
                          <div className="text-xs text-gray-400">{formatBalance(balance)}</div>
                        )}
                      </div>
                      {providers.length > 1 && (
                        <svg
                          className={`w-4 h-4 transition-transform ${isAccountDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>

                    {/* Account Dropdown */}
                    {isAccountDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-72 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-50 overflow-hidden">
                        <div className="py-1">
                          <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-600 flex items-center justify-between">
                            <span>Select Account ({providers.length})</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                refreshBalance();
                              }}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              Refresh
                            </button>
                          </div>
                          {providers.map((p, index) => (
                            <button
                              key={p.address}
                              onClick={() => handleSelectAccount(p)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-600 transition-colors ${p.address === provider.address
                                ? 'bg-blue-900/30 text-blue-300'
                                : 'text-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <div className="min-w-0 flex-1">
                                  {(() => {
                                    const name = p.accountName || `Account ${index + 1}`;
                                    const isAddressLike = name.length > 30 && (name.startsWith('AU') || /^[A-Za-z0-9]+$/.test(name));
                                    return isAddressLike ? (
                                      <div className="font-mono text-xs text-gray-300 truncate" title={p.address}>
                                        {formatAddress(p.address)}
                                      </div>
                                    ) : (
                                      <>
                                        <div className="font-medium truncate" title={name}>
                                          {name}
                                        </div>
                                        <div className="font-mono text-xs text-gray-400 truncate" title={p.address}>
                                          {formatAddress(p.address)}
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                                {p.address === provider.address && (
                                  <svg className="w-4 h-4 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={disconnect}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={openWalletModal}
                  disabled={isConnecting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Click outside to close account dropdown */}
        {isAccountDropdownOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsAccountDropdownOpen(false)}
          />
        )}
      </header>

      {/* Wallet Selection Modal */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeWalletModal}
          />

          {/* Modal */}
          <div className="relative bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Connect Wallet</h2>
              <button
                onClick={closeWalletModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {isLoadingWallets ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : availableWallets.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm">No wallet found</p>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Please install one of the following wallets:
                  </p>
                  <div className="space-y-2 text-sm">
                    <a
                      href="https://station.massa.net/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-blue-400 transition-colors"
                    >
                      Massa Station
                    </a>
                    <a
                      href="https://bearby.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-blue-400 transition-colors"
                    >
                      Bearby Wallet
                    </a>
                  </div>
                  <button
                    onClick={refreshWallets}
                    className="mt-4 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400 mb-4">
                    Select a wallet to connect:
                  </p>
                  {availableWallets.map((w) => (
                    <button
                      key={w.name()}
                      onClick={() => handleConnectWallet(w)}
                      disabled={isConnecting}
                      className="w-full flex items-center gap-4 px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      {getWalletIcon(w.name())}
                      <div className="text-left">
                        <div className="font-medium text-white">{w.name()}</div>
                        <div className="text-xs text-gray-400">
                          {w.name().toLowerCase().includes('massa') && 'Official Massa wallet'}
                          {w.name().toLowerCase().includes('bearby') && 'Browser extension wallet'}
                          {w.name().toLowerCase().includes('metamask') && 'MetaMask Snap for Massa'}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
