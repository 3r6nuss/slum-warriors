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
import KitManagement from './KitManagement';
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

export default function ProductManagement() {
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);
    const [newName, setNewName] = useState('');
    const [newStackable, setNewStackable] = useState(true);
    const [newGreenThreshold, setNewGreenThreshold] = useState('10');
    const [newYellowThreshold, setNewYellowThreshold] = useState('1');
    const [addSuccess, setAddSuccess] = useState(null);
    
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(null);
    const [editingProduct, setEditingProduct] = useState(null); // { id, name }

    // Threshold editing state
    const [editingThreshold, setEditingThreshold] = useState(null); // product id
    const [thresholdValues, setThresholdValues] = useState({ green: '', yellow: '' });

    // Bulk threshold state
    const [bulkGreen, setBulkGreen] = useState('10');
    const [bulkYellow, setBulkYellow] = useState('1');
    const [bulkLoading, setBulkLoading] = useState(false);

    const loadData = async (resetSelection = false) => {
        try {
            const [prodRes, whRes, invRes] = await Promise.all([
                fetch('/api/products', { credentials: 'include' }),
                fetch('/api/inventory/warehouses/list', { credentials: 'include' }),
                fetch('/api/inventory', { credentials: 'include' })
            ]);

            if (prodRes.ok && whRes.ok && invRes.ok) {
                const prodData = await prodRes.json();
                const whData = await whRes.json();
                const invData = await invRes.json();

                const assignments = {};
                prodData.forEach(p => { assignments[p.id] = []; });
                invData.forEach(i => {
                    if (assignments[i.product_id]) {
                        if (!assignments[i.product_id].includes(i.warehouse_id)) {
                            assignments[i.product_id].push(i.warehouse_id);
                        }
                    }
                });

                const productsWithWarehouses = prodData.map(p => ({
                    ...p,
                    warehouseIds: assignments[p.id] || []
                }));

                setProducts(productsWithWarehouses);
                setWarehouses(whData);
                setSelectedWarehouses(prev => resetSelection || prev.length === 0 ? whData.map(w => w.id) : prev);
            }
        } catch (err) {
            console.error('Failed to load data', err);
        }
        setLoading(false);
    };

    useEffect(() => { loadData(true); }, []);

    const toggleWarehouse = (id) => {
        setSelectedWarehouses(prev =>
            prev.includes(id) ? prev.filter(wId => wId !== id) : [...prev, id]
        );
    };

    const resetNewProductForm = () => {
        setNewName('');
        setNewStackable(true);
        setNewGreenThreshold('10');
        setNewYellowThreshold('1');
        // keep selectedWarehouses as is to make adding multiple products easier
    };

    const addProduct = async () => {
        if (!newName.trim() || selectedWarehouses.length === 0) {
            if (selectedWarehouses.length === 0) {
                setStatus({ type: 'error', message: 'Bitte wähle mindestens ein Lager aus' });
            }
            return;
        }

        const green = parseInt(newGreenThreshold);
        const yellow = parseInt(newYellowThreshold);
        if (isNaN(green) || isNaN(yellow) || green < 0 || yellow < 0 || yellow >= green) {
             setStatus({ type: 'error', message: 'Ungültige Schwellwerte (Gelb muss < Grün sein, > 0).' });
             return;
        }

        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: newName.trim(),
                    warehouseIds: selectedWarehouses,
                    is_stackable: newStackable,
                    green_threshold: green,
                    yellow_threshold: yellow
                }),
            });
            const data = await res.json();
            if (res.ok) {
                // Flash success inline, keep focus, retain settings!
                setAddSuccess(`+ ${data.name}`);
                setTimeout(() => setAddSuccess(null), 2500);
                setNewName(''); // ready for next
                loadData();
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch {
            setStatus({ type: 'error', message: 'Verbindungsfehler' });
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
            } catch {
                setStatus({ type: 'error', message: 'Fehler beim Löschen' });
            }
            setDeleting(null);
        } else {
            setDeleting(id);
            setTimeout(() => setDeleting(prev => prev === id ? null : prev), 3000);
        }
    };

    const renameProduct = async (id, currentName) => {
        if (!editingProduct.name.trim() || editingProduct.name === currentName) {
            setEditingProduct(null);
            return;
        }

        try {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: editingProduct.name.trim() })
            });
            const data = await res.json();

            if (res.ok) {
                setStatus({ type: 'success', message: `Produkt umbenannt in "${data.name}"` });
                setEditingProduct(null);
                loadData();
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch {
            setStatus({ type: 'error', message: 'Fehler beim Neuordnen' });
        }
    };

    const moveProduct = async (index, direction) => {
        if (
            (direction === -1 && index === 0) ||
            (direction === 1 && index === products.length - 1)
        ) return;

        const newProducts = [...products];
        const temp = newProducts[index];
        newProducts[index] = newProducts[index + direction];
        newProducts[index + direction] = temp;

        const orderPayload = newProducts.map((p, i) => ({ id: p.id, sort_order: i }));
        setProducts(newProducts);

        try {
            const res = await fetch('/api/products/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ order: orderPayload })
            });
            if (!res.ok) throw new Error('Failed to save order');
        } catch {
            setStatus({ type: 'error', message: 'Fehler beim Speichern' });
            loadData();
        }
    };

    const toggleProductWarehouse = async (productId, warehouseId, currentWarehouseIds) => {
        const newWarehouseIds = currentWarehouseIds.includes(warehouseId)
            ? currentWarehouseIds.filter(id => id !== warehouseId)
            : [...currentWarehouseIds, warehouseId];

        if (newWarehouseIds.length === 0) {
            setStatus({ type: 'error', message: 'Ein Produkt muss mindestens einem Lager zugewiesen sein.' });
            return;
        }

        setProducts(products.map(p => p.id === productId ? { ...p, warehouseIds: newWarehouseIds } : p));

        try {
            const res = await fetch(`/api/products/${productId}/warehouses`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ warehouseIds: newWarehouseIds })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Fehler beim Speichern');
            }
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
            loadData();
        }
    };

    const assignSelectedWarehousesToProduct = async (productId) => {
        if (selectedWarehouses.length === 0) {
            setStatus({ type: 'error', message: 'Bitte wähle zuerst oben mindestens ein Lager aus.' });
            return;
        }

        // Optimistic update
        setProducts(products.map(p => p.id === productId ? { ...p, warehouseIds: selectedWarehouses } : p));

        try {
            const res = await fetch(`/api/products/${productId}/warehouses`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ warehouseIds: selectedWarehouses })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Fehler beim Speichern');
            }
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
            loadData();
        }
    };

    const bulkAssignWarehouses = async () => {
        if (selectedWarehouses.length === 0) {
            setStatus({ type: 'error', message: 'Bitte wähle mindestens ein Lager für die Massenzuweisung aus.' });
            return;
        }

        if (!confirm('Möchtest du wirklich ALLE Produkte den ausgewählten Lagern zuweisen? Fehlende Zuordnungen werden ergänzt.')) return;

        try {
            setStatus({ type: 'success', message: 'Massen-Zuweisung läuft...' });
            const res = await fetch('/api/products/bulk/warehouses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ warehouseIds: selectedWarehouses })
            });
            if (res.ok) {
                setStatus({ type: 'success', message: 'Alle Produkte wurden den ausgewählten Lagern zugewiesen.' });
                loadData();
            } else {
                const data = await res.json();
                setStatus({ type: 'error', message: data.error || 'Fehler bei der Massenzuweisung' });
            }
        } catch {
            setStatus({ type: 'error', message: 'Fehler bei der Massenzuweisung' });
        }
    };

    const toggleStackable = async (productId, currentValue) => {
        const newValue = !currentValue;
        // Optimistic update
        setProducts(products.map(p => p.id === productId ? { ...p, is_stackable: newValue ? 1 : 0 } : p));

        try {
            const res = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ is_stackable: newValue })
            });
            if (!res.ok) throw new Error('Fehler beim Speichern');
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
            loadData();
        }
    };

    // ── Threshold Handlers ──
    const openThresholdEditor = (product) => {
        setEditingThreshold(product.id);
        setThresholdValues({
            green: (product.green_threshold ?? 10).toString(),
            yellow: (product.yellow_threshold ?? 1).toString()
        });
    };

    const saveThreshold = async (productId) => {
        const green = parseInt(thresholdValues.green);
        const yellow = parseInt(thresholdValues.yellow);
        if (isNaN(green) || isNaN(yellow) || green < 0 || yellow < 0) {
            setStatus({ type: 'error', message: 'Schwellwerte müssen positive Zahlen sein.' });
            return;
        }
        if (yellow >= green) {
            setStatus({ type: 'error', message: 'Gelb-Schwellwert muss kleiner als Grün-Schwellwert sein.' });
            return;
        }
        setProducts(products.map(p => p.id === productId ? { ...p, green_threshold: green, yellow_threshold: yellow } : p));
        setEditingThreshold(null);
        try {
            const res = await fetch(`/api/products/${productId}/thresholds`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ green_threshold: green, yellow_threshold: yellow })
            });
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Fehler'); }
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
            loadData();
        }
    };

    const bulkSetThresholds = async () => {
        const green = parseInt(bulkGreen);
        const yellow = parseInt(bulkYellow);
        if (isNaN(green) || isNaN(yellow) || green < 0 || yellow < 0) {
            setStatus({ type: 'error', message: 'Schwellwerte müssen positive Zahlen sein.' });
            return;
        }
        if (yellow >= green) {
            setStatus({ type: 'error', message: 'Gelb-Schwellwert muss kleiner als Grün-Schwellwert sein.' });
            return;
        }
        setBulkLoading(true);
        try {
            const res = await fetch('/api/products/bulk/thresholds', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ green_threshold: green, yellow_threshold: yellow })
            });
            const data = await res.json();
            if (res.ok) { setStatus({ type: 'success', message: data.message }); loadData(); }
            else { setStatus({ type: 'error', message: data.error }); }
        } catch { setStatus({ type: 'error', message: 'Fehler bei der Massen-Aktualisierung.' }); }
        setBulkLoading(false);
    };

    // Helper: 3 traffic-light dots for a product
    const TrafficLight = ({ product, onClick }) => {
        const green = product.green_threshold ?? 10;
        const yellow = product.yellow_threshold ?? 1;
        return (
            <button onClick={onClick} className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg hover:bg-muted/60 transition-all group" title={`Ampel: Rot < ${yellow} ≤ Gelb < ${green} ≤ Grün`}>
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inset-0 rounded-full bg-red-500/60 group-hover:animate-ping" style={{ animationDuration: '2s' }} /><span className="relative rounded-full h-2.5 w-2.5 bg-red-500" /></span>
                <span className="relative flex h-2.5 w-2.5"><span className="relative rounded-full h-2.5 w-2.5 bg-amber-400" /></span>
                <span className="relative flex h-2.5 w-2.5"><span className="relative rounded-full h-2.5 w-2.5 bg-emerald-500" /></span>
                <span className="ml-1 text-[9px] font-mono text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">{yellow}/{green}</span>
            </button>
        );
    };

    // Helper: zone bar preview
    const ZoneBar = ({ green, yellow }) => {
        const total = Math.max(green * 1.3, 20);
        const yellowPct = Math.min((yellow / total) * 100, 100);
        const greenPct = Math.min((green / total) * 100, 100);
        return (
            <div className="relative h-2 w-full rounded-full overflow-hidden bg-muted/30 border border-border/30">
                <div className="absolute inset-0 flex">
                    <div className="h-full bg-gradient-to-r from-red-500/80 to-red-500/40" style={{ width: `${yellowPct}%` }} />
                    <div className="h-full bg-gradient-to-r from-amber-400/60 to-amber-400/30" style={{ width: `${greenPct - yellowPct}%` }} />
                    <div className="h-full bg-gradient-to-r from-emerald-500/50 to-emerald-500/20" style={{ width: `${100 - greenPct}%` }} />
                </div>
                <div className="absolute top-0 h-full w-px bg-amber-400" style={{ left: `${yellowPct}%` }} />
                <div className="absolute top-0 h-full w-px bg-emerald-500" style={{ left: `${greenPct}%` }} />
            </div>
        );
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

    return (
        <div className="space-y-6">
            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Produktverwaltung
                    </CardTitle>
                    <CardDescription>{products.length} Produkte registriert</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {status && (
                        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${status.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                            {status.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                            {status.message}
                            <button onClick={() => setStatus(null)} className="ml-auto text-current opacity-60 hover:opacity-100">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    {/* ── Speed-Add Row ── */}
                    <div className="p-4 rounded-xl border border-border/50 bg-muted/10 space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground pb-2 border-b border-border/50">
                            <Zap className="h-4 w-4 text-primary" />
                            Speed-Add (Schnellanlage)
                            <span className="ml-auto text-xs opacity-50 font-normal">Alle Einstellungen merken sich. Tippen + Enter!</span>
                        </div>

                        {/* Input Row */}
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1 max-w-[400px]">
                                <Input
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Produktname eingeben..."
                                    className="h-10 text-base shadow-sm pl-4 pr-12 bg-background focus-visible:ring-primary"
                                    onKeyDown={(e) => { if (e.key === 'Enter') addProduct(); }}
                                />
                                <Button 
                                    onClick={addProduct} 
                                    disabled={!newName.trim() || selectedWarehouses.length === 0}
                                    size="icon"
                                    className="absolute right-1 top-1 h-8 w-8"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            {addSuccess && (
                                <span className="text-sm font-medium text-emerald-500 animate-in fade-in slide-in-from-left-2">{addSuccess}</span>
                            )}

                            <Button
                                variant="secondary"
                                onClick={bulkAssignWarehouses}
                                disabled={selectedWarehouses.length === 0 || products.length === 0}
                                size="sm"
                                className="ml-auto gap-1.5 bg-primary/10 text-primary hover:bg-primary/20"
                                title="Alle existierenden Produkte den aktuell in der Speed-Add-Leiste ausgewählten Lagern zuweisen"
                            >
                                <Warehouse className="h-3.5 w-3.5" />
                                Massen-Zuweisung Lager
                            </Button>
                        </div>

                        {/* Settings Row (Sticky) */}
                        <div className="flex flex-wrap items-center gap-6 pt-2 bg-muted/30 p-3 rounded-lg border border-border/30">
                            {/* Warehouses */}
                            <div className="space-y-1.5 flex-1 min-w-[200px]">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Standard-Lager für neue Produkte</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {warehouses.map(w => (
                                        <button
                                            key={w.id}
                                            onClick={() => toggleWarehouse(w.id)}
                                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${selectedWarehouses.includes(w.id)
                                                ? w.type === 'leadership'
                                                    ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                                                    : 'bg-primary/15 text-primary border-primary/30'
                                                : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                                                }`}
                                        >
                                            {w.name}
                                        </button>
                                    ))}
                                </div>
                                {selectedWarehouses.length === 0 && <p className="text-[10px] text-destructive m-0 mt-1">Stopp! Bitte wähle mindestens ein Lager für die Zuweisung.</p>}
                            </div>

                            {/* Stackable */}
                            <div className="space-y-1.5 shrink-0 border-l border-border/50 pl-6 hidden sm:block">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Eigenschaften</label>
                                <div className="flex items-center gap-2 mt-1">
                                     <button
                                        onClick={() => setNewStackable(!newStackable)}
                                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <Layers className={`h-3.5 w-3.5 ${newStackable ? 'text-primary' : 'text-muted-foreground/50'}`} />
                                        <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${newStackable ? 'bg-primary' : 'bg-input'}`}>
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-background transition-transform ${newStackable ? 'translate-x-[14px]' : 'translate-x-[2px]'}`} />
                                        </span>
                                        {newStackable ? 'Stapelbar (Menge)' : 'Einzeln (1x)'}
                                    </button>
                                </div>
                            </div>

                            {/* Thresholds */}
                            <div className="space-y-1.5 shrink-0 border-l border-border/50 pl-6 hidden sm:block">
                                 <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Initiale Bestandsampel</label>
                                 <div className="flex items-center gap-2 mt-1">
                                     <div className="flex items-center gap-1.5" title="Ab Gelb">
                                         <span className="h-2 w-2 rounded-full bg-amber-400" />
                                         <Input type="number" min="0" value={newYellowThreshold} onChange={e => setNewYellowThreshold(e.target.value)} className="h-6 w-14 text-xs p-1 text-center bg-background" />
                                     </div>
                                     <div className="flex items-center gap-1.5" title="Ab Grün">
                                         <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                         <Input type="number" min="1" value={newGreenThreshold} onChange={e => setNewGreenThreshold(e.target.value)} className="h-6 w-14 text-xs p-1 text-center bg-background" />
                                     </div>
                                 </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Bestandsampel – Global Defaults ── */}
                    <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-r from-red-500/[0.03] via-amber-400/[0.03] to-emerald-500/[0.03] space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            </div>
                            Bestandsampel – Alle Produkte
                        </div>
                        <p className="text-xs text-muted-foreground/70">
                            Setze Standard-Schwellwerte für <strong>alle</strong> Produkte gleichzeitig. Individuelle Werte werden überschrieben.
                        </p>
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                                    Ab Gelb
                                </label>
                                <Input type="number" min="0" value={bulkYellow} onChange={(e) => setBulkYellow(e.target.value)} className="w-20 h-8 text-sm text-center bg-background" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    Ab Grün
                                </label>
                                <Input type="number" min="1" value={bulkGreen} onChange={(e) => setBulkGreen(e.target.value)} className="w-20 h-8 text-sm text-center bg-background" />
                            </div>
                            <div className="flex-1 min-w-[120px] max-w-[260px] pt-4">
                                <ZoneBar green={parseInt(bulkGreen) || 10} yellow={parseInt(bulkYellow) || 1} />
                                <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5 font-mono">
                                    <span>0 (Rot)</span>
                                    <span>{bulkYellow} (Gelb)</span>
                                    <span>{bulkGreen}+ (Grün)</span>
                                </div>
                            </div>
                            <Button size="sm" onClick={bulkSetThresholds} disabled={bulkLoading || !bulkGreen || !bulkYellow} className="gap-1.5 bg-gradient-to-r from-amber-500/80 to-emerald-500/80 hover:from-amber-500 hover:to-emerald-500 text-white border-0">
                                {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                                Für alle setzen
                            </Button>
                        </div>
                    </div>

                    {/* ── Product list ── */}
                    <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="w-[60px] text-center">Sort.</TableHead>
                                    <TableHead className="w-[30%]">Projekt / Name</TableHead>
                                    <TableHead>Lagerauswahl</TableHead>
                                    <TableHead>Eigenschaften</TableHead>
                                    <TableHead>Bestandsampel</TableHead>
                                    <TableHead className="text-right pr-4">Aktion</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <div className="text-center text-muted-foreground py-12">
                                                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                                <p>Noch keine Produkte vorhanden</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    products.map((p, index) => (
                                        <TableRow key={p.id} className="group hover:bg-muted/20">
                                            {/* Sort controls */}
                                            <TableCell className="p-2 py-3 align-top">
                                                <div className="flex flex-col items-center gap-0.5 mt-1">
                                                    <button
                                                        className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-20 disabled:cursor-default"
                                                        disabled={index === 0}
                                                        onClick={() => moveProduct(index, -1)}
                                                    >
                                                        <ArrowUp className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-20 disabled:cursor-default"
                                                        disabled={index === products.length - 1}
                                                        onClick={() => moveProduct(index, 1)}
                                                    >
                                                        <ArrowDown className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </TableCell>

                                            {/* Product name */}
                                            <TableCell className="p-2 py-3 align-top font-medium">
                                                <div className="flex flex-col mt-0.5">
                                                    {editingProduct?.id === p.id ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Input
                                                                value={editingProduct.name}
                                                                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                                                                className="h-7 text-sm bg-background max-w-[200px]"
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') renameProduct(p.id, p.name);
                                                                    if (e.key === 'Escape') setEditingProduct(null);
                                                                }}
                                                            />
                                                            <button className="p-1 rounded text-emerald-500 hover:bg-emerald-500/10 transition-colors" onClick={() => renameProduct(p.id, p.name)}>
                                                                <Check className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors" onClick={() => setEditingProduct(null)}>
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors py-0.5"
                                                            onClick={() => assignSelectedWarehousesToProduct(p.id)}
                                                            title="Klicken, um diesem Produkt die oben markierten Lager zuzuweisen"
                                                        >
                                                            <Package className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                                                            <span className="truncate">{p.name}</span>
                                                            <button
                                                                className="p-1 rounded text-muted-foreground/30 hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-all ml-1"
                                                                onClick={(e) => { e.stopPropagation(); setEditingProduct({ id: p.id, name: p.name }); }}
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <span className="font-mono text-[10px] text-muted-foreground/40 mt-1 ml-6">#{p.id}</span>
                                                </div>
                                            </TableCell>

                                            {/* Warehouse pills */}
                                            <TableCell className="p-2 py-3 align-top">
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                    {warehouses.map(w => {
                                                        const isAssigned = p.warehouseIds?.includes(w.id);
                                                        return (
                                                            <button
                                                                key={w.id}
                                                                onClick={() => toggleProductWarehouse(p.id, w.id, p.warehouseIds || [])}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all border ${isAssigned
                                                                    ? w.type === 'leadership'
                                                                        ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                                                                        : 'bg-primary/15 text-primary border-primary/30'
                                                                    : 'bg-transparent text-muted-foreground/40 border-border/30 hover:text-muted-foreground hover:border-border/50'
                                                                    }`}
                                                            >
                                                                {w.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </TableCell>

                                            {/* Stackable toggle */}
                                            <TableCell className="p-2 py-3 align-top">
                                                <button
                                                    onClick={() => toggleStackable(p.id, !!p.is_stackable)}
                                                    className="flex items-center gap-1.5 mt-0.5"
                                                    title={p.is_stackable ? 'Stackable – Menge wird gescannt' : 'Non-stackable – immer 1x'}
                                                >
                                                    <Layers className={`h-3.5 w-3.5 transition-colors ${p.is_stackable ? 'text-primary' : 'text-muted-foreground/30'}`} />
                                                    <span className={`relative inline-flex h-[18px] w-8 items-center rounded-full transition-colors ${p.is_stackable ? 'bg-primary' : 'bg-input'}`}>
                                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-background transition-transform ${p.is_stackable ? 'translate-x-[16px]' : 'translate-x-[3px]'}`} />
                                                    </span>
                                                </button>
                                            </TableCell>

                                            {/* Traffic Light indicator */}
                                            <TableCell className="p-2 py-3 align-top">
                                                <div className="flex flex-col gap-1 w-[160px] mt-0.5">
                                                    <TrafficLight product={p} onClick={() => editingThreshold === p.id ? setEditingThreshold(null) : openThresholdEditor(p)} />
                                                    {editingThreshold === p.id && (
                                                        <div className="mt-1.5 p-2 rounded-lg border border-border/50 bg-gradient-to-r from-red-500/[0.04] via-amber-400/[0.04] to-emerald-500/[0.04] shadow-sm animate-in zoom-in-95 duration-200">
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-[10px] font-bold uppercase text-amber-500 flex items-center gap-1 w-10">
                                                                        Gelb
                                                                    </label>
                                                                    <Input type="number" min="0" value={thresholdValues.yellow} onChange={(e) => setThresholdValues({ ...thresholdValues, yellow: e.target.value })} className="flex-1 h-6 text-xs text-center p-1 bg-background" onKeyDown={(e) => { if (e.key === 'Enter') saveThreshold(p.id); if (e.key === 'Escape') setEditingThreshold(null); }} autoFocus />
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-[10px] font-bold uppercase text-emerald-500 flex items-center gap-1 w-10">
                                                                        Grün
                                                                    </label>
                                                                    <Input type="number" min="1" value={thresholdValues.green} onChange={(e) => setThresholdValues({ ...thresholdValues, green: e.target.value })} className="flex-1 h-6 text-xs text-center p-1 bg-background" onKeyDown={(e) => { if (e.key === 'Enter') saveThreshold(p.id); if (e.key === 'Escape') setEditingThreshold(null); }} />
                                                                </div>
                                                                <div className="flex items-center justify-end gap-1 mt-1">
                                                                    <button className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-colors" onClick={() => saveThreshold(p.id)} title="Speichern">
                                                                        <Check className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <button className="p-1 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors" onClick={() => setEditingThreshold(null)} title="Abbrechen">
                                                                        <X className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Delete */}
                                            <TableCell className="p-2 py-3 align-top text-right pr-4">
                                                <button
                                                    onClick={() => deleteProduct(p.id, p.name)}
                                                    className={`p-1.5 rounded-lg transition-all mt-0.5 ${deleting === p.id
                                                        ? 'bg-destructive text-destructive-foreground'
                                                        : 'text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100'
                                                        }`}
                                                    title={deleting === p.id ? 'Nochmal klicken zum Löschen' : 'Löschen'}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Kit Management Integration */}
            <KitManagement />
        </div>
    );
}