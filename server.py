import http.server
import socketserver
import os
import sys

PORT = 8000

class CleanUrlHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Extract path without query parameters or anchors
        url_parts = self.path.split('?')
        req_path = url_parts[0].split('#')[0]
        
        # If requesting a route without extension like /login, /dashboard, etc.
        if req_path and req_path != '/':
            clean_name = req_path.strip('/')
            _, ext = os.path.splitext(clean_name)
            if not ext:
                html_candidate = clean_name + '.html'
                if os.path.isfile(html_candidate):
                    # Rewrite path to the .html file
                    query_str = ('?' + url_parts[1]) if len(url_parts) > 1 else ''
                    self.path = '/' + html_candidate + query_str

        return super().do_GET()

    def end_headers(self):
        # Enable CORS and disable aggressive caching for local dev
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    # Change working directory to script location
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CleanUrlHandler) as httpd:
        print(f"========================================================")
        print(f"  VIDEO ADMIN SERVER DANG CHAY TAI:")
        print(f"  -> http://localhost:{PORT}")
        print(f"  -> Ho tro ca URL co .html va khong co .html")
        print(f"  Bấm Ctrl + C de dung server.")
        print(f"========================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDa dung server.")
            sys.exit(0)
