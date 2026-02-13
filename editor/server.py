from __future__ import annotations

import json
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent.parent
EDITOR_DIR = Path(__file__).resolve().parent
EVENTOS_FILE = ROOT / "eventos" / "data.json"
DIRETRIZES_FILE = ROOT / "diretrizes" / "data.json"


def read_json_file(path: Path, default):
    try:
        raw = path.read_text(encoding="utf-8-sig")
        data = json.loads(raw)
        return data
    except Exception:
        return default


def write_json_file(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, indent=2, ensure_ascii=False)
    path.write_text(text + "\n", encoding="utf-8")


class EditorHandler(BaseHTTPRequestHandler):
    server_version = "UsoJalecoEditor/1.0"

    def _send_bytes(self, status: int, payload: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_json(self, status: int, payload) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send_bytes(status, data, "application/json; charset=utf-8")

    def _read_body_json(self):
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return None
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return None

    def _send_index(self):
        index_file = EDITOR_DIR / "index.html"
        if not index_file.exists():
            self._send_bytes(
                HTTPStatus.NOT_FOUND,
                b"Editor file not found.",
                "text/plain; charset=utf-8",
            )
            return
        self._send_bytes(
            HTTPStatus.OK,
            index_file.read_bytes(),
            "text/html; charset=utf-8",
        )

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):  # noqa: N802
        path = urlparse(self.path).path

        if path in ("/", "/index.html"):
            self._send_index()
            return

        if path == "/api/data":
            self._send_json(
                HTTPStatus.OK,
                {
                    "eventos": read_json_file(EVENTOS_FILE, []),
                    "diretrizes": read_json_file(DIRETRIZES_FILE, []),
                },
            )
            return

        if path == "/api/data/eventos":
            self._send_json(HTTPStatus.OK, read_json_file(EVENTOS_FILE, []))
            return

        if path == "/api/data/diretrizes":
            self._send_json(HTTPStatus.OK, read_json_file(DIRETRIZES_FILE, []))
            return

        self._send_bytes(
            HTTPStatus.NOT_FOUND,
            b"Not found",
            "text/plain; charset=utf-8",
        )

    def do_POST(self):  # noqa: N802
        path = urlparse(self.path).path
        payload = self._read_body_json()

        if path == "/api/save/eventos":
            if not isinstance(payload, list):
                self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Payload must be a JSON array."})
                return
            write_json_file(EVENTOS_FILE, payload)
            self._send_json(HTTPStatus.OK, {"ok": True, "saved": "eventos", "count": len(payload)})
            return

        if path == "/api/save/diretrizes":
            if not isinstance(payload, list):
                self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Payload must be a JSON array."})
                return
            write_json_file(DIRETRIZES_FILE, payload)
            self._send_json(HTTPStatus.OK, {"ok": True, "saved": "diretrizes", "count": len(payload)})
            return

        if path == "/api/save/all":
            if not isinstance(payload, dict):
                self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Payload must be an object."})
                return

            eventos = payload.get("eventos")
            diretrizes = payload.get("diretrizes")

            if not isinstance(eventos, list) or not isinstance(diretrizes, list):
                self._send_json(
                    HTTPStatus.BAD_REQUEST,
                    {"ok": False, "error": "eventos and diretrizes must be arrays."},
                )
                return

            write_json_file(EVENTOS_FILE, eventos)
            write_json_file(DIRETRIZES_FILE, diretrizes)
            self._send_json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "saved": "all",
                    "eventos_count": len(eventos),
                    "diretrizes_count": len(diretrizes),
                },
            )
            return

        self._send_bytes(
            HTTPStatus.NOT_FOUND,
            b"Not found",
            "text/plain; charset=utf-8",
        )

    def log_message(self, fmt: str, *args) -> None:
        sys.stdout.write("[editor] " + (fmt % args) + "\n")


def run_server(port: int = 8765) -> None:
    address = ("127.0.0.1", port)
    httpd = ThreadingHTTPServer(address, EditorHandler)
    print(f"[editor] running at http://127.0.0.1:{port}")
    print("[editor] this panel writes directly into:")
    print(f"[editor] - {EVENTOS_FILE}")
    print(f"[editor] - {DIRETRIZES_FILE}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[editor] stopped")


if __name__ == "__main__":
    custom_port = 8765
    if len(sys.argv) > 1:
        try:
            custom_port = int(sys.argv[1])
        except ValueError:
            custom_port = 8765
    run_server(custom_port)
