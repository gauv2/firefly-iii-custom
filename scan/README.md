# Scan service

Reads a photo or PDF of a receipt or invoice and returns its fields as JSON, for Finance's Scan page.
It runs [Claude Code](https://docs.claude.com/en/docs/claude-code) in headless mode (`claude -p`) with
structured output, signed in with a Claude subscription. There is no API key; usage counts against the
subscription's limits.

```
POST /extract   body: the file, Content-Type image/jpeg | image/png | image/webp | application/pdf
                -> {"ok": true, "data": {"document_type": "receipt", "merchant": "…", "date": "2026-10-28",
                    "total": 12.54, "currency": "EUR", "vat_total": 1.04, "line_items": […], …}, "ms": 9951}
GET  /health    -> {"ok": true}
```

The schema is in `server.mjs`. Claude may only use the Read tool, and only on the uploaded file in its
own temporary folder (`--tools Read --allowedTools "Read(./document.pdf)" --permission-mode dontAsk`), so
text on a document cannot make it do anything else. Two documents are read at a time; the rest wait.

## Run

Create a long-lived token with your Claude account, on any machine with Claude Code:

```sh
claude setup-token
```

Store it in `scan.env` next to your compose file (mode 600, never commit it):

```
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat…
```

Then add the service to Firefly's compose project. It needs no port: the app reaches it as
`http://scan:8080` (override with `FINANCE_SCAN_URL` on the app).

```yaml
  scan:
    build: ./scan            # or image: finance-scan
    restart: unless-stopped
    env_file:
      - path: scan.env
        required: false
    read_only: true
    tmpfs:
      - /tmp
      - /home/node:uid=1000,gid=1000
```

`SCAN_MODEL` picks the model (default `haiku`, which reads receipts well in about ten seconds).
`CLAUDE_CODE_VERSION` in the Dockerfile pins the Claude Code release.

## Privacy

Every scanned document is sent to Anthropic to be read, under your Claude account's terms. Nothing is
stored by the service itself: the file is deleted as soon as it has been read.
