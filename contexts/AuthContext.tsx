import React, { useState, useContext, createContext, useEffect } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setUser(null);
        setLoading(false);
      }
    });
    
    setLoading(false);

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string): Promise<boolean> => {
    setLoading(true);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password: pass });
    
    if (signInError || !signInData.user) {
        console.error("Sign in error:", signInError);
        setUser(null);
        setLoading(false);
        return false;
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', signInData.user.id)
        .single();

    if (profileError || !profile) {
        console.error("Profile fetch error:", profileError);
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        return false;
    }
    
    setUser(profile as User);
    setLoading(false);
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    // The onAuthStateChange listener will handle setting the user to null.
    // This allows React to gracefully unmount components instead of a disruptive page reload,
    // which was causing the application to crash.
  };
  
  return <AuthContext.Provider value={{ user, login, logout }}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};