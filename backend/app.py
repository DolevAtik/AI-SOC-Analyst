"""
Flask REST API for the AI SOC Analyst.
Provides endpoints for log generation, analysis, incident management, and dashboard statistics.
"""
import os
import json
import time
import logging

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("soc_analyst")

from db import init_db, save_incident, get_incidents, get_stats, clear_incidents, get_blocklist, set_blocklist
from log_generator import generate_log_batch
from analyzer import analyze_logs, analyze_manual_log
from windows_event_reader import read_new_security_events, is_available as win_reader_available
from auth import require_auth, verify_token

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', os.urandom(32).hex())

_cors_origins = os.getenv('CORS_ORIGINS', '*')
CORS(app, resources={r"/*": {"origins": _cors_origins}})
socketio = SocketIO(app, cors_allowed_origins=_cors_origins, async_mode='threading')

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri="memory://",
)

# Initialize database on startup
init_db()

# Global state for background streamer
streaming_active      = False
current_attack_ratio  = 0.3
source_mode           = "simulation"   # 'simulation' | 'real_windows' | 'mixed'

def background_streamer():
    """Background thread that continuously generates and analyzes logs."""
    global streaming_active, current_attack_ratio, source_mode

    with app.app_context():
        while True:
            try:
                if streaming_active:
                    logs = []

                    if source_mode == "real_windows":
                        logs = read_new_security_events(max_events=30)
                        if not logs:
                            socketio.emit('new_logs', {'logs': [], 'source': 'real_windows'})
                            time.sleep(3)
                            continue

                    elif source_mode == "mixed":
                        real_logs = read_new_security_events(max_events=15)
                        needed    = max(5, 15 - len(real_logs))
                        sim_logs  = generate_log_batch(count=needed, attack_ratio=current_attack_ratio)
                        logs      = real_logs + sim_logs

                    else:  # simulation (default)
                        logs = generate_log_batch(count=15, attack_ratio=current_attack_ratio)

                    incidents      = analyze_logs(logs)
                    real_incidents = [i for i in incidents if i.get("incident_detected")]

                    for inc in real_incidents:
                        save_incident(inc, raw_logs=logs[:3])

                    socketio.emit('new_logs', {'logs': logs, 'source': source_mode})
                    if real_incidents:
                        socketio.emit('new_incidents', {'incidents': real_incidents})
                        socketio.emit('stats_update', {'stats': get_stats()})

            except Exception as e:
                logger.error("Background streamer error: %s", e)

            time.sleep(3)

# Start background task
socketio.start_background_task(background_streamer)

@socketio.on('connect')
def handle_connect():
    if os.getenv("CLERK_JWKS_URL"):
        token = request.args.get('token', '')
        if not token or not verify_token(token):
            return False  # Reject connection
    logger.info("Client connected")
    emit('stats_update', {'stats': get_stats()})
    emit('source_mode_update', {
        'mode':          source_mode,
        'win_available': win_reader_available(),
    })

@socketio.on('disconnect')
def handle_disconnect():
    logger.info("Client disconnected")

@socketio.on('toggle_stream')
def handle_toggle_stream(data):
    """Start or stop the background log generation."""
    global streaming_active, current_attack_ratio
    streaming_active = data.get('active', False)
    if 'attack_ratio' in data:
        current_attack_ratio = float(data['attack_ratio'])
    logger.info("Streaming=%s mode=%s attack_ratio=%.2f", streaming_active, source_mode, current_attack_ratio)


@socketio.on('set_source_mode')
def handle_set_source_mode(data):
    """Switch between simulation / real_windows / mixed."""
    global source_mode
    mode = data.get('mode', 'simulation')
    if mode not in ('simulation', 'real_windows', 'mixed'):
        return
    source_mode = mode
    logger.info("Source mode changed to: %s", source_mode)
    # Inform all clients of the new mode
    socketio.emit('source_mode_update', {
        'mode':          source_mode,
        'win_available': win_reader_available(),
    })

@socketio.on('chat_message')
def handle_chat_message(data):
    """Handle incoming AI Threat Hunting Chat messages."""
    message = data.get('message', '')
    context = data.get('context', [])
    
    if not message:
        return
        
    from analyzer import chat_with_ai
    response_text = chat_with_ai(message, context)
    
    emit('chat_response', {'response': response_text})

