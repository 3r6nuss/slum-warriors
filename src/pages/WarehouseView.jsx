import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useInventorySocket } from '@/lib/websocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Package, Shield, Warehouse, Settings, Save, X, Loader2,
    PackagePlus, PackageMinus, CheckCircle, AlertCircle, GripHorizontal, ScanLine,
    ArrowDownToLine, ArrowUpToLine, Search, Plus
} from 'lucide-react';

const InventoryScanner = React.lazy(() => import('@/components/InventoryScanner'));

const warehouseMeta = {
    1: { label: 'Führungslager', icon: Shield, type: 'leadership' },
    2: { label: 'Normales Lager', icon: Warehouse, type: 'normal' },
    3: { label: 'Waffenlager', icon: Warehouse, type: 'normal' },
    4: { label: 'Führungswaffenlager', icon: Shield, type: 'leadership' },
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
            setStatus({ type: 'error', message: `Maximal ${item.quantity} verfügbar` });
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
                // This line was added by the user's instruction, but it's problematic as setSelectedItem is not available here.
                // I'm commenting it out to maintain syntactical correctness and avoid runtime errors.
                // setSelectedItem(item);
                setTimeout(() => document.getElementById('qty-input')?.focus(), 50);
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch {
            setStatus({ type: 'error', message: 'Verbindungsfehler' });
        }
        setLoading(false);
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        {item.product_name}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-2">
                    {status && (
                        <div className={`p-3 rounded-lg mb-4 text-sm font-medium border ${status.type === 'error'
                            ? 'bg-destructive/10 text-destructive border-destructive/20'
                            : 'bg-success/10 text-success border-success/20'
                            }`}>
                            {status.message}
                        </div>
                    )}

                    {!mode ? (
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setMode('checkin')}
                                className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all group"
                            >
                                <div className="p-3 rounded-full bg-primary/20 group-hover:scale-110 transition-transform">
                                    <ArrowDownToLine className="h-6 w-6 text-primary" />
                                </div>
                                <span className="font-semibold">Einlagern</span>
                            </button>

                            <button
                                onClick={() => setMode('checkout')}
                                disabled={item.quantity === 0}
                                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all group ${item.quantity === 0
                                    ? 'border-muted bg-muted/30 opacity-50 cursor-not-allowed'
                                    : 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive/50'
                                    }`}
                            >
                                <div className={`p-3 rounded-full transition-transform ${item.quantity === 0 ? 'bg-muted' : 'bg-destructive/20 group-hover:scale-110'
                                    }`}>
                                    <ArrowUpToLine className={`h-6 w-6 ${item.quantity === 0 ? 'text-muted-foreground' : 'text-destructive'}`} />
                                </div>
                                <span className={`font-semibold ${item.quantity === 0 ? 'text-muted-foreground' : ''}`}>Auslagern</span>
                                {item.quantity === 0 && (
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Leer</span>
                                )}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border border-border/50">
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

                            <Button
                                type="submit"
                                className={`w-full ${mode === 'checkin' ? 'bg-success hover:bg-success/90 text-success-foreground' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'}`}
                                disabled={loading}
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {mode === 'checkin' ? 'Einlagern bestätigen' : 'Auslagern bestätigen'}
                            </Button>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ─────────────────────── Main Warehouse View ─────────────────────── */
export default function WarehouseView() {
    const { isAdmin, isLeadership, user } = useAuth();
    const { inventory, connected } = useInventorySocket();
    const { id } = useParams();
    const warehouseId = id || '2'; // Default to "Normales Lager"

    const meta = warehouseMeta[warehouseId] || { label: 'Lager', icon: Warehouse, type: 'normal' };

    const [selectedItem, setSelectedItem] = useState(null);

    // Inline edit state (for admins/leadership)
    const [isEditing, setIsEditing] = useState(false);
    const [edits, setEdits] = useState({});
    const [personName, setPersonName] = useState(user?.display_name || '');
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editStatus, setEditStatus] = useState(null);

    const [quickStatus, setQuickStatus] = useState(null);
    const [showScanner, setShowScanner] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef(null);

    // Inline product creation state
    const [isCreatingProduct, setIsCreatingProduct] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [createProductLoading, setCreateProductLoading] = useState(false);
    const [createProductStatus, setCreateProductStatus] = useState(null);

    // Keyboard shortcut: "/" or "^" toggles search focus, Escape blurs
    useEffect(() => {
        const handleKeyDown = (e) => {
            // "/" or "^" (Dead key on German keyboard) to toggle search
            if (e.key === '/' || e.key === '^' || (e.key === 'Dead' && e.code === 'Backquote')) {
                e.preventDefault();
                // Toggle: if already focused in search, blur out; otherwise focus in
                if (document.activeElement === searchRef.current) {
                    searchRef.current?.blur();
                } else if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                    searchRef.current?.focus();
                }
            }
            if (e.key === 'Escape' && document.activeElement === searchRef.current) {
                if (searchQuery) setSearchQuery('');
                searchRef.current?.blur();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [searchQuery]);

    // Local state for optimistic drag & drop reordering
    const [draggedIdx, setDraggedIdx] = useState(null);

    const warehouseItems = useMemo(() => {
        return inventory.filter(i => i.warehouse_id === parseInt(warehouseId));
    }, [inventory, warehouseId]);

    // Derived state for local items during drag
    // We only use the local dragging state if draggedIdx is active (isEditing blocks drag start)
    const [draggingOrder, setDraggingOrder] = useState(null);

    // Instead of syncing local state in an effect, we calculate the rendered items layout directly.
    // When not dragging, it just uses warehouseItems. When dragging, we maintain the reordered state.
    const localItems = useMemo(() => {
        if (draggedIdx !== null && draggingOrder) {
            return draggingOrder;
        }
        return warehouseItems;
    }, [warehouseItems, draggedIdx, draggingOrder]);

    // Filtered items based on search query
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return localItems;
        const q = searchQuery.toLowerCase().trim();
        return localItems.filter(item =>
            item.product_name.toLowerCase().includes(q)
        );
    }, [localItems, searchQuery]);

    // Autocomplete suggestion: first item that STARTS with the query
    const autocompleteSuggestion = useMemo(() => {
        if (!searchQuery.trim() || filteredItems.length === 0) return '';
        const q = searchQuery.toLowerCase().trim();
        const startsWithMatch = filteredItems.find(item =>
            item.product_name.toLowerCase().startsWith(q)
        );
        return startsWithMatch ? startsWithMatch.product_name : '';
    }, [searchQuery, filteredItems]);

    // Inline product creation handler
    const handleCreateProduct = useCallback(async () => {
        const name = newProductName.trim();
        if (!name) return;

        setCreateProductLoading(true);
        setCreateProductStatus(null);

        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name,
                    warehouseIds: [parseInt(warehouseId)],
                    is_stackable: true,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setCreateProductStatus({ type: 'success', message: `"${name}" wurde angelegt!` });
                setNewProductName('');
                setIsCreatingProduct(false);
                // Keep search so user sees the new product appear via websocket
            } else {
                setCreateProductStatus({ type: 'error', message: data.error || 'Fehler beim Anlegen.' });
            }
        } catch {
            setCreateProductStatus({ type: 'error', message: 'Verbindungsfehler.' });
        }

        setCreateProductLoading(false);
        setTimeout(() => setCreateProductStatus(null), 4000);
    }, [newProductName, warehouseId]);

    // We use derived state instead of an effect to initialize draggingOrder
    // If draggedIdx is active but we have no dragging order yet, initialize it
    // If dragging order is active but draggedIdx is null, it means we finished
    // We update state inside event handlers instead.

    // Refresh selected item data when inventory updates
    // Use derived state for selectedItem instead of syncing it with an effect


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
        } catch {
            setEditStatus({ type: 'error', message: 'Verbindungsfehler.' });
        }

        setIsSaving(false);
    };

    /* --- Drag & Drop Handlers --- */
    const handleDragStart = (e, index) => {
        if (isEditing) {
            e.preventDefault();
            return;
        }
        setDraggedIdx(index);
        // This is necessary for Firefox
        e.dataTransfer.setData('text/plain', index);
        e.dataTransfer.effectAllowed = 'move';

        // Optional: Make the drag image a bit transparent
        requestAnimationFrame(() => {
            e.target.style.opacity = '0.5';
        });
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedIdx === null || draggedIdx === index) return;

        // Optimistically update the list order during drag
        setDraggingOrder((prevItems) => {
            const currentList = prevItems || warehouseItems;
            const newItems = [...currentList];
            const draggedItem = newItems.splice(draggedIdx, 1)[0];
            newItems.splice(index, 0, draggedItem);
            return newItems;
        });

        setDraggedIdx(index);
    };

    const handleDragEnd = async (e) => {
        e.target.style.opacity = '1';

        if (draggedIdx === null) return;

        // 1. Prepare payload based on the new final sorted localItems
        const currentItems = [...localItems];
        const orderPayload = currentItems.map((item, idx) => ({
            product_id: item.product_id,
            sort_order: idx
        }));

        setDraggedIdx(null); // Reset drag state

        // 2. Send to backend
        try {
            const res = await fetch(`/api/inventory/${warehouseId}/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ order: orderPayload })
            });

            if (!res.ok) {
                setQuickStatus({ type: 'error', message: 'Sortierung konnte nicht gespeichert werden.' });
                setTimeout(() => setQuickStatus(null), 3000);
            }
        } catch (err) {
            console.error('Failed to save reorder', err);
        }
    };

    if (!meta) {
        return <Navigate to="/lager/2" replace />;
    }

    // Authorization check for leadership warehouses
    if (meta.type === 'leadership' && !isLeadership) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Shield className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold mb-2">Zugriff verweigert</h2>
                <p className="text-muted-foreground">Dieser Bereich ist nur für die Führungsebene zugänglich.</p>
            </div>
        );
    }

    const Icon = meta.icon;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${meta.type === 'leadership' ? 'bg-primary/10' : 'bg-secondary'}`}>
                        <Icon className={`h-7 w-7 ${meta.type === 'leadership' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{meta.label}</h1>
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

            <div className="mt-8">
                {/* Inventory Area */}
                <div className="flex-1 min-w-0">
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
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowScanner(true)}
                                        className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
                                    >
                                        <ScanLine className="h-4 w-4 mr-2" />
                                        Scanner
                                    </Button>
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
                            {/* Search Bar with Autocomplete */}
                            <div className="relative mt-2 mb-4">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                </div>
                                {/* Ghost text autocomplete hint */}
                                {autocompleteSuggestion && searchQuery && (
                                    <div className="absolute inset-y-0 left-0 pl-9 flex items-center pointer-events-none">
                                        <span className="text-muted-foreground/30 text-sm">
                                            {autocompleteSuggestion}
                                        </span>
                                    </div>
                                )}
                                <Input
                                    ref={searchRef}
                                    id="warehouse-search"
                                    placeholder='Produkt suchen... (drücke "/")'
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value.replace(/\^/g, ''))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Tab' && filteredItems.length > 0 && searchQuery.trim()) {
                                            e.preventDefault();
                                            // Autocomplete the name if we have a suggestion
                                            if (autocompleteSuggestion) {
                                                setSearchQuery(autocompleteSuggestion);
                                            }
                                            // Focus the first filtered item's quantity input
                                            const firstItemId = filteredItems[0]?.product_id;
                                            if (firstItemId) {
                                                const input = document.querySelector(`[data-quick-input="${firstItemId}"]`);
                                                if (input) {
                                                    input.focus();
                                                    input.select();
                                                }
                                            }
                                        }
                                    }}
                                    className="pl-9 pr-9 bg-secondary/30 border-border/50 focus:bg-background transition-colors relative z-10 bg-transparent"
                                    style={{ caretColor: 'var(--foreground)' }}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors z-20"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                                {searchQuery.trim() && filteredItems.length > 0 && (
                                    <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
                                        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border/50 bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                                            Tab ⇥
                                        </kbd>
                                    </div>
                                )}
                            </div>

                            {/* Create Product Status */}
                            {createProductStatus && (
                                <div className={`p-3 rounded-lg mb-4 text-sm font-medium border ${
                                    createProductStatus.type === 'error'
                                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                                        : 'bg-success/10 text-success border-success/20'
                                }`}>
                                    {createProductStatus.message}
                                </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                                {filteredItems.map((item, index) => (
                                    <div
                                        key={item.id}
                                        draggable={!isEditing}
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragEnd={handleDragEnd}
                                        className={`group relative flex flex-col p-2.5 rounded-lg border transition-all duration-200 ${!isEditing
                                            ? 'cursor-grab active:cursor-grabbing border-border/50 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md'
                                            : 'border-border/50 bg-card cursor-default'
                                            } ${index === 0 && searchQuery.trim() ? 'ring-2 ring-primary/40 border-primary/50 bg-primary/5' : ''}`}
                                        style={{
                                            opacity: draggedIdx === index ? 0.5 : 1,
                                            transform: draggedIdx === index ? 'scale(0.98)' : 'scale(1)',
                                        }}
                                        onClick={() => {
                                            if (!isEditing) setSelectedItem(item);
                                        }}
                                    >
                                        {!isEditing && (
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none">
                                                <GripHorizontal className="h-4 w-4" />
                                            </div>
                                        )}
                                        {!isEditing && (
                                            <div className="flex justify-end mb-1">
                                            <Badge variant={item.quantity >= (item.green_threshold ?? 10) ? 'success' : item.quantity >= (item.yellow_threshold ?? 1) ? 'warning' : 'destructive'} className="px-1.5 py-0 text-[10px] h-5">
                                                    {item.quantity}
                                                </Badge>
                                            </div>
                                        )}

                                        <div className="flex-1 mb-1">
                                            <h3 className={`font-semibold text-xs leading-tight line-clamp-2 ${!isEditing ? 'group-hover:text-primary transition-colors' : ''}`}>
                                                {item.product_name}
                                            </h3>
                                        </div>

                                        {!isEditing && (
                                            <div
                                                className="mt-2 pt-2 border-t border-border/20 flex items-center justify-between gap-1"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 w-8 p-0 shrink-0 text-primary border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors text-[11px]"
                                                    onClick={(e) => handleQuickTransaction(e, item, -1)}
                                                    disabled={item.quantity <= 0}
                                                    title="1 Auslagern"
                                                >
                                                    -1
                                                </Button>

                                                <div className="flex-1 relative">
                                                    <Input
                                                        data-quick-input={item.product_id}
                                                        className="h-7 text-center text-[10px] px-1 bg-secondary/30 focus:bg-background transition-colors"
                                                        placeholder="± Zahl ↵"
                                                        title="Zahl eingeben und Enter drücken (+ für Einlagern, - für Auslagern)"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                const val = parseInt(e.currentTarget.value);
                                                                if (!isNaN(val) && val !== 0) {
                                                                    handleQuickTransaction(e, item, val);
                                                                    e.currentTarget.value = '';
                                                                    // Refocus search for next item
                                                                    setTimeout(() => {
                                                                        searchRef.current?.focus();
                                                                        searchRef.current?.select();
                                                                    }, 50);
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 w-8 p-0 shrink-0 text-success border-success/20 hover:bg-success/10 hover:text-success transition-colors text-[11px]"
                                                    onClick={(e) => handleQuickTransaction(e, item, 1)}
                                                    title="1 Einlagern"
                                                >
                                                    +1
                                                </Button>
                                            </div>
                                        )}

                                        {isEditing && (
                                            <div className="mt-2 pt-2 border-t border-border/50">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-[11px] text-muted-foreground">Bestand:</span>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        value={edits[item.product_id] || ''}
                                                        onChange={(e) => setEdits({ ...edits, [item.product_id]: e.target.value })}
                                                        className="w-16 text-right h-7 text-xs px-2"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* No results / Empty state + Inline Product Creation */}
                            {filteredItems.length === 0 && (
                                <div className="text-center text-muted-foreground py-10 border-2 border-dashed border-border/50 rounded-xl mt-4">
                                    {searchQuery.trim() ? (
                                        <>
                                            <Search className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                                            <p className="font-medium">Kein Produkt gefunden für "{searchQuery}"</p>
                                            <p className="text-sm mt-1 text-muted-foreground/70">Möchtest du es anlegen?</p>

                                            {!isCreatingProduct ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-4 border-primary/30 text-primary hover:bg-primary/10"
                                                    onClick={() => {
                                                        setNewProductName(searchQuery.trim());
                                                        setIsCreatingProduct(true);
                                                    }}
                                                >
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    "{searchQuery.trim()}" anlegen
                                                </Button>
                                            ) : (
                                                <form
                                                    onSubmit={(e) => { e.preventDefault(); handleCreateProduct(); }}
                                                    className="mt-4 max-w-sm mx-auto space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
                                                >
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor="new-product-name" className="text-xs text-left block">Produktname</Label>
                                                        <Input
                                                            id="new-product-name"
                                                            value={newProductName}
                                                            onChange={(e) => setNewProductName(e.target.value)}
                                                            placeholder="Produktname..."
                                                            autoFocus
                                                            className="text-center"
                                                        />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground/60">
                                                        Wird im <strong>{meta.label}</strong> angelegt
                                                    </p>
                                                    <div className="flex gap-2 justify-center">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => { setIsCreatingProduct(false); setCreateProductStatus(null); }}
                                                            disabled={createProductLoading}
                                                        >
                                                            Abbrechen
                                                        </Button>
                                                        <Button
                                                            type="submit"
                                                            size="sm"
                                                            className="bg-primary hover:bg-primary/90"
                                                            disabled={createProductLoading || !newProductName.trim()}
                                                        >
                                                            {createProductLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                            <Plus className="h-4 w-4 mr-1" />
                                                            Anlegen
                                                        </Button>
                                                    </div>
                                                </form>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Package className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                                            <p>Keine Produkte im Lager</p>
                                        </>
                                    )}
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
                </div>

                {/* Transaction Dialog */}
                {selectedItem && (
                    <TransactionDialog
                        item={selectedItem}
                        warehouseId={warehouseId}
                        user={user}
                        onClose={() => setSelectedItem(null)}
                    />
                )}

                {/* Inventory Scanner Overlay */}
                {showScanner && (
                    <Suspense fallback={
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    }>
                        <InventoryScanner
                            warehouseItems={warehouseItems}
                            warehouseId={warehouseId}
                            user={user}
                            onClose={() => setShowScanner(false)}
                        />
                    </Suspense>
                )}
            </div>
        </div>
    );
}
