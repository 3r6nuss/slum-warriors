import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectOption } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BarChart3, ArrowUp, ArrowDown, Minus } from 'lucide-react';

export default function StockLevels() {
    const [adjustments, setAdjustments] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [filterWarehouse, setFilterWarehouse] = useState('');
    const [filterProduct, setFilterProduct] = useState('');

    useEffect(() => {
        fetch('/api/inventory/warehouses/list').then(r => r.json()).then(setWarehouses);
        fetch('/api/products').then(r => r.json()).then(setProducts);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams();
        if (filterWarehouse) params.set('warehouse', filterWarehouse);
        if (filterProduct) params.set('product', filterProduct);
        fetch(`/api/adjustments?${params}`).then(r => r.json()).then(setAdjustments);
    }, [filterWarehouse, filterProduct]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <BarChart3 className="h-8 w-8 text-primary" />
                    Lagerstände
                </h1>
                <p className="text-muted-foreground mt-1">Bestandsänderungen und Anpassungs-Historie</p>
            </div>

            {/* Filters */}
            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Lager</Label>
                            <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                                <SelectOption value="">Alle Lager</SelectOption>
                                {warehouses.map(w => (
                                    <SelectOption key={w.id} value={String(w.id)}>{w.name}</SelectOption>
                                ))}
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Produkt</Label>
                            <Select value={filterProduct} onValueChange={setFilterProduct}>
                                <SelectOption value="">Alle Produkte</SelectOption>
                                {products.map(p => (
                                    <SelectOption key={p.id} value={String(p.id)}>{p.name}</SelectOption>
                                ))}
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Adjustment History Table */}
            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle>Anpassungs-Historie</CardTitle>
                    <CardDescription>{adjustments.length} Einträge</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Datum</TableHead>
                                <TableHead>Person</TableHead>
                                <TableHead>Lager</TableHead>
                                <TableHead>Produkt</TableHead>
                                <TableHead className="text-right">Alter Bestand</TableHead>
                                <TableHead className="text-right">Neuer Bestand</TableHead>
                                <TableHead className="text-right">Differenz</TableHead>
                                <TableHead>Grund</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {adjustments.map((a) => (
                                <TableRow key={a.id}>
                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                        {new Date(a.created_at).toLocaleString('de-DE', {
                                            day: '2-digit', month: '2-digit', year: '2-digit',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </TableCell>
                                    <TableCell className="font-medium">{a.person_name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{a.warehouse_name}</TableCell>
                                    <TableCell>{a.product_name}</TableCell>
                                    <TableCell className="text-right font-mono">{a.old_quantity}</TableCell>
                                    <TableCell className="text-right font-mono font-semibold">{a.new_quantity}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {a.difference > 0 ? (
                                                <ArrowUp className="h-3 w-3 text-success" />
                                            ) : a.difference < 0 ? (
                                                <ArrowDown className="h-3 w-3 text-destructive" />
                                            ) : (
                                                <Minus className="h-3 w-3 text-muted-foreground" />
                                            )}
                                            <Badge variant={a.difference > 0 ? 'success' : a.difference < 0 ? 'destructive' : 'secondary'}>
                                                {a.difference > 0 ? '+' : ''}{a.difference}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                        {a.reason || '–'}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {adjustments.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                        Keine Anpassungen gefunden
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
