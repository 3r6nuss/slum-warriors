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
    GripVertical, Layers, Warehouse, Zap, Boxes, Minus, Download
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

export default function SettingsManagement() {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(null);
    const [discordRoles, setDiscordRoles] = useState([]);
    const [roleMappings, setRoleMappings] = useState([]);
    const [savingMappings, setSavingMappings] = useState(false);

    const SYSTEM_ROLES = [
        { value: 'admin', label: 'Admin' },
        { value: 'führung', label: 'Führung' },
        { value: 'moderator', label: 'Moderator' },
        { value: 'member', label: 'Mitglied' },
        { value: 'viewer', label: 'Zuschauer' },
    ];

    const intToHex = (num) => {
        if (!num || num === 0) return null;
        return '#' + num.toString(16).padStart(6, '0');
    };

    const loadSettings = async () => {
        try {
            const [settingsRes, rolesRes] = await Promise.all([
                fetch('/api/admin/settings', { credentials: 'include' }),
                fetch('/api/admin/discord-roles', { credentials: 'include' }),
            ]);
            if (settingsRes.ok) {
                const data = await settingsRes.json();
                setSettings(data);
                try {
                    const mappings = data.role_mappings ? JSON.parse(data.role_mappings) : [];
                    setRoleMappings(mappings);
                } catch { setRoleMappings([]); }
            }
            if (rolesRes.ok) {
                setDiscordRoles(await rolesRes.json());
            }
        } catch (err) {
            console.error('Failed to load settings', err);
        }
        setLoading(false);
    };

    useEffect(() => { loadSettings(); }, []);

    const toggleSetting = async (key, currentValue) => {
        const newValue = currentValue === 'true' ? 'false' : 'true';
        setSettings(prev => ({ ...prev, [key]: newValue }));
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ key, value: newValue })
            });
            if (res.ok) {
                setStatus({ type: 'success', message: 'Einstellung gespeichert' });
                setTimeout(() => setStatus(null), 3000);
            } else {
                throw new Error('Save failed');
            }
        } catch {
            setStatus({ type: 'error', message: 'Fehler beim Speichern' });
            loadSettings();
        }
    };

    const addMapping = () => {
        setRoleMappings(prev => [...prev, { discord_role_id: '', system_role: 'member' }]);
    };

    const removeMapping = (index) => {
        setRoleMappings(prev => prev.filter((_, i) => i !== index));
    };

    const updateMapping = (index, field, value) => {
        setRoleMappings(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
    };

    const saveMappings = async () => {
        setSavingMappings(true);
        const validMappings = roleMappings.filter(m => m.discord_role_id && m.system_role);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ key: 'role_mappings', value: JSON.stringify(validMappings) })
            });
            if (res.ok) {
                setRoleMappings(validMappings);
                setStatus({ type: 'success', message: 'Rollen-Zuordnung gespeichert' });
                setTimeout(() => setStatus(null), 3000);
            } else {
                throw new Error('Save failed');
            }
        } catch {
            setStatus({ type: 'error', message: 'Fehler beim Speichern der Zuordnung' });
        }
        setSavingMappings(false);
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

    const webhookEnabled = settings.webhook_enabled === 'true';

    return (
        <div className="space-y-6 max-w-3xl">
            {status && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${status.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {status.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    <span className="text-sm font-medium">{status.message}</span>
                </div>
            )}

            {/* Webhook Toggle */}
            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-primary" />
                        Discord Webhooks
                    </CardTitle>
                    <CardDescription>Automatische Benachrichtigungen in den Discord-Kanal</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                        <div className="space-y-1">
                            <h3 className="font-semibold text-sm">Webhooks aktiv</h3>
                            <p className="text-sm text-muted-foreground max-w-sm">
                                Aktiviert oder deaktiviert alle automatischen Benachrichtigungen (Ein-/Auslagerungen, etc.).
                            </p>
                        </div>
                        <button
                            onClick={() => toggleSetting('webhook_enabled', settings.webhook_enabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${webhookEnabled ? 'bg-primary' : 'bg-input'}`}
                        >
                            <span className="sr-only">Toggle Webhook</span>
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-background transition-transform ${webhookEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Role Mapping */}
            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Automatische Rollenzuordnung
                    </CardTitle>
                    <CardDescription>
                        Discord-Rollen werden beim Login automatisch zu System-Rollen zugeordnet. Neue Benutzer werden sofort freigeschaltet wenn ein Mapping greift.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {discordRoles.length === 0 ? (
                        <div className="text-center py-8 border border-dashed rounded-xl">
                            <p className="text-muted-foreground text-sm">
                                Keine Discord-Rollen gefunden. Bitte zuerst unter <strong>Rollenverwaltung → Mitglieder</strong> die Discord-Daten synchronisieren.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {roleMappings.map((mapping, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:border-primary/30 transition-colors">
                                    <div className="flex-1">
                                        <Select value={mapping.discord_role_id} onValueChange={(v) => updateMapping(index, 'discord_role_id', v)}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Discord-Rolle wählen..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {discordRoles.map(role => (
                                                    <SelectItem key={role.role_id} value={role.role_id}>
                                                        <span className="flex items-center gap-2">
                                                            <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: intToHex(role.color) || '#6b7280' }} />
                                                            {role.name}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <span className="text-muted-foreground text-lg shrink-0">→</span>
                                    <div className="flex-1">
                                        <Select value={mapping.system_role} onValueChange={(v) => updateMapping(index, 'system_role', v)}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="System-Rolle..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SYSTEM_ROLES.map(sr => (
                                                    <SelectItem key={sr.value} value={sr.value}>{sr.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeMapping(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}

                            <div className="flex items-center gap-3 pt-2">
                                <Button variant="outline" size="sm" className="gap-1.5" onClick={addMapping}>
                                    <Plus className="h-3.5 w-3.5" />
                                    Zuordnung hinzufügen
                                </Button>
                                <Button size="sm" className="gap-1.5" onClick={saveMappings} disabled={savingMappings}>
                                    {savingMappings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                    Speichern
                                </Button>
                            </div>

                            {roleMappings.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Bei mehreren Zuordnungen wird die höchste System-Rolle zugewiesen (Admin &gt; Führung &gt; Moderator &gt; Mitglied &gt; Zuschauer).
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Database Export */}
            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5 text-primary" />
                        Datenbank Export (CSV)
                    </CardTitle>
                    <CardDescription>
                        Exportiere Tabellen als CSV-Dateien für externe Analysen oder Backups (z.B. in Excel).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {['inventory', 'transactions', 'products', 'warehouses', 'users', 'adjustments', 'admin_logs', 'auth_logs', 'error_logs', 'kits', 'discord_members'].map(table => (
                            <Button 
                                key={table}
                                variant="outline" 
                                className="justify-start gap-2 h-10 w-full hover:border-primary/50 hover:bg-primary/5"
                                onClick={() => window.open(`/api/admin/export/csv/${table}`, '_blank')}
                            >
                                <Download className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{table}</span>
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}