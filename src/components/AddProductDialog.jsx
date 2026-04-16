import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PackagePlus, Loader2 } from 'lucide-react';
import ITEMS_DB from '@/assets/items.json';

export default function AddProductDialog({ warehouseId, currentProducts = [], onProductAdded }) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Get current product names in lowercase to filter them out of suggestions
    const currentProductNames = new Set(currentProducts.map(p => (p.name || p.product_name || '').toLowerCase()));
    
    // Filter available items that aren't already registered
    const availableItems = ITEMS_DB.filter(item => !currentProductNames.has(item.toLowerCase()));

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const productName = searchTerm.trim();
        if (!productName) return;

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Use default threshold: green 10, yellow 1, stackable 1
                body: JSON.stringify({ 
                    name: productName,
                    warehouseIds: [warehouseId],
                    is_stackable: true,
                    green_threshold: 10,
                    yellow_threshold: 1
                })
            });

            const data = await res.json();
            
            if (res.ok) {
                setSearchTerm('');
                setOpen(false);
                if (onProductAdded) {
                    onProductAdded(data);
                }
            } else {
                setError(data.error || 'Fehler beim Hinzufügen des Produkts');
            }
        } catch (err) {
            setError('Netzwerkfehler beim Anlegen des Produkts');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                    <PackagePlus className="w-4 h-4" />
                    Artikel hinzufügen
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card/95 backdrop-blur-md border-border/50">
                <DialogHeader>
                    <DialogTitle>Neuen Artikel ins Lager aufnehmen</DialogTitle>
                    <DialogDescription>
                        Füge einen neuen Artikel aus der Datenbank hinzu. Es wird zunächst mit einem Bestand von 0 angelegt.
                    </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <label htmlFor="product-search" className="text-sm font-medium text-muted-foreground">
                            Artikelname
                        </label>
                        <div className="relative">
                            <Input
                                id="product-search"
                                list="available-items"
                                placeholder="Suche nach Artikeln..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                disabled={isLoading}
                                className="w-full"
                                required
                            />
                            <datalist id="available-items">
                                {availableItems.map((item, idx) => (
                                    <option key={idx} value={item} />
                                ))}
                            </datalist>
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-destructive font-medium p-2 rounded bg-destructive/10">
                            {error}
                        </p>
                    )}

                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            disabled={isLoading}
                        >
                            Abbrechen
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isLoading || !searchTerm.trim()}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            {isLoading ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Hinzufügen...</>
                            ) : (
                                'Artikel hinzufügen'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
