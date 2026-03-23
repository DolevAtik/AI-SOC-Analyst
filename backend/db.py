"""
SQLite database layer for storing and querying security incidents.
"""
import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "soc_analyst.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Create the incidents table if it doesn't exist."""
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            severity TEXT NOT NULL,
            threat_type TEXT NOT NULL,
            source_ip TEXT NOT NULL,
            summary TEXT NOT NULL,
            recommended_action TEXT NOT NULL,
            raw_logs TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_severity ON incidents(severity)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_threat_type ON incidents(threat_type)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_timestamp ON incidents(timestamp)
    """)
    conn.commit()
    conn.close()


def save_incident(incident: dict, raw_logs: list = None):
    """Save a detected incident to the database."""
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO incidents (timestamp, severity, threat_type, source_ip, summary, recommended_action, raw_logs)
        VALUES (?, ?, ?, ?, ?, ?, ?)
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
    conn.close()


def get_incidents(limit: int = 100, severity: str = None, threat_type: str = None):
    """Retrieve incidents with optional filters."""
    conn = get_connection()
    query = "SELECT * FROM incidents WHERE 1=1"
    params = []

    if severity:
        query += " AND severity = ?"
        params.append(severity)
    if threat_type:
        query += " AND threat_type = ?"
        params.append(threat_type)

    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_stats():
    """Get aggregate statistics for the dashboard."""
    conn = get_connection()

    total = conn.execute("SELECT COUNT(*) as count FROM incidents").fetchone()["count"]

    severity_rows = conn.execute(
        "SELECT severity, COUNT(*) as count FROM incidents GROUP BY severity"
    ).fetchall()
    by_severity = {row["severity"]: row["count"] for row in severity_rows}

    type_rows = conn.execute(
        "SELECT threat_type, COUNT(*) as count FROM incidents GROUP BY threat_type"
    ).fetchall()
    by_type = {row["threat_type"]: row["count"] for row in type_rows}

    recent = conn.execute(
        "SELECT COUNT(*) as count FROM incidents WHERE created_at >= datetime('now', '-1 hour')"
    ).fetchone()["count"]

    conn.close()

    return {
        "total_incidents": total,
        "last_hour": recent,
        "by_severity": by_severity,
        "by_type": by_type,
    }


def clear_incidents():
    """Clear all incidents from the database."""
    conn = get_connection()
    conn.execute("DELETE FROM incidents")
    conn.commit()
    conn.close()
