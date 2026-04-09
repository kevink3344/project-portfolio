import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Integrations from './pages/Integrations';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PrivateRoute from './components/PrivateRoute';
import ThemeToggle from './components/ThemeToggle';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <a href="/" className="text-xl font-bold tracking-tight hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Application Portfolio
          </a>
          <div className="flex items-center gap-4">
            <a
              href="/integrations"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="View integrations"
              title="Integrations"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2m6 0a2 2 0 012 2v2h1a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3a1 1 0 011-1h1V7a2 2 0 012-2h6a2 2 0 012 2v2a1 1 0 001 1h1a1 1 0 011 1v1a1 1 0 001 1h1v-3a2 2 0 012-2z" />
              </svg>
            </a>
            <ThemeToggle />
          </div>
        </header>
        <main className="px-6 py-8 max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <PrivateRoute>
                  <AdminDashboard />
                </PrivateRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
