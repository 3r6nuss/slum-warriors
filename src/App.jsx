import { BrowserRouter as Router, Routes, Route, NavLink, useParams, Navigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, PackagePlus, PackageMinus, Settings,
  ScrollText, User, Users, Menu, Swords, Shield, Warehouse,
  ChevronRight, ShieldCheck, LogOut, BookOpen, ClipboardCheck, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthProvider, useAuth } from '@/lib/auth';
import WarehouseView from '@/pages/WarehouseView';
import CheckInForm from '@/pages/CheckInForm';
import CheckOutForm from '@/pages/CheckOutForm';
import AdjustStock from '@/pages/AdjustStock';
import Protocols from '@/pages/Protocols';
import PersonProtocol from '@/pages/PersonProtocol';
import AdminArea from '@/pages/AdminArea';
import StockLevels from '@/pages/StockLevels';
import { LoginPage, AuthCallback, PendingPage } from '@/pages/Login';

const warehouses = [
  { id: 2, label: 'Normales Lager', icon: Warehouse, type: 'normal' },
  { id: 1, label: 'Führungslager', icon: Shield, type: 'leadership' },
];



function WarehouseNavItem({ warehouse, onClose, openMenu, setOpenMenu }) {
  const menuId = `wh-${warehouse.id}`;
  const isOpen = openMenu === menuId;
  const Icon = warehouse.icon;

  const handleToggle = (e) => {
    e.preventDefault();
    setOpenMenu(isOpen ? null : menuId);
  };

  return (
    <div className="relative">
      <NavLink
        to={`/lager/${warehouse.id}`}
        onClick={onClose}
        className={({ isActive }) =>
          `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${isActive || isOpen
            ? 'bg-sidebar-accent/50 text-sidebar-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/30'
          }`
        }
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4" />
          <span>{warehouse.label}</span>
        </div>
        <div
          onClick={handleToggle}
          className="p-1 rounded-md hover:bg-sidebar-accent/50"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-90 text-sidebar-primary' : 'text-sidebar-foreground/40'
              }`}
          />
        </div>
      </NavLink>

      <div
        className={`overflow-hidden transition-all duration-250 ease-in-out ${isOpen ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="ml-4 pl-3 border-l border-sidebar-border/50 space-y-0.5 py-1">
          <NavLink
            to={`/einlagern/${warehouse.id}`}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-200 ${isActive
                ? 'bg-sidebar-accent text-sidebar-primary shadow-sm font-medium'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
              }`
            }
          >
            <PackagePlus className="h-3.5 w-3.5" />
            Einlagern
          </NavLink>
          <NavLink
            to={`/auslagern/${warehouse.id}`}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-200 ${isActive
                ? 'bg-sidebar-accent text-sidebar-primary shadow-sm font-medium'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
              }`
            }
          >
            <PackageMinus className="h-3.5 w-3.5" />
            Auslagern
          </NavLink>
        </div>
      </div>
    </div>
  );
}

