import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectOption } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { User, PackagePlus, PackageMinus, TrendingUp, TrendingDown } from 'lucide-react';

export default function PersonProtocol() {
    const [persons, setPersons] = useState([]);
    const [selectedPerson, setSelectedPerson] = useState('');
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        fetch('/api/transactions/persons').then(r => r.json()).then(setPersons);
    }, []);

    useEffect(() => {
        if (selectedPerson) {
            fetch(`/api/transactions/person/${encodeURIComponent(selectedPerson)}`)
                .then(r => r.json())
                .then(setTransactions);
        } else {
            setTransactions([]);
        }
    }, [selectedPerson]);

    // Summary by product
    const summary = useMemo(() => {
        const map = {};
        for (const t of transactions) {
            const key = `${t.warehouse_name} – ${t.product_name}`;
            if (!map[key]) {
                map[key] = { warehouse: t.warehouse_name, product: t.product_name, checkin: 0, checkout: 0 };
            }
            if (t.type === 'checkin') {
                map[key].checkin += t.quantity;
            } else {
                map[key].checkout += t.quantity;
            }
        }
        return Object.values(map);
    }, [transactions]);

    const totalCheckin = summary.reduce((sum, s) => sum + s.checkin, 0);
    const totalCheckout = summary.reduce((sum, s) => sum + s.checkout, 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <User className="h-8 w-8 text-primary" />
                    Personen-Protokoll
                </h1>
                <p className="text-muted-foreground mt-1">Aktivitäten pro Person einsehen</p>
            </div>

            <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                <CardContent className="pt-6">
                    <div className="max-w-sm space-y-2">
                        <Label>Person auswählen</Label>
                        <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                            <SelectOption value="">Person auswählen...</SelectOption>
                            {persons.map(p => (
                                <SelectOption key={p} value={p}>{p}</SelectOption>
                            ))}
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {selectedPerson && (
                <>
                    {/* Stats */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Transaktionen</p>
                                        <p className="text-2xl font-bold">{transactions.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-success/10">
                                        <TrendingUp className="h-5 w-5 text-success" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Eingelagert</p>
                                        <p className="text-2xl font-bold">{totalCheckin}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-destructive/10">
                                        <TrendingDown className="h-5 w-5 text-destructive" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Ausgelagert</p>
                                        <p className="text-2xl font-bold">{totalCheckout}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Summary by product */}
                    {summary.length > 0 && (
                        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                            <CardHeader>
                                <CardTitle>Zusammenfassung</CardTitle>
                                <CardDescription>Mengen pro Produkt für {selectedPerson}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Lager</TableHead>
                                            <TableHead>Produkt</TableHead>
                                            <TableHead className="text-right">Eingelagert</TableHead>
                                            <TableHead className="text-right">Ausgelagert</TableHead>
                                            <TableHead className="text-right">Netto</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {summary.map((s, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="text-muted-foreground">{s.warehouse}</TableCell>
                                                <TableCell className="font-medium">{s.product}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant="success">{s.checkin}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant="destructive">{s.checkout}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant={s.checkin - s.checkout >= 0 ? 'success' : 'destructive'}>
                                                        {s.checkin - s.checkout >= 0 ? '+' : ''}{s.checkin - s.checkout}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Full transaction list */}
                    <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                        <CardHeader>
                            <CardTitle>Alle Transaktionen</CardTitle>
                            <CardDescription>{transactions.length} Einträge für {selectedPerson}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Datum</TableHead>
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
                                            <TableCell>
                                                {t.type === 'checkin' ? (
                                                    <Badge variant="success" className="gap-1">
                                                        <PackagePlus className="h-3 w-3" /> Ein
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="destructive" className="gap-1">
                                                        <PackageMinus className="h-3 w-3" /> Aus
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{t.warehouse_name}</TableCell>
                                            <TableCell className="font-medium">{t.product_name}</TableCell>
                                            <TableCell className="text-right font-mono font-semibold">{t.quantity}</TableCell>
                                        </TableRow>
                                    ))}
                                    {transactions.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                Keine Transaktionen für diese Person
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
