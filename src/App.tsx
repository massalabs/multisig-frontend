import { Routes, Route } from 'react-router-dom';
import { WalletProvider } from './contexts/WalletContext';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Deploy from './pages/Deploy';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <WalletProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/deploy" element={<Deploy />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:address" element={<Dashboard />} />
        </Routes>
      </Layout>
    </WalletProvider>
  );
}

export default App;
