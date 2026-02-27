import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import Button from '../components/common/Button';
import AddressInput from '../components/common/AddressInput';
import { TIME_UNITS } from '../lib/constants';
import { saveAddress } from '../lib/storage';
import { Args, Mas, ArrayTypes } from '@massalabs/massa-web3';

// Safe gas limit under network maximum (3,980,167,295)
const DEPLOY_MAX_GAS = 3_000_000_000n;

type TimeUnit = 'minutes' | 'hours' | 'days'

export default function Deploy() {
  const { provider } = useWallet();
  const navigate = useNavigate();

  const [owners, setOwners] = useState<string[]>(['', '']);
  const [required, setRequired] = useState(2);
  const [upgradeDelay, setUpgradeDelay] = useState(1);
  const [upgradeDelayUnit, setUpgradeDelayUnit] = useState<TimeUnit>('days');
  const [executionDelay, setExecutionDelay] = useState(1);
  const [executionDelayUnit, setExecutionDelayUnit] = useState<TimeUnit>('hours');
  const [deployCoins, setDeployCoins] = useState('0');
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);

  const timeUnitToMs: Record<TimeUnit, bigint> = {
    minutes: TIME_UNITS.MINUTE,
    hours: TIME_UNITS.HOUR,
    days: TIME_UNITS.DAY,
  };

  const addOwner = () => {
    setOwners([...owners, '']);
  };

  const removeOwner = (index: number) => {
    if (owners.length > 2) {
      const newOwners = owners.filter((_, i) => i !== index);
      setOwners(newOwners);
      // Adjust required if needed
      if (required > newOwners.filter((o) => o.trim() !== '').length) {
        setRequired(Math.max(1, newOwners.filter((o) => o.trim() !== '').length));
      }
    }
  };

  const updateOwner = (index: number, value: string) => {
    const newOwners = [...owners];
    newOwners[index] = value;
    setOwners(newOwners);
  };

  const validateForm = (): string | null => {
    const validOwners = owners.filter((o) => o.trim() !== '');

    if (validOwners.length < 2) {
      return 'At least 2 owners are required';
    }

    // Check for duplicate owners
    const uniqueOwners = new Set(validOwners);
    if (uniqueOwners.size !== validOwners.length) {
      return 'Duplicate owner addresses are not allowed';
    }

    // Validate addresses format
    for (const owner of validOwners) {
      if (!owner.startsWith('AU')) {
        return `Invalid address format: ${owner}. Addresses should start with AU`;
      }
    }

    if (required < 1) {
      return 'Required approvals must be at least 1';
    }

    if (required > validOwners.length) {
      return `Required approvals (${required}) cannot exceed number of owners (${validOwners.length})`;
    }

    if (upgradeDelay < 0 || executionDelay < 0) {
      return 'Delays cannot be negative';
    }

    const coinsNum = parseFloat(deployCoins);
    if (Number.isNaN(coinsNum) || coinsNum < 0) {
      return 'Initial coins must be a non-negative number';
    }

    return null;
  };

  const handleDeploy = async () => {
    if (!provider) {
      setError('Please connect your wallet first');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsDeploying(true);
    setError(null);
    setDeployedAddress(null);

    try {
      const validOwners = owners.filter((o) => o.trim() !== '');
      const upgradeDelayMs = BigInt(upgradeDelay) * timeUnitToMs[upgradeDelayUnit];
      const executionDelayMs = BigInt(executionDelay) * timeUnitToMs[executionDelayUnit];

      // Fetch the WASM file
      const response = await fetch('/Multisig.wasm');
      if (!response.ok) {
        throw new Error('Failed to load Multisig.wasm. Make sure the file exists in the public folder.');
      }
      const wasmBuffer = await response.arrayBuffer();
      const wasmBytes = new Uint8Array(wasmBuffer);

      // Build constructor arguments
      const args = new Args()
        .addArray(validOwners, ArrayTypes.STRING)
        .addI32(BigInt(required))
        .addU64(upgradeDelayMs)
        .addU64(executionDelayMs);

      const argsBytes = args.serialize();
      console.log('Constructor args (hex):', Array.from(argsBytes instanceof Uint8Array ? argsBytes : new Uint8Array(argsBytes)).map((b) => b.toString(16).padStart(2, '0')).join(''));
      console.log('Owners:', validOwners);
      console.log('Required:', required);
      console.log('UpgradeDelay (ms):', upgradeDelayMs.toString());
      console.log('ExecutionDelay (ms):', executionDelayMs.toString());

      let coinsAmount: bigint;
      try {
        coinsAmount = deployCoins.trim() ? Mas.fromString(deployCoins.trim()) : 0n;
      } catch {
        throw new Error('Invalid coins amount. Use a number (e.g. 5 or 0.5).');
      }
      const maxCoinsAmount = coinsAmount + Mas.fromMas(5n);

      // Deploy the contract and wait for finalization so the contract is available when opening the dashboard
      const deployedContract = await provider.deploySC({
        byteCode: wasmBytes,
        parameter: args.serialize(),
        coins: coinsAmount,
        fee: Mas.fromMas(1n) / 100n,
        maxGas: DEPLOY_MAX_GAS,
        maxCoins: maxCoinsAmount,
        waitFinalExecution: true,
      });

      const opId = (deployedContract as { operationId?: string }).operationId ?? (deployedContract as { operation_id?: string }).operation_id ?? deployedContract;
      console.log('[deploySC] operationId:', opId);
      // Save address to localStorage for dashboard auto-load
      saveAddress(deployedContract.address);
      setDeployedAddress(deployedContract.address);
    } catch (err) {
      console.error('Deployment error:', err);
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  const validOwnerCount = owners.filter((o) => o.trim() !== '').length;

  if (!provider) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Deploy New Multisig</h2>
        <p className="text-gray-400">Please connect your wallet to deploy a multisig.</p>
      </div>
    );
  }

  if (deployedAddress) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-6 mb-6">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-2xl font-bold text-white mb-2">Multisig Deployed!</h2>
          <p className="text-gray-300 mb-4">Your multisig contract has been deployed successfully.</p>
          <div className="bg-gray-800 rounded-md p-3 mb-4">
            <p className="text-sm text-gray-400 mb-1">Contract Address:</p>
            <p className="font-mono text-white break-all">{deployedAddress}</p>
          </div>
        </div>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => navigate(`/dashboard/${deployedAddress}`)}>
            Go to Dashboard
          </Button>
          <Button variant="secondary" onClick={() => setDeployedAddress(null)}>
            Deploy Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Deploy New Multisig</h1>

      {/* Owners */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Owners</h2>
          <Button size="sm" variant="secondary" onClick={addOwner}>
            Add Owner
          </Button>
        </div>
        <div className="space-y-3">
          {owners.map((owner, index) => (
            <div key={index} className="flex gap-2">
              <AddressInput
                value={owner}
                onChange={(value) => updateOwner(index, value)}
                placeholder={`Owner ${index + 1} address (AU...)`}
                className="flex-1"
              />
              {owners.length > 2 && (
                <button
                  onClick={() => removeOwner(index)}
                  className="px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-400">
          {validOwnerCount} valid owner{validOwnerCount !== 1 ? 's' : ''} configured
        </p>
      </div>

      {/* Required Approvals */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Required Approvals</h2>
        <div className="flex items-center gap-4">
          <input
            type="number"
            min={1}
            max={validOwnerCount || 1}
            value={required}
            onChange={(e) => setRequired(Math.min(Number(e.target.value), validOwnerCount || 1))}
            className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-400">
            out of {validOwnerCount} owner{validOwnerCount !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          Number of owner approvals required to execute a transaction
        </p>
      </div>

      {/* Delays */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Time Delays</h2>

        <div className="space-y-4">
          {/* Upgrade Delay */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upgrade Delay
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={upgradeDelay}
                onChange={(e) => setUpgradeDelay(Number(e.target.value))}
                className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={upgradeDelayUnit}
                onChange={(e) => setUpgradeDelayUnit(e.target.value as TimeUnit)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Time required before a contract upgrade can be executed
            </p>
          </div>

          {/* Execution Delay */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Execution Delay
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={executionDelay}
                onChange={(e) => setExecutionDelay(Number(e.target.value))}
                className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={executionDelayUnit}
                onChange={(e) => setExecutionDelayUnit(e.target.value as TimeUnit)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Time required after approval before a transaction can be executed
            </p>
          </div>
        </div>
      </div>

      {/* Initial coins */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Initial Balance (Coins)</h2>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            MAS to send to the contract on deployment
          </label>
          <input
            type="text"
            inputMode="decimal"
            min="0"
            value={deployCoins}
            onChange={(e) => setDeployCoins(e.target.value)}
            placeholder="5"
            className="w-full max-w-xs px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Amount of MAS the multisig contract will hold after deployment (e.g. 5 or 0.5)
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Deploy Button */}
      <Button onClick={handleDeploy} loading={isDeploying} className="w-full" size="lg">
        {isDeploying ? 'Deploying (waiting for finalization)...' : 'Deploy Multisig'}
      </Button>
    </div>
  );
}
