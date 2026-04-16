import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Menu, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Sidebar from './Sidebar';

import WarehouseView from '@/pages/WarehouseView';
import StatsView from '@/pages/StatsView';
import LogView from '@/pages/LogView';
import QuotasView from '@/pages/QuotasView';

import RoleManagement from '@/components/admin/RoleManagement';
import ProductManagement from '@/components/admin/ProductManagement';
import LogPage from '@/components/admin/LogPage';
import SettingsManagement from '@/components/admin/SettingsManagement';

export default function AppShell() {
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
                            <Crown className="h-5 w-5 text-primary" />
                            <span className="font-semibold text-sm">Nochnaya Krone</span>
                        </div>
                    </div>
                </header>

                <main className="p-6 lg:p-8 max-w-7xl mx-auto">
                    <Routes>
                        <Route path="/" element={<Navigate to="/lager/2" replace />} />
                        <Route path="/lager" element={<Navigate to="/lager/2" replace />} />
                        <Route path="/lager/:id" element={<WarehouseView />} />

                        <Route path="/stats" element={<StatsView />} />
                        <Route path="/logs" element={<LogView />} />
                        <Route path="/abgaben" element={<QuotasView />} />
                        
                        {/* Admin Routes */}
                        <Route path="/admin" element={<Navigate to="/admin/roles" replace />} />
                        <Route path="/admin/roles" element={<div className="space-y-6"><h1 className="text-3xl font-bold tracking-tight mb-4 text-primary">Admin-Zentrale</h1><RoleManagement /></div>} />
                        <Route path="/admin/products" element={<div className="space-y-6"><h1 className="text-3xl font-bold tracking-tight mb-4 text-primary">Admin-Zentrale</h1><ProductManagement /></div>} />
                        <Route path="/admin/logs" element={<div className="space-y-6"><h1 className="text-3xl font-bold tracking-tight mb-4 text-primary">Admin-Zentrale</h1><LogPage /></div>} />
                        <Route path="/admin/settings" element={<div className="space-y-6"><h1 className="text-3xl font-bold tracking-tight mb-4 text-primary">Admin-Zentrale</h1><SettingsManagement /></div>} />
                    </Routes>
                </main>
            </div>
        </div>
    );
}
