import { useState, useEffect } from 'react';
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
    Pencil, Check, X
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
                <p className="text-muted-foreground mt-1">Benutzerverwaltung und System-Logs</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="roles">Rollenverwaltung</TabsTrigger>
                    <TabsTrigger value="logs">System-Logs</TabsTrigger>
                </TabsList>
                <TabsContent value="roles">
                    <RoleManagement />
                </TabsContent>
                <TabsContent value="logs">
                    <LogPage />
                </TabsContent>
            </Tabs>
        </div>
    );
}
