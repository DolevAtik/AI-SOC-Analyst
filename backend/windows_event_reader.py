"""
Real-time Windows Security Event Log reader.

Reads live security events from the local Windows machine and translates
them into the same log dict format used by the simulation engine, so all
existing detectors (brute force, unauthorized access, etc.) work as-is.

Requires:  pip install pywin32
Requires:  Backend running as Administrator (for Security log access)
"""

import re
import os
from datetime import datetime, timezone
from typing import Optional

try:
    import win32evtlog
    PYWIN32_AVAILABLE = True
except ImportError:
    PYWIN32_AVAILABLE = False
    print("[WindowsEventReader] pywin32 not installed — real log mode unavailable.")

# ── Event IDs we care about ────────────────────────────────────────────────────
INTERESTING_IDS = {
    4625,   # An account failed to log on  → brute force
    4624,   # An account was successfully logged on
    4740,   # A user account was locked out
    4648,   # A logon was attempted using explicit credentials
    4672,   # Special privileges assigned (admin logon)
    4776,   # Credential validation (NTLM) — includes failed attempts
}

# ── Regex for valid IPv4 ───────────────────────────────────────────────────────
_IP_RE = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')

# ── Module-level state ─────────────────────────────────────────────────────────
_last_read_time: Optional[datetime] = None   # UTC — events older than this are skipped
_initialized = False

# ── Firewall log path (may not exist / may require admin) ─────────────────────
_FIREWALL_LOG = r"C:\Windows\System32\LogFiles\Firewall\pfirewall.log"
_fw_file_pos = 0   # byte offset to resume reading


def _safe_str(val) -> str:
    return str(val).strip() if val else ""


def _find_ip(fields: list) -> str:
    """Find the first real-looking non-loopback IPv4 in a field list."""
    SKIP = {"-", "N/A", "NULL", "LOCAL", "::1", "0.0.0.0", "", "127.0.0.1"}
    # IPs are usually in the last few fields — search right-to-left
    for f in reversed(fields):
        s = _safe_str(f)
        if s in SKIP:
            continue
        # Strip IPv6-mapped-IPv4 prefix  ::ffff:1.2.3.4
        if s.startswith("::ffff:"):
            s = s[7:]
        if _IP_RE.match(s):
            return s
    return "127.0.0.1"


def _event_to_log(event) -> Optional[dict]:
    """Convert a pywin32 EventLogRecord to our internal log dict."""
    event_id = event.EventID & 0xFFFF
    if event_id not in INTERESTING_IDS:
        return None

    fields = list(event.StringInserts or [])

    try:
        ts = event.TimeGenerated.replace(tzinfo=timezone.utc).isoformat()
    except Exception:
        ts = datetime.now(timezone.utc).isoformat()

    base = {
        "timestamp":   ts,
        "ip":          "127.0.0.1",
        "method":      "POST",
        "path":        "/login",
        "status_code": 200,
        "user_agent":  f"Windows-Security/EventID-{event_id}",
        "user":        None,
        "_event_id":   event_id,   # for debug / transparency
    }

    if event_id == 4625:   # Failed logon
        base["status_code"] = 401
        base["path"]        = "/login"
        # Standard field layout on Win10/11:
        # [5] = Target User Name, [6] = Target Domain
        # [18/19] = Source IP, [19/20] = Source Port
        if len(fields) > 6:
            user = _safe_str(fields[6])
            base["user"] = user if user not in ("-", "") else None
        base["ip"] = _find_ip(fields)

    elif event_id == 4624:  # Successful logon
        base["status_code"] = 200
        base["path"]        = "/login"
        if len(fields) > 6:
            user = _safe_str(fields[6])
            base["user"] = user if user not in ("-", "") else None
        base["ip"] = _find_ip(fields)

    elif event_id == 4740:  # Account lockout
        base["status_code"] = 401
        base["path"]        = "/login"
        if len(fields) > 0:
            base["user"] = _safe_str(fields[0]) or None
        if len(fields) > 4:
            base["ip"] = _find_ip(fields)

    elif event_id == 4648:  # Explicit credentials used
        base["status_code"] = 200
        base["path"]        = "/auth/signin"
        if len(fields) > 6:
            base["user"] = _safe_str(fields[6]) or None
        base["ip"] = _find_ip(fields)

    elif event_id == 4672:  # Special privileges (admin login)
        base["status_code"] = 200
        base["path"]        = "/admin"
        if len(fields) > 1:
            base["user"] = _safe_str(fields[1]) or None

    elif event_id == 4776:  # NTLM credential validation
        base["status_code"] = 401 if len(fields) > 2 and fields[2] else 200
        base["path"]        = "/login"
        if len(fields) > 1:
            base["user"] = _safe_str(fields[1]) or None
        base["ip"] = _find_ip(fields)

    return base


