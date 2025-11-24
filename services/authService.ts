import { supabase } from './supabaseClient';
import { User, UserRole, Department } from '../types';

const STORAGE_KEY = 'zankli_auth_user';

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      throw new Error('Invalid credentials');
    }

    // 2. Fetch User Profile details (Role, Department)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profileData) {
      // If profile is missing, logout to prevent partial state
      await supabase.auth.signOut();
      throw new Error('User profile not found. Please contact administrator.');
    }

    const user: User = {
      id: authData.user.id,
      email: authData.user.email!,
      name: profileData.full_name,
      role: profileData.role as UserRole,
      department: profileData.department as Department
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  verifyPassword: async (email: string, password: string): Promise<boolean> => {
      // Supabase doesn't have a simple "verify" without signing in.
      // We attempt a sign-in. If successful, creds are valid.
      const { error } = await supabase.auth.signInWithPassword({
          email,
          password
      });
      return !error;
  },

  logout: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(STORAGE_KEY);
  },

  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  }
};