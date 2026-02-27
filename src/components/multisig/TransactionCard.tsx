import { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { MultisigInfo, TransactionWithApprovals } from '../../types';
import Button from '../common/Button';
import {
  approveTransaction,
  executeTransaction,
  revokeTransaction,
} from '../../lib/multisig';

interface TransactionCardProps {
  transaction: TransactionWithApprovals
  multisigInfo: MultisigInfo
  onRefresh: () => void
}

export default function TransactionCard({
  transaction,
  multisigInfo,
  onRefresh,
}: TransactionCardProps) {
  const { provider } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize address for comparison (trim; contract and wallet may use same address in different formats)
  const normalizeAddr = (addr: string) => addr.trim().toLowerCase();
  const currentAddr = provider ? normalizeAddr(provider.address) : '';
  const isOwner = provider && multisigInfo.owners.some((o) => normalizeAddr(o) === currentAddr);
  const hasApproved = provider && transaction.approvals.some((a) => normalizeAddr(a) === currentAddr);
  const canExecute = transaction.approvalCount >= multisigInfo.required && !transaction.executed;

  // Timer tick for countdown when waiting for delay
  const [, setTick] = useState(0);
  const nowMs = Date.now();
  const unlockAtMs = Number(transaction.timestamp) + Number(multisigInfo.delay);
  const delayPassed = transaction.timestamp > 0n && unlockAtMs <= nowMs;
  const waitingForDelay = canExecute && !transaction.executed && !delayPassed;

  useEffect(() => {
    if (!waitingForDelay) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [waitingForDelay]);

  const getTimeRemaining = (): string => {
    const remainingMs = Math.max(0, unlockAtMs - Date.now());
    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  const handleApprove = async () => {
    if (!provider) return;
    setIsProcessing(true);
    setError(null);
    try {
      await approveTransaction(provider, multisigInfo.address, transaction.id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecute = async () => {
    if (!provider) return;
    setIsProcessing(true);
    setError(null);
    try {
      await executeTransaction(provider, multisigInfo.address, transaction.id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevoke = async () => {
    if (!provider) return;
    setIsProcessing(true);
    setError(null);
    try {
      await revokeTransaction(provider, multisigInfo.address, transaction.id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatValue = (value: bigint): string => {
    const mas = Number(value) / 1e9;
    return mas.toFixed(4);
  };

  const getStatusBadge = () => {
    if (transaction.executed) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded bg-green-900/50 text-green-400 border border-green-700">
          Executed
        </span>
      );
    }
    if (canExecute) {
      if (delayPassed) {
        return (
          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-900/50 text-blue-400 border border-blue-700">
            Ready to Execute
          </span>
        );
      }
      return (
        <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-900/50 text-yellow-400 border border-yellow-700">
          Waiting for Delay · {getTimeRemaining()}
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium rounded bg-gray-700 text-gray-300">
        Pending ({transaction.approvalCount}/{multisigInfo.required})
      </span>
    );
  };

  return (
    <div className={`bg-gray-700/50 rounded-lg p-4 ${transaction.executed ? 'opacity-75' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-gray-400">#{transaction.id.toString()}</span>
          {getStatusBadge()}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-400">To</p>
          <p className="text-sm font-mono text-white truncate" title={transaction.to}>
            {transaction.to.slice(0, 12)}...{transaction.to.slice(-8)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Method</p>
          <p className="text-sm text-white">
            {transaction.method || '(transfer)'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Value</p>
          <p className="text-sm text-white">{formatValue(transaction.value)} MAS</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Approvals</p>
          <p className="text-sm text-white">
            {transaction.approvalCount} / {multisigInfo.required}
          </p>
        </div>
      </div>

      {/* Approvers - show every approval; no length filter so address is always visible */}
      {(transaction.approvals.length > 0 || transaction.approvalCount > 0) && (
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-1">Approved by:</p>
          <div className="flex flex-wrap gap-1 items-center">
            {transaction.approvals.map((addr, idx) => {
              const raw = typeof addr === 'string' ? addr.trim() : String(addr ?? '').trim();
              const display =
                raw.length >= 14
                  ? `${raw.slice(0, 8)}...${raw.slice(-6)}`
                  : raw || `(approval ${idx + 1})`;
              return (
                <span
                  key={raw || `approval-${idx}`}
                  className="px-2 py-0.5 text-xs font-mono bg-gray-600 rounded text-gray-300 break-all"
                  title={raw || undefined}
                >
                  {display}
                </span>
              );
            })}
            {transaction.approvalCount > 0 && transaction.approvals.length === 0 && (
              <span className="text-xs text-gray-500 italic">
                {transaction.approvalCount} approval{transaction.approvalCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-700 rounded">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Actions */}
      {!transaction.executed && isOwner && (
        <div className="flex gap-2 pt-3 border-t border-gray-600">
          {!hasApproved && (
            <Button
              size="sm"
              onClick={handleApprove}
              loading={isProcessing}
              disabled={isProcessing}
            >
              Approve
            </Button>
          )}
          {hasApproved && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRevoke}
              loading={isProcessing}
              disabled={isProcessing}
            >
              Revoke
            </Button>
          )}
          {canExecute && (
            <Button
              size="sm"
              variant="success"
              onClick={handleExecute}
              loading={isProcessing}
              disabled={isProcessing || !delayPassed}
              title={!delayPassed ? 'Execution delay not passed yet' : ''}
            >
              Execute
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
