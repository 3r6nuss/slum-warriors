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
import ServerConsole from './ServerConsole';
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

export default function LogPage() {
    const [transactions, setTransactions] = useState([]);
    const [edits, setEdits] = useState([]);
    const [adminLogs, setAdminLogs] = useState([]);
    const [authLogs, setAuthLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedEdit, setExpandedEdit] = useState(null);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const [txRes, editRes, adminRes, authRes] = await Promise.all([
                fetch('/api/transactions'),
                fetch('/api/adjustments/edits'),
                fetch('/api/admin/audit/admin', { credentials: 'include' }),
                fetch('/api/admin/audit/auth', { credentials: 'include' })
            ]);

            if (txRes.ok) setTransactions(await txRes.json());
            if (editRes.ok) setEdits(await editRes.json());
            if (adminRes.ok) setAdminLogs(await adminRes.json());
            if (authRes.ok) setAuthLogs(await authRes.json());
        } catch {
            console.error('Failed to load logs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

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
export default function LogPage() {
    const [transactions, setTransactions] = useState([]);
    const [edits, setEdits] = useState([]);
    const [adminLogs, setAdminLogs] = useState([]);
    const [authLogs, setAuthLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedEdit, setExpandedEdit] = useState(null);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const [txRes, editRes, adminRes, authRes] = await Promise.all([
                fetch('/api/transactions'),
                fetch('/api/adjustments/edits'),
                fetch('/api/admin/audit/admin', { credentials: 'include' }),
                fetch('/api/admin/audit/auth', { credentials: 'include' })
            ]);

            if (txRes.ok) setTransactions(await txRes.json());
            if (editRes.ok) setEdits(await editRes.json());
            if (adminRes.ok) setAdminLogs(await adminRes.json());
            if (authRes.ok) setAuthLogs(await authRes.json());
        } catch {
            console.error('Failed to load logs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

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
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xl font-semibold">
                    <ScrollText className="h-6 w-6 text-primary" />
                    System-Logs & Protokolle
                </div>
                <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
                    Aktualisieren
                </Button>
            </div>

            {/* Transactions Card */}
            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="text-lg">Transaktionen</CardTitle>
                    <CardDescription>Aktuelle Ein- und Auslagerungen</CardDescription>
                </CardHeader>
                <CardContent>
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
                                {transactions.slice(0, 50).map(t => (
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
                </CardContent>
            </Card>

            {/* Edits Card */}
            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="text-lg">Lager-Bearbeitungen</CardTitle>
                    <CardDescription>Manuelle Bestandsanpassungen</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {edits.length === 0 && !loading ? (
                            <div className="text-center py-12 border rounded-xl border-dashed">
                                <p className="text-muted-foreground">Keine Bearbeitungen gefunden.</p>
                            </div>
                        ) : (
                            edits.slice(0, 30).map(e => (
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
                </CardContent>
            </Card>

            {/* Admin Logs Card */}
            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="text-lg">Admin-Aktionen</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Admin</TableHead>
                                    <TableHead>Aktion</TableHead>
                                    <TableHead>Ziel-Benutzer</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {adminLogs.slice(0, 30).map(l => (
                                    <TableRow key={l.id}>
                                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                            {new Date(l.created_at).toLocaleString('de-DE')}
                                        </TableCell>
                                        <TableCell className="font-medium">{l.admin_name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[10px] uppercase">
                                                {l.action.replace('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{l.target_name || '-'}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{l.details}</TableCell>
                                    </TableRow>
                                ))}
                                {adminLogs.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            Keine Admin-Aktivitäten gefunden.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Auth Logs Card */}
            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="text-lg">Authentifizierung</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Benutzer</TableHead>
                                    <TableHead>Aktion</TableHead>
                                    <TableHead>IP / Info</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {authLogs.slice(0, 30).map(l => (
                                    <TableRow key={l.id}>
                                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                            {new Date(l.created_at).toLocaleString('de-DE')}
                                        </TableCell>
                                        <TableCell className="font-medium">{l.username}</TableCell>
                                        <TableCell>
                                            <Badge variant={l.action === 'login' ? 'success' : l.action === 'register' ? 'primary' : 'secondary'} className="text-[10px] uppercase">
                                                {l.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground font-mono text-xs">{l.ip_address || '-'}</TableCell>
                                    </TableRow>
                                ))}
                                {authLogs.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            Keine Authentifizierungs-Logs gefunden.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Server Console Card */}
            <ServerConsole />
        </div>
    );
}