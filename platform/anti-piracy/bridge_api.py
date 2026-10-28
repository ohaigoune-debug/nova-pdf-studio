"""Private, read-only dashboard bridge for the existing Madrasadz bot SQLite database.
Run as a separate service; do not expose this port to the internet.
"""
import hmac
import json
import os
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class Handler(BaseHTTPRequestHandler):
    server_version = "MadrasadzAntiPiracyBridge/1"
    def do_GET(self):
        secret = os.getenv("ANTI_PIRACY_API_KEY", "")
        supplied = self.headers.get("Authorization", "")
        if len(secret) < 32 or not hmac.compare_digest(supplied, "Bearer " + secret):
            return self.respond(401, {"error": "unauthorized"})
        if self.path != "/v1/dashboard":
            return self.respond(404, {"error": "not_found"})
        path = Path(os.getenv("DB_PATH", "/data/findings.sqlite3"))
        if not path.is_file():
            return self.respond(200, {"status": "waiting", "counts": {}, "channels": [], "cases": []})
        try:
            conn = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True, timeout=5)
            conn.row_factory = sqlite3.Row
            try:
                counts = {r["status"]: r["count"] for r in conn.execute(
                    "SELECT status, count(*) AS count FROM findings GROUP BY status")}
                channels = [r["username"] for r in conn.execute(
                    "SELECT username FROM channels ORDER BY username LIMIT 200")]
                cases = [dict(r) for r in conn.execute(
                    """SELECT id, source, url, snippet, matched_terms, has_media, published_at,
                              detected_at, status FROM findings ORDER BY id DESC LIMIT 50""")]
            finally:
                conn.close()
        except (sqlite3.Error, OSError):
            return self.respond(503, {"error": "database_unavailable"})
        return self.respond(200, {"status": "ready", "counts": counts,
                                  "channels": channels, "cases": cases})
    def do_POST(self):
        self.respond(405, {"error": "read_only"})
    def respond(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, fmt, *args):
        return

def main():
    key = os.getenv("ANTI_PIRACY_API_KEY", "")
    if len(key) < 32 or key.startswith("PASTE_"):
        raise SystemExit("Set a random ANTI_PIRACY_API_KEY of at least 32 characters")
    port = int(os.getenv("ANTI_PIRACY_API_PORT", "8091"))
    print(f"Read-only private bridge listening on port {port}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()

if __name__ == "__main__":
    main()
