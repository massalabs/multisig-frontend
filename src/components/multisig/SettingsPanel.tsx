import { MultisigInfo } from '../../types';

interface SettingsPanelProps {
  contractAddress: string
  multisigInfo: MultisigInfo
  onSuccess: () => void
}

export default function SettingsPanel({
  multisigInfo,
}: SettingsPanelProps) {
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

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Multisig Settings</h3>

      <div className='space-y-3'>

        {/* Current Settings */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Current Configuration</h4>
          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-400 shrink-0">Contract Address</dt>
              <dd className="text-white font-mono text-sm break-all text-right">
                {multisigInfo.address}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Number of Owners</dt>
              <dd className="text-white">{multisigInfo.owners.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Required Approvals</dt>
              <dd className="text-white">{multisigInfo.required}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Execution Delay</dt>
              <dd className="text-white">{formatDelay(multisigInfo.delay)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Upgrade Delay</dt>
              <dd className="text-white">{formatDelay(multisigInfo.upgradeDelay)}</dd>
            </div>
          </dl>
        </div>

        {/* Owners List */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Owners</h4>
          <div className="space-y-2">
            {multisigInfo.owners.map((owner, index) => (
              <div
                key={owner}
                className="flex items-center justify-between py-2 px-3 bg-gray-600/50 rounded"
              >
                <span className="text-gray-400 text-sm">#{index + 1}</span>
                <span className="text-white font-mono text-sm">
                  {owner}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* How to Change Settings */}
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-300 mb-2">
            How to Change Settings
          </h4>
          <p className="text-sm text-blue-200/80">
            To modify the multisig settings (owners, required approvals, or delays),
            go to the <strong>Submit</strong> tab and select the appropriate preset.
            All changes must be approved by the required number of owners before
            they take effect.
          </p>
        </div>
      </div>
    </div>
  );
}
