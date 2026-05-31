from http.server import BaseHTTPRequestHandler
import urllib.parse
import urllib.request
import json

TOUR_API_KEY_ENC = "YEf%2BSkkIvUZZNXTEKYwZeTCsNBaGvFdT8z7ULIDufbtKqPpeUobKPUyaXh8gYJhxpFnr%2Fs0Dm0TLVHqe4izd3w%3D%3D"
TOUR_BASE = "https://apis.data.go.kr/B551011/KorService2"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        content_id = qs.get("contentId", [""])[0]
        if not content_id:
            self._error(400, "contentId required")
            return
        other = urllib.parse.urlencode({
            "MobileOS": "ETC", "MobileApp": "CherryBloomWebGIS",
            "_type": "json", "contentId": content_id, "contentTypeId": "15",
        })
        url = f"{TOUR_BASE}/detailIntro2?serviceKey={TOUR_API_KEY_ENC}&{other}"
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
            self._error(502, str(exc))

    def _error(self, code, msg):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"error": msg}).encode())

    def log_message(self, *args):
        pass
