import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Menu, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Sidebar from './Sidebar';

import WarehouseView from '@/pages/WarehouseView';
import AdminArea from '@/pages/AdminArea';
import StatsView from '@/pages/StatsView';
import LogView from '@/pages/LogView';

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
                            <Swords className="h-5 w-5 text-primary" />
                            <span className="font-semibold text-sm">Slum Warriors</span>
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
                        <Route path="/admin" element={<Navigate to="/admin/roles" replace />} />
                        <Route path="/admin/:tab" element={<AdminArea />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
}
