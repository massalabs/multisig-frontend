import { InputHTMLAttributes } from 'react';

interface AddressInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string
  error?: string
  onChange: (value: string) => void
}

export default function AddressInput({
  label,
  error,
  value,
  onChange,
  className = '',
  ...props
}: AddressInputProps) {
  const isValidFormat = !value || (typeof value === 'string' && (value.startsWith('AU') || value.startsWith('AS')));

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="AU..."
        className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${error || !isValidFormat
          ? 'border-red-500'
          : 'border-gray-600'
        }`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      {!isValidFormat && !error && (
        <p className="mt-1 text-sm text-yellow-400">
          Address should start with AU (user) or AS (smart contract)
        </p>
      )}
    </div>
  );
}
