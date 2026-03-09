import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    X, Upload, ScanLine, Loader2, CheckCircle, AlertCircle,
    ArrowRight, Save, RotateCcw, Grid3x3, Crop
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
    const normalized = ocrName.toLowerCase().trim();
    if (!normalized || normalized.length < 2) return null;
    let best = null, bestScore = Infinity;
    for (const name of productNames) {
        const np = name.toLowerCase().trim();
        const dist = levenshtein(normalized, np);
        const bonus = np.includes(normalized) || normalized.includes(np) ? -2 : 0;
        const score = dist + bonus;
        if (score < bestScore) { bestScore = score; best = name; }
    }
    const threshold = Math.max(3, Math.floor((best?.length || 0) * 0.45));
    return bestScore <= threshold ? best : null;
}

function parseGermanNumber(str) {
    const cleaned = str.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '');
    const num = parseInt(cleaned);
    return isNaN(num) || num < 0 ? 0 : num;
}

/* ══════════════════════════════════════════════════════════════════
   Auto-detect the right inventory panel from a full GTA screenshot.

   The FiveM inventory has two dark-blue panels side by side.
   We detect the blue UI region, find the vertical divider
   between left/right panels, and crop the right panel's item grid
   (skipping the header row with title + search bar).
   ══════════════════════════════════════════════════════════════════ */

/** Check if a pixel is the characteristic FiveM inventory blue */
function isInventoryBlue(r, g, b, a) {
    // The inventory panels have a dark blue semi-transparent look.
    // Typical values: R:15-80, G:25-100, B:80-200, with high alpha.
    // We also accept slightly brighter blues for the card areas.
    if (a < 100) return false; // too transparent
    const blueRatio = b / (r + g + b + 1);
    return blueRatio > 0.38 && b > 60 && r < 120 && g < 140;
}

/**
 * Find the right inventory panel bounds from a full screenshot.
 * Returns { x, y, width, height } of just the item grid area,
 * or null if detection fails.
 */
