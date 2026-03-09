import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    X, Upload, ScanLine, Loader2, CheckCircle, AlertCircle,
    ArrowRight, Save, RotateCcw
} from 'lucide-react';

/* ── Fuzzy string matching (Levenshtein distance) ─────────────── */
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

function bestMatch(ocrName, productNames) {
    const normalized = ocrName.toLowerCase().trim();
    if (!normalized || normalized.length < 2) return null;

    let best = null;
    let bestScore = Infinity;

    for (const name of productNames) {
        const normalizedProduct = name.toLowerCase().trim();
        const dist = levenshtein(normalized, normalizedProduct);
        // Bonus for substring containment
        const containsBonus =
            normalizedProduct.includes(normalized) || normalized.includes(normalizedProduct) ? -2 : 0;
        const score = dist + containsBonus;
        if (score < bestScore) {
            bestScore = score;
            best = name;
        }
    }

    // Accept matches with < 40% edit distance
    const threshold = Math.max(3, Math.floor((best?.length || 0) * 0.45));
    return bestScore <= threshold ? best : null;
}

/* ── Parse German-style number ("6.669" → 6669, "160.999" → 160999) ─── */
function parseGermanNumber(str) {
    const cleaned = str.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '');
    const num = parseInt(cleaned);
    return isNaN(num) ? 0 : num;
}

/* ══════════════════════════════════════════════════════════════════
   Spatial Grid Parser – uses Tesseract word bounding boxes
   to group words into item cells, then extract qty + name per cell
   ══════════════════════════════════════════════════════════════════ */
function parseWordsIntoItems(words) {
    if (!words || words.length === 0) return [];

    // Filter out very low confidence words and tiny words
    const goodWords = words.filter(w =>
        w.confidence > 30 && w.text.trim().length > 0
    );

    if (goodWords.length === 0) return [];

    // Find grid structure by analyzing X positions (columns) and Y positions (rows).
    // Each inventory cell has a number at the top and a name at the bottom.
    // We cluster words by their center positions.

    const centers = goodWords.map(w => ({
        word: w,
        cx: (w.bbox.x0 + w.bbox.x1) / 2,
        cy: (w.bbox.y0 + w.bbox.y1) / 2,
        width: w.bbox.x1 - w.bbox.x0,
        height: w.bbox.y1 - w.bbox.y0,
    }));

    // Determine cell boundaries by finding clusters in X and Y.
    // Use the overall image dimensions to estimate the grid.
    const allX = centers.map(c => c.cx);
    const allY = centers.map(c => c.cy);
    const imgWidth = Math.max(...goodWords.map(w => w.bbox.x1));
    const imgHeight = Math.max(...goodWords.map(w => w.bbox.y1));

    // Estimate number of columns by clustering X positions
    const numCols = estimateGridDivisions(allX, imgWidth);
    const numRows = estimateGridDivisions(allY, imgHeight);

    const cellWidth = imgWidth / numCols;
    const cellHeight = imgHeight / numRows;

    // Assign each word to a grid cell
    const cells = new Map(); // "col,row" -> { numbers: [], texts: [] }

    for (const c of centers) {
        const col = Math.floor(c.cx / cellWidth);
        const row = Math.floor(c.cy / cellHeight);
        const key = `${col},${row}`;

        if (!cells.has(key)) {
            cells.set(key, { numbers: [], texts: [], col, row });
        }

        const cell = cells.get(key);
        const text = c.word.text.trim();

        // Check if this word is a number (possibly with dots for thousands)
        if (/^[\d.,]+$/.test(text) && parseGermanNumber(text) > 0) {
            cell.numbers.push({ text, cy: c.cy, confidence: c.word.confidence });
        } else if (text.length >= 2 && !/^[^\w]+$/.test(text)) {
            cell.texts.push({ text, cy: c.cy, confidence: c.word.confidence });
        }
    }

    // Build items from cells
    const items = [];
    for (const [, cell] of cells) {
        if (cell.numbers.length === 0 && cell.texts.length === 0) continue;

        // Pick the quantity: the topmost number in the cell (the badge)
        const sortedNumbers = [...cell.numbers].sort((a, b) => a.cy - b.cy);
        const quantity = sortedNumbers.length > 0
            ? parseGermanNumber(sortedNumbers[0].text)
            : null;

        // Pick the name: concatenate text words sorted by Y then X position
        const sortedTexts = [...cell.texts].sort((a, b) => a.cy - b.cy);
        const name = sortedTexts.map(t => t.text).join(' ').trim();

        if (quantity !== null && name) {
            items.push({ name, quantity });
        } else if (name && quantity === null) {
            // A cell with only text, no number – could be a header or label
            // Skip it
        } else if (quantity !== null && !name) {
            // Only a number, no text – might be a stray number
            // Skip it
        }
    }

    return items;
}

