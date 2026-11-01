#!/usr/bin/env python3
"""Start bounded server process groups, run a command, and clean up.

Modified by yuyin-skills: process/log lifecycle and readiness identity checks.

Usage: python with_server.py --server "npm run dev" --port 5173 -- python test.py
Repeat --server/--port for multiple servers. For application identity, also repeat
--ready-url and --ready-token for each server; the endpoint must return the
per-run token configured in that application's server command/environment.
Without that probe, readiness proves only a new live process and an open port.
"""
import argparse
import os
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request


def port_open(port):
    try:
        with socket.create_connection(('localhost', port), timeout=0.2):
            return True
    except OSError:
        return False


def log_tail(log):
    log.flush()
    log.seek(0, os.SEEK_END)
    size = log.tell()
    log.seek(max(0, size - 8192))
    return log.read().decode('utf-8', errors='replace')


def wait_ready(process, port, timeout, log, url=None, token=None):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status = process.poll()
        if status is not None:
            raise RuntimeError(f'Server exited with code {status} on port {port}\n{log_tail(log)}')
        ready = port_open(port)
        if ready and url:
            try:
                with urllib.request.urlopen(url, timeout=min(0.5, timeout)) as response:
                    ready = response.status == 200 and response.read(65536).decode('utf-8') == token
            except (OSError, ValueError, urllib.error.URLError):
                ready = False
        if ready and process.poll() is None:
            return
        time.sleep(min(0.05, max(0, deadline - time.monotonic())))
    raise RuntimeError(f'Server readiness timed out on port {port} after {timeout}s\n{log_tail(log)}')


def stop(process):
    if os.name == 'posix':
        # The shell may exit before its child; signal the entire owned group.
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            pass
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()
    else:
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        process.wait()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server', action='append', required=True)
    parser.add_argument('--port', action='append', required=True, type=int)
    parser.add_argument('--timeout', type=float, default=30)
    parser.add_argument('--ready-url', action='append')
    parser.add_argument('--ready-token', action='append')
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command or len(args.server) != len(args.port) or args.timeout <= 0:
        parser.error('Require a command, positive timeout and matching --server/--port counts')
    if len(set(args.port)) != len(args.port):
        parser.error('Server ports must be distinct')
    if bool(args.ready_url) != bool(args.ready_token) or (args.ready_url and
            (len(args.ready_url) != len(args.port) or len(args.ready_token) != len(args.port))):
        parser.error('Supply one --ready-url and nonempty --ready-token per server')
    if args.ready_token and any(not token for token in args.ready_token):
        parser.error('Readiness tokens must be nonempty')
    for port in args.port:
        if not 1 <= port <= 65535:
            parser.error(f'Invalid port: {port}')
        if port_open(port):
            parser.error(f'Port {port} is already occupied; stop the old server explicitly')
    for i, url in enumerate(args.ready_url or []):
        parsed = urllib.parse.urlparse(url)
        if (parsed.scheme not in ('http', 'https') or
                parsed.hostname not in ('localhost', '127.0.0.1', '::1') or
                parsed.port != args.port[i] or parsed.username or parsed.password):
            parser.error('Readiness URLs must probe the corresponding local server port')
    processes = []
    logs = []
    try:
        for i, (server, port) in enumerate(zip(args.server, args.port)):
            if port_open(port):
                raise RuntimeError(f'Port {port} is already occupied before startup')
            log = tempfile.TemporaryFile()
            logs.append(log)
            process = subprocess.Popen(server, shell=True, stdout=log, stderr=log,
                                       start_new_session=(os.name == 'posix'))
            processes.append(process)
            wait_ready(process, port, args.timeout, log,
                       args.ready_url[i] if args.ready_url else None,
                       args.ready_token[i] if args.ready_token else None)
            print(f'Server ready on port {port} (identity probe: {bool(args.ready_url)})', flush=True)
        for process, port, log in zip(processes, args.port, logs):
            if process.poll() is not None:
                raise RuntimeError(f'Server exited before test on port {port}\n{log_tail(log)}')
        return subprocess.run(command).returncode
    finally:
        try:
            for process in processes:
                stop(process)
        finally:
            for log in logs:
                log.close()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (RuntimeError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
