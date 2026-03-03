import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectOption } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PackageMinus, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function CheckOutForm({ preselectedWarehouse }) {
    const { user } = useAuth();
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [warehouseId, setWarehouseId] = useState(preselectedWarehouse || '');
    const [productId, setProductId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [personName, setPersonName] = useState(user?.display_name || user?.username || '');
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('/api/inventory/warehouses/list').then(r => r.json()).then(setWarehouses);
        fetch('/api/products').then(r => r.json()).then(setProducts);
        fetch('/api/inventory').then(r => r.json()).then(setInventory);
    }, []);

    useEffect(() => {
        if (preselectedWarehouse) setWarehouseId(preselectedWarehouse);
    }, [preselectedWarehouse]);

    const warehouseName = warehouses.find(w => String(w.id) === String(warehouseId))?.name;

    const availableStock = useMemo(() => {
        if (!warehouseId || !productId) return null;
        const item = inventory.find(
            i => i.warehouse_id === parseInt(warehouseId) && i.product_id === parseInt(productId)
        );
        return item ? item.quantity : 0;
    }, [warehouseId, productId, inventory]);

    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!warehouseId || !productId || !quantity || !personName) {
            setStatus({ type: 'error', message: 'Bitte alle Felder ausfüllen' });
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouse_id: parseInt(warehouseId),
                    product_id: parseInt(productId),
                    person_name: personName,
                    type: 'checkout',
                    quantity: parseInt(quantity),
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: `${quantity}x ${products.find(p => p.id === parseInt(productId))?.name} ausgelagert!` });
                setQuantity('');
                setProductId('');
                // Refresh inventory
                fetch('/api/inventory').then(r => r.json()).then(setInventory);
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Verbindungsfehler' });
        }
        setLoading(false);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <PackageMinus className="h-8 w-8 text-primary" />
                    Auslagern
                </h1>
                <p className="text-muted-foreground mt-1">
                    {warehouseName ? `Produkte aus ${warehouseName} entnehmen` : 'Produkte aus einem Lager entnehmen'}
                </p>
            </div>

            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle>Auslagerung erfassen</CardTitle>
                    <CardDescription>
                        Datum: {dateStr} • Uhrzeit: {timeStr}
                    </CardDescription>
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

                        {warehouseName && (
                            <div className="space-y-2">
                                <Label>Lager</Label>
                                <div className="flex h-10 w-full items-center rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm font-medium">
                                    {warehouseName}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="product">Produkt</Label>
                            <Select id="product" value={productId} onValueChange={setProductId}>
                                <SelectOption value="">Produkt auswählen...</SelectOption>
                                {products.map(p => (
                                    <SelectOption key={p.id} value={String(p.id)}>{p.name}</SelectOption>
                                ))}
                            </Select>
                            {availableStock !== null && (
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-muted-foreground">Verfügbar:</span>
                                    <Badge variant={availableStock > 0 ? (availableStock > 10 ? 'success' : 'warning') : 'destructive'}>
                                        {availableStock}
                                    </Badge>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quantity">Menge</Label>
                            <Input
                                id="quantity"
                                type="number"
                                min="1"
                                max={availableStock || undefined}
                                placeholder="Menge eingeben..."
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Wird ausgelagert...' : 'Auslagern'}
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
        </div>
    );
}
