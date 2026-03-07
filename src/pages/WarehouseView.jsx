import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useInventorySocket } from '@/lib/websocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Package, Shield, Warehouse, Settings, Save, X, Loader2,
    PackagePlus, PackageMinus, CheckCircle, AlertCircle
} from 'lucide-react';

const warehouseMeta = {
    1: { label: 'Führungslager', icon: Shield, type: 'leadership' },
    2: { label: 'Normales Lager', icon: Warehouse, type: 'normal' },
};

/* ─────────────────────── Transaction Dialog ─────────────────────── */
function TransactionDialog({ item, warehouseId, user, onClose }) {
    const [mode, setMode] = useState(null); // 'checkin' | 'checkout'
    const [quantity, setQuantity] = useState('');
    const [personName, setPersonName] = useState(user?.display_name || '');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!quantity || !personName || !mode) {
            setStatus({ type: 'error', message: 'Bitte alle Felder ausfüllen' });
            return;
        }
        const qty = parseInt(quantity);
        if (qty <= 0) {
            setStatus({ type: 'error', message: 'Menge muss größer als 0 sein' });
            return;
        }
        if (mode === 'checkout' && qty > item.quantity) {
            setStatus({ type: 'error', message: `Nicht genügend Bestand. Verfügbar: ${item.quantity}` });
            return;
        }

        setLoading(true);
        setStatus(null);
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouse_id: parseInt(warehouseId),
                    product_id: item.product_id,
                    person_name: personName,
                    type: mode,
                    quantity: qty,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                const label = mode === 'checkin' ? 'eingelagert' : 'ausgelagert';
                setStatus({ type: 'success', message: `${qty}x ${item.product_name} ${label}!` });
                setQuantity('');
                setMode(null);
                // Auto-close after short delay
                setTimeout(() => onClose(), 1200);
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch {
            setStatus({ type: 'error', message: 'Verbindungsfehler' });
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative z-10 w-full max-w-md rounded-2xl bg-card border border-border/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10">
                            <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">{item.product_name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm text-muted-foreground">Bestand:</span>
                                <Badge variant={item.quantity > 0 ? (item.quantity > 10 ? 'success' : 'warning') : 'destructive'}>
                                    {item.quantity}
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="p-5">
                    {!mode && !status ? (
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setMode('checkin')}
                                className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border/50 hover:border-success hover:bg-success/10 transition-colors duration-75"
                            >
                                <div className="p-3 rounded-full bg-success/10 group-hover:bg-success/20 transition-colors">
                                    <PackagePlus className="h-6 w-6 text-success" />
                                </div>
                                <span className="font-semibold text-sm">Einlagern</span>
                            </button>
                            <button
                                onClick={() => setMode('checkout')}
                                className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border/50 hover:border-primary hover:bg-primary/10 transition-colors duration-75"
                            >
                                <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                    <PackageMinus className="h-6 w-6 text-primary" />
                                </div>
                                <span className="font-semibold text-sm">Auslagern</span>
                            </button>
                        </div>
                    ) : status?.type === 'success' ? (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <div className="p-3 rounded-full bg-success/10">
                                <CheckCircle className="h-8 w-8 text-success" />
                            </div>
                            <p className="font-medium text-success">{status.message}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <button
                                    type="button"
                                    onClick={() => { setMode(null); setStatus(null); }}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    ← Zurück
                                </button>
                                <Badge variant={mode === 'checkin' ? 'success' : 'default'}>
                                    {mode === 'checkin' ? 'Einlagern' : 'Auslagern'}
                                </Badge>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="txn-person">Name</Label>
                                <Input
                                    id="txn-person"
                                    placeholder="Dein Name..."
                                    value={personName}
                                    onChange={(e) => setPersonName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="txn-quantity">Menge</Label>
                                <Input
                                    id="txn-quantity"
                                    type="number"
                                    min="1"
                                    max={mode === 'checkout' ? item.quantity : undefined}
                                    placeholder="Menge eingeben..."
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    autoFocus
                                />
                                {mode === 'checkout' && (
                                    <p className="text-xs text-muted-foreground">
                                        Maximal verfügbar: {item.quantity}
                                    </p>
                                )}
                            </div>

                            {status?.type === 'error' && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span className="text-sm font-medium">{status.message}</span>
                                </div>
                            )}

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Wird verarbeitet...
                                    </>
                                ) : (
                                    <>
                                        {mode === 'checkin' ? <PackagePlus className="h-4 w-4 mr-2" /> : <PackageMinus className="h-4 w-4 mr-2" />}
                                        {mode === 'checkin' ? 'Einlagern' : 'Auslagern'}
                                    </>
                                )}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────── Main Warehouse View ─────────────────────── */
