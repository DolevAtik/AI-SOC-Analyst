"""
Flask REST API for the AI SOC Analyst.
Provides endpoints for log generation, analysis, incident management, and dashboard statistics.
"""
import os
import json
import eventlet
eventlet.monkey_patch()  # Required for websocket performance

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from db import init_db, save_incident, get_incidents, get_stats, clear_incidents
from log_generator import generate_log_batch
from analyzer import analyze_logs, analyze_manual_log

app = Flask(__name__)
app.config['SECRET_KEY'] = 'ai-soc-secret!'
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Initialize database on startup
init_db()

# Global state for background streamer
streaming_active = False
current_attack_ratio = 0.3

def background_streamer():
    """Background thread that continuously generates and analyzes logs."""
    global streaming_active, current_attack_ratio
    
    while True:
        if streaming_active:
            # Generate a small batch of logs frequently
            logs = generate_log_batch(count=15, attack_ratio=current_attack_ratio)
            incidents = analyze_logs(logs)
            
            # Save real incidents
            real_incidents = [i for i in incidents if i.get("incident_detected")]
            for inc in real_incidents:
                save_incident(inc, raw_logs=logs[:3])
                
            # Emit data to all connected clients
            socketio.emit('new_logs', {'logs': logs})
            if real_incidents:
                socketio.emit('new_incidents', {'incidents': real_incidents})
                # Refresh stats if incidents occurred
                socketio.emit('stats_update', {'stats': get_stats()})
                
        # Sleep before next iteration (adjust frequency as needed)
        socketio.sleep(3)

# Start background task
socketio.start_background_task(background_streamer)

@socketio.on('connect')
def handle_connect():
    print("Client connected")
    emit('stats_update', {'stats': get_stats()})

@socketio.on('disconnect')
def handle_disconnect():
    print("Client disconnected")

@socketio.on('toggle_stream')
def handle_toggle_stream(data):
    """Start or stop the background log generation."""
    global streaming_active, current_attack_ratio
    streaming_active = data.get('active', False)
    if 'attack_ratio' in data:
        current_attack_ratio = float(data['attack_ratio'])
    print(f"Streaming set to: {streaming_active}, Attack Ratio: {current_attack_ratio}")

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
def stats():
    """Get dashboard aggregate statistics."""
    return jsonify({
        "status": "success",
        "stats": get_stats(),
    })


@app.route("/api/incidents/clear", methods=["POST"])
def clear():
    """Clear all stored incidents."""
    clear_incidents()
    return jsonify({"status": "success", "message": "All incidents cleared."})


@app.route("/api/analyze/manual", methods=["POST"])
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


if __name__ == "__main__":
    print("AI SOC Analyst API starting...")
    print("Endpoints available:")
    print("   POST /api/logs/generate   - Generate simulated logs")
    print("   POST /api/logs/analyze    - Analyze logs for threats")
    print("   POST /api/logs/stream     - Generate + analyze in one shot")
    print("   GET  /api/incidents       - List stored incidents")
    print("   GET  /api/stats           - Dashboard statistics")
    print("   POST /api/incidents/clear  - Clear all incidents")
    print("   GET  /api/health          - Health check")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, use_reloader=False)
