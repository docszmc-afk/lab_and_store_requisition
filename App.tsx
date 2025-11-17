import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RequisitionProvider } from './contexts/RequisitionContext';
import { LoginScreen } from './components/LoginScreen';
import { DashboardScreen } from './components/DashboardScreen';

const AppContent: React.FC = () => {
  const { user, login } = useAuth();

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  // If user is authenticated, wrap DashboardScreen with RequisitionProvider
  // to ensure it has access to requisition data.
  return (
    <RequisitionProvider>
      <DashboardScreen />
    </RequisitionProvider>
  );
};

function App() {
  // AuthProvider wraps everything to provide authentication state globally.
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
