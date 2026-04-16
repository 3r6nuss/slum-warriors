import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { ShieldCheck, Users, Package, FileText, Terminal, Activity, Settings, Boxes } from 'lucide-react';
import RoleManagement from '@/components/admin/RoleManagement';
import LogPage from '@/components/admin/LogPage';
import ServerConsole from '@/components/admin/ServerConsole';
import WsMonitor from '@/components/admin/WsMonitor';
import ProductManagement from '@/components/admin/ProductManagement';
import KitManagement from '@/components/admin/KitManagement';
import SettingsManagement from '@/components/admin/SettingsManagement';

export default function AdminArea() {
    const { isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState('roles');

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <ShieldCheck className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold mb-2">Zugriff verweigert</h2>
                <p className="text-muted-foreground">Nur Admins können auf diesen Bereich zugreifen.</p>
            </div>
        );
    }

    const tabs = [
        { id: 'roles', label: 'Rollen & Mitglieder', icon: Users },
        { id: 'products', label: 'Produkte', icon: Package },
        { id: 'kits', label: 'Kits', icon: Boxes },
        { id: 'logs', label: 'System-Logs', icon: FileText },
        { id: 'console', label: 'Konsole', icon: Terminal },
        { id: 'wsmonitor', label: 'WS Monitor', icon: Activity },
        { id: 'settings', label: 'System-Einst.', icon: Settings }
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'roles': return <RoleManagement />;
            case 'products': return <ProductManagement />;
            case 'kits': return <KitManagement />;
            case 'logs': return <LogPage />;
            case 'console': return <ServerConsole />;
            case 'wsmonitor': return <WsMonitor />;
            case 'settings': return <SettingsManagement />;
            default: return <RoleManagement />;
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <ShieldCheck className="h-8 w-8 text-primary" />
                    Admin-Bereich
                </h1>
                <p className="text-muted-foreground mt-1">Verwaltung von System, Benutzern und Logistik.</p>
            </div>

            {/* In-Page Navigation / Tab bar (decluttering the sidebar) */}
            <div className="flex flex-wrap gap-2 mb-8 bg-muted/20 p-2 rounded-xl border border-border/50">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                isActive 
                                ? 'bg-primary text-primary-foreground shadow-sm scale-[1.02]' 
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {renderContent()}
            </div>
        </div>
    );
}
