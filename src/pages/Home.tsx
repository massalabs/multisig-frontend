import { Link } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import Button from '../components/common/Button';

export default function Home() {
  const { provider, openWalletModal, isConnecting } = useWallet();

  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold text-white mb-4">
        Massa Multisig Wallet
      </h1>
      <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
        A secure multi-signature wallet for the Massa blockchain. Require
        multiple approvals before executing transactions.
      </p>

      <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-3xl mb-3">1</div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Multiple Owners
          </h3>
          <p className="text-gray-400 text-sm">
            Add multiple owners who can submit and approve transactions
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-3xl mb-3">2</div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Threshold Approval
          </h3>
          <p className="text-gray-400 text-sm">
            Set required approvals threshold for transaction execution
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-3xl mb-3">3</div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Time Delays
          </h3>
          <p className="text-gray-400 text-sm">
            Configurable delays for added security on sensitive operations
          </p>
        </div>
      </div>

      {!provider ? (
        <div className="mb-8">
          <p className="text-gray-400 mb-4">Connect your wallet to get started</p>
          <Button onClick={openWalletModal} loading={isConnecting} size="lg">
            Connect Wallet
          </Button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/deploy">
            <Button size="lg">Deploy New Multisig</Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="secondary" size="lg">
              Manage Existing Multisig
            </Button>
          </Link>
        </div>
      )}

      <div className="mt-12 bg-gray-800 rounded-lg p-6 border border-gray-700 max-w-2xl mx-auto text-left">
        <h3 className="text-lg font-semibold text-white mb-4">Key Features</h3>
        <ul className="space-y-2 text-gray-300">
          <li className="flex items-start">
            <span className="text-green-400 mr-2">-</span>
            Hold MAS and interact with any smart contract
          </li>
          <li className="flex items-start">
            <span className="text-green-400 mr-2">-</span>
            Submit, approve, and execute transactions
          </li>
          <li className="flex items-start">
            <span className="text-green-400 mr-2">-</span>
            Add or remove owners via multisig approval
          </li>
          <li className="flex items-start">
            <span className="text-green-400 mr-2">-</span>
            Upgrade contract with time-locked delay
          </li>
          <li className="flex items-start">
            <span className="text-green-400 mr-2">-</span>
            Configurable execution delay for security
          </li>
        </ul>
      </div>
    </div>
  );
}
