import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';

import { LoginPage, AuthCallback } from '@/pages/Login';
import AppShell from '@/components/layout/AppShell';
import RequireAuth from '@/components/auth/RequireAuth';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/*" element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
