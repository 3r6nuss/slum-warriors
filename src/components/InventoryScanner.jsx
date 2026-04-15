import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    X, Upload, ScanLine, Loader2, CheckCircle, AlertCircle,
    ArrowRight, Save, RotateCcw, Replace, PlusCircle
} from 'lucide-react';

/* ── Fuzzy matching ───────────────────────────────────────────── */
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
}

function bestMatch(ocrName, productNames) {
    const normalized = ocrName.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalized || normalized.length < 2) return null;
    let best = null, bestScore = Infinity;
    for (const name of productNames) {
        const np = name.toLowerCase().replace(/\s+/g, ' ').trim();
        const dist = levenshtein(normalized, np);
        let bonus = 0;
        if (np.includes(normalized) && normalized.length >= 4) bonus = -3;
        else if (normalized.includes(np) && np.length >= 4) bonus = -3;
        else if (np.includes(normalized) || normalized.includes(np)) bonus = -1;

        const score = dist + bonus;
        if (score < bestScore) { bestScore = score; best = name; }
    }
    const threshold = Math.max(3, Math.floor((best?.length || 0) * 0.45));
    return bestScore <= threshold ? best : null;
}


/* ══════════════════════════════════════════════════════════════════
   Main Component – Server-Side OCR Scanner (Queue Auto-Magic)
   ══════════════════════════════════════════════════════════════════ */
