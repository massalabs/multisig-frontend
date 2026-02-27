import { MultisigInfo, TransactionWithApprovals } from '../../types';
import TransactionCard from './TransactionCard';
import Button from '../common/Button';

interface TransactionListProps {
  transactions: TransactionWithApprovals[]
  multisigInfo: MultisigInfo
  onRefresh: () => void
}

export default function TransactionList({
  transactions,
  multisigInfo,
  onRefresh,
}: TransactionListProps) {
  const pendingTxs = transactions.filter((tx) => !tx.executed);
  const executedTxs = transactions.filter((tx) => tx.executed);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          Operations ({transactions.length})
        </h3>
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No operations yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Submit a new operation to get started
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending Transactions */}
          {pendingTxs.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3">
                Pending ({pendingTxs.length})
              </h4>
              <div className="space-y-3">
                {pendingTxs.map((tx) => (
                  <TransactionCard
                    key={tx.id.toString()}
                    transaction={tx}
                    multisigInfo={multisigInfo}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Executed Transactions */}
          {executedTxs.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3">
                Executed ({executedTxs.length})
              </h4>
              <div className="space-y-3">
                {executedTxs.map((tx) => (
                  <TransactionCard
                    key={tx.id.toString()}
                    transaction={tx}
                    multisigInfo={multisigInfo}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
