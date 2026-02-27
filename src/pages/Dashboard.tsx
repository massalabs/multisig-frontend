import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import Button from '../components/common/Button';
import AddressInput from '../components/common/AddressInput';
import TransactionList from '../components/multisig/TransactionList';
import SubmitTxForm from '../components/multisig/SubmitTxForm';
import SettingsPanel from '../components/multisig/SettingsPanel';
import {
  getOwners,
  getRequired,
  getDelay,
  getUpgradeDelay,
  getTransactions,
  getApprovals,
  receiveCoins,
  getContractBalance,
} from '../lib/multisig';
import { getSavedAddresses, saveAddress, removeAddress } from '../lib/storage';
import type { MultisigInfo, TransactionWithApprovals } from '../types';
import { Mas } from '@massalabs/massa-web3';

type Tab = 'transactions' | 'submit' | 'settings' | 'deposit'

interface MultisigSummary {
  address: string
  owners: string[]
  required: number
  isOwner: boolean
}

export default function Dashboard() {
  const { address: urlAddress } = useParams();
  const navigate = useNavigate();
  const { provider } = useWallet();

  // List of user's multisigs
  const [userMultisigs, setUserMultisigs] = useState<MultisigSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Selected multisig details
  const [contractAddress, setContractAddress] = useState(urlAddress || '');
  const [multisigInfo, setMultisigInfo] = useState<MultisigInfo | null>(null);
  const [contractBalance, setContractBalance] = useState<bigint | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithApprovals[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('transactions');
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);

  // Manual address input
  const [manualAddress, setManualAddress] = useState('');

  // Load user's multisigs from localStorage
  const loadUserMultisigs = useCallback(async () => {
    if (!provider) {
      console.log('No provider available');
      return;
    }

    setIsLoadingList(true);
    setError(null);

    const savedAddresses = getSavedAddresses();
    console.log('Saved addresses from localStorage:', savedAddresses);
    console.log('Current wallet address:', provider.address);

    const multisigs: MultisigSummary[] = [];

    for (const address of savedAddresses) {
      try {
        console.log(`Loading multisig: ${address}`);
        const owners = await getOwners(provider, address);
        console.log(`Owners for ${address}:`, owners);

        if (owners.length > 0) {
          const required = await getRequired(provider, address);
          const isOwner = owners.includes(provider.address);
          console.log(`Is owner: ${isOwner}`);
          multisigs.push({ address, owners, required, isOwner });
        }
      } catch (err) {
        // Contract might be invalid or not a multisig, skip it
        console.warn(`Failed to load multisig ${address}:`, err);
      }
    }

    console.log('Loaded multisigs:', multisigs);
    setUserMultisigs(multisigs);
    setIsLoadingList(false);
  }, [provider]);

  // Load selected multisig data
  const loadMultisigData = useCallback(async () => {
    if (!provider || !contractAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      const [owners, required, delay, upgradeDelay] = await Promise.all([
        getOwners(provider, contractAddress),
        getRequired(provider, contractAddress),
        getDelay(provider, contractAddress),
        getUpgradeDelay(provider, contractAddress),
      ]);

      if (owners.length === 0) {
        throw new Error('Invalid multisig address or contract not found');
      }

      setMultisigInfo({
        address: contractAddress,
        owners,
        required,
        delay,
        upgradeDelay,
      });

      // Load contract balance
      const balance = await getContractBalance(provider, contractAddress);
      setContractBalance(balance);

      // Always save address when we successfully load a multisig so it appears in "Your Multisigs"
      saveAddress(contractAddress);

      // Load transactions
      const txs = await getTransactions(provider, contractAddress);

      // Load approvals for each transaction
      const txsWithApprovals: TransactionWithApprovals[] = await Promise.all(
        txs.map(async (tx) => {
          const approvals = await getApprovals(provider, contractAddress, tx.id);
          return {
            ...tx,
            approvals,
            approvalCount: approvals.length,
          };
        })
      );

      setTransactions(txsWithApprovals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load multisig data');
      setMultisigInfo(null);
      setContractBalance(null);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [provider, contractAddress]);

  // Load user's multisigs on mount and when provider changes
  useEffect(() => {
    if (provider && !urlAddress) {
      loadUserMultisigs();
    }
  }, [provider, urlAddress, loadUserMultisigs]);

  // Handle URL address changes
  useEffect(() => {
    if (urlAddress && urlAddress !== contractAddress) {
      setContractAddress(urlAddress);
    }
  }, [urlAddress, contractAddress]);

  // Load multisig data when address is set
  useEffect(() => {
    if (contractAddress && provider) {
      loadMultisigData();
    }
  }, [contractAddress, provider, loadMultisigData]);

  const handleSelectMultisig = (address: string) => {
    setContractAddress(address);
    navigate(`/dashboard/${address}`);
  };

  const handleLoadManualAddress = () => {
    if (manualAddress) {
      setContractAddress(manualAddress);
      navigate(`/dashboard/${manualAddress}`);
    }
  };

  const handleRemoveMultisig = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeAddress(address);
    setUserMultisigs((prev) => prev.filter((m) => m.address !== address));
  };

  const handleBackToList = () => {
    setMultisigInfo(null);
    setContractBalance(null);
    setContractAddress('');
    setManualAddress('');
    navigate('/dashboard');
    loadUserMultisigs();
  };

  const formatBalance = (bal: bigint): string => {
    return `${Mas.toString(bal, 4)} MAS`;
  };

  const handleDeposit = async () => {
    if (!provider || !contractAddress || !depositAmount) return;

    setIsDepositing(true);
    try {
      const amount = Mas.fromString(depositAmount);
      await receiveCoins(provider, contractAddress, amount);
      setDepositAmount('');
      await loadMultisigData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setIsDepositing(false);
    }
  };

  const isOwner = provider && multisigInfo?.owners.includes(provider.address);

  const formatDelay = (ms: bigint): string => {
    const hours = Number(ms / 3600000n);
    if (hours < 1) {
      const minutes = Number(ms / 60000n);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  };

  if (!provider) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Multisig Dashboard</h2>
        <p className="text-gray-400">Please connect your wallet to manage a multisig.</p>
      </div>
    );
  }

  // Show multisig list if no specific address is selected
  if (!multisigInfo && !contractAddress) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Multisig Dashboard</h1>

        {/* User's Multisigs */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Your Multisigs</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadUserMultisigs}
              loading={isLoadingList}
            >
              Refresh
            </Button>
          </div>

          {isLoadingList ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <svg
                className="animate-spin h-10 w-10 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-sm text-gray-400">Loading your multisigs...</p>
            </div>
          ) : userMultisigs.length > 0 ? (
            <div className="space-y-3">
              {userMultisigs.map((multisig) => (
                <div
                  key={multisig.address}
                  onClick={() => handleSelectMultisig(multisig.address)}
                  className="bg-gray-700/50 hover:bg-gray-700 rounded-lg p-4 cursor-pointer transition-colors border border-gray-600 hover:border-gray-500"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white">
                          {formatAddress(multisig.address)}
                        </span>
                        {multisig.isOwner && (
                          <span className="px-2 py-0.5 bg-green-900/50 text-green-400 text-xs rounded">
                            Owner
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-400">
                        {multisig.owners.length} owners · {multisig.required} required
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleRemoveMultisig(multisig.address, e)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title="Remove from list"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="mb-2">No multisig contracts found.</p>
              <p className="text-sm">
                Deploy a new multisig or load an existing one below.
              </p>
              <p className="text-xs mt-2 text-gray-500">
                Saved addresses in storage: {getSavedAddresses().length}
              </p>
            </div>
          )}
        </div>

        {/* Manual Address Input */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            Load Existing Multisig
          </h2>
          <div className="flex gap-4">
            <AddressInput
              value={manualAddress}
              onChange={setManualAddress}
              placeholder="Enter multisig contract address (AS...)"
              className="flex-1"
            />
            <Button onClick={handleLoadManualAddress} disabled={!manualAddress}>
              Load
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state for specific multisig
  if (isLoading && !multisigInfo) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={handleBackToList}>
            Back
          </Button>
          <h1 className="text-2xl font-bold text-white">Multisig Dashboard</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <svg
            className="animate-spin h-8 w-8 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !multisigInfo) {
    const isContractNotFound =
      error.includes('contract not found') || error.includes('Invalid multisig address');

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={handleBackToList}>
            Back
          </Button>
          <h1 className="text-2xl font-bold text-white">Multisig Dashboard</h1>
        </div>
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 text-center">
          <p className="text-red-400">{error}</p>
          {isContractNotFound && (
            <p className="text-gray-400 text-sm mt-2">
              If you just deployed this contract, wait a moment for the deployment to finalize, then try again.
            </p>
          )}
          <div className="flex gap-3 justify-center mt-4">
            {isContractNotFound && (
              <Button
                variant="secondary"
                onClick={() => {
                  setError(null);
                  loadMultisigData();
                }}
              >
                Try again
              </Button>
            )}
            <Button variant="secondary" onClick={handleBackToList}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Multisig detail view
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="secondary" size="sm" onClick={handleBackToList}>
          Back
        </Button>
        <h1 className="text-2xl font-bold text-white">Multisig Dashboard</h1>
      </div>

      {/* Multisig Info */}
      {multisigInfo && (
        <>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Multisig Info</h2>
                <p className="text-sm text-gray-400 font-mono mt-1">
                  {multisigInfo.address}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-400">Contract Balance</p>
                <p className="text-xl font-semibold text-white">
                  {contractBalance !== null ? formatBalance(contractBalance) : '—'}
                </p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-400">Owners</p>
                <p className="text-xl font-semibold text-white">
                  {multisigInfo.owners.length}
                </p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-400">Required</p>
                <p className="text-xl font-semibold text-white">
                  {multisigInfo.required}
                </p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-400">Execution Delay</p>
                <p className="text-xl font-semibold text-white">
                  {formatDelay(multisigInfo.delay)}
                </p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-400">Your Role</p>
                <p
                  className={`text-xl font-semibold ${isOwner ? 'text-green-400' : 'text-gray-400'}`}
                >
                  {isOwner ? 'Owner' : 'Viewer'}
                </p>
              </div>
            </div>

            {/* Owner List */}
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">Owners:</p>
              <div className="flex flex-wrap gap-2">
                {multisigInfo.owners.map((owner) => (
                  <span
                    key={owner}
                    className={`px-2 py-1 rounded text-xs font-mono ${owner === provider?.address
                      ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                      : 'bg-gray-700 text-gray-300'
                      }`}
                  >
                    {owner.slice(0, 8)}...{owner.slice(-6)}
                    {owner === provider?.address && ' (you)'}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-700">
            <nav className="flex space-x-4">
              {(['transactions', 'submit', 'deposit', 'settings'] as Tab[]).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                      }`}
                  >
                    {tab === 'transactions' ? 'Operations' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                )
              )}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            {activeTab === 'transactions' && (
              <TransactionList
                transactions={transactions}
                multisigInfo={multisigInfo}
                onRefresh={loadMultisigData}
              />
            )}

            {activeTab === 'submit' && (
              <SubmitTxForm
                contractAddress={contractAddress}
                multisigInfo={multisigInfo}
                onSuccess={loadMultisigData}
              />
            )}

            {activeTab === 'deposit' && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Deposit MAS
                </h3>
                <div className="max-w-md">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amount (MAS)
                  </label>
                  <div className="flex gap-4">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button
                      onClick={handleDeposit}
                      loading={isDepositing}
                      disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                    >
                      Deposit
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <SettingsPanel
                contractAddress={contractAddress}
                multisigInfo={multisigInfo}
                onSuccess={loadMultisigData}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
