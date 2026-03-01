import { useState, useEffect, useMemo } from 'react';
import { useInventorySocket } from '@/lib/websocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, Shield, Warehouse } from 'lucide-react';

export default function Dashboard() {
    const { inventory, connected } = useInventorySocket();

    const grouped = useMemo(() => {
        const map = {};
        for (const item of inventory) {
            if (!map[item.warehouse_id]) {
                map[item.warehouse_id] = {
                    id: item.warehouse_id,
                    name: item.warehouse_name,
                    type: item.warehouse_type,
                    items: [],
                };
            }
            map[item.warehouse_id].items.push(item);
        }
        return Object.values(map);
    }, [inventory]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Lagerübersicht</h1>
                    <p className="text-muted-foreground mt-1">Echtzeit-Bestandsanzeige aller Lager</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                    <span className="text-sm text-muted-foreground">
                        {connected ? 'Live' : 'Verbindung getrennt'}
                    </span>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {grouped.map((warehouse) => (
                    <Card key={warehouse.id} className="overflow-hidden backdrop-blur-sm bg-card/80 border-border/50 hover:border-primary/30 transition-all duration-300">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                                {warehouse.type === 'leadership' ? (
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <Shield className="h-5 w-5 text-primary" />
                                    </div>
                                ) : (
                                    <div className="p-2 rounded-lg bg-secondary">
                                        <Warehouse className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                )}
                                <div>
                                    <CardTitle className="text-lg">{warehouse.name}</CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {warehouse.items.length} Produkte
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Produkt</TableHead>
                                        <TableHead className="text-right">Bestand</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {warehouse.items.map((item) => (
                                        <TableRow key={item.id} className="group">
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    {item.product_name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={item.quantity > 0 ? (item.quantity > 10 ? 'success' : 'warning') : 'destructive'}>
                                                    {item.quantity}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {warehouse.items.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                                                Keine Produkte im Lager
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {grouped.length === 0 && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Warehouse className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Lade Lagerdaten...</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