/** Estimate the number of grid divisions along one axis */
function estimateGridDivisions(positions, totalSize) {
    if (positions.length === 0) return 1;

    // Sort positions and find natural gaps
    const sorted = [...new Set(positions)].sort((a, b) => a - b);

    // Use a simple approach: try common grid sizes (2-8 columns/rows)
    // and pick the one where words cluster best
    let bestDivs = 4; // default for FiveM inventory
    let bestScore = Infinity;

    for (let divs = 2; divs <= 8; divs++) {
        const cellSize = totalSize / divs;
        // For each position, measure distance to nearest cell center
        let totalDist = 0;
        for (const pos of sorted) {
            const cellCenter = (Math.floor(pos / cellSize) + 0.5) * cellSize;
            totalDist += Math.abs(pos - cellCenter);
        }
        const avgDist = totalDist / sorted.length;
        if (avgDist < bestScore) {
            bestScore = avgDist;
            bestDivs = divs;
        }
    }

    return bestDivs;
}


/* ══════════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════════ */
export default function InventoryScanner({ warehouseItems, warehouseId, user, onClose }) {
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    const [scanResults, setScanResults] = useState(null);
    const [applying, setApplying] = useState(false);
    const [applyStatus, setApplyStatus] = useState(null);
    const [personName, setPersonName] = useState(user?.display_name || user?.username || '');

    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);

    const productNames = warehouseItems.map(i => i.product_name);

    /* ── Handle file selection ─────────────────────────────────── */
    const handleFile = useCallback((file) => {
        if (!file || !file.type.startsWith('image/')) return;
        setImage(file);
        setScanResults(null);
        setApplyStatus(null);

        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target.result);
        reader.readAsDataURL(file);
    }, []);

    /* ── Drag & Drop ──────────────────────────────────────────── */
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.add('ring-2', 'ring-primary', 'bg-primary/5');
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.remove('ring-2', 'ring-primary', 'bg-primary/5');
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.remove('ring-2', 'ring-primary', 'bg-primary/5');
        const file = e.dataTransfer.files[0];
        handleFile(file);
    }, [handleFile]);

    /* ── Clipboard paste support ──────────────────────────────── */
    useEffect(() => {
        const handlePaste = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    handleFile(file);
                    e.preventDefault();
                    break;
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handleFile]);

    /* ── Run OCR scan ─────────────────────────────────────────── */
    const runScan = async () => {
        if (!image) return;
        setScanning(true);
        setProgress(0);
        setProgressLabel('Lade Tesseract.js...');
        setScanResults(null);

        try {
            const Tesseract = await import('tesseract.js');

            setProgressLabel('Texterkennung läuft...');
            setProgress(15);

            // Run OCR on the original image (no preprocessing — keep colors
            // so Tesseract can use its own binarization which is smarter)
            const result = await Tesseract.recognize(imagePreview, 'deu+eng', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        setProgress(15 + Math.round(m.progress * 75));
                        setProgressLabel('Texterkennung läuft...');
                    }
                }
            });

            setProgress(92);
            setProgressLabel('Wörter werden räumlich analysiert...');

            const ocrText = result.data.text;
            const words = result.data.words;

            console.log('OCR raw text:', ocrText);
            console.log('OCR words with bboxes:', words?.map(w => ({
                text: w.text, bbox: w.bbox, conf: w.confidence
            })));

            // Use word-level spatial parsing instead of line-based parsing
            const parsed = parseWordsIntoItems(words);
            console.log('Spatially parsed items:', parsed);

            // Match against known products
            const matched = parsed.map(item => {
                const match = bestMatch(item.name, productNames);
                const warehouseItem = match
                    ? warehouseItems.find(wi => wi.product_name === match)
                    : null;

                return {
                    ocrName: item.name,
                    ocrQuantity: item.quantity,
                    matchedName: match,
                    matchedItem: warehouseItem,
                    currentQuantity: warehouseItem?.quantity ?? null,
                    diff: warehouseItem ? item.quantity - warehouseItem.quantity : null,
                    accepted: !!match,
                };
            });

            // Find warehouse items not matched
            const matchedProductIds = new Set(
                matched.filter(m => m.matchedItem).map(m => m.matchedItem.product_id)
            );
            const unscanned = warehouseItems
                .filter(wi => !matchedProductIds.has(wi.product_id))
                .map(wi => ({
                    ocrName: null,
                    ocrQuantity: null,
                    matchedName: wi.product_name,
                    matchedItem: wi,
                    currentQuantity: wi.quantity,
                    diff: null,
                    accepted: false,
                    notScanned: true,
                }));

            setProgress(100);
            setProgressLabel('Fertig!');
            setScanResults({ matched, unscanned, rawText: ocrText });
        } catch (err) {
            console.error('OCR Error:', err);
            setScanResults({ error: err.message });
        }

        setScanning(false);
    };

    /* ── Apply scanned values ─────────────────────────────────── */
    const applyResults = async () => {
        if (!scanResults?.matched || !personName) return;

        const changes = scanResults.matched
            .filter(r => r.accepted && r.matchedItem && r.diff !== 0 && r.diff !== null)
            .map(r => ({
                product_id: r.matchedItem.product_id,
                new_quantity: r.ocrQuantity,
            }));

        if (changes.length === 0) {
            setApplyStatus({ type: 'error', message: 'Keine Änderungen zum Übernehmen.' });
            return;
        }

        setApplying(true);
        setApplyStatus(null);

        try {
            const res = await fetch('/api/adjustments/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouse_id: parseInt(warehouseId),
                    person_name: personName,
                    reason: 'Inventar-Scanner Abgleich',
                    changes,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setApplyStatus({ type: 'success', message: `${changes.length} Produkt(e) erfolgreich aktualisiert!` });
            } else {
                setApplyStatus({ type: 'error', message: data.error || 'Fehler beim Speichern.' });
            }
        } catch {
            setApplyStatus({ type: 'error', message: 'Verbindungsfehler.' });
        }

        setApplying(false);
    };

    /* ── Toggle accept ────────────────────────────────────────── */
    const toggleAccept = (index) => {
        setScanResults(prev => {
            const newMatched = [...prev.matched];
            newMatched[index] = { ...newMatched[index], accepted: !newMatched[index].accepted };
            return { ...prev, matched: newMatched };
        });
    };

    /* ── Reset ────────────────────────────────────────────────── */
    const reset = () => {
        setImage(null);
        setImagePreview(null);
        setScanResults(null);
        setApplyStatus(null);
        setProgress(0);
    };

    const acceptedChanges = scanResults?.matched?.filter(r => r.accepted && r.diff !== 0 && r.diff !== null) || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-card border border-border/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ───────────────────────────────────── */}
                <div className="flex items-center justify-between p-5 border-b border-border/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20">
                            <ScanLine className="h-5 w-5 text-violet-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Inventar Scanner</h3>
                            <p className="text-sm text-muted-foreground">
                                Screenshot hochladen → automatisch erkennen
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* ── Body (scrollable) ────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">

                    {/* Upload area */}
                    {!imagePreview && (
                        <div
                            ref={dropZoneRef}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-border/50 rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
                        >
                            <div className="flex flex-col items-center gap-4">
                                <div className="p-4 rounded-2xl bg-secondary">
                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="font-semibold text-lg">Screenshot hier ablegen</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        oder klicken zum Auswählen • <kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">Strg+V</kbd> zum Einfügen
                                    </p>
                                </div>
                                <p className="text-xs text-muted-foreground/60">
                                    PNG, JPG, WebP • Am besten nur den Inventar-Bereich zuschneiden
                                </p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleFile(e.target.files[0])}
                            />
                        </div>
                    )}

                    {/* Image preview + scan button */}
                    {imagePreview && !scanResults && (
                        <div className="space-y-4">
                            <div className="relative rounded-xl overflow-hidden border border-border/50 bg-secondary/30">
                                <img
                                    src={imagePreview}
                                    alt="Screenshot"
                                    className="w-full max-h-64 object-contain"
                                />
                                <div className="absolute top-3 right-3">
                                    <Button variant="secondary" size="sm" onClick={reset}>
                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                        Anderes Bild
                                    </Button>
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200">
                                <strong>Tipp:</strong> Für beste Ergebnisse nur den Inventar-Bereich (die Item-Karten) zuschneiden, ohne die Überschrift und Suchleiste.
                            </div>

                            {scanning ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        <span className="text-sm font-medium">{progressLabel}</span>
                                    </div>
                                    <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-violet-500 to-blue-500 h-full rounded-full transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">{progress}%</p>
                                </div>
                            ) : (
                                <Button onClick={runScan} className="w-full" size="lg">
                                    <ScanLine className="h-5 w-5 mr-2" />
                                    Jetzt scannen
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {scanResults?.error && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                            <div>
                                <p className="font-medium text-destructive">Scanfehler</p>
                                <p className="text-sm text-muted-foreground">{scanResults.error}</p>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {scanResults?.matched && (
                        <div className="space-y-4">
                            {/* Stats */}
                            <div className="flex gap-3 flex-wrap">
                                <Badge variant="outline" className="text-sm py-1 px-3">
                                    {scanResults.matched.length} erkannt
                                </Badge>
                                <Badge variant="success" className="text-sm py-1 px-3">
                                    {scanResults.matched.filter(r => r.matchedItem).length} zugeordnet
                                </Badge>
                                {scanResults.matched.filter(r => !r.matchedItem).length > 0 && (
                                    <Badge variant="warning" className="text-sm py-1 px-3">
                                        {scanResults.matched.filter(r => !r.matchedItem).length} nicht zugeordnet
                                    </Badge>
                                )}
                            </div>

                            {/* Small preview */}
                            {imagePreview && (
                                <div className="rounded-lg overflow-hidden border border-border/30 bg-secondary/20">
                                    <img src={imagePreview} alt="Screenshot" className="w-full max-h-32 object-contain opacity-60" />
                                </div>
                            )}

                            {/* Results table */}
                            <div className="rounded-xl border border-border/50 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-secondary/50 border-b border-border/50">
                                            <th className="text-left p-3 font-semibold w-8">✓</th>
                                            <th className="text-left p-3 font-semibold">Erkannt (OCR)</th>
                                            <th className="text-left p-3 font-semibold">
                                                <ArrowRight className="h-3.5 w-3.5 inline mr-1" />
                                                Zugeordnet
                                            </th>
                                            <th className="text-right p-3 font-semibold">Gescannt</th>
                                            <th className="text-right p-3 font-semibold">Aktuell</th>
                                            <th className="text-right p-3 font-semibold">Differenz</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scanResults.matched.map((row, idx) => (
                                            <tr
                                                key={idx}
                                                className={`border-b border-border/30 transition-colors ${row.accepted ? 'bg-success/5' : 'opacity-50'
                                                    } ${row.matchedItem ? 'cursor-pointer hover:bg-secondary/30' : ''}`}
                                                onClick={() => row.matchedItem && toggleAccept(idx)}
                                            >
                                                <td className="p-3">
                                                    {row.matchedItem && (
                                                        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${row.accepted
                                                            ? 'bg-success border-success text-success-foreground'
                                                            : 'border-border'
                                                            }`}>
                                                            {row.accepted && <CheckCircle className="h-3.5 w-3.5" />}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <span className="font-mono text-xs bg-secondary/50 px-2 py-1 rounded">
                                                        {row.ocrName}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    {row.matchedName ? (
                                                        <span className="font-medium text-success">{row.matchedName}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">—</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right font-mono font-semibold">
                                                    {row.ocrQuantity?.toLocaleString('de-DE')}
                                                </td>
                                                <td className="p-3 text-right font-mono text-muted-foreground">
                                                    {row.currentQuantity?.toLocaleString('de-DE') ?? '—'}
                                                </td>
                                                <td className="p-3 text-right font-mono font-semibold">
                                                    {row.diff !== null ? (
                                                        <span className={
                                                            row.diff > 0 ? 'text-success' :
                                                                row.diff < 0 ? 'text-destructive' :
                                                                    'text-muted-foreground'
                                                        }>
                                                            {row.diff > 0 && '+'}{row.diff.toLocaleString('de-DE')}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        ))}

                                        {scanResults.unscanned?.length > 0 && (
                                            <>
                                                <tr>
                                                    <td colSpan={6} className="p-3 bg-secondary/30 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                                                        Nicht im Screenshot erkannt
                                                    </td>
                                                </tr>
                                                {scanResults.unscanned.map((row, idx) => (
                                                    <tr key={`unscanned-${idx}`} className="border-b border-border/30 opacity-40">
                                                        <td className="p-3" />
                                                        <td className="p-3 text-muted-foreground italic">—</td>
                                                        <td className="p-3 text-muted-foreground">{row.matchedName}</td>
                                                        <td className="p-3 text-right text-muted-foreground">—</td>
                                                        <td className="p-3 text-right font-mono text-muted-foreground">
                                                            {row.currentQuantity?.toLocaleString('de-DE')}
                                                        </td>
                                                        <td className="p-3 text-right text-muted-foreground">—</td>
                                                    </tr>
                                                ))}
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Apply section */}
                            {acceptedChanges.length > 0 && (
                                <div className="space-y-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
                                    <h4 className="font-semibold flex items-center gap-2">
                                        <Save className="h-4 w-4 text-primary" />
                                        Bestände übernehmen ({acceptedChanges.length} Änderung{acceptedChanges.length > 1 ? 'en' : ''})
                                    </h4>
                                    <div className="space-y-2">
                                        <Label htmlFor="scanner-person">Dein Name *</Label>
                                        <Input
                                            id="scanner-person"
                                            placeholder="Wer führt den Abgleich durch?"
                                            value={personName}
                                            onChange={(e) => setPersonName(e.target.value)}
                                        />
                                    </div>

                                    {applyStatus && (
                                        <div className={`flex items-center gap-2 p-3 rounded-lg ${applyStatus.type === 'success'
                                            ? 'bg-success/10 text-success'
                                            : 'bg-destructive/10 text-destructive'
                                            }`}>
                                            {applyStatus.type === 'success'
                                                ? <CheckCircle className="h-4 w-4" />
                                                : <AlertCircle className="h-4 w-4" />
                                            }
                                            <span className="text-sm font-medium">{applyStatus.message}</span>
                                        </div>
                                    )}

                                    <Button
                                        onClick={applyResults}
                                        disabled={applying || !personName || applyStatus?.type === 'success'}
                                        className="w-full"
                                    >
                                        {applying ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Wird übernommen...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Bestände aktualisieren
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={reset}>
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Neuer Scan
                                </Button>
                            </div>

                            {/* Debug: raw OCR text */}
                            <details className="text-xs">
                                <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                                    Roher OCR-Text anzeigen
                                </summary>
                                <pre className="mt-2 p-3 rounded-lg bg-secondary/50 font-mono text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                                    {scanResults.rawText}
                                </pre>
                            </details>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
