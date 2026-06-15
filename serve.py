#!/usr/bin/env python3
# 開発用の簡易サーバー。
#  - HTML / JS / CSS は常に最新を返す（no-store）
#  - 画像など重い静的アセットはキャッシュさせる（ページ移動のたびの再DLを防ぐ）
# 使い方: python3 serve.py [port]
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

CACHEABLE = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf")


class DevHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        path = self.path.split("?")[0].lower()
        if path.endswith(CACHEABLE):
            # 画像・フォントはキャッシュするが毎回更新確認（変更なければ 304 で本体DLなし）。
            # → 再ダウンロードを避けつつ、差し替え時はすぐ反映される。
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    HTTPServer(("127.0.0.1", port), DevHandler).serve_forever()