export default function InventoryScanner({ warehouseItems, warehouseId, user, onClose }) {
    const [scanMode, setScanMode] = useState('set');

    // Queue status
    const [queueStatus, setQueueStatus] = useState(null); // { id: '...', status: 'pending' | 'processing' }
    const [queueError, setQueueError] = useState(null);

    // Results
    const [allResults, setAllResults] = useState([]); // accumulated across screenshots
    const [scanResults, setScanResults] = useState(null); // processed results
    const [applying, setApplying] = useState(false);
    const [applyStatus, setApplyStatus] = useState(null);
    const [personName, setPersonName] = useState(user?.display_name || user?.username || '');

    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);
    const pollTimer = useRef(null);

    const productNames = warehouseItems.map(i => i.product_name);

    /* ── Cleanup ─────────────────────────────────────────── */
    useEffect(() => {
        return () => {
            if (pollTimer.current) clearInterval(pollTimer.current);
        };
    }, []);

    /* ── File handling & Queueing ─────────────────────────────────────────── */
    const handleFile = useCallback(async (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        setQueueError(null);
        setQueueStatus({ status: 'uploading' });

        try {
            const formData = new FormData();
            formData.append('image', file);

            const res = await fetch('/api/scanner/scan', {
                method: 'POST',
                // We send the raw File directly as binary body since our express backend req.on('data') expects it
                body: file,
                headers: {
                    'Content-Type': 'application/octet-stream'
                }
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Server-Fehler' }));
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            setQueueStatus({ id: data.jobId, status: data.status });

            // Start polling
            if (pollTimer.current) clearInterval(pollTimer.current);
            pollTimer.current = setInterval(() => pollJob(data.jobId), 1500);

        } catch (err) {
            console.error('Upload error:', err);
            setQueueStatus(null);
            setQueueError(err.message);
        }
    }, [scanMode]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault(); e.stopPropagation();
        dropZoneRef.current?.classList.add('ring-2', 'ring-primary', 'bg-primary/5');
    }, []);
    const handleDragLeave = useCallback((e) => {
        e.preventDefault(); e.stopPropagation();
        dropZoneRef.current?.classList.remove('ring-2', 'ring-primary', 'bg-primary/5');
    }, []);
    const handleDrop = useCallback((e) => {
        e.preventDefault(); e.stopPropagation();
        dropZoneRef.current?.classList.remove('ring-2', 'ring-primary', 'bg-primary/5');
        handleFile(e.dataTransfer.files[0]);
    }, [handleFile]);

    useEffect(() => {
        const handlePaste = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    handleFile(item.getAsFile());
                    e.preventDefault();
                    break;
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handleFile]);

    /* ── Polling ──────────────────────────────────── */
    const pollJob = async (jobId) => {
        try {
            const res = await fetch(`/api/scanner/job/${jobId}`);
            if (!res.ok) throw new Error('Job Check Error');
            const job = await res.json();

            setQueueStatus({ id: job.id, status: job.status });

            if (job.status === 'completed') {
                clearInterval(pollTimer.current);
                setQueueStatus(null);
                processResults(job.result || []);
            } else if (job.status === 'error') {
                clearInterval(pollTimer.current);
                setQueueStatus(null);
                setQueueError(job.error || 'Generierungsfehler');
            }
        } catch (err) {
            console.error('Polling error:', err);
            clearInterval(pollTimer.current);
            setQueueStatus(null);
            setQueueError('Verbindungsfehler zur Warteschlange.');
        }
    };

    /* ── Processing Results ─────────────────────────────────────────── */
    const processResults = (newResults) => {
        const accumResults = [...allResults];
        
        for (const item of newResults) {
            if (!item.name) continue;
            
            // Normalize quantity
            let qty = parseInt(item.quantity) || 1;

            const existIdx = accumResults.findIndex(m => m.name.toLowerCase() === item.name.toLowerCase());
            if (existIdx >= 0) {
                const match = bestMatch(item.name, productNames);
                const wi = match ? warehouseItems.find(w => w.product_name === match) : null;
                if (wi && !wi.is_stackable) {
                    accumResults[existIdx] = { ...item, quantity: accumResults[existIdx].quantity + qty };
                } else {
                    accumResults[existIdx] = { ...item, quantity: qty };
                }
            } else {
                accumResults.push({ name: item.name, quantity: qty });
            }
        }

        setAllResults(accumResults);

        // Match against products
        const matched = accumResults.map(item => {
            const match = bestMatch(item.name, productNames);
            const wi = match ? warehouseItems.find(w => w.product_name === match) : null;

            let targetQty = item.quantity;
            if (scanMode === 'add' && wi) {
                targetQty = wi.quantity + item.quantity;
            }

            return {
                ocrName: item.name, ocrQuantity: targetQty,
                matchedName: match, matchedItem: wi,
                currentQuantity: wi?.quantity ?? null,
                diff: wi ? targetQty - wi.quantity : null,
                accepted: !!match,
            };
        });

        const matchedIds = new Set(matched.filter(m => m.matchedItem).map(m => m.matchedItem.product_id));
        const unscanned = warehouseItems
            .filter(wi => !matchedIds.has(wi.product_id))
            .map(wi => ({
                ocrName: null, ocrQuantity: null,
                matchedName: wi.product_name, matchedItem: wi,
                currentQuantity: wi.quantity, diff: null,
                accepted: false, notScanned: true,
            }));

        setScanResults({ matched, unscanned, scanCount: accumResults.length });
    };

    /* ── Apply ────────────────────────────────────────────────── */
    const applyResults = async () => {
        if (!scanResults?.matched || !personName) return;
        const changes = scanResults.matched
            .filter(r => r.accepted && r.matchedItem && r.diff !== 0 && r.diff !== null)
            .map(r => ({ product_id: r.matchedItem.product_id, new_quantity: r.ocrQuantity }));
        
        if (changes.length === 0) {
            setApplyStatus({ type: 'error', message: 'Keine Änderungen zum Übernehmen.' }); return;
        }
        
        setApplying(true); setApplyStatus(null);
        try {
            const res = await fetch('/api/adjustments/batch', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouse_id: parseInt(warehouseId), person_name: personName,
                    reason: `Automatische Inventurerfassung LLM (${scanMode === 'add' ? 'Hinzufügen' : 'Setzen'})`, changes,
                }),
            });
            const data = await res.json();
            setApplyStatus(res.ok
                ? { type: 'success', message: `${changes.length} Produkt(e) aktualisiert!` }
                : { type: 'error', message: data.error || 'Fehler.' });
        } catch { setApplyStatus({ type: 'error', message: 'Verbindungsfehler.' }); }
        setApplying(false);
    };

    const zeroOutUnscanned = (idx, e) => {
        if (e) e.stopPropagation();
        setScanResults(prev => {
            if (!prev) return prev;
            const u = [...prev.unscanned];
            const itemToZero = u[idx];
            u.splice(idx, 1);

            const matchedItem = {
                ocrName: 'Manuell genullt', ocrQuantity: 0,
                matchedName: itemToZero.matchedName, matchedItem: itemToZero.matchedItem,
                currentQuantity: itemToZero.currentQuantity, diff: -itemToZero.currentQuantity,
                accepted: true
            };
            return { ...prev, matched: [...prev.matched, matchedItem], unscanned: u };
        });
    };

    const zeroAllUnscanned = () => {
        setScanResults(prev => {
            if (!prev || !prev.unscanned || prev.unscanned.length === 0) return prev;
            const newMatched = prev.unscanned.map(itemToZero => ({
                ocrName: 'Manuell genullt', ocrQuantity: 0,
                matchedName: itemToZero.matchedName, matchedItem: itemToZero.matchedItem,
                currentQuantity: itemToZero.currentQuantity, diff: -itemToZero.currentQuantity,
                accepted: true
            }));
            return { ...prev, matched: [...prev.matched, ...newMatched], unscanned: [] };
        });
    };

    const adjustQuantity = (idx, delta, e) => {
        if (e) e.stopPropagation();
        setScanResults(prev => {
            if (!prev) return prev;
            const m = [...prev.matched];
            const currentObj = m[idx];

            const newQty = Math.max(0, (currentObj.ocrQuantity || 0) + delta);
            const newDiff = currentObj.matchedItem ? newQty - currentObj.matchedItem.quantity : null;

            m[idx] = { ...currentObj, ocrQuantity: newQty, diff: newDiff };

            setAllResults(currentAll => {
                const nextAll = [...currentAll];
                const allIdx = nextAll.findIndex(a => a.name === currentObj.ocrName);
                if (allIdx >= 0) nextAll[allIdx] = { ...nextAll[allIdx], quantity: newQty };
                return nextAll;
            });

            return { ...prev, matched: m };
        });
    };

    const toggleAccept = (idx) => {
        setScanResults(prev => {
            const m = [...prev.matched];
            m[idx] = { ...m[idx], accepted: !m[idx].accepted };
            return { ...prev, matched: m };
        });
    };

    const reset = () => {
        setScanResults(null); 
        setApplyStatus(null);
        setAllResults([]); 
        setQueueError(null);
        setQueueStatus(null);
        if (pollTimer.current) clearInterval(pollTimer.current);
    };

    const acceptedChanges = scanResults?.matched?.filter(r => r.accepted && r.diff !== 0 && r.diff !== null) || [];

    /* ── Render ────────────────────────────────────────────────── */
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative z-10 w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-card border border-border/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20">
                            <ScanLine className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Auto-KI Scanner</h3>
                            <p className="text-xs text-muted-foreground">
                                Screenshot einfügen, die KI macht den Rest!
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {allResults.length > 0 && (
                            <Badge variant="success" className="text-xs">
                                {allResults.length} Items gesammelt
                            </Badge>
                        )}
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                    {/* ── Mode Selection ────────────────────── */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-secondary/50 border border-border/30">
                            <button
                                onClick={() => setScanMode('set')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    scanMode === 'set'
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Replace className="h-3.5 w-3.5" />
                                Auf Wert setzen
                            </button>
                            <button
                                onClick={() => setScanMode('add')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    scanMode === 'add'
                                        ? 'bg-emerald-500 text-white shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <PlusCircle className="h-3.5 w-3.5" />
                                Hinzufügen
                            </button>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                            {scanMode === 'set' 
                                ? 'Bestand wird auf den gescannten Wert überschrieben' 
                                : 'Gescannte Mengen werden zum aktuellen Bestand addiert'}
                        </span>
                    </div>

                    {/* Progress Information */}
                    {queueStatus && (
                        <div className="flex flex-col items-center justify-center p-8 border border-indigo-500/30 bg-indigo-500/5 rounded-xl animate-pulse">
                            <Loader2 className="h-8 w-8 text-indigo-400 animate-spin mb-3" />
                            <h4 className="text-lg font-semibold text-indigo-300">
                                KI analysiert Bild...
                            </h4>
                            <p className="text-sm text-indigo-200/70 mt-1">
                                {queueStatus.status === 'pending' ? 'Warte auf Einreihung in die Pipeline...' : 'Das LLM Modell (Vision) verarbeitet die Pixel...'}
                            </p>
                        </div>
                    )}

                    {/* Upload area */}
                    {!queueStatus && (
                        <div
                            ref={dropZoneRef}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-border/50 rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                        >
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-4 rounded-2xl bg-secondary">
                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <p className="font-semibold text-lg">Screenshot aus dem Spiel reinwerfen</p>
                                <p className="text-sm text-muted-foreground">
                                    Mach einfach C&P: <kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">Strg+V</kbd> oder zieh das Bild hier herein.
                                </p>
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                                onChange={(e) => handleFile(e.target.files[0])} />
                        </div>
                    )}

                    {/* Error */}
                    {queueError && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                            <p className="text-sm text-destructive">{queueError}</p>
                        </div>
                    )}

                    {/* Results Table */}
                    {scanResults?.matched && !queueStatus && (
                        <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500 fade-in">
                            <div className="flex gap-2 flex-wrap items-center">
                                <Badge variant="success" className="text-xs py-1 px-2.5">
                                    {scanResults.matched.filter(r => r.matchedItem).length} zugeordnet
                                </Badge>
                                {scanResults.matched.filter(r => !r.matchedItem).length > 0 && (
                                    <Badge variant="warning" className="text-xs py-1 px-2.5">
                                        {scanResults.matched.filter(r => !r.matchedItem).length} unbekannt
                                    </Badge>
                                )}
                                <Badge variant="outline" className="text-xs py-1 px-2.5">
                                    {scanResults.scanCount} total ausgelesen
                                </Badge>
                            </div>

                            <div className="rounded-xl border border-border/50 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-secondary/50 border-b border-border/50">
                                            <th className="text-left p-2.5 font-semibold w-8">✓</th>
                                            <th className="text-left p-2.5 font-semibold">KI Erkannt</th>
                                            <th className="text-left p-2.5 font-semibold"><ArrowRight className="h-3 w-3 inline mr-1" />Zugeordnet</th>
                                            <th className="text-right p-2.5 font-semibold">Menge</th>
                                            <th className="text-right p-2.5 font-semibold">Bestand</th>
                                            <th className="text-right p-2.5 font-semibold">Diff</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scanResults.matched.map((row, idx) => (
                                            <tr key={idx}
                                                className={`border-b border-border/30 transition-colors ${row.accepted ? 'bg-success/5' : 'opacity-50'} ${row.matchedItem ? 'cursor-pointer hover:bg-secondary/30' : ''}`}
                                                onClick={() => row.matchedItem && toggleAccept(idx)}>
                                                <td className="p-2.5">
                                                    {row.matchedItem && (
                                                        <div className={`h-4.5 w-4.5 rounded border-2 flex items-center justify-center ${row.accepted
                                                            ? 'bg-success border-success text-success-foreground' : 'border-border'}`}>
                                                            {row.accepted && <CheckCircle className="h-3 w-3" />}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-2.5">
                                                    <span className="font-mono text-xs bg-secondary/50 px-1.5 py-0.5 rounded">{row.ocrName}</span>
                                                </td>
                                                <td className="p-2.5">
                                                    {row.matchedName
                                                        ? <span className="font-medium text-success text-xs">{row.matchedName}</span>
                                                        : <span className="text-muted-foreground italic text-xs">—</span>}
                                                </td>
                                                <td className="p-2.5 text-right font-mono font-semibold text-xs">
                                                    {row.matchedItem ? (
                                                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                className="h-5 w-5 rounded bg-secondary/50 hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"
                                                                onClick={(e) => adjustQuantity(idx, -1, e)}
                                                            >-</button>
                                                            <span className="w-6 text-center">{row.ocrQuantity?.toLocaleString('de-DE')}</span>
                                                            <button
                                                                className="h-5 w-5 rounded bg-secondary/50 hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"
                                                                onClick={(e) => adjustQuantity(idx, 1, e)}
                                                            >+</button>
                                                        </div>
                                                    ) : (
                                                        row.ocrQuantity?.toLocaleString('de-DE')
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-right font-mono text-muted-foreground text-xs">
                                                    {row.currentQuantity?.toLocaleString('de-DE') ?? '—'}
                                                </td>
                                                <td className="p-2.5 text-right font-mono font-semibold text-xs">
                                                    {row.diff !== null ? (
                                                        <span className={row.diff > 0 ? 'text-success' : row.diff < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                                                            {row.diff > 0 && '+'}{row.diff.toLocaleString('de-DE')}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                        {scanResults.unscanned?.length > 0 && (
                                            <>
                                                <tr>
                                                    <td colSpan={5} className="p-2 bg-secondary/30 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                                                        Noch nicht gescannt
                                                    </td>
                                                    <td className="p-2 bg-secondary/30 text-right">
                                                        <Button variant="ghost" size="sm" onClick={zeroAllUnscanned} className="h-6 text-xs text-destructive hover:text-white hover:bg-destructive transition-colors px-2">
                                                            Alle Nullen
                                                        </Button>
                                                    </td>
                                                </tr>
                                                {scanResults.unscanned.map((row, idx) => (
                                                    <tr key={`u-${idx}`} className="border-b border-border/30 opacity-40 hover:opacity-100 transition-opacity">
                                                        <td className="p-2" />
                                                        <td className="p-2 text-muted-foreground italic text-xs">—</td>
                                                        <td className="p-2 text-muted-foreground text-xs">{row.matchedName}</td>
                                                        <td className="p-2 text-right text-xs text-muted-foreground">—</td>
                                                        <td className="p-2 text-right font-mono text-muted-foreground text-xs">
                                                            {row.currentQuantity?.toLocaleString('de-DE')}
                                                        </td>
                                                        <td className="p-2 text-right text-xs text-muted-foreground">
                                                            <Button variant="outline" size="sm" className="h-6 w-full text-xs hover:bg-destructive hover:text-white hover:border-destructive" onClick={(e) => zeroOutUnscanned(idx, e)}>
                                                                0 setzen
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Apply */}
                            {acceptedChanges.length > 0 && (
                                <div className="space-y-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
                                    <h4 className="font-semibold text-sm flex items-center gap-2">
                                        <Save className="h-4 w-4 text-primary" />
                                        Bestände übernehmen ({acceptedChanges.length})
                                    </h4>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="sp" className="text-xs">Dein Name *</Label>
                                        <Input id="sp" placeholder="Name..." value={personName}
                                            onChange={(e) => setPersonName(e.target.value)} className="h-8 text-sm" />
                                    </div>
                                    {applyStatus && (
                                        <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${applyStatus.type === 'success'
                                            ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                            {applyStatus.type === 'success' ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                                            {applyStatus.message}
                                        </div>
                                    )}
                                    <Button onClick={applyResults} disabled={applying || !personName || applyStatus?.type === 'success'} className="w-full" size="sm">
                                        {applying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Übernehme...</> : <><Save className="h-4 w-4 mr-2" />Aktualisieren</>}
                                    </Button>
                                </div>
                            )}

                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" size="sm" onClick={reset}>
                                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                    Alles löschen & Neustart
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
