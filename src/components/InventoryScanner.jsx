import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    X, Upload, ScanLine, Loader2, CheckCircle, AlertCircle,
    ArrowRight, Save, RotateCcw, Grid3x3, Move, Plus, Crop,
    PanelLeft, PanelRight, Replace, PlusCircle
} from 'lucide-react';

const STORAGE_KEY = 'scanner_grid_settings';
const DEFAULT_GRID = { x: 5, y: 5, w: 90, h: 90 };
const DEFAULT_COLS = 4;
const DEFAULT_ROWS = 3;

function loadSavedGrid() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return null;
}

function saveGrid(gridPos, numCols, numRows, side) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ gridPos, numCols, numRows, side }));
}

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
   Main Component – Server-Side OCR Scanner
   ══════════════════════════════════════════════════════════════════ */
export default function InventoryScanner({ warehouseItems, warehouseId, user, onClose }) {
    // Image state
    const [imageFile, setImageFile] = useState(null);       // raw File/Blob for upload
    const [imagePreview, setImagePreview] = useState(null);  // data URL for display

    // Grid overlay state (in % of image) – load from localStorage
    const savedGrid = loadSavedGrid();
    const [gridPos, setGridPos] = useState(savedGrid?.gridPos || { ...DEFAULT_GRID });
    const [numCols, setNumCols] = useState(savedGrid?.numCols || DEFAULT_COLS);
    const [numRows, setNumRows] = useState(savedGrid?.numRows || DEFAULT_ROWS);
    const [gridSaved, setGridSaved] = useState(false);

    // Side selection: which side of the screenshot contains the inventory
    const [side, setSide] = useState(savedGrid?.side || 'left');

    // Mode: "set" = overwrite stock, "add" = add to existing stock
    const [scanMode, setScanMode] = useState('set');

    // Scan state
    const [scanning, setScanning] = useState(false);

    // Results
    const [allResults, setAllResults] = useState([]); // accumulated across screenshots
    const [scanResults, setScanResults] = useState(null); // processed results
    const [applying, setApplying] = useState(false);
    const [applyStatus, setApplyStatus] = useState(null);
    const [personName, setPersonName] = useState(user?.display_name || user?.username || '');

    // Drag state
    const [dragging, setDragging] = useState(null); // 'move' | 'resize' | null
    const [dragStart, setDragStart] = useState(null);
    const containerRef = useRef(null);
    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);

    const productNames = warehouseItems.map(i => i.product_name);

    /* ── File handling ─────────────────────────────────────────── */
    const handleFile = useCallback((file) => {
        if (!file || !file.type.startsWith('image/')) return;
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target.result);
        reader.readAsDataURL(file);
    }, []);

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

    /* ── Grid drag handlers ───────────────────────────────────── */
    const getMousePct = useCallback((e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
        };
    }, []);

    const handleMouseDown = useCallback((e, mode) => {
        e.preventDefault(); e.stopPropagation();
        setDragging(mode);
        setDragStart({ mouse: getMousePct(e), grid: { ...gridPos } });
    }, [getMousePct, gridPos]);

    useEffect(() => {
        if (!dragging) return;
        const handleMove = (e) => {
            const current = getMousePct(e);
            const dx = current.x - dragStart.mouse.x;
            const dy = current.y - dragStart.mouse.y;

            if (dragging === 'move') {
                setGridPos({
                    ...dragStart.grid,
                    x: Math.max(0, Math.min(100 - dragStart.grid.w, dragStart.grid.x + dx)),
                    y: Math.max(0, Math.min(100 - dragStart.grid.h, dragStart.grid.y + dy)),
                });
            } else if (dragging === 'resize') {
                setGridPos({
                    ...dragStart.grid,
                    w: Math.max(10, Math.min(100 - dragStart.grid.x, dragStart.grid.w + dx)),
                    h: Math.max(10, Math.min(100 - dragStart.grid.y, dragStart.grid.h + dy)),
                });
            }
        };
        const handleUp = () => setDragging(null);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [dragging, dragStart, getMousePct]);

    /* ── Run scan via server ──────────────────────────────────── */
    const runScan = async () => {
        if (!imageFile) return;
        setScanning(true);

        try {
            const formData = new FormData();
            formData.append('image', imageFile);
            formData.append('side', side);
            formData.append('grid_x', gridPos.x.toString());
            formData.append('grid_y', gridPos.y.toString());
            formData.append('grid_w', gridPos.w.toString());
            formData.append('grid_h', gridPos.h.toString());
            formData.append('cols', numCols.toString());
            formData.append('rows', numRows.toString());

            const res = await fetch('/api/scanner/scan', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Server-Fehler' }));
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            const newResults = data.items || [];

            // Accumulate results
            const accumResults = [...allResults];
            for (const item of newResults) {
                const existIdx = accumResults.findIndex(m => m.name.toLowerCase() === item.name.toLowerCase());
                if (existIdx >= 0) {
                    const match = bestMatch(item.name, productNames);
                    const wi = match ? warehouseItems.find(w => w.product_name === match) : null;
                    if (wi && !wi.is_stackable) {
                        // Sum quantities for non-stackable items
                        accumResults[existIdx] = { ...item, quantity: accumResults[existIdx].quantity + item.quantity };
                    } else {
                        // Overwrite for stackable items
                        accumResults[existIdx] = item;
                    }
                } else {
                    accumResults.push(item);
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

            // Clear image so user can load next screenshot
            setImagePreview(null);
            setImageFile(null);

        } catch (err) {
            console.error('Scan error:', err);
            setScanResults({ error: err.message });
        } finally {
            setScanning(false);
        }
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
                    reason: `Inventar-Scanner Abgleich (${scanMode === 'add' ? 'Hinzufügen' : 'Setzen'})`, changes,
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

            return {
                ...prev,
                matched: [...prev.matched, matchedItem],
                unscanned: u
            };
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

            return {
                ...prev,
                matched: [...prev.matched, ...newMatched],
                unscanned: []
            };
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

            // Sync back to allResults so next runScan doesn't wipe manual changes
            setAllResults(currentAll => {
                const nextAll = [...currentAll];
                const allIdx = nextAll.findIndex(a => a.name === currentObj.ocrName);
                if (allIdx >= 0) {
                    nextAll[allIdx] = { ...nextAll[allIdx], quantity: newQty };
                }
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
        setImagePreview(null); setImageFile(null);
        setScanResults(null); setApplyStatus(null);
        setAllResults([]); 
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
                        <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20">
                            <ScanLine className="h-5 w-5 text-violet-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Inventar Scanner</h3>
                            <p className="text-xs text-muted-foreground">
                                Screenshot einfügen → Seite & Grid anpassen → scannen
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

                    {/* ── Side + Mode Selection ────────────────────── */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Side toggle */}
                        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-secondary/50 border border-border/30">
                            <button
                                onClick={() => setSide('left')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    side === 'left'
                                        ? 'bg-violet-500 text-white shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <PanelLeft className="h-3.5 w-3.5" />
                                Links
                            </button>
                            <button
                                onClick={() => setSide('right')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    side === 'right'
                                        ? 'bg-violet-500 text-white shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <PanelRight className="h-3.5 w-3.5" />
                                Rechts
                            </button>
                        </div>

                        {/* Mode toggle */}
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

                    {/* Upload area */}
                    {!imagePreview && !scanResults && (
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
                                <p className="font-semibold text-lg">GTA Screenshot reinwerfen</p>
                                <p className="text-sm text-muted-foreground">
                                    Kompletter Screenshot • <kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">Strg+V</kbd> oder Drag & Drop
                                </p>
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                                onChange={(e) => handleFile(e.target.files[0])} />
                        </div>
                    )}

                    {/* Upload area for NEXT screenshot (when we already have results) */}
                    {!imagePreview && scanResults && (
                        <div
                            ref={dropZoneRef}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-violet-500/30 rounded-xl p-6 text-center cursor-pointer hover:border-violet-500/60 hover:bg-violet-500/5 transition-all"
                        >
                            <div className="flex items-center justify-center gap-3">
                                <Plus className="h-5 w-5 text-violet-400" />
                                <p className="font-medium text-violet-300">Nächsten Screenshot laden (nach Scrollen)</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Grid-Position bleibt erhalten</p>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                                onChange={(e) => handleFile(e.target.files[0])} />
                        </div>
                    )}

                    {/* Image with Grid Overlay */}
                    {imagePreview && (
                        <div className="space-y-3">
                            {/* Grid settings bar */}
                            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/30 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Grid3x3 className="h-4 w-4 text-muted-foreground" />
                                    <Label className="text-xs whitespace-nowrap">Spalten:</Label>
                                    {[3, 4, 5, 6].map(n => (
                                        <button key={n} onClick={() => setNumCols(n)}
                                            className={`h-7 w-7 rounded text-xs font-bold transition-all ${numCols === n
                                                ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs whitespace-nowrap">Zeilen:</Label>
                                    {[2, 3, 4, 5, 6].map(n => (
                                        <button key={n} onClick={() => setNumRows(n)}
                                            className={`h-7 w-7 rounded text-xs font-bold transition-all ${numRows === n
                                                ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <div className="ml-auto flex items-center gap-1.5">
                                    <Button
                                        variant="outline" size="sm"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => { saveGrid(gridPos, numCols, numRows, side); setGridSaved(true); setTimeout(() => setGridSaved(false), 2000); }}
                                    >
                                        <Save className="h-3 w-3" />
                                        {gridSaved ? 'Gespeichert!' : 'Speichern'}
                                    </Button>
                                    <Button
                                        variant="ghost" size="sm"
                                        className="h-7 text-xs gap-1 text-muted-foreground"
                                        onClick={() => { setGridPos({ ...DEFAULT_GRID }); setNumCols(DEFAULT_COLS); setNumRows(DEFAULT_ROWS); localStorage.removeItem(STORAGE_KEY); }}
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        Reset
                                    </Button>
                                </div>
                            </div>

                            {/* Numeric fine-tuning */}
                            <div className="flex items-center gap-3 px-2.5 flex-wrap">
                                {[
                                    { key: 'x', label: 'X%' },
                                    { key: 'y', label: 'Y%' },
                                    { key: 'w', label: 'W%' },
                                    { key: 'h', label: 'H%' },
                                ].map(({ key, label }) => (
                                    <div key={key} className="flex items-center gap-1">
                                        <Label className="text-[10px] text-muted-foreground font-mono w-5">{label}</Label>
                                        <Input
                                            type="number"
                                            min="0" max="100" step="1"
                                            value={Math.round(gridPos[key])}
                                            onChange={(e) => {
                                                const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                                setGridPos(prev => ({ ...prev, [key]: val }));
                                            }}
                                            className="h-7 w-16 text-xs font-mono text-center bg-secondary/50 border-border/30"
                                        />
                                    </div>
                                ))}

                                {/* Side indicator on image */}
                                <div className="ml-auto flex items-center gap-1.5">
                                    <Crop className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground">
                                        Scannt die <strong className="text-violet-400">{side === 'left' ? 'linke' : 'rechte'}</strong> Bildhälfte
                                    </span>
                                </div>
                            </div>

                            {/* Image container with overlay */}
                            <div
                                ref={containerRef}
                                className="relative rounded-xl overflow-hidden border border-border/50 bg-black select-none"
                                style={{ cursor: dragging ? 'grabbing' : 'default' }}
                            >
                                <img
                                    src={imagePreview}
                                    alt="Screenshot"
                                    className="w-full block"
                                    draggable={false}
                                    style={{ maxHeight: '50vh', objectFit: 'contain' }}
                                />

                                {/* Dim the inactive side */}
                                <div className="absolute inset-0 pointer-events-none"
                                    style={{
                                        background: side === 'left'
                                            ? 'linear-gradient(to right, transparent 50%, rgba(0,0,0,0.6) 50%)'
                                            : 'linear-gradient(to right, rgba(0,0,0,0.6) 50%, transparent 50%)'
                                    }}
                                />

                                {/* Grid overlay — positioned relative to the selected side */}
                                <div
                                    className="absolute border-2 border-violet-400/80"
                                    style={{
                                        left: side === 'left'
                                            ? `${gridPos.x / 2}%`
                                            : `${50 + gridPos.x / 2}%`,
                                        top: `${gridPos.y}%`,
                                        width: `${gridPos.w / 2}%`,
                                        height: `${gridPos.h}%`,
                                    }}
                                >
                                    {/* Move handle (center) */}
                                    <div
                                        className="absolute inset-0 cursor-grab active:cursor-grabbing"
                                        onMouseDown={(e) => handleMouseDown(e, 'move')}
                                    />

                                    {/* Column lines */}
                                    {Array.from({ length: numCols - 1 }, (_, i) => (
                                        <div key={`col-${i}`}
                                            className="absolute top-0 bottom-0 w-px bg-violet-400/50"
                                            style={{ left: `${((i + 1) / numCols) * 100}%` }}
                                        />
                                    ))}

                                    {/* Row lines */}
                                    {Array.from({ length: numRows - 1 }, (_, i) => (
                                        <div key={`row-${i}`}
                                            className="absolute left-0 right-0 h-px bg-violet-400/50"
                                            style={{ top: `${((i + 1) / numRows) * 100}%` }}
                                        />
                                    ))}

                                    {/* Show which part of each cell will be scanned */}
                                    {Array.from({ length: numCols * numRows }, (_, i) => {
                                        const col = i % numCols, row = Math.floor(i / numCols);
                                        const cw = 100 / numCols, ch = 100 / numRows;
                                        return (
                                            <div key={`cell-${i}`} className="absolute pointer-events-none"
                                                style={{ left: `${col * cw}%`, top: `${row * ch}%`, width: `${cw}%`, height: `${ch}%` }}>
                                                {/* Number region highlight */}
                                                <div className="absolute top-0.5 bg-emerald-400/20 border border-emerald-400/40 rounded-sm"
                                                    style={{ height: '25%', left: '20%', right: '20%' }}>
                                                    <span className="text-[7px] text-emerald-300 px-0.5">Zahl</span>
                                                </div>
                                                {/* Name region highlight */}
                                                <div className="absolute inset-x-1 bottom-0.5 bg-blue-400/20 border border-blue-400/40 rounded-sm"
                                                    style={{ height: '28%' }}>
                                                    <span className="text-[7px] text-blue-300 px-0.5">Name</span>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Resize handle (bottom-right corner) */}
                                    <div
                                        className="absolute -bottom-2 -right-2 w-5 h-5 bg-violet-500 border-2 border-violet-300 rounded-sm cursor-nwse-resize shadow-lg z-10"
                                        onMouseDown={(e) => handleMouseDown(e, 'resize')}
                                    />

                                    {/* Move indicator (top-left) */}
                                    <div className="absolute -top-2 -left-2 w-5 h-5 bg-violet-500 border-2 border-violet-300 rounded-sm cursor-grab shadow-lg z-10 flex items-center justify-center"
                                        onMouseDown={(e) => handleMouseDown(e, 'move')}>
                                        <Move className="h-3 w-3 text-white" />
                                    </div>
                                </div>
                            </div>

                            {/* Scan button */}
                            {scanning ? (
                                <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-secondary/30 border border-border/30">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    <span className="text-sm font-medium">Server scannt {numCols * numRows} Zellen...</span>
                                </div>
                            ) : (
                                <Button onClick={runScan} className="w-full" size="lg">
                                    <ScanLine className="h-5 w-5 mr-2" />
                                    Grid scannen ({numCols * numRows} Zellen)
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {scanResults?.error && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                            <p className="text-sm text-destructive">{scanResults.error}</p>
                        </div>
                    )}

                    {/* Results */}
                    {scanResults?.matched && (
                        <div className="space-y-3">
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
                                    {scanResults.scanCount} total gescannt
                                </Badge>
                                <Badge variant={scanMode === 'add' ? 'success' : 'default'} className="text-xs py-1 px-2.5">
                                    {scanMode === 'add' ? '➕ Hinzufügen' : '🔄 Setzen'}
                                </Badge>
                            </div>

                            {/* Table */}
                            <div className="rounded-xl border border-border/50 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-secondary/50 border-b border-border/50">
                                            <th className="text-left p-2.5 font-semibold w-8">✓</th>
                                            <th className="text-left p-2.5 font-semibold">Erkannt</th>
                                            <th className="text-left p-2.5 font-semibold"><ArrowRight className="h-3 w-3 inline mr-1" />Zugeordnet</th>
                                            <th className="text-right p-2.5 font-semibold">Scan</th>
                                            <th className="text-right p-2.5 font-semibold">Lager</th>
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
                                    Alles zurücksetzen
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