def _read_firewall_log(max_lines: int = 30) -> list:
    """Tail the Windows Firewall log for new DROP/BLOCK entries."""
    global _fw_file_pos
    logs = []
    if not os.path.exists(_FIREWALL_LOG):
        return logs

    try:
        with open(_FIREWALL_LOG, "r", errors="replace") as f:
            f.seek(_fw_file_pos)
            lines = f.readlines()
            _fw_file_pos = f.tell()

        for line in lines[-max_lines:]:
            # Format: date time action proto src-ip dst-ip src-port dst-port ...
            if line.startswith("#") or not line.strip():
                continue
            parts = line.split()
            if len(parts) < 7:
                continue
            action = parts[2].upper()
            if action not in ("DROP", "BLOCK"):
                continue
            src_ip = parts[4]
            if not _IP_RE.match(src_ip):
                continue
            logs.append({
                "timestamp":   f"{parts[0]}T{parts[1]}Z",
                "ip":          src_ip,
                "method":      "GET",
                "path":        f"/firewall/blocked:{parts[6]}",
                "status_code": 403,
                "user_agent":  "Windows-Firewall",
                "user":        None,
                "_event_id":   "FW_DROP",
            })
    except PermissionError:
        pass   # Not admin or log not enabled
    except Exception as e:
        print(f"[WindowsEventReader] Firewall log error: {e}")

    return logs


def read_new_security_events(max_events: int = 50) -> list:
    """
    Read Windows Security events that arrived since the last call.

    On the very first call this function initialises the cursor to 'now'
    so we only return events that occur *after* the monitor starts — not
    the entire event history.

    Returns a list of log dicts (same schema as log_generator output).
    """
    global _last_read_time, _initialized

    if not PYWIN32_AVAILABLE:
        return []

    now = datetime.now(timezone.utc)
    logs: list = []
    newest_seen: Optional[datetime] = None

    # ── First call: set baseline and return empty ──────────────────────────────
    if not _initialized:
        _last_read_time = now
        _initialized = True
        print("[WindowsEventReader] Initialised — watching from now.")
        return []

    try:
        hand = win32evtlog.OpenEventLog(None, "Security")
        flags = (win32evtlog.EVENTLOG_BACKWARDS_READ |
                 win32evtlog.EVENTLOG_SEQUENTIAL_READ)

        keep_going = True
        while keep_going:
            batch = win32evtlog.ReadEventLog(hand, flags, 0)
            if not batch:
                break

            for event in batch:
                try:
                    t = event.TimeGenerated.replace(tzinfo=timezone.utc)
                except Exception:
                    continue

                # Stop when we reach events we've already processed
                if _last_read_time and t <= _last_read_time:
                    keep_going = False
                    break

                log = _event_to_log(event)
                if log:
                    logs.append(log)
                    if newest_seen is None or t > newest_seen:
                        newest_seen = t

                if len(logs) >= max_events:
                    keep_going = False
                    break

        win32evtlog.CloseEventLog(hand)

    except Exception as e:
        print(f"[WindowsEventReader] Error reading Security log: {e}")
        print("  → Make sure the backend is running as Administrator.")

    # ── Also pull firewall log ─────────────────────────────────────────────────
    logs += _read_firewall_log()

    # Advance cursor
    if newest_seen:
        _last_read_time = newest_seen

    # Return in chronological order (oldest first)
    return list(reversed(logs))


def is_available() -> bool:
    """Return True if pywin32 is installed (real mode can be used)."""
    return PYWIN32_AVAILABLE
