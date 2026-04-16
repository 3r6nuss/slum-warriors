import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Users, RefreshCw, Search, Pencil, Check, X, Crown,
    Swords, Shield, User, Eye, Loader2, ChevronDown, ChevronRight,
    UserCircle, Hash, Key, CheckCircle, Copy
} from 'lucide-react';

const SYSTEM_ROLE_CONFIG = {
    admin: { label: 'Admin', icon: Crown, color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    führung: { label: 'Führung', icon: Swords, color: 'bg-red-500/15 text-red-400 border-red-500/30' },
    moderator: { label: 'Moderator', icon: Shield, color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    member: { label: 'Mitglied', icon: User, color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    viewer: { label: 'Zuschauer', icon: Eye, color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

function intToHex(colorInt) {
    if (!colorInt) return null;
    return '#' + colorInt.toString(16).padStart(6, '0');
}

export default function MembersView() {
    const [members, setMembers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [expandedRoles, setExpandedRoles] = useState({});
    const [editingName, setEditingName] = useState(null);
    const [status, setStatus] = useState(null);

    const loadMembers = useCallback(async () => {
        try {
            const res = await fetch('/api/members', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setMembers(data.members || []);
                setRoles(data.roles || []);
                // Auto-expand all roles on first load
                if (Object.keys(expandedRoles).length === 0) {
                    const expanded = {};
                    (data.roles || []).forEach(r => { expanded[r.role_id] = true; });
                    expanded['no-role'] = true;
                    setExpandedRoles(expanded);
                }
            }
        } catch {
            console.error('Failed to load members');
        } finally {
            setLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { loadMembers(); }, [loadMembers]);

    const syncMembers = async () => {
        setSyncing(true);
        setStatus(null);
        try {
            const res = await fetch('/api/members/sync', {
                method: 'POST',
                credentials: 'include',
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: `${data.members_synced} Mitglieder und ${data.roles_synced} Rollen synchronisiert` });
                await loadMembers();
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Sync fehlgeschlagen: ' + err.message });
        } finally {
            setSyncing(false);
        }
    };

    const setCustomName = async (memberId, customName) => {
        try {
            const res = await fetch(`/api/members/${memberId}/custom-name`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ custom_name: customName }),
            });
            const data = await res.json();
            if (res.ok) {
                setEditingName(null);
                loadMembers();
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch {
            setStatus({ type: 'error', message: 'Fehler beim Setzen des Namens' });
        }
    };

    const generateToken = async (memberId) => {
        setStatus(null);
        try {
            const res = await fetch(`/api/members/${memberId}/token`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await res.json();
            if (res.ok) {
                try {
                    await navigator.clipboard.writeText(data.link);
                    setStatus({ type: 'success', message: 'Login-Link kopiert!' });
                } catch (e) {
                    setStatus({ type: 'success', message: 'Link generiert: ' + data.link });
                }
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Fehler beim Generieren des Tokens' });
        }
    };

    const setSystemRole = async (memberId, systemRole) => {
        try {
            const res = await fetch(`/api/members/${memberId}/system-role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ system_role: systemRole === 'none' ? null : systemRole }),
            });
            if (res.ok) {
                loadMembers();
            }
        } catch {
            setStatus({ type: 'error', message: 'Fehler beim Setzen der Rolle' });
        }
    };

    const toggleRole = (roleId) => {
        setExpandedRoles(prev => ({ ...prev, [roleId]: !prev[roleId] }));
    };

    // Group members by their Discord roles
    const getMembersForRole = (roleId) => {
        return filteredMembers.filter(m => {
            const memberRoles = JSON.parse(m.discord_roles || '[]');
            return memberRoles.includes(roleId);
        });
    };

    const getMembersWithoutRoles = () => {
        return filteredMembers.filter(m => {
            const memberRoles = JSON.parse(m.discord_roles || '[]');
            return memberRoles.length === 0;
        });
    };

    // Filter members
    const filteredMembers = members.filter(m => {
        const nameMatch = search === '' || 
            m.username.toLowerCase().includes(search.toLowerCase()) ||
            (m.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
            (m.custom_name || '').toLowerCase().includes(search.toLowerCase());

        if (!nameMatch) return false;

        if (filterRole === 'all') return true;
        if (filterRole === 'no-role') {
            const memberRoles = JSON.parse(m.discord_roles || '[]');
            return memberRoles.length === 0;
        }
        const memberRoles = JSON.parse(m.discord_roles || '[]');
        return memberRoles.includes(filterRole);
    });

    // Roles that actually have members
    const activeRoles = roles.filter(r => {
        return members.some(m => {
            const memberRoles = JSON.parse(m.discord_roles || '[]');
            return memberRoles.includes(r.role_id);
        });
    });

    const noRoleMembers = getMembersWithoutRoles();

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Users className="h-6 w-6 text-primary" />
                        </div>
                        Discord Mitglieder
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {members.length} Mitglieder · {roles.length} Rollen
                    </p>
                </div>
                <Button
                    onClick={syncMembers}
                    disabled={syncing}
                    className="gap-2"
                >
                    {syncing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                    {syncing ? 'Synchronisiere...' : 'Discord Sync'}
                </Button>
            </div>

            {/* Status */}
            {status && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                    status.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                    {status.message}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{members.length}</div>
                        <div className="text-xs text-muted-foreground">Gesamt</div>
                    </CardContent>
                </Card>
                <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{roles.length}</div>
                        <div className="text-xs text-muted-foreground">Discord Rollen</div>
                    </CardContent>
                </Card>
                <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{members.filter(m => m.custom_name).length}</div>
                        <div className="text-xs text-muted-foreground">Mit Klarname</div>
                    </CardContent>
                </Card>
                <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{members.filter(m => m.system_role).length}</div>
                        <div className="text-xs text-muted-foreground">Mit System-Rolle</div>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Mitglied suchen..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="w-full sm:w-56">
                        <SelectValue placeholder="Alle Rollen" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Rollen</SelectItem>
                        <SelectItem value="no-role">Ohne Rolle</SelectItem>
                        {roles.map(r => (
                            <SelectItem key={r.role_id} value={r.role_id}>
                                <span className="flex items-center gap-2">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full inline-block"
                                        style={{ backgroundColor: intToHex(r.color) || '#6b7280' }}
                                    />
                                    {r.name}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* No members hint */}
            {members.length === 0 && (
                <Card className="backdrop-blur-sm bg-card/80 border-border/50 border-dashed">
                    <CardContent className="p-12 text-center">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">Noch keine Mitglieder synchronisiert</h3>
                        <p className="text-muted-foreground text-sm mb-4">
                            Klicke auf "Discord Sync" um alle Server-Mitglieder zu laden.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Grouped by Discord Roles */}
            {filterRole === 'all' ? (
                <div className="space-y-3">
                    {activeRoles.map(role => {
                        const roleMembers = getMembersForRole(role.role_id);
                        if (roleMembers.length === 0) return null;
                        const isExpanded = expandedRoles[role.role_id];
                        const roleColor = intToHex(role.color) || '#6b7280';

                        return (
                            <Card key={role.role_id} className="backdrop-blur-sm bg-card/80 border-border/50 overflow-hidden">
                                <button
                                    onClick={() => toggleRole(role.role_id)}
                                    className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-3.5 h-3.5 rounded-full ring-2 ring-offset-2 ring-offset-background"
                                            style={{ backgroundColor: roleColor, ringColor: roleColor }}
                                        />
                                        <span className="font-semibold text-sm" style={{ color: roleColor }}>
                                            {role.name}
                                        </span>
                                        <Badge variant="secondary" className="text-[10px] px-1.5">
                                            {roleMembers.length}
                                        </Badge>
                                    </div>
                                    {isExpanded
                                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    }
                                </button>
                                {isExpanded && (
                                    <CardContent className="pt-0 pb-2 px-2">
                                        <div className="divide-y divide-border/50">
                                            {roleMembers.map(member => (
                                                <MemberRow
                                                    key={member.id}
                                                    member={member}
                                                    roles={roles}
                                                    editingName={editingName}
                                                    setEditingName={setEditingName}
                                                    setCustomName={setCustomName}
                                                    setSystemRole={setSystemRole}
                                                    generateToken={generateToken}
                                                />
                                            ))}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}

                    {/* Members without roles */}
                    {noRoleMembers.length > 0 && (
                        <Card className="backdrop-blur-sm bg-card/80 border-border/50 overflow-hidden">
                            <button
                                onClick={() => toggleRole('no-role')}
                                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-3.5 h-3.5 rounded-full bg-muted-foreground/30 ring-2 ring-offset-2 ring-offset-background ring-muted-foreground/30" />
                                    <span className="font-semibold text-sm text-muted-foreground">
                                        Ohne Rolle
                                    </span>
                                    <Badge variant="secondary" className="text-[10px] px-1.5">
                                        {noRoleMembers.length}
                                    </Badge>
                                </div>
                                {expandedRoles['no-role']
                                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                }
                            </button>
                            {expandedRoles['no-role'] && (
                                <CardContent className="pt-0 pb-2 px-2">
                                    <div className="divide-y divide-border/50">
                                        {noRoleMembers.map(member => (
                                            <MemberRow
                                                key={member.id}
                                                member={member}
                                                roles={roles}
                                                editingName={editingName}
                                                setEditingName={setEditingName}
                                                setCustomName={setCustomName}
                                                setSystemRole={setSystemRole}
                                                generateToken={generateToken}
                                            />
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    )}
                </div>
            ) : (
                /* Flat filtered list */
                <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                            {filteredMembers.length} Mitglieder
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 pb-2">
                        <div className="divide-y divide-border/50">
                            {filteredMembers.map(member => (
                                <MemberRow
                                    key={member.id}
                                    member={member}
                                    roles={roles}
                                    editingName={editingName}
                                    setEditingName={setEditingName}
                                    setCustomName={setCustomName}
                                    setSystemRole={setSystemRole}
                                    generateToken={generateToken}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function MemberRow({ member, roles, editingName, setEditingName, setCustomName, setSystemRole, generateToken }) {
    const memberRoles = JSON.parse(member.discord_roles || '[]');
    const memberRoleNames = memberRoles.map(rid => {
        const r = roles.find(role => role.role_id === rid);
        return r ? { name: r.name, color: intToHex(r.color) } : null;
    }).filter(Boolean);

    const sysRoleConfig = member.system_role ? SYSTEM_ROLE_CONFIG[member.system_role] : null;

    return (
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 py-3 px-3 hover:bg-muted/20 rounded-lg transition-colors">
            {/* Avatar + Name */}
            <div className="flex items-center gap-3 min-w-0 lg:w-56 shrink-0">
                {member.avatar ? (
                    <img
                        src={`https://cdn.discordapp.com/avatars/${member.discord_id}/${member.avatar}.png?size=40`}
                        alt=""
                        className="h-9 w-9 rounded-full ring-1 ring-border shrink-0"
                    />
                ) : (
                    <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                        <UserCircle className="h-5 w-5 text-muted-foreground" />
                    </div>
                )}
                <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                        {member.display_name || member.username}
                    </div>
                    {member.display_name && (
                        <div className="text-[11px] text-muted-foreground truncate">
                            @{member.username}
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Name */}
            <div className="lg:w-44 shrink-0">
                {editingName?.memberId === member.id ? (
                    <div className="flex items-center gap-1">
                        <Input
                            value={editingName.value}
                            onChange={(e) => setEditingName({ ...editingName, value: e.target.value })}
                            className="h-7 text-xs w-32"
                            placeholder="Klarname..."
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') setCustomName(member.id, editingName.value);
                                if (e.key === 'Escape') setEditingName(null);
                            }}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-500" onClick={() => setCustomName(member.id, editingName.value)}>
                            <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingName(null)}>
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 group">
                        <span className={`text-xs ${member.custom_name ? 'font-medium text-foreground' : 'text-muted-foreground/60 italic'}`}>
                            {member.custom_name || 'Kein Klarname'}
                        </span>
                        <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                            onClick={() => setEditingName({ memberId: member.id, value: member.custom_name || '' })}
                        >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                    </div>
                )}
            </div>

            {/* Discord Roles */}
            <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
                {memberRoleNames.slice(0, 4).map((r, i) => (
                    <span
                        key={i}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
                        style={{
                            color: r.color || '#9ca3af',
                            borderColor: (r.color || '#9ca3af') + '40',
                            backgroundColor: (r.color || '#9ca3af') + '15',
                        }}
                    >
                        {r.name}
                    </span>
                ))}
                {memberRoleNames.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">
                        +{memberRoleNames.length - 4}
                    </span>
                )}
                {memberRoleNames.length === 0 && (
                    <span className="text-[10px] text-muted-foreground italic">Keine Rollen</span>
                )}
            </div>

            {/* System Role */}
            <div className="lg:w-40 shrink-0">
                <Select
                    value={member.system_role || 'none'}
                    onValueChange={(val) => setSystemRole(member.id, val)}
                >
                    <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue placeholder="System-Rolle" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">
                            <span className="text-muted-foreground">Keine</span>
                        </SelectItem>
                        {Object.entries(SYSTEM_ROLE_CONFIG).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>
                                {cfg.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Actions */}
            <div className="shrink-0 flex items-center justify-end w-8">
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                    onClick={() => generateToken(member.id)}
                    title="Login-Link (Token) generieren und in die Zwischenablage kopieren"
                >
                    <Key className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
