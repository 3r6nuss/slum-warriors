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

export default function ServerConsole() {
    const [logs, setLogs] = useState([]);
    const [paused, setPaused] = useState(false);
    const [filter, setFilter] = useState('ALL');
    const scrollRef = useRef(null);
    const intervalRef = useRef(null);

    const fetchLogs = useCallback(async () => {
        try {
            const url = filter === 'ALL'
                ? '/api/admin/logs?limit=200'
                : `/api/admin/logs?limit=200&category=${filter}`;
            const res = await fetch(url, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch {
            console.error('Failed to fetch logs');
        }
    }, [filter]);

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            try {
                const url = filter === 'ALL'
                    ? '/api/admin/logs?limit=200'
                    : `/api/admin/logs?limit=200&category=${filter}`;
                const res = await fetch(url, { credentials: 'include' });
                if (res.ok && isMounted) {
                    const data = await res.json();
                    setLogs(data);
                }
            } catch {
                console.error('Failed to fetch logs');
            }
        };

        load();

        if (!paused) {
            intervalRef.current = setInterval(load, 3000);
        }

        return () => {
            isMounted = false;
            clearInterval(intervalRef.current);
        }
    }, [filter, paused]);

    useEffect(() => {
        if (!paused && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, paused]);

    const categories = ['ALL', 'SERVER', 'WS', 'AUTH', 'API', 'DB'];

    return (
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal className="h-5 w-5 text-primary" />
                        Server-Konsole
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFilter(cat)}
                                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${filter === cat
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPaused(!paused)}
                            className="gap-1.5"
                        >
                            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                            {paused ? 'Fortsetzen' : 'Pause'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-1.5">
                            <RotateCcw className="h-3.5 w-3.5" />
                            Aktualisieren
                        </Button>
                    </div>
                </CardTitle>
                <CardDescription>
                    {paused ? 'Auto-Refresh pausiert' : 'Live – aktualisiert alle 3 Sekunden'}
                    {' · '}{logs.length} Einträge
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div
                    ref={scrollRef}
                    className="rounded-lg border overflow-auto font-mono text-xs leading-relaxed"
                    style={{
                        background: '#0c0e14',
                        maxHeight: '520px',
                        minHeight: '320px',
                    }}
                >
                    <div className="p-3 space-y-px">
                        {logs.length === 0 ? (
                            <div className="text-center py-12" style={{ color: '#475569' }}>
                                Keine Log-Einträge vorhanden.
                            </div>
                        ) : (
                            logs.map(entry => {
                                const catColor = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.SERVER;
                                const levelColor = LEVEL_COLORS[entry.level] || LEVEL_COLORS.INFO;

                                return (
                                    <div
                                        key={entry.id}
                                        className="flex items-start gap-2 py-1 px-2 rounded hover:bg-white/[0.03] transition-colors"
                                    >
                                        <span style={{ color: '#475569', flexShrink: 0 }}>
                                            {new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                        <span
                                            className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                                            style={{
                                                background: catColor.bg,
                                                color: catColor.text,
                                                border: `1px solid ${catColor.border}`,
                                                flexShrink: 0,
                                                minWidth: '52px',
                                                textAlign: 'center',
                                            }}
                                        >
                                            {entry.category}
                                        </span>
                                        <span style={{ color: levelColor, flexShrink: 0 }}>
                                            {entry.level === 'ERROR' ? '✖' : entry.level === 'WARN' ? '⚠' : '●'}
                                        </span>
                                        <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>
                                            {entry.message}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}