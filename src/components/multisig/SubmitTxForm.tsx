import { useState, useCallback } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { MultisigInfo } from '../../types';
import Button from '../common/Button';
import AddressInput from '../common/AddressInput';
import {
  submitTransaction,
  buildAddOwnerArgs,
  buildRemoveOwnerArgs,
  buildReplaceOwnerArgs,
  buildChangeRequirementArgs,
  buildChangeExecutionDelayArgs,
} from '../../lib/multisig';
import { Args, Mas } from '@massalabs/massa-web3';
import { TIME_UNITS } from '../../lib/constants';

type Preset = 'custom' | 'addOwner' | 'removeOwner' | 'replaceOwner' | 'changeRequirement' | 'changeExecutionDelay'

export type DataArgType = 'string' | 'u8' | 'u16' | 'u32' | 'u64' | 'i32' | 'i64' | 'bool' | 'bytes'

export interface DataArg {
  id: string
  type: DataArgType
  value: string
}

const DATA_ARG_TYPES: { value: DataArgType; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'u8', label: 'U8' },
  { value: 'u16', label: 'U16' },
  { value: 'u32', label: 'U32' },
  { value: 'u64', label: 'U64' },
  { value: 'i32', label: 'I32' },
  { value: 'i64', label: 'I64' },
  { value: 'bool', label: 'Bool' },
  { value: 'bytes', label: 'Bytes (hex)' },
]

function serializeDataArgs(args: DataArg[]): Uint8Array {
  if (args.length === 0) return new Uint8Array(0);
  const a = new Args();
  for (const arg of args) {
    const v = arg.value.trim();
    switch (arg.type) {
      case 'string':
        a.addString(v);
        break;
      case 'u8':
        a.addU8(BigInt(v));
        break;
      case 'u16':
        a.addU16(BigInt(v));
        break;
      case 'u32':
        a.addU32(BigInt(v));
        break;
      case 'u64':
        a.addU64(BigInt(v));
        break;
      case 'i32':
        a.addI32(BigInt(v));
        break;
      case 'i64':
        a.addI64(BigInt(v));
        break;
      case 'bool':
        a.addBool(v === 'true' || v === '1');
        break;
      case 'bytes': {
        const hex = v.startsWith('0x') ? v.slice(2) : v;
        const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || []);
        a.addUint8Array(bytes);
        break;
      }
      default:
        break;
    }
  }
  return a.serialize();
}

interface SubmitTxFormProps {
  contractAddress: string
  multisigInfo: MultisigInfo
  onSuccess: () => void
}

