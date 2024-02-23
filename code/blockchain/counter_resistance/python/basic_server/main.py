#!/usr/bin/env python3
"""
A simple HTTP server with CORS. Primarily for local development.
Usage: python server.py --port <port> --directory <dir>
"""

import argparse
import logging
from http.server import HTTPServer, SimpleHTTPRequestHandler


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        SimpleHTTPRequestHandler.end_headers(self)


def run(server_class=HTTPServer, handler_class=CORSRequestHandler, port=8000, directory=None):
    logging.basicConfig(level=logging.INFO)
    server_address = ('', port)
    httpd = server_class(server_address, lambda *args, **kwargs: handler_class(*args, directory=directory, **kwargs))
    logging.info(f'Starting HTTP server on port {port}, serving directory "{directory}"...')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    logging.info('Stopping HTTP server...')


def main():
    parser = argparse.ArgumentParser(description="Simple HTTP Server with CORS")
    parser.add_argument("--port", default=8000, type=int, help="Specify the port to listen on")
    parser.add_argument("--directory", default=".", type=str, help="Specify the directory to serve")
    args = parser.parse_args()

    run(port=args.port, directory=args.directory)


if __name__ == "__main__":
    main()
