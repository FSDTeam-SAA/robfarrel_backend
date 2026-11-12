"""Serve ai-tester.html and forward /api/* to the backend, so the browser never makes a cross-origin call.

    python test-tools/serve-tester.py                      # http://localhost:3000 -> backend :5000
    python test-tools/serve-tester.py --port 3001 --backend http://localhost:5000

Standard library only. For local testing; not for production.
"""

import argparse
import http.server
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
FORWARD_HEADERS = ("content-type", "authorization", "accept")


def make_handler(backend: str) -> type[http.server.SimpleHTTPRequestHandler]:
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(HERE), **kwargs)

        def do_GET(self) -> None:
            if self.path.startswith("/api/"):
                return self._proxy()
            if self.path in ("/", ""):
                self.path = "/ai-tester.html"
            return super().do_GET()

        def do_POST(self) -> None:
            self._proxy()

        def do_PATCH(self) -> None:
            self._proxy()

        def do_DELETE(self) -> None:
            self._proxy()

        def _proxy(self) -> None:
            length = int(self.headers.get("content-length") or 0)
            body = self.rfile.read(length) if length else None
            headers = {k: v for k, v in self.headers.items() if k.lower() in FORWARD_HEADERS}
            request = urllib.request.Request(
                backend + self.path, data=body, headers=headers, method=self.command
            )
            try:
                with urllib.request.urlopen(request, timeout=300) as response:
                    status, payload = response.status, response.read()
                    content_type = response.headers.get("content-type", "application/json")
            except urllib.error.HTTPError as exc:
                status, payload = exc.code, exc.read()
                content_type = exc.headers.get("content-type", "application/json")
            except (urllib.error.URLError, TimeoutError) as exc:
                status = 502
                payload = (
                    '{"success":false,"message":"Tester proxy could not reach the backend at '
                    + backend
                    + ": "
                    + str(getattr(exc, "reason", exc)).replace('"', "'")
                    + '"}'
                ).encode()
                content_type = "application/json"
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=3000)
    parser.add_argument("--backend", default="http://localhost:5000")
    args = parser.parse_args()
    backend = args.backend.rstrip("/")
    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(backend))
    print(f"AI tester: http://localhost:{args.port}/  (API calls forwarded to {backend})")
    server.serve_forever()


if __name__ == "__main__":
    main()
