import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInventorySocket } from '@/lib/websocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Shield, Warehouse, Settings, ClipboardCheck } from 'lucide-react';

const warehouseMeta = {
    1: { label: 'Führungslager', icon: Shield, type: 'leadership' },
    2: { label: 'Normales Lager', icon: Warehouse, type: 'normal' },
};

export default function WarehouseView({ warehouseId }) {
    const { inventory, connected } = useInventorySocket();

    const warehouseItems = useMemo(() => {
        return inventory.filter(i => i.warehouse_id === parseInt(warehouseId));
    }, [inventory, warehouseId]);

    const meta = warehouseMeta[warehouseId] || { label: 'Lager', icon: Warehouse, type: 'normal' };
    const Icon = meta.icon;

    return (
        <div className="space-y-6">
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

            <Card className="overflow-hidden backdrop-blur-sm bg-card/80 border-border/50">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Lagerbestand</CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link to={`/anpassen/${warehouseId}`}>
                                <Settings className="h-4 w-4 mr-2" />
                                Bearbeiten
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link to={`/bestaetigen/${warehouseId}`}>
                                <ClipboardCheck className="h-4 w-4 mr-2" />
                                Bestätigen
                            </Link>
                        </Button>
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
                            {warehouseItems.map((item) => (
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
                            {warehouseItems.length === 0 && (
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
        </div>
    );
}
