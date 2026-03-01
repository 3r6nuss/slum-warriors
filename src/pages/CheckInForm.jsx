import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectOption } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PackagePlus, CheckCircle, AlertCircle } from 'lucide-react';

export default function CheckInForm({ preselectedWarehouse }) {
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [warehouseId, setWarehouseId] = useState(preselectedWarehouse || '');
    const [productId, setProductId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [personName, setPersonName] = useState('');
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('/api/inventory/warehouses/list').then(r => r.json()).then(setWarehouses);
        fetch('/api/products').then(r => r.json()).then(setProducts);
    }, []);

    useEffect(() => {
        if (preselectedWarehouse) setWarehouseId(preselectedWarehouse);
    }, [preselectedWarehouse]);

    const warehouseName = warehouses.find(w => String(w.id) === String(warehouseId))?.name;

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
                    type: 'checkin',
                    quantity: parseInt(quantity),
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: `${quantity}x ${products.find(p => p.id === parseInt(productId))?.name} eingelagert!` });
                setQuantity('');
                setProductId('');
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
                    <PackagePlus className="h-8 w-8 text-primary" />
                    Einlagern
                </h1>
                <p className="text-muted-foreground mt-1">
                    {warehouseName ? `Produkte in ${warehouseName} einlagern` : 'Produkte in ein Lager einlagern'}
                </p>
            </div>

            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle>Einlagerung erfassen</CardTitle>
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
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quantity">Menge</Label>
                            <Input
                                id="quantity"
                                type="number"
                                min="1"
                                placeholder="Menge eingeben..."
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Wird eingelagert...' : 'Einlagern'}
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