export default function WarehouseView() {
    const { isAdmin, isLeadership, user } = useAuth();
    const { inventory, connected } = useInventorySocket();

    const [activeWarehouse, setActiveWarehouse] = useState('2'); // default: Normales Lager
    const [selectedItem, setSelectedItem] = useState(null);

    // Inline edit state (for admins/leadership)
    const [isEditing, setIsEditing] = useState(false);
    const [edits, setEdits] = useState({});
    const [personName, setPersonName] = useState(user?.display_name || '');
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editStatus, setEditStatus] = useState(null);

    const [quickStatus, setQuickStatus] = useState(null);

    const warehouseId = activeWarehouse;

    const warehouseItems = useMemo(() => {
        return inventory.filter(i => i.warehouse_id === parseInt(warehouseId));
    }, [inventory, warehouseId]);

    const meta = warehouseMeta[warehouseId] || { label: 'Lager', icon: Warehouse, type: 'normal' };
    const Icon = meta.icon;

    // Refresh selected item data when inventory updates
    useEffect(() => {
        if (selectedItem) {
            const updated = warehouseItems.find(i => i.product_id === selectedItem.product_id);
            if (updated) setSelectedItem(updated);
        }
    }, [warehouseItems]);

    const handleEditToggle = () => {
        if (!isEditing) {
            const initialEdits = {};
            warehouseItems.forEach(item => {
                initialEdits[item.product_id] = item.quantity.toString();
            });
            setEdits(initialEdits);
            setEditStatus(null);
        }
        setIsEditing(!isEditing);
    };

    const handleQuickTransaction = async (e, item, amount) => {
        if (e) e.stopPropagation();
        if (amount === 0 || isNaN(amount)) return;

        const qty = Math.abs(amount);
        const type = amount > 0 ? 'checkin' : 'checkout';

        if (type === 'checkout' && qty > item.quantity) {
            setQuickStatus({ type: 'error', message: `Nicht genügend Bestand für ${item.product_name}.` });
            setTimeout(() => setQuickStatus(null), 3000);
            return;
        }

        const pName = user?.display_name || user?.username || 'Unbekannt';

        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouse_id: parseInt(warehouseId),
                    product_id: item.product_id,
                    person_name: pName,
                    type: type,
                    quantity: qty,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setQuickStatus({ type: 'error', message: data.error || 'Fehler beim Buchen.' });
            } else {
                setQuickStatus({ type: 'success', message: `${qty}x ${item.product_name} ${type === 'checkin' ? 'eingelagert' : 'ausgelagert'}!` });
            }
        } catch {
            setQuickStatus({ type: 'error', message: 'Verbindungsfehler' });
        }

        setTimeout(() => setQuickStatus(null), 3000);
    };

    const handleSave = async () => {
        if (!personName) {
            setEditStatus({ type: 'error', message: 'Bitte gib deinen Namen an.' });
            return;
        }

        const changesToMake = warehouseItems.filter(item => {
            const newVal = edits[item.product_id];
            return newVal !== undefined && newVal !== '' && parseInt(newVal) !== item.quantity;
        }).map(item => ({
            product_id: item.product_id,
            new_quantity: parseInt(edits[item.product_id])
        }));

        if (changesToMake.length === 0) {
            setEditStatus({ type: 'error', message: 'Keine Änderungen vorgenommen.' });
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        setEditStatus(null);

        try {
            const res = await fetch('/api/adjustments/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouse_id: parseInt(warehouseId),
                    person_name: personName,
                    reason: reason || undefined,
                    changes: changesToMake
                }),
            });
            const data = await res.json();

            if (res.ok) {
                setEditStatus({ type: 'success', message: data.message });
                setIsEditing(false);
                setReason('');
            } else {
                setEditStatus({ type: 'error', message: data.error || 'Fehler beim Speichern.' });
            }
        } catch (err) {
            setEditStatus({ type: 'error', message: 'Verbindungsfehler.' });
        }

        setIsSaving(false);
    };

    const availableWarehouses = isLeadership
        ? [
            { id: '2', label: 'Normales Lager', icon: Warehouse },
            { id: '1', label: 'Führungslager', icon: Shield },
        ]
        : [{ id: '2', label: 'Normales Lager', icon: Warehouse }];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${meta.type === 'leadership' ? 'bg-primary/10' : 'bg-secondary'}`}>
                        <Icon className={`h-7 w-7 ${meta.type === 'leadership' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Lager</h1>
                        <p className="text-muted-foreground mt-0.5">
                            {warehouseItems.length} Produkte im Bestand
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                    <span className="text-sm text-muted-foreground">
                        {connected ? 'Live' : 'Verbindung getrennt'}
                    </span>
                </div>
            </div>

            {/* Warehouse Tabs (only if leadership has multiple) */}
            {availableWarehouses.length > 1 && (
                <div className="flex gap-2">
                    {availableWarehouses.map((wh) => {
                        const WhIcon = wh.icon;
                        const isActive = activeWarehouse === wh.id;
                        return (
                            <button
                                key={wh.id}
                                onClick={() => { setActiveWarehouse(wh.id); setIsEditing(false); setEditStatus(null); }}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                                    }`}
                            >
                                <WhIcon className="h-4 w-4" />
                                {wh.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Inventory Table */}
            <Card className="overflow-hidden backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader className="pb-3 flex flex-row items-baseline justify-between">
                    <div>
                        <CardTitle className="text-lg">Lagerbestand</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Tippe auf ein Produkt zum Ein- oder Auslagern
                        </p>
                        {editStatus && (
                            <p className={`text-sm mt-1 font-medium ${editStatus.type === 'error' ? 'text-destructive' : 'text-success'}`}>
                                {editStatus.message}
                            </p>
                        )}
                        {quickStatus && !isEditing && (
                            <p className={`text-sm mt-1 font-medium ${quickStatus.type === 'error' ? 'text-destructive' : 'text-success'}`}>
                                {quickStatus.message}
                            </p>
                        )}
                    </div>
                    {(isAdmin || isLeadership) && (
                        <div className="flex gap-2 relative top-2">
                            {!isEditing ? (
                                <Button variant="outline" size="sm" onClick={handleEditToggle}>
                                    <Settings className="h-4 w-4 mr-2" />
                                    Bearbeiten
                                </Button>
                            ) : (
                                <>
                                    <Button variant="ghost" size="sm" onClick={handleEditToggle} disabled={isSaving}>
                                        <X className="h-4 w-4 mr-2" />
                                        Abbrechen
                                    </Button>
                                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                        Speichern
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
                        {warehouseItems.map((item) => (
                            <div
                                key={item.id}
                                className={`group relative flex flex-col p-4 rounded-xl border transition-all duration-200 ${!isEditing
                                    ? 'cursor-pointer border-border/50 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md'
                                    : 'border-border/50 bg-card'
                                    }`}
                                onClick={() => {
                                    if (!isEditing) setSelectedItem(item);
                                }}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className={`p-2 rounded-lg transition-colors ${!isEditing ? 'bg-secondary group-hover:bg-primary/10' : 'bg-secondary'}`}>
                                        <Package className={`h-5 w-5 ${!isEditing ? 'text-muted-foreground group-hover:text-primary' : 'text-muted-foreground'}`} />
                                    </div>
                                    {!isEditing && (
                                        <Badge variant={item.quantity > 0 ? (item.quantity > 10 ? 'success' : 'warning') : 'destructive'}>
                                            {item.quantity}
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex-1">
                                    <h3 className={`font-semibold text-sm line-clamp-2 ${!isEditing ? 'group-hover:text-primary transition-colors' : ''}`}>
                                        {item.product_name}
                                    </h3>
                                </div>

                                {!isEditing && (
                                    <div
                                        className="mt-3 pt-3 border-t border-border/20 flex items-center justify-between gap-1.5"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 w-9 p-0 shrink-0 text-primary border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors"
                                            onClick={(e) => handleQuickTransaction(e, item, -1)}
                                            disabled={item.quantity <= 0}
                                            title="1 Auslagern"
                                        >
                                            -1
                                        </Button>

                                        <div className="flex-1 relative">
                                            <Input
                                                className="h-8 text-center text-xs px-1 bg-secondary/30 focus:bg-background transition-colors"
                                                placeholder="± Zahl ↵"
                                                title="Zahl eingeben und Enter drücken (+ für Einlagern, - für Auslagern)"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const val = parseInt(e.currentTarget.value);
                                                        if (!isNaN(val) && val !== 0) {
                                                            handleQuickTransaction(e, item, val);
                                                            e.currentTarget.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 w-9 p-0 shrink-0 text-success border-success/20 hover:bg-success/10 hover:text-success transition-colors"
                                            onClick={(e) => handleQuickTransaction(e, item, 1)}
                                            title="1 Einlagern"
                                        >
                                            +1
                                        </Button>
                                    </div>
                                )}

                                {isEditing && (
                                    <div className="mt-3 pt-3 border-t border-border/50">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs text-muted-foreground">Bestand:</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={edits[item.product_id] || ''}
                                                onChange={(e) => setEdits({ ...edits, [item.product_id]: e.target.value })}
                                                className="w-20 text-right h-8 text-sm"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {warehouseItems.length === 0 && (
                        <div className="text-center text-muted-foreground py-12 border-2 border-dashed border-border/50 rounded-xl mt-4">
                            <Package className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                            <p>Keine Produkte im Lager</p>
                        </div>
                    )}

                    {isEditing && (
                        <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-4 border border-border/50">
                            <h3 className="font-semibold text-sm">Bestätigung & Grund</h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="editPersonName">Dein Name *</Label>
                                    <Input
                                        id="editPersonName"
                                        placeholder="Wer macht die Anpassung?"
                                        value={personName}
                                        onChange={(e) => setPersonName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="editReason">Grund</Label>
                                    <Input
                                        id="editReason"
                                        placeholder="Optional (z.B. Inventur)"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Transaction Dialog */}
            {selectedItem && (
                <TransactionDialog
                    item={selectedItem}
                    warehouseId={warehouseId}
                    user={user}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
}
