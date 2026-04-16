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

export default function KitManagement() {
    const [kits, setKits] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(null);
    const [deleting, setDeleting] = useState(null);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingKit, setEditingKit] = useState(null); // null = create, object = edit
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formItems, setFormItems] = useState([]); // [{ product_id, quantity }]
    const [formSaving, setFormSaving] = useState(false);

    const loadData = async () => {
        try {
            const [kitsRes, prodRes] = await Promise.all([
                fetch('/api/kits', { credentials: 'include' }),
                fetch('/api/products', { credentials: 'include' }),
            ]);
            if (kitsRes.ok) setKits(await kitsRes.json());
            if (prodRes.ok) setProducts(await prodRes.json());
        } catch (err) {
            console.error('Failed to load kit data', err);
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const openCreateForm = () => {
        setEditingKit(null);
        setFormName('');
        setFormDescription('');
        setFormItems([{ product_id: '', quantity: 1 }]);
        setShowForm(true);
    };

    const openEditForm = (kit) => {
        setEditingKit(kit);
        setFormName(kit.name);
        setFormDescription(kit.description || '');
        setFormItems(kit.items.map(i => ({ product_id: i.product_id.toString(), quantity: i.quantity })));
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingKit(null);
    };

    const addFormItem = () => {
        setFormItems([...formItems, { product_id: '', quantity: 1 }]);
    };

    const removeFormItem = (index) => {
        setFormItems(formItems.filter((_, i) => i !== index));
    };

    const updateFormItem = (index, field, value) => {
        const updated = [...formItems];
        updated[index] = { ...updated[index], [field]: value };
        setFormItems(updated);
    };

    const handleSubmit = async () => {
        if (!formName.trim()) {
            setStatus({ type: 'error', message: 'Kit-Name ist erforderlich' });
            return;
        }

        const validItems = formItems.filter(i => i.product_id && i.quantity >= 1);
        if (validItems.length === 0) {
            setStatus({ type: 'error', message: 'Mindestens ein Produkt mit Menge ≥ 1 ist erforderlich' });
            return;
        }

        setFormSaving(true);
        try {
            const payload = {
                name: formName.trim(),
                description: formDescription.trim(),
                items: validItems.map(i => ({ product_id: parseInt(i.product_id), quantity: parseInt(i.quantity) })),
            };

            const url = editingKit ? `/api/kits/${editingKit.id}` : '/api/kits';
            const method = editingKit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: editingKit ? `Kit "${data.name}" aktualisiert` : `Kit "${data.name}" erstellt` });
                closeForm();
                loadData();
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch {
            setStatus({ type: 'error', message: 'Verbindungsfehler' });
        }
        setFormSaving(false);
        setTimeout(() => setStatus(null), 4000);
    };

    const deleteKit = async (id, name) => {
        if (deleting === id) {
            try {
                const res = await fetch(`/api/kits/${id}`, { method: 'DELETE', credentials: 'include' });
                if (res.ok) {
                    setStatus({ type: 'success', message: `Kit "${name}" gelöscht` });
                    loadData();
                } else {
                    const data = await res.json();
                    setStatus({ type: 'error', message: data.error });
                }
            } catch {
                setStatus({ type: 'error', message: 'Fehler beim Löschen' });
            }
            setDeleting(null);
        } else {
            setDeleting(id);
            setTimeout(() => setDeleting(prev => prev === id ? null : prev), 3000);
        }
        setTimeout(() => setStatus(null), 4000);
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

    return (
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Boxes className="h-5 w-5 text-primary" />
                        Kit-Verwaltung
                    </div>
                    <Button size="sm" onClick={openCreateForm} className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Neues Kit
                    </Button>
                </CardTitle>
                <CardDescription>{kits.length} Kit{kits.length !== 1 ? 's' : ''} konfiguriert</CardDescription>
            </CardHeader>
            <CardContent>
                {status && (
                    <div className={`mb-4 flex items-center gap-2 p-3 rounded-lg ${status.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <span className="text-sm">{status.message}</span>
                    </div>
                )}

                {/* Create/Edit Form */}
                {showForm && (
                    <div className="mb-6 p-4 border border-primary/20 rounded-xl bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                            {editingKit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            {editingKit ? `"${editingKit.name}" bearbeiten` : 'Neues Kit erstellen'}
                        </h3>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                                    <Input
                                        placeholder="z.B. Raub-Kit"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Beschreibung (optional)</label>
                                    <Input
                                        placeholder="Kurze Beschreibung..."
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Items */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Produkte im Kit</label>
                                {formItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <Select
                                            value={item.product_id.toString()}
                                            onValueChange={(val) => updateFormItem(idx, 'product_id', val)}
                                        >
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Produkt wählen..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {products.map(p => (
                                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9 shrink-0"
                                                onClick={() => updateFormItem(idx, 'quantity', Math.max(1, (parseInt(item.quantity) || 1) - 1))}
                                            >
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateFormItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                className="w-16 text-center"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9 shrink-0"
                                                onClick={() => updateFormItem(idx, 'quantity', (parseInt(item.quantity) || 1) + 1)}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10"
                                            onClick={() => removeFormItem(idx)}
                                            disabled={formItems.length <= 1}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={addFormItem} className="gap-1.5 mt-1">
                                    <Plus className="h-3.5 w-3.5" />
                                    Produkt hinzufügen
                                </Button>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
                                <Button variant="ghost" size="sm" onClick={closeForm} disabled={formSaving}>
                                    Abbrechen
                                </Button>
                                <Button size="sm" onClick={handleSubmit} disabled={formSaving} className="gap-1.5">
                                    {formSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    {editingKit ? 'Speichern' : 'Kit erstellen'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Kits Table */}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Beschreibung</TableHead>
                                <TableHead>Inhalt</TableHead>
                                <TableHead className="text-right">Aktionen</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {kits.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                        <Boxes className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        Noch keine Kits angelegt
                                    </TableCell>
                                </TableRow>
                            ) : (
                                kits.map(kit => (
                                    <TableRow key={kit.id} className="group">
                                        <TableCell className="font-semibold">{kit.name}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {kit.description || <span className="italic">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {kit.items.map(item => (
                                                    <Badge key={item.id} variant="secondary" className="text-xs gap-1">
                                                        {item.quantity}× {item.product_name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => openEditForm(kit)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-8 w-8 transition-all ${deleting === kit.id
                                                        ? 'bg-destructive text-destructive-foreground opacity-100'
                                                        : 'text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10'
                                                    }`}
                                                    onClick={() => deleteKit(kit.id, kit.name)}
                                                    title={deleting === kit.id ? 'Nochmal klicken zum Bestätigen' : 'Löschen'}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}