@app.route("/api/logs/generate", methods=["POST"])
@require_auth
def generate_logs():
    """Generate a batch of simulated server logs."""
    data = request.get_json(silent=True) or {}
    count = min(int(data.get("count", 50)), 500)  # Cap at 500
    attack_ratio = float(data.get("attack_ratio", 0.3))
    attack_ratio = max(0.0, min(1.0, attack_ratio))

    logs = generate_log_batch(count=count, attack_ratio=attack_ratio)
    return jsonify({
        "status": "success",
        "log_count": len(logs),
        "logs": logs,
    })


@app.route("/api/logs/analyze", methods=["POST"])
@require_auth
@limiter.limit("30 per minute")
def analyze():
    """Analyze provided logs and return detected incidents."""
    data = request.get_json(silent=True) or {}
    logs = data.get("logs", [])

    if not logs:
        return jsonify({"error": "No logs provided for analysis"}), 400

    incidents = analyze_logs(logs)

    # Save real incidents to database
    for incident in incidents:
        if incident.get("incident_detected"):
            save_incident(incident, raw_logs=logs[:5])  # Store sample of related logs

    return jsonify({
        "status": "success",
        "incidents_found": sum(1 for i in incidents if i.get("incident_detected")),
        "incidents": incidents,
    })


@app.route("/api/logs/stream", methods=["POST"])
@require_auth
def stream():
    """Generate logs and analyze them in one shot (convenience endpoint)."""
    data = request.get_json(silent=True) or {}
    count = min(int(data.get("count", 50)), 500)
    attack_ratio = float(data.get("attack_ratio", 0.3))
    attack_ratio = max(0.0, min(1.0, attack_ratio))

    logs = generate_log_batch(count=count, attack_ratio=attack_ratio)
    incidents = analyze_logs(logs)

    # Save real incidents to database
    for incident in incidents:
        if incident.get("incident_detected"):
            save_incident(incident, raw_logs=logs[:5])

    return jsonify({
        "status": "success",
        "log_count": len(logs),
        "logs": logs,
        "incidents_found": sum(1 for i in incidents if i.get("incident_detected")),
        "incidents": incidents,
    })


@app.route("/api/incidents", methods=["GET"])
@require_auth
def list_incidents():
    """Retrieve stored incidents with optional filters."""
    limit = min(int(request.args.get("limit", 100)), 500)
    severity = request.args.get("severity")
    threat_type = request.args.get("threat_type")

    incidents = get_incidents(limit=limit, severity=severity, threat_type=threat_type)
    return jsonify({
        "status": "success",
        "count": len(incidents),
        "incidents": incidents,
    })


@app.route("/api/stats", methods=["GET"])
@require_auth
def stats():
    """Get dashboard aggregate statistics."""
    return jsonify({
        "status": "success",
        "stats": get_stats(),
    })


@app.route("/api/incidents/clear", methods=["POST"])
@require_auth
def clear():
    """Clear all stored incidents."""
    clear_incidents()
    return jsonify({"status": "success", "message": "All incidents cleared."})


@app.route("/api/analyze/manual", methods=["POST"])
@require_auth
@limiter.limit("20 per minute")
def analyze_manual():
    """Analyze a manually entered log string."""
    data = request.get_json(silent=True) or {}
    log_text = data.get("log_text", "")

    if not log_text:
        return jsonify({"error": "No log text provided"}), 400

    from analyzer import analyze_manual_log
    analysis_result = analyze_manual_log(log_text)

    return jsonify({
        "status": "success",
        "analysis": analysis_result
    })


@app.route("/api/incidents/report", methods=["POST"])
@require_auth
def report_incident():
    """Save a manually reported incident to the database."""
    data = request.get_json(silent=True) or {}
    required = ["severity", "threat_type", "source_ip", "summary", "recommended_action"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Missing required field: {field}"}), 400

    incident = {
        "severity": data["severity"],
        "threat_type": data["threat_type"],
        "source_ip": data["source_ip"],
        "summary": data["summary"],
        "recommended_action": data["recommended_action"],
        "timestamp": datetime.utcnow().isoformat(),
    }
    save_incident(incident)
    return jsonify({"status": "success", "message": "Incident reported successfully."})



@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "service": "AI SOC Analyst API",
    })


# ── Blocklist management ───────────────────────────────────────────────────────

@app.route("/api/blocklist", methods=["GET"])
@require_auth
def get_blocklist_route():
    """Return current blocklist IPs."""
    return jsonify({"status": "success", "ips": get_blocklist()})


