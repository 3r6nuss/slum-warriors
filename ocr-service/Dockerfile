FROM python:3.11-slim

# System dependencies for PaddleOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download PaddleOCR models at build time so container starts fast
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=False, lang='latin', show_log=False)"

COPY main.py .

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
