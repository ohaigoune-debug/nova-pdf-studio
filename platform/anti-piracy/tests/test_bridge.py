import http.client
import json
import threading
from http.server import ThreadingHTTPServer

from bot.bridge_api import Handler

def test_bridge_readonly_auth_and_missing_db(tmp_path, monkeypatch):
    monkeypatch.setenv('ANTI_PIRACY_API_KEY', 'K' * 40)
    monkeypatch.setenv('DB_PATH', str(tmp_path / 'missing.db'))
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        def request(method, headers=None):
            conn = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=3)
            conn.request(method, '/v1/dashboard', headers=headers or {})
            response = conn.getresponse()
            status = response.status
            payload = json.loads(response.read())
            conn.close()
            return status, payload
        assert request('GET')[0] == 401
        assert request('POST')[0] == 405
        status, result = request('GET', {'Authorization': 'Bearer ' + 'K' * 40})
        assert status == 200
        assert result['status'] == 'waiting'
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
