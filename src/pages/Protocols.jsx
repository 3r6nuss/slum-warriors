import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectOption } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollText, PackagePlus, PackageMinus, ArrowUp, ArrowDown, Minus } from 'lucide-react';

export default function Protocols() {
    const [transactions, setTransactions] = useState([]);
    const [adjustments, setAdjustments] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [filterWarehouse, setFilterWarehouse] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterPerson, setFilterPerson] = useState('');
    const [activeTab, setActiveTab] = useState('transactions');

    useEffect(() => {
        fetch('/api/inventory/warehouses/list').then(r => r.json()).then(setWarehouses);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams();
        if (filterWarehouse) params.set('warehouse', filterWarehouse);
        if (filterType) params.set('type', filterType);
        if (filterPerson) params.set('person', filterPerson);
        fetch(`/api/transactions?${params}`).then(r => r.json()).then(setTransactions);
    }, [filterWarehouse, filterType, filterPerson]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (filterWarehouse) params.set('warehouse', filterWarehouse);
        fetch(`/api/adjustments?${params}`).then(r => r.json()).then(setAdjustments);
    }, [filterWarehouse]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <ScrollText className="h-8 w-8 text-primary" />
                    Protokolle
                </h1>
                <p className="text-muted-foreground mt-1">Alle Ein-/Auslagerungen und Anpassungen</p>
            </div>

            {/* Filters */}
            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-3">
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
                            <Label>Typ</Label>
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectOption value="">Alle Typen</SelectOption>
                                <SelectOption value="checkin">Einlagerung</SelectOption>
                                <SelectOption value="checkout">Auslagerung</SelectOption>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Person</Label>
                            <Input
                                placeholder="Nach Person suchen..."
                                value={filterPerson}
                                onChange={(e) => setFilterPerson(e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="transactions">Transaktionen</TabsTrigger>
                    <TabsTrigger value="adjustments">Anpassungen</TabsTrigger>
                </TabsList>

                <TabsContent value="transactions">
                    <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                        <CardHeader>
                            <CardTitle>Transaktions-Protokoll</CardTitle>
                            <CardDescription>{transactions.length} Einträge</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Datum</TableHead>
                                        <TableHead>Person</TableHead>
                                        <TableHead>Typ</TableHead>
                                        <TableHead>Lager</TableHead>
                                        <TableHead>Produkt</TableHead>
                                        <TableHead className="text-right">Menge</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {new Date(t.created_at).toLocaleString('de-DE', {
                                                    day: '2-digit', month: '2-digit', year: '2-digit',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </TableCell>
                                            <TableCell className="font-medium">{t.person_name}</TableCell>
                                            <TableCell>
                                                {t.type === 'checkin' ? (
                                                    <Badge variant="success" className="gap-1">
                                                        <PackagePlus className="h-3 w-3" /> Einlagerung
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="destructive" className="gap-1">
                                                        <PackageMinus className="h-3 w-3" /> Auslagerung
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{t.warehouse_name}</TableCell>
                                            <TableCell>{t.product_name}</TableCell>
                                            <TableCell className="text-right font-mono font-semibold">{t.quantity}</TableCell>
                                        </TableRow>
                                    ))}
                                    {transactions.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                                Keine Transaktionen gefunden
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="adjustments">
                    <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                        <CardHeader>
                            <CardTitle>Anpassungs-Protokoll</CardTitle>
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
                                        <TableHead className="text-right">Alt</TableHead>
                                        <TableHead className="text-right">Neu</TableHead>
                                        <TableHead className="text-right">Diff</TableHead>
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
                                            <TableCell className="text-right font-mono">{a.new_quantity}</TableCell>
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
                </TabsContent>
            </Tabs>
        </div>
    );
}
