export interface Transaction {
  id: bigint
  to: string
  method: string
  value: bigint
  data: Uint8Array
  timestamp: bigint
  executed: boolean
}

export interface MultisigInfo {
  address: string
  owners: string[]
  required: number
  delay: bigint
  upgradeDelay: bigint
}

export interface TransactionWithApprovals extends Transaction {
  approvals: string[]
  approvalCount: number
}

export type NetworkId = 'mainnet' | 'buildnet'

export interface DeployParams {
  owners: string[]
  required: number
  upgradeDelay: bigint
  executionDelay: bigint
}
