import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useInventorySocket } from '@/lib/websocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Shield, Warehouse, Settings, ClipboardCheck, Save, X, Loader2 } from 'lucide-react';

const warehouseMeta = {
    1: { label: 'Führungslager', icon: Shield, type: 'leadership' },
    2: { label: 'Normales Lager', icon: Warehouse, type: 'normal' },
};

export default function WarehouseView({ warehouseId }) {
    const { isAdmin, isLeadership } = useAuth();
    const { inventory, connected } = useInventorySocket();
    const [isEditing, setIsEditing] = useState(false);
    const [edits, setEdits] = useState({});
    const [personName, setPersonName] = useState('');
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState(null);

    const warehouseItems = useMemo(() => {
        return inventory.filter(i => i.warehouse_id === parseInt(warehouseId));
    }, [inventory, warehouseId]);

    const meta = warehouseMeta[warehouseId] || { label: 'Lager', icon: Warehouse, type: 'normal' };
    const Icon = meta.icon;

    const handleEditToggle = () => {
        if (!isEditing) {
            const initialEdits = {};
            warehouseItems.forEach(item => {
                initialEdits[item.product_id] = item.quantity.toString();
            });
            setEdits(initialEdits);
            setStatus(null);
        }
        setIsEditing(!isEditing);
    };

    const handleSave = async () => {
        if (!personName) {
            setStatus({ type: 'error', message: 'Bitte gib deinen Namen an.' });
            return;
        }

        const changesToMake = warehouseItems.filter(item => {
            const newVal = edits[item.product_id];
            return newVal !== undefined && newVal !== '' && parseInt(newVal) !== item.quantity;
        });

        if (changesToMake.length === 0) {
            setStatus({ type: 'error', message: 'Keine Änderungen vorgenommen.' });
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        setStatus(null);
        let errorCount = 0;

        for (const item of changesToMake) {
            try {
                const res = await fetch('/api/adjustments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        warehouse_id: parseInt(warehouseId),
                        product_id: item.product_id,
                        new_quantity: parseInt(edits[item.product_id]),
                        person_name: personName,
                        reason: reason || undefined,
                    }),
                });
                if (!res.ok) errorCount++;
            } catch (err) {
                errorCount++;
            }
        }

        setIsSaving(false);
        if (errorCount === 0) {
            setStatus({ type: 'success', message: `${changesToMake.length} Produkte erfolgreich aktualisiert.` });
            setIsEditing(false);
            setPersonName('');
            setReason('');
        } else {
            setStatus({ type: 'error', message: `Fehler beim Speichern von ${errorCount} Produkten.` });
        }
    };

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
                <CardHeader className="pb-3 flex flex-row items-baseline justify-between">
                    <div>
                        <CardTitle className="text-lg">Lagerbestand</CardTitle>
                        {status && (
                            <p className={`text-sm mt-1 font-medium ${status.type === 'error' ? 'text-destructive' : 'text-success'}`}>
                                {status.message}
                            </p>
                        )}
                    </div>
                    {(isAdmin || isLeadership) && (
                        <div className="flex gap-2 relative top-2">
                            {!isEditing ? (
                                <>
                                    <Button variant="outline" size="sm" onClick={handleEditToggle}>
                                        <Settings className="h-4 w-4 mr-2" />
                                        Bearbeiten
                                    </Button>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link to={`/bestaetigen/${warehouseId}`}>
                                            <ClipboardCheck className="h-4 w-4 mr-2" />
                                            Bestätigen
                                        </Link>
                                    </Button>
                                </>
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
                                        {!isEditing ? (
                                            <Badge variant={item.quantity > 0 ? (item.quantity > 10 ? 'success' : 'warning') : 'destructive'}>
                                                {item.quantity}
                                            </Badge>
                                        ) : (
                                            <div className="flex justify-end">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={edits[item.product_id] || ''}
                                                    onChange={(e) => setEdits({ ...edits, [item.product_id]: e.target.value })}
                                                    className="w-24 text-right h-8"
                                                />
                                            </div>
                                        )}
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

                    {isEditing && (
                        <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-4 border border-border/50">
                            <h3 className="font-semibold text-sm">Bestätigung & Grund</h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="personName">Dein Name *</Label>
                                    <Input
                                        id="personName"
                                        placeholder="Wer macht die Anpassung?"
                                        value={personName}
                                        onChange={(e) => setPersonName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reason">Grund</Label>
                                    <Input
                                        id="reason"
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
    );
}
