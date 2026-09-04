#!/usr/bin/env python3
"""
Kavach AI — run the demo on THIS laptop.

Simplest possible option. No certificate, no pip install, nothing to
configure. Opens your browser automatically.

    python 1_RUN_ON_LAPTOP.py

The microphone works because "localhost" is treated as a secure origin.
The laptop has no accelerometer, so use the on-screen inject buttons to
drive motion — which is what you should do on stage anyway.

Press Ctrl+C to stop.
"""
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

PORT = 8000


def find_html():
    here = os.path.dirname(os.path.abspath(__file__))
    for name in ("index.html", "kavach_ai_demo.html"):
        if os.path.exists(os.path.join(here, name)):
            return name
    for name in sorted(os.listdir(here)):
        if name.lower().endswith(".html"):
            return name
    return None


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    page = find_html()
    if not page:
        print("\nNo .html file found next to this script.")
        print("Folder: %s\n" % os.getcwd())
        input("Press Enter to close...")
        sys.exit(1)

    url = "http://localhost:%d/%s" % (PORT, page)

    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, fmt, *args):
            pass

    try:
        srv = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        print("\nCould not start on port %d: %s" % (PORT, e))
        print("Something else may already be using it. Close it and retry.\n")
        input("Press Enter to close...")
        sys.exit(1)

    bar = "=" * 56
    print(bar)
    print("  Kavach AI is running on this laptop.")
    print(bar)
    print("\n  Open this address in Chrome:\n")
    print("      %s" % url)
    print("\n  (Your browser should open by itself in a second.)")
    print("\n  Do NOT type the [::] address Python sometimes prints —")
    print("  that is not a real web address.")
    print("\n  Keep this window OPEN. Ctrl+C to stop.\n")

    threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
