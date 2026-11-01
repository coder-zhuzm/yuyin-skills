import importlib.util
import os
from pathlib import Path
import socket
import signal
import subprocess
import sys
import tempfile
import unittest

HELPER = Path(__file__).resolve().parents[1] / 'skills/upstream/anthropic/webapp-testing/scripts/with_server.py'

class ServerTests(unittest.TestCase):
    def port(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            return sock.getsockname()[1]

    def run_helper(self, command, port, marker, timeout='2', probe=None):
        process = subprocess.Popen([sys.executable, str(HELPER), '--server', command, '--port', str(port), '--timeout', timeout, *(probe or []), '--', sys.executable, '-c', f'from pathlib import Path; Path({str(marker)!r}).write_text("tested")'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
        try:
            stdout, stderr = process.communicate(timeout=12)
            return subprocess.CompletedProcess(process.args, process.returncode, stdout, stderr)
        finally:
            try: os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError: pass


    def test_occupied_port_rejected_before_test(self):
        with tempfile.TemporaryDirectory() as folder, socket.socket() as old:
            old.bind(('127.0.0.1', 0)); old.listen()
            marker = Path(folder) / 'test-ran'
            result = self.run_helper(f'{sys.executable} -c "raise SystemExit(7)"', old.getsockname()[1], marker)
            self.assertNotEqual(result.returncode, 0, result.stdout)
            self.assertFalse(marker.exists())
            self.assertIn('already', result.stderr.lower())

    def test_exit_reports_error_without_running_test(self):
        with tempfile.TemporaryDirectory() as folder:
            marker = Path(folder) / 'test-ran'
            result = self.run_helper(f'{sys.executable} -c "import sys; print(\'startup broken\', file=sys.stderr); sys.exit(7)"', self.port(), marker)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('startup broken', result.stderr)
            self.assertIn('7', result.stderr)
            self.assertFalse(marker.exists())

    def test_slow_noisy_server_runs_and_releases_child_port(self):
        if os.name == 'nt': self.skipTest('POSIX process group test')
        with tempfile.TemporaryDirectory() as folder:
            port = self.port(); marker = Path(folder) / 'test-ran'
            server = Path(folder) / 'server.py'
            server.write_text(f'import time, http.server\nprint("x" * 200000, flush=True)\ntime.sleep(0.2)\nhttp.server.HTTPServer(("127.0.0.1", {port}), http.server.SimpleHTTPRequestHandler).serve_forever()\n')
            result = self.run_helper(f'{sys.executable} {server}', port, marker, '4')
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(marker.exists())
            with socket.socket() as sock:
                self.assertNotEqual(sock.connect_ex(('127.0.0.1', port)), 0)

    def test_application_identity_probe_rejects_wrong_marker(self):
        with tempfile.TemporaryDirectory() as folder:
            port = self.port(); marker = Path(folder) / 'test-ran'
            server = Path(folder) / 'health.py'
            server.write_text(f'import http.server\nclass Handler(http.server.BaseHTTPRequestHandler):\n def do_GET(self):\n  self.send_response(200); self.end_headers(); self.wfile.write(b"actual-run")\nhttp.server.HTTPServer(("127.0.0.1", {port}), Handler).serve_forever()\n')
            args = ['--ready-url', f'http://localhost:{port}/health', '--ready-token', 'wrong-run']
            result = self.run_helper(f'{sys.executable} {server}', port, marker, '0.4', args)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(marker.exists())
            args[-1] = 'actual-run'
            result = self.run_helper(f'{sys.executable} {server}', port, marker, '2', args)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(marker.exists())

    def test_timeout_does_not_run_test(self):
        with tempfile.TemporaryDirectory() as folder:
            marker = Path(folder) / 'test-ran'
            result = self.run_helper(f'{sys.executable} -c "import time; time.sleep(10)"', self.port(), marker, '0.2')
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(marker.exists())

if __name__ == '__main__': unittest.main()
