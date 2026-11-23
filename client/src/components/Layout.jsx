// client/src/components/Layout.jsx
// App layout wrapper with persistent navbar and footer

import { Outlet, Link } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <footer className="bg-slate-900 text-slate-400 py-8 px-4 text-center border-t border-slate-800 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 SkillSwap — Student Portfolio Project.</p>
          <div className="flex gap-6 text-xs">
            <Link to="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <Link to="/auth" className="hover:text-white transition-colors">
              Login
            </Link>
            <Link to="/dashboard" className="hover:text-white transition-colors">
              Find Matches
            </Link>
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

