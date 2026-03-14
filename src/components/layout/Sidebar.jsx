import { NavLink } from 'react-router-dom';
import {
    Swords, Shield, Warehouse,
    Users, Package, FileText, Terminal, Activity, Settings,
    History, BarChart3
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import UserProfile from './UserProfile';

export default function Sidebar({ open, onClose }) {
    const { isAdmin, isLeadership } = useAuth();

    const navLinkStyle = ({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
            ? 'bg-sidebar-accent/50 text-sidebar-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/30'
        }`;

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
                <nav className="flex-1 p-4 overflow-y-auto space-y-6">

                    {/* Kategorie: Lager */}
                    <div>
                        <div className="mb-2 px-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                                Kategorie: Lager
                            </p>
                        </div>
                        <div className="space-y-1">
                            <NavLink to="/lager/2" onClick={onClose} className={navLinkStyle}>
                                <Warehouse className="h-4 w-4" /> Normales Lager
                            </NavLink>
                            <NavLink to="/lager/3" onClick={onClose} className={navLinkStyle}>
                                <Warehouse className="h-4 w-4" /> Waffenlager
                            </NavLink>
                            <NavLink to="/stats" onClick={onClose} className={navLinkStyle}>
                                <BarChart3 className="h-4 w-4" /> Statistiken
                            </NavLink>
                        </div>
                    </div>

                    {/* Kategorie: Führung */}
                    {(isAdmin || isLeadership) && (
                        <div>
                            <div className="mb-2 px-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                                    Kategorie: Führung
                                </p>
                            </div>
                            <div className="space-y-1">
                                <NavLink to="/lager/1" onClick={onClose} className={navLinkStyle}>
                                    <Shield className="h-4 w-4" /> Führungslager
                                </NavLink>
                                <NavLink to="/lager/4" onClick={onClose} className={navLinkStyle}>
                                    <Shield className="h-4 w-4" /> Führungs-Waffen
                                </NavLink>
                                <NavLink to="/logs" onClick={onClose} className={navLinkStyle}>
                                    <History className="h-4 w-4" /> Lager-Historie
                                </NavLink>
                            </div>
                        </div>
                    )}

                    {/* Kategorie: Admin */}
                    {isAdmin && (
                        <div>
                            <div className="mb-2 px-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                                    Kategorie: Admin
                                </p>
                            </div>
                            <div className="space-y-1">
                                <NavLink to="/admin/roles" onClick={onClose} className={navLinkStyle}>
                                    <Users className="h-4 w-4" /> Rollenverwaltung
                                </NavLink>
                                <NavLink to="/admin/products" onClick={onClose} className={navLinkStyle}>
                                    <Package className="h-4 w-4" /> Produkte
                                </NavLink>
                                <NavLink to="/admin/logs" onClick={onClose} className={navLinkStyle}>
                                    <FileText className="h-4 w-4" /> System-Logs
                                </NavLink>
                                <NavLink to="/admin/console" onClick={onClose} className={navLinkStyle}>
                                    <Terminal className="h-4 w-4" /> Konsole
                                </NavLink>
                                <NavLink to="/admin/wsmonitor" onClick={onClose} className={navLinkStyle}>
                                    <Activity className="h-4 w-4" /> WS Monitor
                                </NavLink>
                                <NavLink to="/admin/settings" onClick={onClose} className={navLinkStyle}>
                                    <Settings className="h-4 w-4" /> System-Einst.
                                </NavLink>
                            </div>
                        </div>
                    )}
                </nav>

                {/* User profile */}
                <UserProfile />
            </aside>
        </>
    );
}
