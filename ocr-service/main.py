"""
OCR Microservice for Nochnaya Krone Inventory Scanner.
Receives a game screenshot, crops a grid of inventory cells,
and returns recognized item names + quantities as JSON.
"""

import io
import re
import logging
from contextlib import asynccontextmanager

import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ocr-service")

# ── Global OCR instances (loaded once at startup) ────────────────
ocr_num = None   # Optimized for digits
ocr_name = None  # Optimized for text (latin chars)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load PaddleOCR models once at startup."""
    global ocr_num, ocr_name
    from paddleocr import PaddleOCR

    logger.info("Loading PaddleOCR models...")

    # Number recognition: digits only
    ocr_num = PaddleOCR(
        use_angle_cls=False,
        lang="en",
        show_log=False,
        det=True,
        rec=True,
        cls=False,
    )

    # Name recognition: latin characters (German + English)
    ocr_name = PaddleOCR(
        use_angle_cls=False,
        lang="latin",
        show_log=False,
        det=True,
        rec=True,
        cls=False,
    )

    logger.info("PaddleOCR models loaded and ready!")
    yield
    logger.info("Shutting down OCR service.")


app = FastAPI(title="Nochnaya Krone OCR Service", lifespan=lifespan)


# ── Health check ─────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "models_loaded": ocr_num is not None and ocr_name is not None}


# ── Preprocessing helpers ────────────────────────────────────────
def crop_side(img: Image.Image, side: str) -> Image.Image:
    """Crop the left or right half of the image."""
    w, h = img.size
    if side == "left":
        return img.crop((0, 0, w // 2, h))
    else:
        return img.crop((w // 2, 0, w, h))


def preprocess_for_ocr(img: Image.Image, scale: int = 3) -> np.ndarray:
    """Upscale and convert to numpy array for PaddleOCR."""
    w, h = img.size
    img_scaled = img.resize((w * scale, h * scale), Image.LANCZOS)
    return np.array(img_scaled)


def extract_number(text: str) -> int | None:
    """Extract a number from OCR text, handling German formatting."""
    # Remove common OCR artifacts
    cleaned = re.sub(r"[^0-9.,]", "", text.strip())
    if not cleaned:
        return None
    # Remove thousand separators (dots in German) and decimal commas
    cleaned = cleaned.replace(".", "").replace(",", "")
    try:
        num = int(cleaned)
        return num if num > 0 else None
    except ValueError:
        return None


def clean_name(text: str) -> str | None:
    """Clean up an OCR-recognized item name."""
    # Remove common OCR artifacts
    cleaned = re.sub(r"[|><'\"`_~\-\[\]{}()\\/@#$%^&*+=]", " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    # Must contain at least some letters and be long enough
    if len(cleaned) < 2 or not re.search(r"[a-zA-ZäöüÄÖÜß]", cleaned):
        return None
    return cleaned


# ── Main scan endpoint ───────────────────────────────────────────
@app.post("/scan")
async def scan_inventory(
    image: UploadFile = File(...),
    side: str = Form("left"),
    grid_x: float = Form(5),
    grid_y: float = Form(5),
    grid_w: float = Form(90),
    grid_h: float = Form(90),
    cols: int = Form(4),
    rows: int = Form(3),
):
    """
    Scan a game inventory screenshot.

    Args:
        image: Full game screenshot
        side: "left" or "right" — which side contains the inventory panel
        grid_x/y/w/h: Grid position in % of the cropped side
        cols/rows: Number of columns and rows in the inventory grid
    """
    if side not in ("left", "right"):
        raise HTTPException(400, "side must be 'left' or 'right'")
    if cols < 1 or cols > 10 or rows < 1 or rows > 10:
        raise HTTPException(400, "cols and rows must be between 1 and 10")

    try:
        # Read and decode image
        image_bytes = await image.read()
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        logger.info(f"Received image: {img.size[0]}x{img.size[1]}, side={side}, grid={cols}x{rows}")

        # Crop to selected side
        panel = crop_side(img, side)
        panel_w, panel_h = panel.size

        # Calculate grid position in pixels
        gx = (grid_x / 100) * panel_w
        gy = (grid_y / 100) * panel_h
        gw = (grid_w / 100) * panel_w
        gh = (grid_h / 100) * panel_h

        cell_w = gw / cols
        cell_h = gh / rows

        results = []

        for row in range(rows):
            for col in range(cols):
                cell_x = gx + col * cell_w
                cell_y = gy + row * cell_h

                # ── Number region: top 25% of cell, center 60% width ──
                num_x = cell_x + cell_w * 0.2
                num_y = cell_y
                num_w = cell_w * 0.6
                num_h = cell_h * 0.25

                num_crop = panel.crop((
                    int(num_x), int(num_y),
                    int(num_x + num_w), int(num_y + num_h)
                ))

                # ── Name region: bottom 28% of cell ──
                name_x = cell_x
                name_y = cell_y + cell_h * 0.72
                name_w = cell_w
                name_h = cell_h * 0.28

                name_crop = panel.crop((
                    int(name_x), int(name_y),
                    int(name_x + name_w), int(name_y + name_h)
                ))

                quantity = None
                name = None

                # OCR the number region
                try:
                    num_arr = preprocess_for_ocr(num_crop)
                    num_result = ocr_num.ocr(num_arr, cls=False)
                    if num_result and num_result[0]:
                        for line in num_result[0]:
                            text = line[1][0]
                            parsed = extract_number(text)
                            if parsed is not None:
                                quantity = parsed
                                break
                except Exception as e:
                    logger.debug(f"Number OCR failed for cell [{row},{col}]: {e}")

                # OCR the name region
                try:
                    name_arr = preprocess_for_ocr(name_crop)
                    name_result = ocr_name.ocr(name_arr, cls=False)
                    if name_result and name_result[0]:
                        # Combine all detected text lines
                        texts = [line[1][0] for line in name_result[0]]
                        combined = " ".join(texts)
                        cleaned = clean_name(combined)
                        if cleaned:
                            name = cleaned
                except Exception as e:
                    logger.debug(f"Name OCR failed for cell [{row},{col}]: {e}")

                logger.info(f"Cell [{row},{col}]: qty={quantity}, name=\"{name}\"")

                if name:
                    results.append({
                        "name": name,
                        "quantity": quantity if quantity is not None else 1,
                    })

        logger.info(f"Scan complete: {len(results)} items found")
        return JSONResponse(content={"items": results, "total_cells": cols * rows})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scan failed: {e}", exc_info=True)
        raise HTTPException(500, f"OCR scan failed: {str(e)}")
