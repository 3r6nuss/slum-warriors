import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, ArrowLeft, ArrowRight, Loader2, PackageOpen } from 'lucide-react';

export default function LogView() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Filters
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('all');

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to first page on new search
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Fetch on filter or page change
    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const query = new URLSearchParams({
                    page: page.toString(),
                    limit: '50'
                });

                if (debouncedSearch) query.append('search', debouncedSearch);
                if (actionFilter !== 'all') query.append('action', actionFilter);

                const res = await fetch(`/api/logs?${query.toString()}`);
                const data = await res.json();

                if (res.ok) {
                    setLogs(data.logs || []);
                    setTotalPages(data.totalPages || 1);
                    setTotalCount(data.totalCount || 0);
                }
            } catch (err) {
                console.error("Failed to fetch logs", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [page, debouncedSearch, actionFilter]);

    // Format Date
    const formatDate = (dateString) => {
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }).format(date);
        } catch {
            return dateString;
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Lager-Historie</h1>
                    <p className="text-muted-foreground mt-0.5">
                        Gesamtes Logbuch aller Einlagerungen, Auslagerungen und Korrekturen.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-muted-foreground" />
                    <Badge variant="secondary" className="text-sm">
                        {totalCount.toLocaleString('de-DE')} Einträge
                    </Badge>
                </div>
            </div>

            <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Person oder Produkt suchen..."
                                className="pl-9 bg-background/50"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Select value={actionFilter} onValueChange={(val) => { setActionFilter(val); setPage(1); }}>
                            <SelectTrigger className="w-full sm:w-[180px] bg-background/50">
                                <SelectValue placeholder="Alle Aktionen" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Aktionen</SelectItem>
                                <SelectItem value="checkin">Einlagerungen</SelectItem>
                                <SelectItem value="checkout">Auslagerungen</SelectItem>
                                <SelectItem value="Korrektur">Admin-Korrekturen</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="relative overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <TableHead className="w-[180px]">Datum</TableHead>
                                    <TableHead>Person</TableHead>
                                    <TableHead>Lager</TableHead>
                                    <TableHead>Aktion</TableHead>
                                    <TableHead>Produkt</TableHead>
                                    <TableHead className="text-right">Menge / Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-48 text-center">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground mt-2 block">Lade Historie...</span>
                                        </TableCell>
                                    </TableRow>
                                ) : logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                            <PackageOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            Keine Einträge gefunden.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => (
                                        <TableRow key={log.unique_id} className="group hover:bg-muted/20">
                                            <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                                {formatDate(log.created_at)}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {log.person_name}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {log.warehouse_name}
                                            </TableCell>
                                            <TableCell>
                                                {log.action === 'checkin' && <Badge variant="success" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">Einlagerung</Badge>}
                                                {log.action === 'checkout' && <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20">Auslagerung</Badge>}
                                                {log.action === 'Korrektur' && <Badge variant="warning" className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20">Admin-Korrektur</Badge>}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {log.product_name || <span className="text-muted-foreground text-xs italic">Gelöschtes Produkt</span>}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-sm">
                                                {log.source === 'transaction' ? (
                                                    <span className={log.action === 'checkin' ? 'text-emerald-500' : 'text-rose-500'}>
                                                        {log.action === 'checkin' ? '+' : '-'}{log.qty_change}
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="text-foreground">
                                                            {log.old_qty} <ArrowRight className="inline h-3 w-3 text-muted-foreground mx-1" /> {log.new_qty}
                                                        </span>
                                                        <span className={log.qty_change > 0 ? 'text-emerald-500 text-xs' : 'text-rose-500 text-xs'}>
                                                            (Diff: {log.qty_change > 0 ? '+' : ''}{log.qty_change})
                                                        </span>
                                                        {log.reason && <span className="text-[10px] text-muted-foreground italic max-w-[200px] truncate" title={log.reason}>"{log.reason}"</span>}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/10">
                        <div className="text-sm text-muted-foreground">
                            Seite <span className="font-medium text-foreground">{page}</span> von <span className="font-medium text-foreground">{totalPages || 1}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                            >
                                <ArrowLeft className="h-4 w-4 mr-1" /> Vorherige
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || loading || totalPages === 0}
                            >
                                Nächste <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
