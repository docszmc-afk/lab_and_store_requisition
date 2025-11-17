import React, { useState } from 'react';
import { DocumentTextIcon } from './Icons';

interface LoginScreenProps {
  onLogin: (email: string, pass: string) => Promise<boolean>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
        const success = await onLogin(email, password);
        if (!success) {
          setError('Invalid email or password. Please try again.');
        }
    } catch (err) {
        setError('An unexpected error occurred. Please try again.');
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <div className="mx-auto h-16 w-16 text-burnt-orange-700 bg-burnt-orange-100 rounded-full flex items-center justify-center">
             <DocumentTextIcon className="h-8 w-8"/>
          </div>
          <h1 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900">
            Zankli Medical Centre
          </h1>
          <h2 className="mt-2 text-center text-xl font-semibold tracking-tight text-burnt-orange-800">
            Procurement & Requisition System
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full appearance-none rounded-t-md border border-slate-300 px-3 py-3 text-slate-900 placeholder-slate-500 focus:z-10 focus:border-burnt-orange-500 focus:outline-none focus:ring-burnt-orange-500 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full appearance-none rounded-b-md border border-slate-300 px-3 py-3 text-slate-900 placeholder-slate-500 focus:z-10 focus:border-burnt-orange-500 focus:outline-none focus:ring-burnt-orange-500 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-burnt-orange-700 py-3 px-4 text-sm font-medium text-white hover:bg-burnt-orange-800 focus:outline-none focus:ring-2 focus:ring-burnt-orange-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
