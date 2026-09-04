#!/usr/bin/env python3
"""
Kavach AI — one-command local server (Windows / macOS / Linux)

Serves the demo over HTTPS on your own Wi-Fi so the phone's microphone,
motion sensors and vibration are unlocked. Browsers only allow those on a
secure origin, which is why opening the .html file directly does nothing.

Nothing leaves your network. No hosting account. No openssl needed —
the certificate is generated in Python.

HOW TO USE
----------
1. Put this file in the SAME folder as kavach_ai_demo.html
2. Install the one dependency (once):

       pip install cryptography

3. Run it:

       python kavach_server.py

4. It prints two addresses:
       - a localhost address  -> open on THIS laptop (always works)
       - a network address    -> open on your PHONE (same Wi-Fi)

   On the phone you get a certificate warning. That is expected — the
   certificate is one this script just made for you. Tap Advanced -> Proceed.

Press Ctrl+C to stop.
"""
import http.server
import ipaddress
import os
import socket
import ssl
import sys
import datetime

PORT = 8443
CERT = "kavach-cert.pem"
KEY = "kavach-key.pem"


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def find_html():
    """Serve whatever .html file is in this folder, whatever it's named."""
    here = os.path.dirname(os.path.abspath(__file__))
    preferred = ["index.html", "kavach_ai_demo.html"]
    for name in preferred:
        if os.path.exists(os.path.join(here, name)):
            return name
    for name in sorted(os.listdir(here)):
        if name.lower().endswith(".html"):
            return name
    return None


def make_cert(ip):
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
    except ImportError:
        sys.exit(
            "\nMissing the 'cryptography' package. Install it with:\n\n"
            "    pip install cryptography\n\n"
            "then run this script again.\n"
        )

    print("Generating a self-signed certificate for %s ..." % ip)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, ip)])
    now = datetime.datetime.now(datetime.timezone.utc)

    san = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
    ]
    try:
        san.append(x509.IPAddress(ipaddress.ip_address(ip)))
    except ValueError:
        pass

    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=90))
        .add_extension(x509.SubjectAlternativeName(san), critical=False)
        .sign(key, hashes.SHA256())
    )

    with open(KEY, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))
    with open(CERT, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    print("Certificate written.\n")


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    page = find_html()
    if not page:
        sys.exit(
            "\nNo .html file found in this folder.\n"
            "Put kavach_ai_demo.html next to this script and run it again.\n"
            "Folder: %s\n" % os.getcwd()
        )

    ip = lan_ip()
    if not (os.path.exists(CERT) and os.path.exists(KEY)):
        make_cert(ip)

    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path in ("/", "/index.html"):
                self.path = "/" + page
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

        def log_message(self, fmt, *args):
            pass  # keep the console clean

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(CERT, KEY)

    srv = http.server.HTTPServer(("0.0.0.0", PORT), Handler)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)

    bar = "=" * 58
    print(bar)
    print("  Kavach AI demo is running.  Serving: %s" % page)
    print(bar)
    print("\n  On THIS laptop:")
    print("      https://localhost:%d" % PORT)
    print("\n  On your PHONE (same Wi-Fi):")
    print("      https://%s:%d" % (ip, PORT))
    print("\n  The phone will show a certificate warning.")
    print("  Tap Advanced -> Proceed. It is your own certificate.")
    print("\n  Then tap 'Start monitoring' and allow mic + motion + location.")
    print("\n  Ctrl+C to stop.\n")

    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
