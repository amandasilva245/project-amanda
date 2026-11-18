FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x entrypoint.sh

EXPOSE 8000

# Remove um eventual "\r" (fim de linha do Windows) antes de executar: com o
# código montado do Windows (./backend:/app), o script pode chegar em CRLF.
CMD ["sh", "-c", "tr -d '\\r' < entrypoint.sh > /tmp/entrypoint.sh && exec sh /tmp/entrypoint.sh"]