function detectRightPanel(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const data = ctx.getImageData(0, 0, W, H).data;

    // Step 1: For every column, count how many pixels are "inventory blue"
    const colBlueCounts = new Float32Array(W);
    for (let x = 0; x < W; x++) {
        let count = 0;
        // Sample every 2nd pixel for speed
        for (let y = 0; y < H; y += 2) {
            const idx = (y * W + x) * 4;
            if (isInventoryBlue(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
                count++;
            }
        }
        colBlueCounts[x] = count / (H / 2); // normalize to 0-1
    }

    // Step 2: Find the UI region (columns with >20% blue pixels)
    const blueThreshold = 0.20;
    let uiLeft = -1, uiRight = -1;
    for (let x = 0; x < W; x++) {
        if (colBlueCounts[x] > blueThreshold) {
            if (uiLeft === -1) uiLeft = x;
            uiRight = x;
        }
    }

    if (uiLeft === -1 || uiRight - uiLeft < W * 0.2) {
        console.log('Could not detect inventory UI region');
        return null;
    }

    console.log(`Inventory UI detected: x=${uiLeft} to x=${uiRight} (${uiRight - uiLeft}px wide)`);

    // Step 3: Find the vertical divider between left and right panels.
    // The divider is in the middle ~40-60% of the UI region and has a
    // brief dip in blue density (or a different shade).
    const uiWidth = uiRight - uiLeft;
    const searchStart = uiLeft + Math.floor(uiWidth * 0.35);
    const searchEnd = uiLeft + Math.floor(uiWidth * 0.65);

    let minBlue = Infinity, dividerX = uiLeft + Math.floor(uiWidth / 2);
    // Use a sliding window to find the thinnest blue region (the gap/divider)
    const windowSize = 5;
    for (let x = searchStart; x < searchEnd - windowSize; x++) {
        let sum = 0;
        for (let dx = 0; dx < windowSize; dx++) sum += colBlueCounts[x + dx];
        if (sum < minBlue) {
            minBlue = sum;
            dividerX = x + Math.floor(windowSize / 2);
        }
    }

    console.log(`Panel divider at x=${dividerX}`);

    // Step 4: The right panel starts just after the divider
    const rightPanelX = dividerX + 5;
    const rightPanelWidth = uiRight - rightPanelX;

    if (rightPanelWidth < 100) {
        console.log('Right panel too narrow');
        return null;
    }

    // Step 5: Find the top and bottom of the right panel by scanning rows
    // within the right panel's X range
    const rowBlueCounts = new Float32Array(H);
    for (let y = 0; y < H; y++) {
        let count = 0;
        for (let x = rightPanelX; x < uiRight; x += 2) {
            const idx = (y * W + x) * 4;
            if (isInventoryBlue(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
                count++;
            }
        }
        rowBlueCounts[y] = count / ((uiRight - rightPanelX) / 2);
    }

    let panelTop = -1, panelBottom = -1;
    for (let y = 0; y < H; y++) {
        if (rowBlueCounts[y] > blueThreshold) {
            if (panelTop === -1) panelTop = y;
            panelBottom = y;
        }
    }

    if (panelTop === -1) {
        console.log('Could not detect panel vertical bounds');
        return null;
    }

    const panelHeight = panelBottom - panelTop;

    // Step 6: Skip the header area (title + weight/search bar).
    // The header is roughly the top 12-15% of the panel.
    const headerSkip = Math.floor(panelHeight * 0.13);
    const itemGridTop = panelTop + headerSkip;
    const itemGridHeight = panelBottom - itemGridTop;

    console.log(`Right panel: x=${rightPanelX}, y=${itemGridTop}, w=${rightPanelWidth}, h=${itemGridHeight}`);
    console.log(`(skipped ${headerSkip}px header)`);

    return {
        x: rightPanelX,
        y: itemGridTop,
        width: rightPanelWidth,
        height: itemGridHeight,
    };
}

/* ── Crop helpers ─────────────────────────────────────────────── */
function cropRegion(sourceCanvas, x, y, w, h) {
    const crop = document.createElement('canvas');
    crop.width = w;
    crop.height = h;
    crop.getContext('2d').drawImage(sourceCanvas, x, y, w, h, 0, 0, w, h);
    return crop;
}

function canvasToDataUrl(canvas) {
    return canvas.toDataURL('image/png');
}

/* ── Parse OCR text from one cell ─────────────────────────────── */
function parseCellText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let quantity = null;
    let nameParts = [];

    for (const line of lines) {
        if (/^[\d.,]+$/.test(line)) {
            const num = parseGermanNumber(line);
            if (num > 0 && quantity === null) quantity = num;
        } else {
            const numTextMatch = line.match(/^([\d.,]+)\s+(.+)$/);
            if (numTextMatch && quantity === null) {
                const num = parseGermanNumber(numTextMatch[1]);
                if (num > 0) {
                    quantity = num;
                    const rest = numTextMatch[2].trim();
                    if (rest.length >= 2) nameParts.push(rest);
                }
            } else if (/[a-zA-ZäöüÄÖÜß]/.test(line) && line.length >= 2) {
                nameParts.push(line);
            }
        }
    }

    return { quantity, name: nameParts.join(' ').trim() || null };
}

/* ── Detect rows within the item grid ─────────────────────────── */
function detectRows(canvas, numCols) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;

    const rowBrightness = [];
    for (let y = 0; y < h; y++) {
        let sum = 0;
        for (let x = 0; x < w; x += 2) {
            const idx = (y * w + x) * 4;
            sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        }
        rowBrightness.push(sum / (w / 2));
    }

    const avgB = rowBrightness.reduce((a, b) => a + b, 0) / h;
    const darkThreshold = avgB * 0.65;

    const gaps = [];
    let inGap = false, gapStart = 0;
    for (let y = 0; y < h; y++) {
        if (rowBrightness[y] < darkThreshold) {
            if (!inGap) { inGap = true; gapStart = y; }
        } else {
            if (inGap) {
                if (y - gapStart > 3) gaps.push([gapStart, y]);
                inGap = false;
            }
        }
    }

    const rows = [];
    let prevEnd = 0;
    for (const [gStart, gEnd] of gaps) {
        if (gStart - prevEnd > 30) rows.push([prevEnd, gStart]);
        prevEnd = gEnd;
    }
    if (h - prevEnd > 30) rows.push([prevEnd, h]);

    // Fallback
    if (rows.length === 0) {
        const cellH = Math.floor(w / numCols);
        const numRows = Math.max(1, Math.round(h / cellH));
        const rH = Math.floor(h / numRows);
        for (let r = 0; r < numRows; r++)
            rows.push([r * rH, Math.min((r + 1) * rH, h)]);
    }

    return rows;
}


