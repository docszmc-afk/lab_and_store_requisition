import React, { useState } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await authService.login(email, password);
      onLogin(user);
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-zankli-cream">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-zankli-black relative overflow-hidden justify-center items-center">
        {/* Abstract Decoration */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-zankli-orange/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-zankli-dark rounded-full blur-[120px]" />
        
        <div className="relative z-10 text-center p-12">
          <div className="w-24 h-24 bg-zankli-orange rounded-2xl mx-auto flex items-center justify-center mb-8 shadow-2xl shadow-orange-900/50 transform rotate-3">
             <span className="text-6xl font-bold text-white">Z</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Zankli Medical Centre</h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto leading-relaxed">
            Advanced Procurement & Requisition Management System.
          </p>
          
          <div className="mt-12 flex justify-center gap-4">
              <div className="px-4 py-2 rounded-full border border-gray-700 text-gray-500 text-xs uppercase tracking-widest">Secure</div>
              <div className="px-4 py-2 rounded-full border border-gray-700 text-gray-500 text-xs uppercase tracking-widest">Efficient</div>
              <div className="px-4 py-2 rounded-full border border-gray-700 text-gray-500 text-xs uppercase tracking-widest">Automated</div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="w-full max-w-sm mx-auto">
            <div className="mb-10 lg:hidden text-center">
                <div className="w-12 h-12 bg-zankli-orange rounded-lg mx-auto flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-white">Z</span>
                </div>
                <h2 className="text-2xl font-bold text-zankli-black">Zankli Medical</h2>
            </div>

            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
                <p className="mt-2 text-sm text-gray-500">Please enter your details to sign in.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email address</label>
                    <div className="relative">
                        <input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-zankli-orange focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-400 shadow-sm"
                            placeholder="Enter your email"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <div className="relative">
                        <input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-zankli-orange focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-400 shadow-sm"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {error && (
                    <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100 flex items-center animate-fadeIn">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-zankli-orange hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zankli-orange transition-all transform active:scale-[0.99] ${isLoading ? 'opacity-70 cursor-not-allowed' : 'shadow-lg shadow-orange-500/30'}`}
                >
                    {isLoading ? (
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : null}
                    {isLoading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>
            
            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400">
                    Restricted Access Area • Zankli Medical Centre
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};