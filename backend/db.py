"""
Database layer — supports SQLite (local dev) and PostgreSQL (production).
Uses SQLite when DATABASE_URL is not set, PostgreSQL otherwise.
"""
import os
import json
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL")
_MODE = "postgres" if DATABASE_URL else "sqlite"

SEVERITY_RANK = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}

DEFAULT_BLOCKLIST = [
    "185.220.101.34", "185.220.101.45",
    "45.155.205.233", "45.155.205.100",
    "193.142.146.22", "89.248.167.131",
    "103.43.75.118",  "23.129.64.130",
]

# ── Connection helpers ─────────────────────────────────────────────────────────

if _MODE == "postgres":
    import psycopg2
    import psycopg2.extras
    from psycopg2.pool import ThreadedConnectionPool

    _pool = None

    def _get_pool():
        global _pool
        if _pool is None:
            url = DATABASE_URL
            # Railway appends ?sslmode=require — psycopg2 handles it natively
            _pool = ThreadedConnectionPool(1, 10, url)
        return _pool

    def get_connection():
        return _get_pool().getconn()

    def release_connection(conn):
        _get_pool().putconn(conn)

    def _cursor(conn):
        return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    PH = "%s"          # PostgreSQL placeholder
    AUTOINCREMENT = "SERIAL PRIMARY KEY"
    NOW_FUNC = "NOW()"
    LAST_HOUR = "NOW() - INTERVAL '1 hour'"
    IGNORE = "ON CONFLICT DO NOTHING"

else:
    import sqlite3

    DB_PATH = os.path.join(os.path.dirname(__file__), "soc_analyst.db")

    def get_connection():
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def release_connection(conn):
        conn.close()

    def _cursor(conn):
        return conn.cursor()

    PH = "?"
    AUTOINCREMENT = "INTEGER PRIMARY KEY AUTOINCREMENT"
    NOW_FUNC = "datetime('now')"
    LAST_HOUR = "datetime('now', '-1 hour')"
    IGNORE = "OR IGNORE"


# ── Schema ─────────────────────────────────────────────────────────────────────

