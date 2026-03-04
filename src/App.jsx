import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useState } from 'react';
import {
  User, Menu, Swords, Shield, Warehouse,
  ShieldCheck, LogOut, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthProvider, useAuth } from '@/lib/auth';
import WarehouseView from '@/pages/WarehouseView';
import AdminArea from '@/pages/AdminArea';
import { LoginPage, AuthCallback, PendingPage } from '@/pages/Login';

function UserProfile() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const avatar = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png?size=40`
    : null;

  return (
    <div className="p-4 border-t border-sidebar-border space-y-3">
      <div className="flex items-center gap-3">
        {avatar ? (
          <img src={avatar} alt="" className="h-8 w-8 rounded-full ring-2 ring-sidebar-primary/30" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <User className="h-4 w-4 text-sidebar-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sidebar-foreground truncate">{user.display_name || user.username}</p>
          {user.display_name && (
            <p className="text-[11px] text-sidebar-foreground/40 truncate">@{user.username}</p>
          )}
          <p className="text-xs text-sidebar-foreground/50 capitalize">{user.role}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground"
        onClick={logout}
      >
        <LogOut className="h-3.5 w-3.5 mr-2" />
        Abmelden
      </Button>
    </div>
  );
}

function Sidebar({ open, onClose }) {
  const { isAdmin } = useAuth();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-sidebar-background border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Brand */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sidebar-primary/10">
              <Swords className="h-6 w-6 text-sidebar-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-sidebar-foreground" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Slum Warriors
              </h2>
              <p className="text-xs text-sidebar-foreground/60">Lagerverwaltung</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="mt-2 mb-2 px-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Übersicht
            </p>
          </div>
          <div className="space-y-1">
            <NavLink
              to="/lager"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                  ? 'bg-sidebar-accent/50 text-sidebar-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/30'
                }`
              }
            >
              <Warehouse className="h-4 w-4" />
              Lager
            </NavLink>
          </div>

          {isAdmin && (
            <>
              <div className="mt-5 mb-2 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  Verwaltung
                </p>
              </div>
              <div className="space-y-1">
                <NavLink
                  to="/admin"
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                      ? 'bg-sidebar-accent/50 text-sidebar-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/30'
                    }`
                  }
                >
                  <ShieldCheck className="h-4 w-4" />
                  Admin
                </NavLink>
              </div>
            </>
          )}
        </nav>

        {/* User profile */}
        <UserProfile />
      </aside>
    </>
  );
}

function RequireAuth({ children }) {
  const { isLoggedIn, loading, isPending } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (isPending) return <PendingPage />;
  return children;
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-lg">
          <div className="flex items-center h-16 px-6 gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 lg:hidden">
              <Swords className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Slum Warriors</span>
            </div>
          </div>
        </header>

        <main className="p-6 lg:p-8 max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/lager" replace />} />
            <Route path="/lager" element={<WarehouseView />} />
            <Route path="/admin" element={<AdminArea />} />
            <Route path="/admin/logs" element={<AdminArea initialTab="logs" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

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