/* ══════════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════════ */
export default function InventoryScanner({ warehouseItems, warehouseId, user, onClose }) {
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [croppedPreview, setCroppedPreview] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    const [scanResults, setScanResults] = useState(null);
    const [applying, setApplying] = useState(false);
    const [applyStatus, setApplyStatus] = useState(null);
    const [personName, setPersonName] = useState(user?.display_name || user?.username || '');
    const [numCols, setNumCols] = useState(4);
    const [detectionInfo, setDetectionInfo] = useState(null);

    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);

    const productNames = warehouseItems.map(i => i.product_name);

    /* ── File handling ─────────────────────────────────────────── */
    const handleFile = useCallback((file) => {
        if (!file || !file.type.startsWith('image/')) return;
        setImage(file);
        setScanResults(null);
        setApplyStatus(null);
        setCroppedPreview(null);
        setDetectionInfo(null);

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

    /* ── Run scan ─────────────────────────────────────────────── */
    const runScan = async () => {
        if (!image) return;
        setScanning(true);
        setProgress(0);
        setProgressLabel('Lade Tesseract.js...');
        setScanResults(null);
        setCroppedPreview(null);

        try {
            const Tesseract = await import('tesseract.js');

            setProgressLabel('Bild wird analysiert...');
            setProgress(3);

            // Load image onto canvas
            const img = new Image();
            img.src = imagePreview;
            await new Promise((resolve) => { img.onload = resolve; });

            const fullCanvas = document.createElement('canvas');
            fullCanvas.width = img.naturalWidth;
            fullCanvas.height = img.naturalHeight;
            fullCanvas.getContext('2d').drawImage(img, 0, 0);

            setProgressLabel('Rechtes Inventarfeld wird gesucht...');
            setProgress(5);

            // Auto-detect the right panel
            const panel = detectRightPanel(fullCanvas);

            let gridCanvas;
            if (panel) {
                // Successfully detected → crop to item grid
                gridCanvas = cropRegion(fullCanvas, panel.x, panel.y, panel.width, panel.height);
                setCroppedPreview(canvasToDataUrl(gridCanvas));
                setDetectionInfo(`Rechtes Panel erkannt: ${panel.width}×${panel.height}px (ab x=${panel.x})`);
            } else {
                // Fallback: use the entire image (user may have already cropped)
                gridCanvas = fullCanvas;
                setDetectionInfo('Kein Panel erkannt – scanne gesamtes Bild');
            }

            setProgressLabel('Grid wird aufgeteilt...');
            setProgress(8);

            // Detect rows and split into cells
            const rows = detectRows(gridCanvas, numCols);
            const cellWidth = Math.floor(gridCanvas.width / numCols);

            console.log(`Grid: ${numCols} cols × ${rows.length} rows`);

            const cells = [];
            for (let r = 0; r < rows.length; r++) {
                const [y1, y2] = rows[r];
                for (let c = 0; c < numCols; c++) {
                    cells.push({
                        row: r, col: c,
                        dataUrl: canvasToDataUrl(
                            cropRegion(gridCanvas, c * cellWidth, y1, cellWidth, y2 - y1)
                        ),
                    });
                }
            }

            setProgressLabel(`${cells.length} Zellen gefunden, scanne...`);
            setProgress(10);

            // OCR each cell
            const parsed = [];
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                setProgress(10 + Math.round((i / cells.length) * 80));
                setProgressLabel(`Zelle ${i + 1}/${cells.length}...`);

                try {
                    const result = await Tesseract.recognize(cell.dataUrl, 'deu+eng');
                    const { quantity, name } = parseCellText(result.data.text);
                    console.log(`[${cell.row},${cell.col}] "${result.data.text.trim()}" → qty=${quantity} name="${name}"`);
                    if (quantity !== null && name) {
                        parsed.push({ name, quantity, row: cell.row, col: cell.col });
                    }
                } catch (err) {
                    console.warn(`Cell [${cell.row},${cell.col}] failed:`, err);
                }
            }

            setProgress(92);
            setProgressLabel('Abgleich...');

            // Match
            const matched = parsed.map(item => {
                const match = bestMatch(item.name, productNames);
                const wi = match ? warehouseItems.find(w => w.product_name === match) : null;
                return {
                    ocrName: item.name, ocrQuantity: item.quantity,
                    matchedName: match, matchedItem: wi,
                    currentQuantity: wi?.quantity ?? null,
                    diff: wi ? item.quantity - wi.quantity : null,
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

            setProgress(100);
            setProgressLabel('Fertig!');
            setScanResults({
                matched, unscanned,
                gridInfo: `${numCols} Spalten × ${rows.length} Zeilen = ${cells.length} Zellen`,
            });
        } catch (err) {
            console.error('OCR Error:', err);
            setScanResults({ error: err.message });
        }
        setScanning(false);
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
                    reason: 'Inventar-Scanner Abgleich', changes,
                }),
            });
            const data = await res.json();
            setApplyStatus(res.ok
                ? { type: 'success', message: `${changes.length} Produkt(e) aktualisiert!` }
                : { type: 'error', message: data.error || 'Fehler.' });
        } catch { setApplyStatus({ type: 'error', message: 'Verbindungsfehler.' }); }
        setApplying(false);
    };

    const toggleAccept = (idx) => {
        setScanResults(prev => {
            const m = [...prev.matched];
            m[idx] = { ...m[idx], accepted: !m[idx].accepted };
            return { ...prev, matched: m };
        });
    };

    const reset = () => {
        setImage(null); setImagePreview(null); setCroppedPreview(null);
        setScanResults(null); setApplyStatus(null); setProgress(0);
        setDetectionInfo(null);
    };

    const acceptedChanges = scanResults?.matched?.filter(r => r.accepted && r.diff !== 0 && r.diff !== null) || [];

    /* ── Render ────────────────────────────────────────────────── */
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-card border border-border/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20">
                            <ScanLine className="h-5 w-5 text-violet-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Inventar Scanner</h3>
                            <p className="text-sm text-muted-foreground">
                                Ganzen Screenshot reinwerfen – rechtes Panel wird automatisch erkannt
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">

                    {/* Upload */}
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
                                    <p className="font-semibold text-lg">GTA Screenshot reinwerfen</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Kompletter Screenshot • <kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">Strg+V</kbd> oder Drag & Drop
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                                    <Crop className="h-3.5 w-3.5" />
                                    Rechtes Inventar-Panel wird automatisch erkannt
                                </div>
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

                    {/* Preview + Settings */}
                    {imagePreview && !scanResults && (
                        <div className="space-y-4">
                            <div className="relative rounded-xl overflow-hidden border border-border/50 bg-secondary/30">
                                <img src={imagePreview} alt="Screenshot" className="w-full max-h-48 object-contain" />
                                <div className="absolute top-3 right-3">
                                    <Button variant="secondary" size="sm" onClick={reset}>
                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                        Anderes Bild
                                    </Button>
                                </div>
                            </div>

                            {/* Grid settings */}
                            <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 border border-border/30">
                                <Grid3x3 className="h-5 w-5 text-muted-foreground shrink-0" />
                                <div className="flex items-center gap-3 flex-1">
                                    <Label className="text-sm whitespace-nowrap">Spalten:</Label>
                                    <div className="flex items-center gap-2">
                                        {[3, 4, 5, 6].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setNumCols(n)}
                                                className={`h-9 w-9 rounded-lg font-bold text-sm transition-all ${numCols === n
                                                    ? 'bg-primary text-primary-foreground shadow-md'
                                                    : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
                                                    }`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>
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
                            {/* Info badges */}
                            <div className="flex gap-3 flex-wrap items-center">
                                {detectionInfo && (
                                    <Badge variant="outline" className="text-sm py-1 px-3">
                                        <Crop className="h-3 w-3 mr-1.5" />
                                        {detectionInfo}
                                    </Badge>
                                )}
                                <Badge variant="outline" className="text-sm py-1 px-3">
                                    <Grid3x3 className="h-3 w-3 mr-1.5" />
                                    {scanResults.gridInfo}
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

                            {/* Cropped preview – show what was auto-detected */}
                            {croppedPreview && (
                                <details className="rounded-lg border border-border/30 overflow-hidden">
                                    <summary className="p-3 cursor-pointer text-sm text-muted-foreground hover:text-foreground bg-secondary/20 transition-colors">
                                        Erkannter Inventar-Bereich anzeigen
                                    </summary>
                                    <div className="border-t border-border/30 bg-secondary/10">
                                        <img src={croppedPreview} alt="Erkannter Bereich" className="w-full max-h-48 object-contain" />
                                    </div>
                                </details>
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
                                                            ? 'bg-success border-success text-success-foreground' : 'border-border'
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
                                                    {row.matchedName
                                                        ? <span className="font-medium text-success">{row.matchedName}</span>
                                                        : <span className="text-muted-foreground italic">—</span>}
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
                                                                row.diff < 0 ? 'text-destructive' : 'text-muted-foreground'
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
                                                    <tr key={`u-${idx}`} className="border-b border-border/30 opacity-40">
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

                            {/* Apply */}
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
                                            ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                                            }`}>
                                            {applyStatus.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                            <span className="text-sm font-medium">{applyStatus.message}</span>
                                        </div>
                                    )}
                                    <Button onClick={applyResults} disabled={applying || !personName || applyStatus?.type === 'success'} className="w-full">
                                        {applying
                                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Wird übernommen...</>
                                            : <><Save className="h-4 w-4 mr-2" />Bestände aktualisieren</>}
                                    </Button>
                                </div>
                            )}

                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={reset}>
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Neuer Scan
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
