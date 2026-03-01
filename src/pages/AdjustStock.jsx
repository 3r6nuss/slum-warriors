import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectOption } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, CheckCircle, AlertCircle, ArrowUp, ArrowDown, Minus } from 'lucide-react';

export default function AdjustStock() {
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [adjustments, setAdjustments] = useState([]);
    const [warehouseId, setWarehouseId] = useState('');
    const [productId, setProductId] = useState('');
    const [newQuantity, setNewQuantity] = useState('');
    const [personName, setPersonName] = useState('');
    const [reason, setReason] = useState('');
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadData = () => {
        fetch('/api/inventory/warehouses/list').then(r => r.json()).then(setWarehouses);
        fetch('/api/products').then(r => r.json()).then(setProducts);
        fetch('/api/inventory').then(r => r.json()).then(setInventory);
        fetch('/api/adjustments').then(r => r.json()).then(setAdjustments);
    };

    useEffect(loadData, []);

    const currentStock = useMemo(() => {
        if (!warehouseId || !productId) return null;
        const item = inventory.find(
            i => i.warehouse_id === parseInt(warehouseId) && i.product_id === parseInt(productId)
        );
        return item ? item.quantity : 0;
    }, [warehouseId, productId, inventory]);

    const difference = useMemo(() => {
        if (currentStock === null || newQuantity === '') return null;
        return parseInt(newQuantity) - currentStock;
    }, [currentStock, newQuantity]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!warehouseId || !productId || newQuantity === '' || !personName) {
            setStatus({ type: 'error', message: 'Bitte alle Pflichtfelder ausfüllen' });
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/adjustments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouse_id: parseInt(warehouseId),
                    product_id: parseInt(productId),
                    new_quantity: parseInt(newQuantity),
                    person_name: personName,
                    reason: reason || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: `Bestand angepasst: ${data.oldQuantity} → ${data.newQuantity} (${data.difference >= 0 ? '+' : ''}${data.difference})` });
                setNewQuantity('');
                setReason('');
                setProductId('');
                loadData();
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Verbindungsfehler' });
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <Settings className="h-8 w-8 text-primary" />
                    Bestand anpassen
                </h1>
                <p className="text-muted-foreground mt-1">Lagerbestände manuell korrigieren</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Form */}
                <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                    <CardHeader>
                        <CardTitle>Manuelle Anpassung</CardTitle>
                        <CardDescription>Bestand direkt setzen – wird protokolliert</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="person">Name</Label>
                                <Input
                                    id="person"
                                    placeholder="Dein Name..."
                                    value={personName}
                                    onChange={(e) => setPersonName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="warehouse">Lager</Label>
                                <Select id="warehouse" value={warehouseId} onValueChange={setWarehouseId}>
                                    <SelectOption value="">Lager auswählen...</SelectOption>
                                    {warehouses.map(w => (
                                        <SelectOption key={w.id} value={String(w.id)}>{w.name}</SelectOption>
                                    ))}
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="product">Produkt</Label>
                                <Select id="product" value={productId} onValueChange={setProductId}>
                                    <SelectOption value="">Produkt auswählen...</SelectOption>
                                    {products.map(p => (
                                        <SelectOption key={p.id} value={String(p.id)}>{p.name}</SelectOption>
                                    ))}
                                </Select>
                            </div>

                            {currentStock !== null && (
                                <div className="p-3 rounded-lg bg-secondary/50 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Aktueller Bestand:</span>
                                        <Badge variant="secondary">{currentStock}</Badge>
                                    </div>
                                    {difference !== null && (
                                        <>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Neuer Bestand:</span>
                                                <Badge variant="outline">{newQuantity}</Badge>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Differenz:</span>
                                                <Badge variant={difference > 0 ? 'success' : difference < 0 ? 'destructive' : 'secondary'}>
                                                    {difference > 0 ? '+' : ''}{difference}
                                                </Badge>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="newQuantity">Neuer Bestand</Label>
                                <Input
                                    id="newQuantity"
                                    type="number"
                                    min="0"
                                    placeholder="Neue Menge..."
                                    value={newQuantity}
                                    onChange={(e) => setNewQuantity(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="reason">Grund (optional)</Label>
                                <Textarea
                                    id="reason"
                                    placeholder="Grund für die Anpassung..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Wird angepasst...' : 'Bestand anpassen'}
                            </Button>
                        </form>

                        {status && (
                            <div className={`mt-4 flex items-center gap-2 p-3 rounded-lg ${status.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                                }`}>
                                {status.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                                <span className="text-sm font-medium">{status.message}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Adjustment Log */}
                <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                    <CardHeader>
                        <CardTitle>Anpassungs-Protokoll</CardTitle>
                        <CardDescription>Letzte manuelle Änderungen</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Person</TableHead>
                                    <TableHead>Produkt</TableHead>
                                    <TableHead className="text-right">Änderung</TableHead>
                                    <TableHead className="text-right">Neuer Stand</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {adjustments.slice(0, 20).map((adj) => (
                                    <TableRow key={adj.id}>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {new Date(adj.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </TableCell>
                                        <TableCell className="font-medium text-sm">{adj.person_name}</TableCell>
                                        <TableCell className="text-sm">
                                            <span className="text-muted-foreground">{adj.warehouse_name.substring(0, 3)}.</span> {adj.product_name}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {adj.difference > 0 ? (
                                                    <ArrowUp className="h-3 w-3 text-success" />
                                                ) : adj.difference < 0 ? (
                                                    <ArrowDown className="h-3 w-3 text-destructive" />
                                                ) : (
                                                    <Minus className="h-3 w-3 text-muted-foreground" />
                                                )}
                                                <Badge variant={adj.difference > 0 ? 'success' : adj.difference < 0 ? 'destructive' : 'secondary'} className="text-xs">
                                                    {adj.old_quantity} → {adj.new_quantity}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">{adj.new_quantity}</TableCell>
                                    </TableRow>
                                ))}
                                {adjustments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                            Noch keine Anpassungen vorhanden
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
