import { Provider, Args, Mas, MAX_GAS_CALL, ArrayTypes, strToBytes, PublicAPI } from '@massalabs/massa-web3';
import type { Transaction } from '../types';

// Safe gas limit for callSC (network max ~3.98e9)
const SAFE_GAS_CALL = 3_000_000_000n;

// Storage keys (matching the contract)
const OWNERS_KEY = strToBytes('owners');
const DELAY_KEY = strToBytes('delay');
const UPGRADE_DELAY_KEY = strToBytes('upgradeable_period');
const REQUIRED_KEY = strToBytes('required');

/** Log operation ID for debugging */
function logOperationId(operation: Record<string, unknown>, label: string): void {
  const id = operation.operationId ?? operation.operation_id ?? operation.id ?? operation;
  console.log(`[${label}] operationId:`, id);
}

/** Wait for operation finalization and throw on execution error */
async function waitAndCheckOperation(operation: { waitFinalExecution?: () => Promise<unknown> }): Promise<void> {
  if (typeof operation.waitFinalExecution === 'function') {
    const status = await operation.waitFinalExecution();
    if (status && typeof status === 'object' && 'status' in status) {
      const s = (status as { status?: string }).status;
      if (s === 'FAILED' || s === 'ERROR' || (typeof s === 'string' && s.toLowerCase().includes('fail'))) {
        const msg = 'message' in status ? String((status as { message?: string }).message) : 'Operation failed';
        throw new Error(msg);
      }
    }
  }
}

// Helper to convert bytes to numbers
function bytesToI32(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getInt32(0, true);
}

function bytesToU64(bytes: Uint8Array): bigint {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(0, true);
}

// ============ WRITE FUNCTIONS ============

/**
 * Submit a new transaction
 */
export async function submitTransaction(
  provider: Provider,
  contractAddress: string,
  to: string,
  method: string,
  value: bigint,
  data: Uint8Array
): Promise<bigint> {

  console.log('method', method)
  const txArgs = new Args()
    .addString(to)
    .addString(method)
    .addU64(value)
    .addUint8Array(data);

  const operation = await provider.callSC({
    target: contractAddress,
    func: 'submit',
    parameter: txArgs.serialize(),
    coins: Mas.fromMas(0n),
    fee: Mas.fromMas(1n) / 100n,
    maxGas: SAFE_GAS_CALL,
  });

  logOperationId(operation as unknown as Record<string, unknown>, 'submit');
  await waitAndCheckOperation(operation);

  // The transaction ID should be emitted in an event
  // For now return 0n and rely on refreshing to see the new tx
  return 0n;
}

/**
 * Approve a transaction
 */
export async function approveTransaction(
  provider: Provider,
  contractAddress: string,
  txId: bigint
): Promise<void> {
  const args = new Args().addU64(txId);

  const operation = await provider.callSC({
    target: contractAddress,
    func: 'approve',
    parameter: args.serialize(),
    coins: Mas.fromMas(0n),
    fee: Mas.fromMas(1n) / 100n,
    maxGas: SAFE_GAS_CALL,
  });

  logOperationId(operation as unknown as Record<string, unknown>, 'approve');
  await waitAndCheckOperation(operation);
}

/**
 * Execute a transaction
 */
export async function executeTransaction(
  provider: Provider,
  contractAddress: string,
  txId: bigint
): Promise<void> {
  const args = new Args().addU64(txId);

  const operation = await provider.callSC({
    target: contractAddress,
    func: 'execute',
    parameter: args.serialize(),
    coins: Mas.fromMas(0n),
    fee: Mas.fromMas(1n) / 100n,
    maxGas: SAFE_GAS_CALL,
  });

  logOperationId(operation as unknown as Record<string, unknown>, 'execute');
  await waitAndCheckOperation(operation);
}

/**
 * Revoke approval for a transaction
 */
export async function revokeTransaction(
  provider: Provider,
  contractAddress: string,
  txId: bigint
): Promise<void> {
  const args = new Args().addU64(txId);

  const operation = await provider.callSC({
    target: contractAddress,
    func: 'revoke',
    parameter: args.serialize(),
    coins: Mas.fromMas(0n),
    fee: Mas.fromMas(1n) / 100n,
    maxGas: SAFE_GAS_CALL,
  });

  logOperationId(operation as unknown as Record<string, unknown>, 'revoke');
  await waitAndCheckOperation(operation);
}

/**
 * Deposit MAS to the multisig
 */
export async function receiveCoins(
  provider: Provider,
  contractAddress: string,
  amount: bigint
): Promise<void> {
  const operation = await provider.callSC({
    target: contractAddress,
    func: 'receiveCoins',
    parameter: new Uint8Array(0),
    coins: amount,
    fee: Mas.fromMas(1n) / 100n,
    maxGas: SAFE_GAS_CALL,
  });

  logOperationId(operation as unknown as Record<string, unknown>, 'receiveCoins');
  await waitAndCheckOperation(operation);
}

// ============ VIEW FUNCTIONS ============

/**
 * Get owners of the multisig
 */
export async function getOwners(
  provider: Provider,
  contractAddress: string
): Promise<string[]> {
  try {
    console.log(`Reading owners from contract: ${contractAddress}`);
    const data = await provider.readStorage(contractAddress, [OWNERS_KEY], true);
    console.log('Raw storage data:', data);

    if (data.length > 0 && data[0] && data[0].length > 0) {
      const args = new Args(data[0]);
      const owners = args.nextArray<string>(ArrayTypes.STRING);
      console.log('Parsed owners:', owners);
      return owners;
    }
    console.log('No owners data found in storage');
    return [];
  } catch (err) {
    console.error('Error reading owners:', err);
    return [];
  }
}

