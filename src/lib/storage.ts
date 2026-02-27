const STORAGE_KEY = 'massa-multisig-addresses';

/**
 * Get all saved multisig contract addresses from localStorage
 */
export function getSavedAddresses(): string[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save a multisig contract address to localStorage
 */
export function saveAddress(address: string): void {
  const addresses = getSavedAddresses();
  if (!addresses.includes(address)) {
    addresses.push(address);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
  }
}

/**
 * Remove a multisig contract address from localStorage
 */
export function removeAddress(address: string): void {
  const addresses = getSavedAddresses().filter((a) => a !== address);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
}
