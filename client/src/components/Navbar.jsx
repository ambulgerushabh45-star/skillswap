// client/src/components/Navbar.jsx
// Navigation header with authentication state and responsive layout

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Calendar, Sparkles, LogOut, MessageCircle } from 'lucide-react';

export default function Navbar() {
  const { user, status, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Title */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
          <Sparkles className="h-6 w-6 text-indigo-600" />
          <span>SkillSwap</span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link
            to="/dashboard"
            className={`transition-colors flex items-center gap-1.5 ${
              location.pathname === '/dashboard'
                ? 'text-indigo-600 font-semibold'
                : 'text-slate-600 hover:text-indigo-600'
            }`}
          >
            <Users className="h-4 w-4" />
            Find Matches
          </Link>
          <Link
            to="/events"
            className={`transition-colors flex items-center gap-1.5 ${
              location.pathname === '/events'
                ? 'text-indigo-600 font-semibold'
                : 'text-slate-600 hover:text-indigo-600'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Local Events
          </Link>
          {status === 'authenticated' && (
            <Link
              to="/chat"
              className={`transition-colors flex items-center gap-1.5 ${
                location.pathname === '/chat'
                  ? 'text-indigo-600 font-semibold'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              <span>Messages</span>
            </Link>
          )}
        </nav>

        {/* User Auth Section */}
        <div className="flex items-center gap-3">
          {status === 'authenticated' && user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile Messages Icon */}
              <Link
                to="/chat"
                className={`md:hidden flex items-center p-1.5 rounded-lg transition-colors ${
                  location.pathname === '/chat'
                    ? 'text-indigo-600 bg-indigo-50 font-semibold'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
                }`}
                title="Messages"
              >
                <MessageCircle className="h-5 w-5" />
              </Link>

              <Link
                to="/profile/setup"
                className="flex items-center gap-2 text-sm font-medium hover:text-indigo-600"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.image || ''} alt={user.name || 'User'} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">{user.name || 'Profile'}</span>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="gap-1.5 text-slate-600"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/auth">
                <Button variant="outline" size="sm">
                  Log In
                </Button>
              </Link>
              <Link to="/auth?tab=signup">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

