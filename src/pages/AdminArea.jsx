import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectOption } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import {
    ShieldCheck, Users, ScrollText, Crown, Shield, User, Eye,
    CheckCircle, AlertCircle, Swords, Clock, UserCheck, UserX,
    Pencil, Check, X, Terminal, Activity, Pause, Play, RotateCcw, Wifi,
    Package, Plus, Trash2
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

function RoleManagement() {
    const [users, setUsers] = useState([]);
    const [status, setStatus] = useState(null);
    const [editingName, setEditingName] = useState(null); // { userId, value }
    const { user: currentUser } = useAuth();

    const loadUsers = () => {
        fetch('/api/auth/users', { credentials: 'include' })
            .then(r => r.json())
            .then(setUsers)
            .catch(() => setUsers([]));
    };

    useEffect(loadUsers, []);

    const changeRole = async (userId, newRole) => {
        try {
            const res = await fetch(`/api/auth/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ role: newRole }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: data.message });
                loadUsers();
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Fehler beim Ändern der Rolle' });
        }
    };

    const approveUser = async (userId, role = 'member') => {
        try {
            const res = await fetch(`/api/auth/users/${userId}/approve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ role }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: data.message });
                loadUsers();
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Fehler beim Freischalten' });
        }
    };

    const revokeUser = async (userId) => {
        try {
            const res = await fetch(`/api/auth/users/${userId}/revoke`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: data.message });
                loadUsers();
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Fehler beim Zurücksetzen' });
        }
    };

    const setDisplayName = async (userId, displayName) => {
        try {
            const res = await fetch(`/api/auth/users/${userId}/display-name`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ display_name: displayName }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: data.message });
                setEditingName(null);
                loadUsers();
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Fehler beim Setzen des Klarnamens' });
        }
    };

    return (
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Rollenverwaltung
                </CardTitle>
                <CardDescription>{users.length} registrierte Benutzer</CardDescription>
            </CardHeader>
            <CardContent>
                {status && (
                    <div className={`mb-4 flex items-center gap-2 p-3 rounded-lg ${status.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                        }`}>
                        {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <span className="text-sm">{status.message}</span>
                    </div>
                )}

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Benutzer</TableHead>
                            <TableHead>Klarname</TableHead>
                            <TableHead>Discord ID</TableHead>
                            <TableHead>Aktuelle Rolle</TableHead>
                            <TableHead>Rolle ändern</TableHead>
                            <TableHead>Freischalten</TableHead>
                            <TableHead>Beigetreten</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((u) => {
                            const roleInfo = ROLE_CONFIG[u.role] || ROLE_CONFIG.member;
                            const RoleIcon = roleInfo.icon;
                            const isCurrentUser = u.discord_id === currentUser?.discord_id;
                            const isProtected = HARDCODED_IDS.includes(u.discord_id);

                            return (
                                <TableRow key={u.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {u.avatar ? (
                                                <img
                                                    src={`https://cdn.discordapp.com/avatars/${u.discord_id}/${u.avatar}.png?size=32`}
                                                    alt=""
                                                    className="h-8 w-8 rounded-full"
                                                />
                                            ) : (
                                                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            )}
                                            <div>
                                                <span className="font-medium">{u.username}</span>
                                                {isCurrentUser && (
                                                    <span className="ml-2 text-xs text-muted-foreground">(Du)</span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {editingName?.userId === u.id ? (
                                            <div className="flex items-center gap-1.5">
                                                <Input
                                                    value={editingName.value}
                                                    onChange={(e) => setEditingName({ ...editingName, value: e.target.value })}
                                                    className="h-8 w-36 text-sm"
                                                    placeholder="Klarname..."
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') setDisplayName(u.id, editingName.value);
                                                        if (e.key === 'Escape') setEditingName(null);
                                                    }}
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500" onClick={() => setDisplayName(u.id, editingName.value)}>
                                                    <Check className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingName(null)}>
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 group">
                                                <span className={`text-sm ${u.display_name ? 'font-medium' : 'text-muted-foreground italic'}`}>
                                                    {u.display_name || 'Nicht gesetzt'}
                                                </span>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => setEditingName({ userId: u.id, value: u.display_name || '' })}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        {u.discord_id}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={roleInfo.color} className="gap-1">
                                            <RoleIcon className="h-3 w-3" />
                                            {roleInfo.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {isProtected ? (
                                            <span className="text-xs text-muted-foreground">Geschützt</span>
                                        ) : (
                                            <Select
                                                value={u.role}
                                                onValueChange={(newRole) => changeRole(u.id, newRole)}
                                                className="w-36"
                                            >
                                                {Object.entries(ROLE_CONFIG)
                                                    .filter(([key]) => key !== 'pending')
                                                    .map(([key, cfg]) => (
                                                        <SelectOption key={key} value={key}>{cfg.label}</SelectOption>
                                                    ))}
                                            </Select>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {u.role === 'pending' ? (
                                            <Button
                                                size="sm"
                                                className="gap-1.5"
                                                onClick={() => approveUser(u.id, 'member')}
                                            >
                                                <UserCheck className="h-3.5 w-3.5" />
                                                Freischalten
                                            </Button>
                                        ) : isProtected || isCurrentUser ? (
                                            <Badge variant="outline" className="gap-1 text-green-500 border-green-500/30">
                                                <CheckCircle className="h-3 w-3" />
                                                Aktiv
                                            </Badge>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="gap-1.5"
                                                onClick={() => revokeUser(u.id)}
                                            >
                                                <UserX className="h-3.5 w-3.5" />
                                                Sperren
                                            </Button>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {new Date(u.created_at).toLocaleDateString('de-DE')}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {users.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                    Noch keine Benutzer registriert
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function LogPage() {
    const [transactions, setTransactions] = useState([]);
    const [edits, setEdits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedEdit, setExpandedEdit] = useState(null);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const [txRes, editRes] = await Promise.all([
                fetch('/api/transactions'),
                fetch('/api/adjustments/edits')
            ]);
            if (txRes.ok) setTransactions(await txRes.json());
            if (editRes.ok) setEdits(await editRes.json());
        } catch (err) {
            console.error('Failed to load logs', err);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadLogs();
    }, []);

    const renderDifferences = (before, after) => {
        const allProducts = new Set([...Object.keys(before), ...Object.keys(after)]);
        const diffs = Array.from(allProducts).map(id => {
            const b = before[id] || { name: 'Unbekannt', quantity: 0 };
            const a = after[id] || { name: 'Unbekannt', quantity: 0 };
            return {
                id,
                name: a.name || b.name,
                oldQty: b.quantity,
                newQty: a.quantity,
                diff: a.quantity - b.quantity
            };
        }).filter(d => d.diff !== 0);

        if (diffs.length === 0) return <p className="text-sm text-muted-foreground italic mt-3">Keine Bestandsänderungen protokolliert.</p>;

        return (
            <div className="mt-4 rounded-md border text-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="py-2 h-auto">Produkt</TableHead>
                            <TableHead className="py-2 h-auto text-right">Vorher</TableHead>
                            <TableHead className="py-2 h-auto text-right">Nachher</TableHead>
                            <TableHead className="py-2 h-auto text-right">Differenz</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {diffs.map(d => (
                            <TableRow key={d.id} className="hover:bg-transparent">
                                <TableCell className="py-2 font-medium">{d.name}</TableCell>
                                <TableCell className="py-2 text-right">{d.oldQty}</TableCell>
                                <TableCell className="py-2 text-right font-medium">{d.newQty}</TableCell>
                                <TableCell className="py-2 text-right">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${d.diff > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                                        }`}>
                                        {d.diff > 0 ? '+' : ''}{d.diff}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ScrollText className="h-5 w-5 text-primary" />
                        System-Logs
                    </div>
                    <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
                        Aktualisieren
                    </Button>
                </CardTitle>
                <CardDescription>Systemweite Aktivitäten und Bestandsänderungen</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="transactions" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="transactions">Transaktionen (Ein-/Auslagern)</TabsTrigger>
                        <TabsTrigger value="edits">Lager-Bearbeitungen</TabsTrigger>
                    </TabsList>

                    <TabsContent value="transactions">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Datum</TableHead>
                                        <TableHead>Lager</TableHead>
                                        <TableHead>Person</TableHead>
                                        <TableHead>Typ</TableHead>
                                        <TableHead>Produkt</TableHead>
                                        <TableHead className="text-right">Menge</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map(t => (
                                        <TableRow key={t.id}>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(t.created_at).toLocaleString('de-DE')}
                                            </TableCell>
                                            <TableCell>{t.warehouse_name}</TableCell>
                                            <TableCell className="font-medium">{t.person_name}</TableCell>
                                            <TableCell>
                                                <Badge variant={t.type === 'checkin' ? 'success' : 'default'} className="text-[10px] uppercase">
                                                    {t.type === 'checkin' ? 'Einlagern' : 'Auslagern'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{t.product_name}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                <span className={t.type === 'checkin' ? 'text-success' : 'text-primary'}>
                                                    {t.type === 'checkin' ? '+' : '-'}{t.quantity}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {transactions.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                Keine Transaktionen gefunden.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="edits">
                        <div className="space-y-4">
                            {edits.length === 0 && !loading ? (
                                <div className="text-center py-12 border rounded-xl border-dashed">
                                    <p className="text-muted-foreground">Keine Bearbeitungen gefunden.</p>
                                </div>
                            ) : (
                                edits.map(e => (
                                    <div key={e.id} className="border rounded-xl p-4 bg-card hover:border-primary/50 transition-colors">
                                        <div
                                            className="flex items-center justify-between cursor-pointer"
                                            onClick={() => setExpandedEdit(expandedEdit === e.id ? null : e.id)}
                                        >
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <Badge variant="secondary">{e.warehouse_name}</Badge>
                                                    <span className="text-sm font-semibold">{e.person_name}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(e.created_at).toLocaleString('de-DE')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-foreground/80 mt-2">
                                                    Grund: {e.reason ? <span className="italic">{e.reason}</span> : <span className="text-muted-foreground italic">Kein Grund angegeben</span>}
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={(eEvt) => { eEvt.stopPropagation(); setExpandedEdit(expandedEdit === e.id ? null : e.id); }}>
                                                {expandedEdit === e.id ? 'Details ausblenden' : 'Details anzeigen'}
                                            </Button>
                                        </div>

                                        {expandedEdit === e.id && renderDifferences(e.state_before, e.state_after)}
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

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

function ServerConsole() {
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
        } catch (err) {
            console.error('Failed to fetch logs', err);
        }
    }, [filter]);

    useEffect(() => {
        fetchLogs();
        if (!paused) {
            intervalRef.current = setInterval(fetchLogs, 3000);
        }
        return () => clearInterval(intervalRef.current);
    }, [fetchLogs, paused]);

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

function WsMonitor() {
    const [stats, setStats] = useState({ current: 0, history: [] });
    const [hours, setHours] = useState(24);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/ws-stats?hours=${hours}`, { credentials: 'include' });
            if (res.ok) {
                setStats(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch ws stats', err);
        }
        setLoading(false);
    }, [hours]);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
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
                                    onClick={() => { setHours(h); setLoading(true); }}
                                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${hours === h
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    {h}h
                                </button>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchStats}>
                            <RotateCcw className="h-3.5 w-3.5" />
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

function ProductManagement() {
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);
    const [newName, setNewName] = useState('');
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(null);

    const loadData = async () => {
        try {
            const [prodRes, whRes] = await Promise.all([
                fetch('/api/products', { credentials: 'include' }),
                fetch('/api/inventory/warehouses/list', { credentials: 'include' })
            ]);

            if (prodRes.ok) setProducts(await prodRes.json());
            if (whRes.ok) {
                const whData = await whRes.json();
                setWarehouses(whData);
                // Default to all warehouses selected
                setSelectedWarehouses(whData.map(w => w.id));
            }
        } catch (err) {
            console.error('Failed to load data', err);
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const toggleWarehouse = (id) => {
        setSelectedWarehouses(prev =>
            prev.includes(id) ? prev.filter(wId => wId !== id) : [...prev, id]
        );
    };

    const addProduct = async () => {
        if (!newName.trim() || selectedWarehouses.length === 0) {
            if (selectedWarehouses.length === 0) {
                setStatus({ type: 'error', message: 'Bitte wähle mindestens ein Lager aus' });
            }
            return;
        }

        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: newName.trim(),
                    warehouseIds: selectedWarehouses
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: `"${data.name}" wurde hinzugefügt` });
                setNewName('');
                loadData(); // Reload to get updated products list
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Fehler beim Hinzufügen' });
        }
    };

    const deleteProduct = async (id, name) => {
        if (deleting === id) {
            try {
                const res = await fetch(`/api/products/${id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                });
                if (res.ok) {
                    setStatus({ type: 'success', message: `"${name}" wurde gelöscht` });
                    loadData();
                } else {
                    const data = await res.json();
                    setStatus({ type: 'error', message: data.error });
                }
            } catch (err) {
                setStatus({ type: 'error', message: 'Fehler beim Löschen' });
            }
            setDeleting(null);
        } else {
            setDeleting(id);
            setTimeout(() => setDeleting(prev => prev === id ? null : prev), 3000);
        }
    };

    return (
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Produktverwaltung
                </CardTitle>
                <CardDescription>{products.length} Produkte registriert</CardDescription>
            </CardHeader>
            <CardContent>
                {status && (
                    <div className={`mb-4 flex items-center gap-2 p-3 rounded-lg ${status.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <span className="text-sm">{status.message}</span>
                    </div>
                )}

                {/* Add new product */}
                <div className="flex flex-col gap-3 mb-6 bg-muted/30 p-4 rounded-xl border">
                    <div className="flex flex-wrap gap-2">
                        {warehouses.map(w => (
                            <Button
                                key={w.id}
                                size="sm"
                                variant={selectedWarehouses.includes(w.id) ? 'default' : 'outline'}
                                onClick={() => toggleWarehouse(w.id)}
                                className={`text-xs h-8 ${selectedWarehouses.includes(w.id) ? 'bg-primary/20 text-primary hover:bg-primary/30' : ''}`}
                            >
                                {selectedWarehouses.includes(w.id) ? <Check className="h-3.5 w-3.5 mr-1" /> : null}
                                {w.name}
                            </Button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Neues Produkt hinzufügen..."
                            className="flex-1 bg-background"
                            onKeyDown={(e) => { if (e.key === 'Enter') addProduct(); }}
                        />
                        <Button onClick={addProduct} disabled={!newName.trim() || selectedWarehouses.length === 0} className="gap-1.5 min-w-[120px]">
                            <Plus className="h-4 w-4" />
                            Hinzufügen
                        </Button>
                    </div>
                </div>

                {/* Product list */}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Produktname</TableHead>
                                <TableHead className="text-right">Aktionen</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-mono text-xs text-muted-foreground w-16">
                                        {p.id}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 text-muted-foreground" />
                                            {p.name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant={deleting === p.id ? 'destructive' : 'outline'}
                                            className="gap-1.5"
                                            onClick={() => deleteProduct(p.id, p.name)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            {deleting === p.id ? 'Wirklich löschen?' : 'Löschen'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {products.length === 0 && !loading && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                        Noch keine Produkte vorhanden
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

export default function AdminArea({ initialTab = 'roles' }) {
    const { isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState(initialTab);

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <ShieldCheck className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold mb-2">Zugriff verweigert</h2>
                <p className="text-muted-foreground">Nur Admins können auf diesen Bereich zugreifen.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <ShieldCheck className="h-8 w-8 text-primary" />
                    Admin-Bereich
                </h1>
                <p className="text-muted-foreground mt-1">Benutzerverwaltung, Logs und System-Monitoring</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="roles">Rollenverwaltung</TabsTrigger>
                    <TabsTrigger value="products">Produkte</TabsTrigger>
                    <TabsTrigger value="logs">System-Logs</TabsTrigger>
                    <TabsTrigger value="console">Konsole</TabsTrigger>
                    <TabsTrigger value="wsmonitor">WS Monitor</TabsTrigger>
                </TabsList>
                <TabsContent value="roles">
                    <RoleManagement />
                </TabsContent>
                <TabsContent value="products">
                    <ProductManagement />
                </TabsContent>
                <TabsContent value="logs">
                    <LogPage />
                </TabsContent>
                <TabsContent value="console">
                    <ServerConsole />
                </TabsContent>
                <TabsContent value="wsmonitor">
                    <WsMonitor />
                </TabsContent>
            </Tabs>
        </div>
    );
}