export default function SubmitTxForm({
  contractAddress,
  multisigInfo,
  onSuccess,
}: SubmitTxFormProps) {
  const { provider } = useWallet();

  const [preset, setPreset] = useState<Preset>('custom');
  const [to, setTo] = useState('');
  const [method, setMethod] = useState('');
  const [value, setValue] = useState('');
  const [dataArgs, setDataArgs] = useState<DataArg[]>([]);

  const addDataArg = useCallback(() => {
    setDataArgs((prev) => [
      ...prev,
      { id: `arg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`, type: 'string', value: '' },
    ]);
  }, []);
  const removeDataArg = useCallback((id: string) => {
    setDataArgs((prev) => prev.filter((a) => a.id !== id));
  }, []);
  const updateDataArg = useCallback((id: string, updates: Partial<DataArg>) => {
    setDataArgs((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  // Preset-specific fields
  const [newOwner, setNewOwner] = useState('');
  const [ownerToRemove, setOwnerToRemove] = useState('');
  const [oldOwner, setOldOwner] = useState('');
  const [newRequired, setNewRequired] = useState(multisigInfo.required);
  const [newDelay, setNewDelay] = useState(1);
  const [newDelayUnit, setNewDelayUnit] = useState<'minutes' | 'hours' | 'days'>('hours');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isOwner = provider && multisigInfo.owners.includes(provider.address);

  const presets: { value: Preset; label: string }[] = [
    { value: 'custom', label: 'Custom Operation' },
    { value: 'addOwner', label: 'Add Owner' },
    { value: 'removeOwner', label: 'Remove Owner' },
    { value: 'replaceOwner', label: 'Replace Owner' },
    { value: 'changeRequirement', label: 'Change Required Approvals' },
    { value: 'changeExecutionDelay', label: 'Change Execution Delay' },
  ];

  const handleSubmit = async () => {
    if (!provider || !isOwner) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      let targetTo = to;
      let targetMethod = method;
      let targetValue = value ? Mas.fromString(value) : 0n;
      let data = new Uint8Array();

      // Build transaction based on preset
      switch (preset) {
        case 'addOwner':
          if (!newOwner) throw new Error('New owner address required');
          if (!newOwner.startsWith('AU')) throw new Error('Owner address must start with AU');
          targetTo = contractAddress;
          targetMethod = 'addOwner';
          targetValue = 0n;
          data = buildAddOwnerArgs(newOwner);
          break;

        case 'removeOwner':
          if (!ownerToRemove) throw new Error('Owner to remove required');
          if (multisigInfo.owners.length - 1 < multisigInfo.required) {
            throw new Error(`Cannot remove owner: would leave fewer owners (${multisigInfo.owners.length - 1}) than required approvals (${multisigInfo.required})`);
          }
          if (multisigInfo.owners.length <= 2) {
            throw new Error('Cannot remove owner: minimum 2 owners required');
          }
          targetTo = contractAddress;
          targetMethod = 'removeOwner';
          targetValue = 0n;
          data = buildRemoveOwnerArgs(ownerToRemove);
          break;

        case 'replaceOwner':
          if (!oldOwner || !newOwner) throw new Error('Both old and new owner addresses required');
          if (!newOwner.startsWith('AU')) throw new Error('New owner address must start with AU');
          targetTo = contractAddress;
          targetMethod = 'replaceOwner';
          targetValue = 0n;
          data = buildReplaceOwnerArgs(oldOwner, newOwner);
          break;

        case 'changeRequirement':
          if (newRequired < 1) throw new Error('Required must be at least 1');
          if (newRequired > multisigInfo.owners.length) {
            throw new Error(`Required (${newRequired}) cannot exceed owners (${multisigInfo.owners.length})`);
          }
          targetTo = contractAddress;
          targetMethod = 'changeRequirement';
          targetValue = 0n;
          data = buildChangeRequirementArgs(newRequired);
          break;

        case 'changeExecutionDelay': {
          const unitMs =
            newDelayUnit === 'minutes'
              ? TIME_UNITS.MINUTE
              : newDelayUnit === 'hours'
                ? TIME_UNITS.HOUR
                : TIME_UNITS.DAY;
          const delayMs = BigInt(newDelay) * unitMs;
          targetTo = contractAddress;
          targetMethod = 'changeExecutionDelay';
          targetValue = 0n;
          data = buildChangeExecutionDelayArgs(delayMs);
          break;
        }

        case 'custom':
          if (!to) throw new Error('Target address required');
          try {
            data = serializeDataArgs(dataArgs);
          } catch (e) {
            throw new Error(
              `Invalid data argument: ${e instanceof Error ? e.message : 'check types and values (e.g. numbers for u64, true/false for bool)'}`
            );
          }
          break;
      }

      await submitTransaction(provider, contractAddress, targetTo, targetMethod, targetValue, data);
      setSuccess('Operation submitted successfully!');

      // Reset form
      setTo('');
      setMethod('');
      setValue('');
      setDataArgs([]);
      setNewOwner('');
      setOwnerToRemove('');
      setOldOwner('');

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit operation');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Only owners can submit operations</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Submit Operation</h3>

      <div className="space-y-4 max-w-xl">
        {/* Preset Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Operation Type
          </label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {presets.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Operation Fields */}
        {preset === 'custom' && (
          <>
            <AddressInput
              label="Target Address"
              value={to}
              onChange={setTo}
              placeholder="AS... or AU..."
            />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Method (optional)
              </label>
              <input
                type="text"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="e.g., transfer"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Value (MAS)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  Data (optional)
                </label>
                <Button type="button" variant="secondary" size="sm" onClick={addDataArg}>
                  Add argument
                </Button>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                Add arguments in order; they will be serialized with Args.
              </p>
              {dataArgs.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No arguments. Click &quot;Add argument&quot; to add one.</p>
              ) : (
                <div className="space-y-3">
                  {dataArgs.map((arg, index) => (
                    <div
                      key={arg.id}
                      className="flex flex-wrap items-center gap-2 p-3 bg-gray-700/50 rounded-md border border-gray-600"
                    >
                      <span className="text-gray-400 text-sm w-6">#{index + 1}</span>
                      <select
                        value={arg.type}
                        onChange={(e) => updateDataArg(arg.id, { type: e.target.value as DataArgType })}
                        className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-blue-500 min-w-[100px]"
                      >
                        {DATA_ARG_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={arg.value}
                        onChange={(e) => updateDataArg(arg.id, { value: e.target.value })}
                        placeholder={arg.type === 'bool' ? 'true / false' : arg.type === 'bytes' ? '0x... or hex' : 'value'}
                        className="flex-1 min-w-[120px] px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white font-mono text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeDataArg(arg.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                        title="Remove argument"
                        aria-label="Remove argument"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Add Owner */}
        {preset === 'addOwner' && (
          <AddressInput
            label="New Owner Address"
            value={newOwner}
            onChange={setNewOwner}
            placeholder="AU..."
          />
        )}

        {/* Remove Owner */}
        {preset === 'removeOwner' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Owner to Remove
            </label>
            <select
              value={ownerToRemove}
              onChange={(e) => setOwnerToRemove(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select owner...</option>
              {multisigInfo.owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner.slice(0, 12)}...{owner.slice(-8)}
                </option>
              ))}
            </select>
            {multisigInfo.owners.length <= 2 && (
              <p className="mt-1 text-sm text-yellow-400">
                Cannot remove: minimum 2 owners required
              </p>
            )}
            {multisigInfo.owners.length - 1 < multisigInfo.required && multisigInfo.owners.length > 2 && (
              <p className="mt-1 text-sm text-yellow-400">
                Warning: Removing an owner will leave fewer owners than required approvals
              </p>
            )}
          </div>
        )}

        {/* Replace Owner */}
        {preset === 'replaceOwner' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Owner to Replace
              </label>
              <select
                value={oldOwner}
                onChange={(e) => setOldOwner(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select owner...</option>
                {multisigInfo.owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner.slice(0, 12)}...{owner.slice(-8)}
                  </option>
                ))}
              </select>
            </div>
            <AddressInput
              label="New Owner Address"
              value={newOwner}
              onChange={setNewOwner}
              placeholder="AU..."
            />
          </>
        )}

        {/* Change Requirement */}
        {preset === 'changeRequirement' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              New Required Approvals
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={1}
                max={multisigInfo.owners.length}
                value={newRequired}
                onChange={(e) => setNewRequired(parseInt(e.target.value) || 1)}
                className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400">
                of {multisigInfo.owners.length} owners (current: {multisigInfo.required})
              </span>
            </div>
            {newRequired > multisigInfo.owners.length && (
              <p className="mt-1 text-sm text-red-400">
                Cannot exceed number of owners ({multisigInfo.owners.length})
              </p>
            )}
          </div>
        )}

        {/* Change Execution Delay */}
        {preset === 'changeExecutionDelay' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              New Execution Delay
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={newDelay}
                onChange={(e) => setNewDelay(parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newDelayUnit}
                onChange={(e) => setNewDelayUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded-md">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-900/30 border border-green-700 rounded-md">
            <p className="text-sm text-green-300">{success}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          className="w-full"
        >
          Submit Operation
        </Button>
      </div>
    </div>
  );
}
