#!/usr/bin/env python3
"""Servidor de desarrollo.

Dos cosas además de servir archivos:

  · Range requests, que el módulo estándar no implementa.
  · POST /_captura, que guarda un PNG en _capturas/. Sirve para que una
    página pueda dejar en disco lo que dibujó, y así se pueda revisar una
    animación cuadro por cuadro sin tener que mirarla en vivo. Es solo para
    desarrollo: no lo dejes escuchando fuera de tu máquina.

También manda cabeceras anti-caché, porque sin eso al editar un .js el
navegador sigue sirviendo el viejo y parece que el cambio no hizo nada.
"""
import base64
import http.server
import json
import os
import re
import socketserver

PORT = 8082
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
CAPTURAS = os.path.join(DIRECTORY, "_capturas")
LIMITE = 24 * 1024 * 1024        # una captura no puede pesar más que esto


class RangeRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # sin esto, editar un .js y recargar puede seguir sirviendo el viejo
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def do_POST(self):
        if self.path != "/_captura":
            self.send_error(404)
            return
        try:
            largo = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            largo = 0
        if largo <= 0 or largo > LIMITE:
            self.send_error(413)
            return

        try:
            datos = json.loads(self.rfile.read(largo).decode("utf-8"))
            # el nombre lo elige la página, pero no puede salir de _capturas/
            nombre = re.sub(r"[^A-Za-z0-9_-]", "", str(datos.get("nombre", "captura")))[:60]
            if not nombre:
                nombre = "captura"
            crudo = str(datos.get("png", ""))
            crudo = crudo.split(",", 1)[1] if crudo.startswith("data:") else crudo
            binario = base64.b64decode(crudo, validate=True)
        except Exception as e:
            self.send_error(400, str(e))
            return

        if not binario.startswith(b"\x89PNG"):
            self.send_error(415, "solo PNG")
            return

        os.makedirs(CAPTURAS, exist_ok=True)
        destino = os.path.join(CAPTURAS, nombre + ".png")
        with open(destino, "wb") as f:
            f.write(binario)

        cuerpo = json.dumps({"ok": True, "archivo": destino, "bytes": len(binario)}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()

        range_header = self.headers.get("Range")
        file_size = os.path.getsize(path)

        if not range_header:
            self.send_response(200)
            self.send_header("Accept-Ranges", "bytes")
            ctype = self.guess_type(path)
            self.send_header("Content-type", ctype)
            self.send_header("Content-Length", str(file_size))
            self.end_headers()
            return open(path, "rb")

        match = re.match(r"bytes=(\d*)-(\d*)", range_header)
        start_str, end_str = match.groups()
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        f = open(path, "rb")
        f.seek(start)

        self.send_response(206)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Content-Length", str(length))
        self.end_headers()

        self._range = (start, length)
        return f

    def copyfile(self, source, outputfile):
        if hasattr(self, "_range"):
            start, length = self._range
            remaining = length
            bufsize = 64 * 1024
            while remaining > 0:
                chunk = source.read(min(bufsize, remaining))
                if not chunk:
                    break
                try:
                    outputfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break
                remaining -= len(chunk)
            del self._range
        else:
            try:
                super().copyfile(source, outputfile)
            except (BrokenPipeError, ConnectionResetError):
                pass


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with ThreadingHTTPServer(("", PORT), RangeRequestHandler) as httpd:
        print(f"Sirviendo {DIRECTORY} en http://localhost:{PORT}")
        httpd.serve_forever()
