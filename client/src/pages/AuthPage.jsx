// client/src/pages/AuthPage.jsx
// User Login and Registration Page

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sparkles, Mail, Lock, User, AlertCircle, CheckCircle, KeyRound } from 'lucide-react';

export default function AuthPage() {
  const { status, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(() =>
    searchParams.get('tab') === 'signup' ? 'signup' : 'login'
  );

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [providers, setProviders] = useState({ google: false });

  // Fetch available OAuth providers
  useEffect(() => {
    apiFetch('/api/auth/providers')
      .then((data) => {
        if (data && typeof data.google === 'boolean') {
          setProviders(data);
        }
      })
      .catch(() => {});
  }, []);

  // Handle URL error query parameter
  useEffect(() => {
    const errCode = searchParams.get('error');
    if (!errCode) return;

    switch (errCode) {
      case 'google_cancelled':
        setError('Google sign-in was cancelled.');
        break;
      case 'account_exists':
        setError('An account with this e-mail already exists. Sign in with your e-mail and password.');
        break;
      case 'google_unavailable':
        setError('Google sign-in is currently unavailable.');
        break;
      case 'google_failed':
        setError('Google sign-in failed. Please try again.');
        break;
      default:
        setError('An error occurred during authentication.');
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    }
  }, [status, navigate, location.state]);

  // Sync tab with URL search parameter
  useEffect(() => {
    if (searchParams.get('tab') === 'signup') {
      void Promise.resolve().then(() => setActiveTab('signup'));
    } else if (searchParams.get('tab') === 'login') {
      void Promise.resolve().then(() => setActiveTab('login'));
    }
  }, [searchParams]);

  const handleTabChange = (val) => {
    setActiveTab(val);
    setError(null);
    setSuccess(null);
    setSearchParams(val === 'signup' ? { tab: 'signup' } : {});
  };

  // Demo credentials quick-fill
  const fillDemoCredentials = () => {
    setEmail('alex@example.com');
    setPassword('password123');
    setError(null);
    if (activeTab !== 'login') {
      handleTabChange('login');
    }
  };

  // Handle Login submission
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await login(email, password);
      setSuccess('Login successful! Redirecting...');
      const destination = location.state?.from?.pathname || '/dashboard';
      setTimeout(() => {
        navigate(destination, { replace: true });
      }, 500);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup submission
  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await register(name, email, password);
      setSuccess('Account created! Redirecting to your dashboard...');
      const destination = location.state?.from?.pathname || '/dashboard';
      setTimeout(() => {
        navigate(destination, { replace: true });
      }, 700);
    } catch (err) {
      setError(err.message || 'Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-600 text-white mb-3 shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome to SkillSwap</h1>
          <p className="text-sm text-slate-500 mt-1">Join local peers to learn and teach skills together.</p>
        </div>

        <Card className="border-slate-200 shadow-md">
          <CardHeader className="pb-4">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Log In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login" className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Log In to Your Account</CardTitle>
                    <CardDescription className="text-xs">
                      Enter your email and password to access your matches and events.
                    </CardDescription>
                  </div>
                </div>

                {error && (
                  <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="mt-3 p-3 rounded-md bg-green-50 border border-green-200 flex items-center gap-2 text-xs text-green-700">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>{success}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Email Address</label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        className="pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">Password</label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700"
                  >
                    {loading ? 'Logging in...' : 'Log In'}
                  </Button>

                  {/* Demo Credentials Quick-Fill Button (Development Only) */}
                  {!import.meta.env?.PROD && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={fillDemoCredentials}
                      className="w-full text-xs gap-1.5 border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-indigo-600" />
                      Fill Demo Credentials (alex@example.com)
                    </Button>
                  )}
                </form>
              </TabsContent>

              {/* Signup Tab */}
              <TabsContent value="signup" className="pt-4">
                <CardTitle className="text-lg">Create a Free Account</CardTitle>
                <CardDescription className="text-xs">
                  Start trading skills with local peers in less than 2 minutes.
                </CardDescription>

                {error && (
                  <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="mt-3 p-3 rounded-md bg-green-50 border border-green-200 flex items-center gap-2 text-xs text-green-700">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>{success}</span>
                  </div>
                )}

                <form onSubmit={handleSignup} className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Full Name</label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="Alex Johnson"
                        className="pl-9"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">Email Address</label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        className="pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">Password (min 6 chars)</label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700"
                  >
                    {loading ? 'Creating account...' : 'Sign Up'}
                  </Button>

                  <p className="text-xs text-slate-500 text-center mt-3">
                    By signing up you agree to the{' '}
                    <Link to="/terms" className="text-indigo-600 hover:underline">
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="text-indigo-600 hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardHeader>

          {providers.google && (
            <CardContent className="pt-0">
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400 font-medium">Or continue with</span>
                </div>
              </div>

              <Button
                variant="outline"
                type="button"
                onClick={() => window.location.assign('/api/auth/google')}
                className="w-full gap-2 border-slate-200 text-slate-700 bg-white hover:bg-slate-50 shadow-xs"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </Button>
            </CardContent>
          )}

          <CardFooter className="justify-center border-t border-slate-100 py-3 text-xs text-slate-500">
            By logging in, you agree to SkillSwap Community Guidelines.
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