def init_db():
    conn = get_connection()
    cur = _cursor(conn)

    if _MODE == "postgres":
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS incidents (
                id          SERIAL PRIMARY KEY,
                timestamp   TEXT NOT NULL,
                severity    TEXT NOT NULL,
                threat_type TEXT NOT NULL,
                source_ip   TEXT NOT NULL,
                summary     TEXT NOT NULL,
                recommended_action TEXT NOT NULL,
                raw_logs    TEXT,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_severity    ON incidents(severity)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_threat_type ON incidents(threat_type)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_timestamp   ON incidents(timestamp)")
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS blocklist (
                id       SERIAL PRIMARY KEY,
                ip       TEXT NOT NULL UNIQUE,
                added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.commit()
        cur.execute("SELECT COUNT(*) AS count FROM blocklist")
        row = cur.fetchone()
        count = row["count"] if row else 0
    else:
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS incidents (
                id {AUTOINCREMENT},
                timestamp TEXT NOT NULL,
                severity TEXT NOT NULL,
                threat_type TEXT NOT NULL,
                source_ip TEXT NOT NULL,
                summary TEXT NOT NULL,
                recommended_action TEXT NOT NULL,
                raw_logs TEXT,
                created_at TEXT NOT NULL DEFAULT ({NOW_FUNC})
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_severity    ON incidents(severity)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_threat_type ON incidents(threat_type)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_timestamp   ON incidents(timestamp)")
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS blocklist (
                id {AUTOINCREMENT},
                ip TEXT NOT NULL UNIQUE,
                added_at TEXT NOT NULL DEFAULT ({NOW_FUNC})
            )
        """)
        conn.commit()
        cur.execute("SELECT COUNT(*) as count FROM blocklist")
        row = cur.fetchone()
        count = row["count"] if row else 0

    if count == 0:
        if _MODE == "postgres":
            psycopg2.extras.execute_values(
                cur,
                "INSERT INTO blocklist (ip) VALUES %s ON CONFLICT DO NOTHING",
                [(ip,) for ip in DEFAULT_BLOCKLIST],
            )
        else:
            cur.executemany(
                "INSERT OR IGNORE INTO blocklist (ip) VALUES (?)",
                [(ip,) for ip in DEFAULT_BLOCKLIST],
            )
        conn.commit()

    cur.close()
    release_connection(conn)


# ── Incidents ──────────────────────────────────────────────────────────────────

def save_incident(incident: dict, raw_logs: list = None):
    conn = get_connection()
    cur = _cursor(conn)
    cur.execute(
        f"""
        INSERT INTO incidents
            (timestamp, severity, threat_type, source_ip, summary, recommended_action, raw_logs)
        VALUES ({PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH})
        """,
        (
            incident.get("timestamp", datetime.utcnow().isoformat()),
            incident["severity"],
            incident["threat_type"],
            incident["source_ip"],
            incident["summary"],
            incident["recommended_action"],
            json.dumps(raw_logs) if raw_logs else None,
        ),
    )
    conn.commit()
    cur.close()
    release_connection(conn)


def get_incidents(limit: int = 100, severity: str = None, threat_type: str = None):
    conn = get_connection()
    cur = _cursor(conn)
    query = "SELECT * FROM incidents WHERE 1=1"
    params = []

    if severity:
        query += f" AND severity = {PH}"
        params.append(severity)
    if threat_type:
        query += f" AND threat_type = {PH}"
        params.append(threat_type)

    query += f" ORDER BY created_at DESC LIMIT {PH}"
    params.append(limit)

    cur.execute(query, params)
    rows = cur.fetchall()
    cur.close()
    release_connection(conn)
    return [dict(row) for row in rows]


def get_stats():
    conn = get_connection()
    cur = _cursor(conn)

    cur.execute("SELECT COUNT(*) AS count FROM incidents")
    total = (cur.fetchone() or {}).get("count", 0)

    cur.execute("SELECT severity, COUNT(*) AS count FROM incidents GROUP BY severity")
    by_severity = {row["severity"]: row["count"] for row in cur.fetchall()}

    cur.execute("SELECT threat_type, COUNT(*) AS count FROM incidents GROUP BY threat_type")
    by_type = {row["threat_type"]: row["count"] for row in cur.fetchall()}

    cur.execute(f"SELECT COUNT(*) AS count FROM incidents WHERE created_at >= {LAST_HOUR}")
    recent = (cur.fetchone() or {}).get("count", 0)

    cur.close()
    release_connection(conn)
    return {
        "total_incidents": total,
        "last_hour": recent,
        "by_severity": by_severity,
        "by_type": by_type,
    }


def clear_incidents():
    conn = get_connection()
    cur = _cursor(conn)
    cur.execute("DELETE FROM incidents")
    conn.commit()
    cur.close()
    release_connection(conn)


# ── Blocklist ──────────────────────────────────────────────────────────────────

def get_blocklist() -> list:
    conn = get_connection()
    cur = _cursor(conn)
    cur.execute("SELECT ip FROM blocklist ORDER BY added_at ASC")
    rows = cur.fetchall()
    cur.close()
    release_connection(conn)
    return [row["ip"] for row in rows]


def set_blocklist(ips: list):
    clean = list({ip.strip() for ip in ips if ip.strip()})
    conn = get_connection()
    cur = _cursor(conn)
    cur.execute("DELETE FROM blocklist")
    if clean:
        if _MODE == "postgres":
            psycopg2.extras.execute_values(
                cur,
                "INSERT INTO blocklist (ip) VALUES %s ON CONFLICT DO NOTHING",
                [(ip,) for ip in clean],
            )
        else:
            cur.executemany(
                "INSERT OR IGNORE INTO blocklist (ip) VALUES (?)",
                [(ip,) for ip in clean],
            )
    conn.commit()
    cur.close()
    release_connection(conn)


def add_to_blocklist(ip: str):
    conn = get_connection()
    cur = _cursor(conn)
    if _MODE == "postgres":
        cur.execute("INSERT INTO blocklist (ip) VALUES (%s) ON CONFLICT DO NOTHING", (ip.strip(),))
    else:
        cur.execute("INSERT OR IGNORE INTO blocklist (ip) VALUES (?)", (ip.strip(),))
    conn.commit()
    cur.close()
    release_connection(conn)
