import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, Search, Loader2, Save, RefreshCw, HandCoins, AlertOctagon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function QuotasView() {
    const { isModerator, isLeadership } = useAuth();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [products, setProducts] = useState([]);
    const [targetProduct, setTargetProduct] = useState('');
    const [targetQuantity, setTargetQuantity] = useState('');
    const [originalGoalStr, setOriginalGoalStr] = useState('');
    const [savingGoal, setSavingGoal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [status, setStatus] = useState(null);
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [resetting, setResetting] = useState(false);

    useEffect(() => {
        if (!isModerator && !isLeadership) return;
        loadQuotas();
    }, [isModerator, isLeadership]);

    const loadQuotas = async () => {
        try {
            const [quotasRes, productsRes] = await Promise.all([
                fetch('/api/quotas', { credentials: 'include' }),
                fetch('/api/products')
            ]);
            
            const [quotasData, productsData] = await Promise.all([
                quotasRes.json(),
                productsRes.json()
            ]);

            if (quotasRes.ok && productsRes.ok) {
                setUsers(quotasData.users || []);
                setProducts(productsData || []);
                setOriginalGoalStr(quotasData.goal || '');
                
                try {
                    const parsed = JSON.parse(quotasData.goal || '{}');
                    setTargetProduct(parsed.product_id || '');
                    setTargetQuantity(parsed.quantity || '');
                } catch {
                    // Fallback for old plain text goals
                }
            } else {
                setStatus({ type: 'error', message: quotasData.error || 'Fehler beim Laden.' });
            }
        } catch {
            setStatus({ type: 'error', message: 'Verbindungsfehler beim Laden.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGoal = async () => {
        if (!targetProduct || !targetQuantity) {
            setStatus({ type: 'error', message: 'Bitte Produkt und Menge wählen.' });
            setTimeout(() => setStatus(null), 3000);
            return;
        }

        const selectedProduct = products.find(p => p.id.toString() === targetProduct.toString());
        const newGoalStr = JSON.stringify({
            product_id: parseInt(targetProduct),
            product_name: selectedProduct?.name || '',
            quantity: parseInt(targetQuantity)
        });

        setSavingGoal(true);
        setStatus(null);
        try {
            const res = await fetch('/api/quotas/goal', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ goal: newGoalStr })
            });
            const data = await res.json();
            if (res.ok) {
                setOriginalGoalStr(newGoalStr);
                setStatus({ type: 'success', message: 'Ziel gespeichert!' });
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch {
            setStatus({ type: 'error', message: 'Verbindungsfehler.' });
        }
        setSavingGoal(false);
        setTimeout(() => setStatus(null), 3000);
    };

    const handleToggle = async (userId, currentStatus) => {
        try {
            // Optimistic UI update
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, has_paid_quota: !currentStatus } : u));
            
            const res = await fetch(`/api/quotas/${userId}/toggle`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ has_paid: !currentStatus })
            });
            
            if (!res.ok) {
                // Revert on error
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, has_paid_quota: currentStatus } : u));
                const data = await res.json();
                setStatus({ type: 'error', message: data.error });
            }
        } catch {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, has_paid_quota: currentStatus } : u));
            setStatus({ type: 'error', message: 'Netzwerkfehler' });
        }
    };

    const handleResetAll = async () => {
        setResetting(true);
        try {
            const res = await fetch('/api/quotas/reset', {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok) {
                setUsers(prev => prev.map(u => ({ ...u, has_paid_quota: 0 })));
                setTimeout(() => setShowResetDialog(false), 500);
            } else {
                const data = await res.json();
                setStatus({ type: 'error', message: data.error });
            }
        } catch {
            setStatus({ type: 'error', message: 'Netzwerkfehler' });
        }
        setResetting(false);
    };

    if (!isModerator && !isLeadership) {
        return <Navigate to="/" replace />;
    }

    const filteredUsers = users.filter(u => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (u.username && u.username.toLowerCase().includes(q)) || 
               (u.display_name && u.display_name.toLowerCase().includes(q));
    });

    const completedCount = users.filter(u => u.has_paid_quota).length;
    const progressPercent = users.length > 0 ? Math.round((completedCount / users.length) * 100) : 0;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-500/10">
                    <HandCoins className="h-7 w-7 text-orange-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pflichtabgaben</h1>
                    <p className="text-muted-foreground mt-0.5">
                        Wöchentliche Abgaben verwalten und kontrollieren.
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Column: Settings & Progress */}
                    <div className="space-y-6 lg:col-span-1">
                        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <AlertOctagon className="h-5 w-5 text-amber-500" />
                                    Aktuelles Ziel
                                </CardTitle>
                                <CardDescription>Was müssen die Mitglieder aktuell abgeben?</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Produkt</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={targetProduct}
                                            onChange={e => setTargetProduct(e.target.value)}
                                        >
                                            <option value="">-- Produkt wählen --</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Menge</Label>
                                        <Input 
                                            type="number"
                                            min="1"
                                            placeholder="z.B. 2000" 
                                            value={targetQuantity}
                                            onChange={e => setTargetQuantity(e.target.value)}
                                            className="bg-background/50"
                                        />
                                    </div>
                                </div>
                                <Button 
                                    className="w-full gap-2" 
                                    onClick={handleSaveGoal}
                                    disabled={savingGoal}
                                >
                                    {savingGoal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Ziel Speichern
                                </Button>
                                {status && (
                                    <div className={`text-sm text-center p-2 rounded ${status.type === 'error' ? 'text-destructive bg-destructive/10' : 'text-success bg-success/10'}`}>
                                        {status.message}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
                            <CardHeader>
                                <CardTitle className="text-lg">Fortschritt</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-muted-foreground">Erledigt</span>
                                        <span className="font-bold">{completedCount} / {users.length} ({progressPercent}%)</span>
                                    </div>
                                    <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-success transition-all duration-500" 
                                            style={{ width: `${progressPercent}%` }} 
                                        />
                                    </div>
                                </div>

                                <Button 
                                    variant="destructive" 
                                    className="w-full gap-2"
                                    onClick={() => setShowResetDialog(true)}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Alle Zurücksetzen (Reset)
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: User List */}
                    <div className="lg:col-span-2">
                        <Card className="backdrop-blur-sm bg-card/80 border-border/50 h-[calc(100vh-220px)] flex flex-col">
                            <CardHeader className="pb-3 shrink-0">
                                <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
                                    <CardTitle>Mitglieder-Liste</CardTitle>
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Suchen..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 bg-background/50"
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-0">
                                <div className="divide-y divide-border/50 border-t border-border/50">
                                    {filteredUsers.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            Keine Mitglieder gefunden.
                                        </div>
                                    ) : (
                                        filteredUsers.map(user => (
                                            <div 
                                                key={user.id} 
                                                className={`flex items-center justify-between p-4 transition-colors ${user.has_paid_quota ? 'bg-success/5 hover:bg-success/10' : 'hover:bg-muted/30'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <img 
                                                            src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`} 
                                                            alt={user.username}
                                                            className="w-10 h-10 rounded-full border border-border/50 bg-secondary"
                                                        />
                                                        {user.has_paid_quota ? (
                                                            <div className="absolute -bottom-1 -right-1 bg-success text-success-foreground p-0.5 rounded-full border-2 border-background">
                                                                <Check className="h-3 w-3 relative top-0.5" strokeWidth={3} />
                                                            </div>
                                                        ) : (
                                                            <div className="absolute -bottom-1 -right-1 bg-destructive text-destructive-foreground p-0.5 rounded-full border-2 border-background">
                                                                <X className="h-3 w-3" strokeWidth={3} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium leading-none mb-1">
                                                            {user.display_name || user.username}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground uppercase opacity-70">
                                                            {user.role}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <Button
                                                    variant={user.has_paid_quota ? "outline" : "default"}
                                                    className={`gap-2 min-w-[130px] ${user.has_paid_quota ? "border-success text-success hover:bg-success hover:text-success-foreground" : "bg-primary hover:bg-primary/90"}`}
                                                    onClick={() => handleToggle(user.id, user.has_paid_quota)}
                                                >
                                                    {user.has_paid_quota ? (
                                                        <>Offen markieren</>
                                                    ) : (
                                                        <><Check className="h-4 w-4" /> Abhaken</>
                                                    )}
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                </div>
            )}

            {/* Reset Dialog */}
            <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Abgaben zurücksetzen?</DialogTitle>
                        <DialogDescription>
                            Bist du sicher, dass du die Abgaben für **alle** Nutzer wieder auf "Offen" (Nicht bezahlt) setzen möchtest? Dies markiert in der Regel den Beginn einer neuen Woche.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setShowResetDialog(false)} disabled={resetting}>Abbrechen</Button>
                        <Button variant="destructive" onClick={handleResetAll} disabled={resetting}>
                            {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Ja, alle zurücksetzen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