@app.route("/api/blocklist", methods=["POST"])
@require_auth
def update_blocklist():
    """Replace the blocklist with a new set of IPs sent from the frontend Settings."""
    data = request.get_json(silent=True) or {}
    ips = data.get("ips", [])
    if not isinstance(ips, list):
        return jsonify({"error": "'ips' must be a list of IP strings"}), 400
    set_blocklist(ips)
    return jsonify({"status": "success", "count": len(ips), "message": f"{len(ips)} IPs saved to blocklist."})


# ── Real log ingestion — Apache / Nginx Combined Log Format ───────────────

import re as _re

# Apache/Nginx Combined Log Format pattern
_COMBINED_LOG_RE = _re.compile(
    r'(?P<ip>[\d\.a-fA-F:]+)\s+'   # Client IP
    r'\S+\s+'                        # ident (usually '-')
    r'(?P<user>\S+)\s+'             # auth user
    r'\[(?P<time>[^\]]+)\]\s+'      # [timestamp]
    r'"(?P<method>\S+)\s+'          # "METHOD
    r'(?P<path>\S+)\s+'             # /path
    r'(?P<proto>[^"]+)"\s+'         # HTTP/1.1"
    r'(?P<status>\d{3})\s+'         # status code
    r'(?P<size>\S+)'                # response size
    r'(?:\s+"(?P<referer>[^"]*)")?'  # optional referer
    r'(?:\s+"(?P<ua>[^"]*)")?' ,     # optional user-agent
    _re.IGNORECASE,
)

_APACHE_TIME_FMT = "%d/%b/%Y:%H:%M:%S %z"


def _parse_apache_line(line: str) -> dict | None:
    """Parse a single Apache/Nginx Combined Log line into our internal log dict."""
    m = _COMBINED_LOG_RE.match(line.strip())
    if not m:
        return None
    try:
        dt = datetime.strptime(m.group("time"), _APACHE_TIME_FMT)
        timestamp = dt.isoformat()
    except ValueError:
        timestamp = datetime.utcnow().isoformat() + "Z"

    user = m.group("user")
    if user == "-":
        user = None

    return {
        "timestamp": timestamp,
        "ip": m.group("ip"),
        "method": m.group("method").upper(),
        "path": m.group("path"),
        "status_code": int(m.group("status")),
        "user_agent": m.group("ua") or "",
        "user": user,
    }


@app.route("/api/logs/parse", methods=["POST"])
@require_auth
@limiter.limit("20 per minute")
def parse_real_logs():
    """Parse and analyze real Apache/Nginx Combined Log Format entries.

    Body: { "log_text": "<raw log lines, one per line>" }
    Returns the same structure as /api/logs/analyze.
    """
    data = request.get_json(silent=True) or {}
    raw_text = data.get("log_text", "")

    if not raw_text:
        return jsonify({"error": "No log_text provided"}), 400

    lines = raw_text.strip().splitlines()
    parsed = []
    failed = []
    for i, line in enumerate(lines):
        entry = _parse_apache_line(line)
        if entry:
            parsed.append(entry)
        elif line.strip():
            failed.append({"line": i + 1, "content": line[:120]})

    if not parsed:
        return jsonify({
            "error": "No valid log lines could be parsed. Expected Apache/Nginx Combined Log Format.",
            "examples": [
                '192.168.1.1 - alice [06/Apr/2026:08:00:00 +0000] "GET /admin HTTP/1.1" 403 512',
                '10.0.0.5 - - [06/Apr/2026:08:01:00 +0000] "POST /login HTTP/1.1" 401 0 "-" "sqlmap/1.7"',
            ],
            "failed_lines": failed,
        }), 422

    incidents = analyze_logs(parsed)
    for incident in incidents:
        if incident.get("incident_detected"):
            save_incident(incident, raw_logs=parsed[:5])

    return jsonify({
        "status": "success",
        "parsed_count": len(parsed),
        "failed_count": len(failed),
        "failed_lines": failed,
        "incidents_found": sum(1 for i in incidents if i.get("incident_detected")),
        "incidents": incidents,
    })


if __name__ == "__main__":
    logger.info("AI SOC Analyst API starting on port 5000")
    socketio.run(app, host="0.0.0.0", port=5000, debug=False, use_reloader=False)