/**
 * Get required number of approvals
 */
export async function getRequired(
  provider: Provider,
  contractAddress: string
): Promise<number> {
  try {
    const data = await provider.readStorage(contractAddress, [REQUIRED_KEY], true);

    if (data.length > 0 && data[0] && data[0].length > 0) {
      return bytesToI32(data[0]);
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Get execution delay
 */
export async function getDelay(
  provider: Provider,
  contractAddress: string
): Promise<bigint> {
  try {
    const data = await provider.readStorage(contractAddress, [DELAY_KEY], true);

    if (data.length > 0 && data[0] && data[0].length > 0) {
      return bytesToU64(data[0]);
    }
    return 0n;
  } catch {
    return 0n;
  }
}

/**
 * Get upgrade delay (from Upgradeable library storage)
 */
export async function getUpgradeDelay(
  provider: Provider,
  contractAddress: string
): Promise<bigint> {
  try {
    const data = await provider.readStorage(contractAddress, [UPGRADE_DELAY_KEY], true);

    if (data.length > 0 && data[0] && data[0].length > 0) {
      return bytesToU64(data[0]);
    }
    return 0n;
  } catch {
    return 0n;
  }
}

/**
 * Get the MAS balance of an address (e.g. the multisig contract)
 */
export async function getContractBalance(
  provider: Provider,
  address: string
): Promise<bigint> {
  try {
    const client = await PublicAPI.fromProvider(provider);
    return await client.getBalance(address, true);
  } catch (err) {
    console.error('Error getting contract balance:', err);
    return 0n;
  }
}

/**
 * Get all transactions
 */
export async function getTransactions(
  provider: Provider,
  contractAddress: string,
  from?: bigint,
  to?: bigint
): Promise<Transaction[]> {
  // Build args - only add if defined
  const args = new Args();
  if (from !== undefined) args.addU64(from);
  if (to !== undefined) args.addU64(to);

  try {
    const result = await provider.readSC({
      target: contractAddress,
      func: 'getTransactions',
      parameter: args.serialize(),
      maxGas: MAX_GAS_CALL,
    });

    if (!result.value || result.value.length === 0) {
      return [];
    }

    // Parse the transaction array
    // Contract uses serializableObjectsArrayToBytes - NO u32 count prefix, just concatenated serialized Transaction objects
    // Each Transaction: to (string), method (string), value (u64), data (bytes), timestamp (u64), executed (bool)
    const argsResult = new Args(result.value);
    const transactions: Transaction[] = [];
    const startId = from !== undefined ? from : 0n;
    let index = 0;

    while (true) {
      try {
        const tx: Transaction = {
          id: startId + BigInt(index),
          to: argsResult.nextString(),
          method: argsResult.nextString(),
          value: argsResult.nextU64(),
          data: argsResult.nextUint8Array(),
          timestamp: argsResult.nextU64(),
          executed: argsResult.nextBool(),
        };
        transactions.push(tx);
        index++;
      } catch {
        // No more transactions or end of buffer
        break;
      }
    }

    return transactions;
  } catch (err) {
    console.error('Error getting transactions:', err);
    return [];
  }
}

/**
 * Get approvals for a transaction.
 * The contract returns nativeTypeArrayToBytes(approvals) which is a raw memory copy of string[]
 * (pointers, not serialized strings), so we cannot parse it. Instead we read storage directly:
 * APPROVED is a PersistentMap with key = "approved::" + txId + owner, value = bool.
 */
export async function getApprovals(
  provider: Provider,
  contractAddress: string,
  txId: bigint
): Promise<string[]> {
  try {
    const owners = await getOwners(provider, contractAddress);
    if (owners.length === 0) return [];

    const txIdStr = txId.toString();
    const keys = owners.map((owner) => strToBytes(`approved::${txIdStr}${owner}`));
    const values = await provider.readStorage(contractAddress, keys, true);

    const approvals: string[] = [];
    for (let i = 0; i < owners.length; i++) {
      const raw = values[i];
      if (raw && raw.length > 0 && raw[0] === 1) {
        approvals.push(owners[i]);
      }
    }
    return approvals;
  } catch (err) {
    console.error('Error getting approvals:', err);
    return [];
  }
}

// ============ HELPER FUNCTIONS FOR PRESETS ============

/**
 * Build args for addOwner call (to be submitted as tx)
 */
export function buildAddOwnerArgs(owner: string): Uint8Array {
  return new Args().addString(owner).serialize();
}

/**
 * Build args for removeOwner call
 */
export function buildRemoveOwnerArgs(owner: string): Uint8Array {
  return new Args().addString(owner).serialize();
}

/**
 * Build args for replaceOwner call
 */
export function buildReplaceOwnerArgs(oldOwner: string, newOwner: string): Uint8Array {
  return new Args().addString(oldOwner).addString(newOwner).serialize();
}

/**
 * Build args for changeRequirement call
 */
export function buildChangeRequirementArgs(required: number): Uint8Array {
  return new Args().addI32(BigInt(required)).serialize();
}

/**
 * Build args for changeExecutionDelay call
 */
export function buildChangeExecutionDelayArgs(delayMs: bigint): Uint8Array {
  return new Args().addU64(delayMs).serialize();
}
