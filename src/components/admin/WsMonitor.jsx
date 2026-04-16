import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import MembersView from '@/pages/MembersView';
import {
    ShieldCheck, Users, Crown, Shield, User, Eye, UserCheck, UserX,
    CheckCircle, AlertCircle, Swords, Clock, ScrollText, Send,
    Pencil, Check, X, Terminal, Activity, Pause, Play, RotateCcw, Wifi,
    Package, Plus, Trash2, ArrowUp, ArrowDown, Settings, Loader2,
    GripVertical, Layers, Warehouse, Zap, Boxes, Minus
} from 'lucide-react';

const HARDCODED_IDS = [
    '823276402320998450',
];

const ROLE_CONFIG = {
    admin: { label: 'Admin', icon: Crown, color: 'default', description: 'Voller Zugriff' },
    führung: { label: 'Führung', icon: Swords, color: 'warning', description: 'Führungslager Zugriff' },
    moderator: { label: 'Moderator', icon: Shield, color: 'secondary', description: 'Erweiterte Rechte' },
    member: { label: 'Mitglied', icon: User, color: 'secondary', description: 'Standard-Zugriff' },
    viewer: { label: 'Zuschauer', icon: Eye, color: 'outline', description: 'Nur lesen' },
    pending: { label: 'Ausstehend', icon: Clock, color: 'destructive', description: 'Wartet auf Freischaltung' },
};

const CATEGORY_COLORS = {
    SERVER: { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa', border: 'rgba(139, 92, 246, 0.3)' },
    WS: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' },
    AUTH: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' },
    API: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
    DB: { bg: 'rgba(244, 114, 182, 0.15)', text: '#f472b6', border: 'rgba(244, 114, 182, 0.3)' },
};

const LEVEL_COLORS = {
    INFO: '#94a3b8',
    WARN: '#fbbf24',
    ERROR: '#ef4444',
};

export default function WsMonitor() {
    const [stats, setStats] = useState({ current: 0, history: [] });
    const [hours, setHours] = useState(24);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/ws-stats?hours=${hours}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch {
            console.error('Failed to fetch ws stats');
        }
    }, [hours]);

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            setLoading(true);
            await fetchStats();
            if (isMounted) setLoading(false);
        };

        load();

        const interval = setInterval(fetchStats, 30000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [fetchStats]);

    const history = stats.history || [];

    // SVG Chart dimensions
    const W = 800, H = 300, PAD_L = 50, PAD_R = 20, PAD_T = 20, PAD_B = 50;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const maxClients = Math.max(1, ...history.map(h => h.connected_clients));
    const yTicks = Math.min(maxClients, 5);

    const points = history.map((h, i) => {
        const x = PAD_L + (history.length > 1 ? (i / (history.length - 1)) * chartW : chartW / 2);
        const y = PAD_T + chartH - (h.connected_clients / maxClients) * chartH;
        return { x, y, ...h };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = points.length > 0
        ? `${linePath} L ${points[points.length - 1].x} ${PAD_T + chartH} L ${points[0].x} ${PAD_T + chartH} Z`
        : '';

    // X-axis labels (show ~6 labels)
    const xLabels = [];
    if (history.length > 0) {
        const step = Math.max(1, Math.floor(history.length / 6));
        for (let i = 0; i < history.length; i += step) {
            xLabels.push({ index: i, label: new Date(history[i].recorded_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) });
        }
    }

    return (
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        WebSocket Monitor
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                            {[1, 6, 12, 24].map(h => (
                                <button
                                    key={h}
                                    onClick={() => { setHours(h); }}
                                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${hours === h
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    {h}h
                                </button>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchStats().then(() => setLoading(false)); }} disabled={loading} className="gap-1.5">
                            <RotateCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                            Aktualisieren
                        </Button>
                    </div>
                </CardTitle>
                <CardDescription>WebSocket-Verbindungen alle 5 Minuten · {history.length} Datenpunkte</CardDescription>
            </CardHeader>
            <CardContent>
                {/* Current status */}
                <div className="flex items-center gap-6 mb-6">
                    <div className="flex items-center gap-3 p-4 rounded-xl border bg-card">
                        <div className={`p-2.5 rounded-lg ${stats.current > 0 ? 'bg-green-500/10' : 'bg-muted'}`}>
                            <Wifi className={`h-6 w-6 ${stats.current > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                            <p className="text-3xl font-bold tracking-tight">{stats.current}</p>
                            <p className="text-xs text-muted-foreground">Aktuell verbunden</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl border bg-card">
                        <div className="p-2.5 rounded-lg bg-primary/10">
                            <Activity className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold tracking-tight">{maxClients}</p>
                            <p className="text-xs text-muted-foreground">Max ({hours}h)</p>
                        </div>
                    </div>
                </div>

                {/* SVG Chart */}
                <div className="rounded-xl border bg-card p-4 overflow-x-auto">
                    {history.length < 2 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p>Noch nicht genügend Datenpunkte. Das Diagramm füllt sich alle 5 Minuten.</p>
                        </div>
                    ) : (
                        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '320px' }}>
                            <defs>
                                <linearGradient id="wsGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
                                </linearGradient>
                            </defs>

                            {/* Grid lines */}
                            {Array.from({ length: yTicks + 1 }).map((_, i) => {
                                const y = PAD_T + (i / yTicks) * chartH;
                                const val = Math.round(maxClients - (i / yTicks) * maxClients);
                                return (
                                    <g key={i}>
                                        <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
                                        <text x={PAD_L - 10} y={y + 4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize="11" fontFamily="monospace">{val}</text>
                                    </g>
                                );
                            })}

                            {/* X-axis labels */}
                            {xLabels.map(({ index, label }) => {
                                const p = points[index];
                                if (!p) return null;
                                return (
                                    <text key={index} x={p.x} y={H - 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10" fontFamily="monospace">{label}</text>
                                );
                            })}

                            {/* Area fill */}
                            {areaPath && <path d={areaPath} fill="url(#wsGradient)" />}

                            {/* Line */}
                            {linePath && <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                            {/* Dots */}
                            {points.map((p, i) => (
                                <g key={i}>
                                    <circle cx={p.x} cy={p.y} r="4" fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="2" />
                                    <title>{new Date(p.recorded_at).toLocaleString('de-DE')} – {p.connected_clients} Client(s)</title>
                                </g>
                            ))}
                        </svg>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}