function AdminNavItem({ onClose, openMenu, setOpenMenu }) {
  const isOpen = openMenu === 'admin';

  return (
    <div className="relative">
      <div
        onClick={() => setOpenMenu(isOpen ? null : 'admin')}
        className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${isOpen
          ? 'bg-sidebar-accent/50 text-sidebar-foreground'
          : 'text-sidebar-foreground/70'
          }`}
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-4 w-4" />
          <span>Admin</span>
        </div>
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-90 text-sidebar-primary' : 'text-sidebar-foreground/40'
            }`}
        />
      </div>

      <div
        className={`overflow-hidden transition-all duration-250 ease-in-out ${isOpen ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="ml-4 pl-3 border-l border-sidebar-border/50 space-y-0.5 py-1">
          <NavLink
            to="/admin"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-200 ${isActive
                ? 'bg-sidebar-accent text-sidebar-primary shadow-sm font-medium'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
              }`
            }
          >
            <Users className="h-3.5 w-3.5" />
            Rollenverwaltung
          </NavLink>
          <NavLink
            to="/admin/logs"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-200 ${isActive
                ? 'bg-sidebar-accent text-sidebar-primary shadow-sm font-medium'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
              }`
            }
          >
            <ScrollText className="h-3.5 w-3.5" />
            System-Logs
          </NavLink>
        </div>
      </div>
    </div>
  );
}

function BuchhaltungNavItem({ onClose, openMenu, setOpenMenu }) {
  const isOpen = openMenu === 'buchhaltung';

  return (
    <div className="relative">
      <div
        onClick={() => setOpenMenu(isOpen ? null : 'buchhaltung')}
        className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${isOpen
          ? 'bg-sidebar-accent/50 text-sidebar-foreground'
          : 'text-sidebar-foreground/70'
          }`}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="h-4 w-4" />
          <span>Buchhaltung</span>
        </div>
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-90 text-sidebar-primary' : 'text-sidebar-foreground/40'
            }`}
        />
      </div>

      <div
        className={`overflow-hidden transition-all duration-250 ease-in-out ${isOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="ml-4 pl-3 border-l border-sidebar-border/50 space-y-0.5 py-1">
          <NavLink
            to="/protokolle"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-200 ${isActive
                ? 'bg-sidebar-accent text-sidebar-primary shadow-sm font-medium'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
              }`
            }
          >
            <ScrollText className="h-3.5 w-3.5" />
            Protokolle
          </NavLink>
          <NavLink
            to="/person"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-200 ${isActive
                ? 'bg-sidebar-accent text-sidebar-primary shadow-sm font-medium'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
              }`
            }
          >
            <User className="h-3.5 w-3.5" />
            Personen-Protokoll
          </NavLink>
          <NavLink
            to="/lagerstaende"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-200 ${isActive
                ? 'bg-sidebar-accent text-sidebar-primary shadow-sm font-medium'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
              }`
            }
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Lagerstände
          </NavLink>
        </div>
      </div>
    </div>
  );
}
function UserProfile() {
  const { user, logout, isAdmin } = useAuth();
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
  const { isAdmin, isLeadership } = useAuth();
  const [openMenu, setOpenMenu] = useState(null);

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

          {/* Lager section */}
          <div className="mt-5 mb-2 px-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Lager
            </p>
          </div>
          <div className="space-y-1">
            {warehouses
              .filter(wh => wh.type !== 'leadership' || isLeadership)
              .map((wh) => (
                <WarehouseNavItem key={wh.id} warehouse={wh} onClose={onClose} openMenu={openMenu} setOpenMenu={setOpenMenu} />
              ))}
          </div>

          {/* Buchhaltung section */}
          {(isAdmin || isLeadership) && (
            <>
              <div className="mt-5 mb-2 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  Verwaltung
                </p>
              </div>
              <div className="space-y-1">
                <BuchhaltungNavItem onClose={onClose} openMenu={openMenu} setOpenMenu={setOpenMenu} />
                {isAdmin && <AdminNavItem onClose={onClose} openMenu={openMenu} setOpenMenu={setOpenMenu} />}
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

function WarehouseViewWrapper() {
  const { warehouseId } = useParams();
  const { isLeadership } = useAuth();
  if (warehouseId === '1' && !isLeadership) return <Navigate to="/lager/2" replace />;
  return <WarehouseView warehouseId={warehouseId} />;
}

function CheckInWrapper() {
  const { warehouseId } = useParams();
  const { isLeadership } = useAuth();
  if (warehouseId === '1' && !isLeadership) return <Navigate to="/lager/2" replace />;
  return <CheckInForm preselectedWarehouse={warehouseId} />;
}

function CheckOutWrapper() {
  const { warehouseId } = useParams();
  const { isLeadership } = useAuth();
  if (warehouseId === '1' && !isLeadership) return <Navigate to="/lager/2" replace />;
  return <CheckOutForm preselectedWarehouse={warehouseId} />;
}

function AdjustStockWrapper() {
  const { warehouseId } = useParams();
  const { isLeadership } = useAuth();
  if (warehouseId === '1' && !isLeadership) return <Navigate to="/lager/2" replace />;
  return <AdjustStock preselectedWarehouse={warehouseId} />;
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
            <Route path="/" element={<Navigate to="/lager/2" replace />} />
            <Route path="/lager/:warehouseId" element={<WarehouseViewWrapper />} />
            <Route path="/einlagern/:warehouseId" element={<CheckInWrapper />} />
            <Route path="/auslagern/:warehouseId" element={<CheckOutWrapper />} />
            <Route path="/anpassen/:warehouseId" element={<AdjustStockWrapper />} />
            <Route path="/bestaetigen/:warehouseId" element={<AdjustStockWrapper />} />
            <Route path="/protokolle" element={<Protocols />} />
            <Route path="/person" element={<PersonProtocol />} />
            <Route path="/lagerstaende" element={<StockLevels />} />
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
