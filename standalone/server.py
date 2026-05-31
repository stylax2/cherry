#!/usr/bin/env python3
"""Static file server + Tour API proxy (CORS bypass for local dev)."""
import json
import os
import urllib.parse
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler

# 포털 일반 인증키(Encoding) — 이미 URL 인코딩된 상태이므로 추가 인코딩 없이 사용
TOUR_API_KEY_ENC  = "YEf%2BSkkIvUZZNXTEKYwZeTCsNBaGvFdT8z7ULIDufbtKqPpeUobKPUyaXh8gYJhxpFnr%2Fs0Dm0TLVHqe4izd3w%3D%3D"
TOUR_BASE         = "https://apis.data.go.kr/B551011/KorService2"
PORT = 8080


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/festival-detail"):
            self._proxy_festival_detail()
        elif self.path.startswith("/api/festivals"):
            self._proxy_festivals()
        else:
            super().do_GET()

    def _proxy_festivals(self):
        other = urllib.parse.urlencode({
            "MobileOS": "ETC", "MobileApp": "CherryBloomWebGIS",
            "_type": "json", "keyword": "벚꽃",
            "contentTypeId": "15", "arrange": "A",
            "numOfRows": "100", "pageNo": "1",
        })
        self._call_tour(f"{TOUR_BASE}/searchKeyword2?serviceKey={TOUR_API_KEY_ENC}&{other}")

    def _proxy_festival_detail(self):
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        content_id = qs.get("contentId", [""])[0]
        if not content_id:
            self._json_error(400, "contentId required")
            return
        other = urllib.parse.urlencode({
            "MobileOS": "ETC", "MobileApp": "CherryBloomWebGIS",
            "_type": "json", "contentId": content_id, "contentTypeId": "15",
        })
        self._call_tour(f"{TOUR_BASE}/detailIntro2?serviceKey={TOUR_API_KEY_ENC}&{other}")

    def _call_tour(self, url):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "CherryBloomWebGIS/1.0"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = resp.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)
        except Exception as exc:
            self._json_error(502, str(exc))

    def _json_error(self, code, msg):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"error": msg}).encode())

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = HTTPServer(("", PORT), Handler)
    print(f"서버 실행 중: http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n서버 종료")
