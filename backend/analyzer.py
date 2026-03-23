"""
Core threat detection engine.
Analyzes batches of server log entries and identifies security incidents.
"""
import re
import os
import json
import requests
from collections import defaultdict
from datetime import datetime

def call_gemini(prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise Exception("API key not configured.")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {'Content-Type': 'application/json'}
    data = {"contents": [{"parts": [{"text": prompt}]}]}
    
    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 429:
        raise Exception("API rate limit exceeded (Quota Exhausted). Please wait a moment before asking again or check your Gemini plan.")
    elif response.status_code != 200:
        raise Exception(f"AI Provider Error ({response.status_code})")
        
    result = response.json()
    try:
        return result['candidates'][0]['content']['parts'][0]['text']
    except (KeyError, IndexError):
        raise Exception("Unexpected response format from Gemini API.")


# --- Known-malicious IP blocklist ---
BLOCKLISTED_IPS = {
    "185.220.101.34", "185.220.101.45",
    "45.155.205.233", "45.155.205.100",
    "193.142.146.22", "89.248.167.131",
    "103.43.75.118", "23.129.64.130",
}

# --- SQL injection detection patterns ---
SQL_PATTERNS = [
    re.compile(r"(\%27)|(\')|(\-\-)|(\%23)|(#)", re.IGNORECASE),
    re.compile(r"((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))", re.IGNORECASE),
    re.compile(r"\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|EXECUTE)\b", re.IGNORECASE),
    re.compile(r"\b(OR|AND)\s+[\'\"]?\d+[\'\"]?\s*=\s*[\'\"]?\d+", re.IGNORECASE),
    re.compile(r"(\bOR\b\s+\b\w+\b\s*=\s*\b\w+\b)", re.IGNORECASE),
    re.compile(r"(xp_cmdshell|information_schema|sys\.objects)", re.IGNORECASE),
    re.compile(r"CONVERT\s*\(", re.IGNORECASE),
]

# --- Sensitive paths that non-admins shouldn't access ---
SENSITIVE_PATHS = {
    "/admin", "/admin/users", "/admin/config", "/admin/logs",
    "/etc/passwd", "/etc/shadow", "/.env", "/wp-admin",
    "/phpmyadmin", "/server-status", "/debug", "/api/v1/admin/export",
}

# --- Malicious user agents ---
MALICIOUS_AGENTS = {"sqlmap", "nikto", "nmap", "masscan", "dirbuster", "gobuster"}


def _parse_timestamp(ts: str) -> datetime:
    """Parse ISO format timestamp."""
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return datetime.utcnow()


def detect_brute_force(logs: list) -> list:
    """
    Detect brute force attacks by finding repeated authentication failures
    from the same IP within a short time window.
    """
    incidents = []
    failures_by_ip = defaultdict(list)

    for log in logs:
        if log.get("status_code") == 401 and log.get("path", "").lower() in (
            "/login", "/api/v1/auth/login", "/auth/signin",
            "/login?user=", "/api/v1/auth",
        ):
            failures_by_ip[log["ip"]].append(log)

    for ip, failed_logs in failures_by_ip.items():
        count = len(failed_logs)

        if count < 3:
            continue  # Likely a forgotten password

        # Check if failures happened rapidly
        timestamps = sorted([_parse_timestamp(l["timestamp"]) for l in failed_logs])
        if len(timestamps) >= 2:
            window = (timestamps[-1] - timestamps[0]).total_seconds()
        else:
            window = 0

        # Determine severity based on count and speed
        if count >= 10:
            severity = "Critical"
            summary = (
                f"Brute force attack detected: {count} failed login attempts from {ip} "
                f"within {window:.0f} seconds. Immediate action required."
            )
        elif count >= 5:
            severity = "High"
            summary = (
                f"Possible brute force attack: {count} failed login attempts from {ip} "
                f"within {window:.0f} seconds."
            )
        else:
            severity = "Medium"
            summary = (
                f"Suspicious login activity: {count} failed attempts from {ip} "
                f"within {window:.0f} seconds."
            )

        # Check if any attempt succeeded after failures (account compromise)
        last_log = failed_logs[-1]
        if any(l.get("status_code") == 200 for l in failed_logs):
            severity = "Critical"
            summary += " WARNING: A successful login was detected after multiple failures — possible account compromise."

        target_user = failed_logs[0].get("user", "unknown")
        incidents.append({
            "incident_detected": True,
            "severity": severity,
            "threat_type": "Brute Force Attack",
            "source_ip": ip,
            "summary": summary,
            "recommended_action": f"Block IP {ip}, force password reset for user '{target_user}', enable MFA.",
            "timestamp": failed_logs[0]["timestamp"],
        })

    return incidents


def detect_sql_injection(logs: list) -> list:
    """Detect SQL injection attempts in request paths/parameters."""
    incidents = []
    sqli_by_ip = defaultdict(list)

    for log in logs:
        path = log.get("path", "")
        for pattern in SQL_PATTERNS:
            if pattern.search(path):
                sqli_by_ip[log["ip"]].append(log)
                break

    for ip, sqli_logs in sqli_by_ip.items():
        count = len(sqli_logs)

        # Check for server errors indicating successful exploitation
        server_errors = sum(1 for l in sqli_logs if l.get("status_code", 0) >= 500)

        if server_errors > 0 or count >= 5:
            severity = "Critical"
            summary = (
                f"SQL Injection attack from {ip}: {count} malicious requests detected. "
                f"{server_errors} caused server errors (possible successful exploitation)."
            )
            action = f"Block IP {ip} immediately, audit database for unauthorized changes, review WAF rules."
        elif count >= 3:
            severity = "High"
            summary = f"Multiple SQL injection attempts from {ip}: {count} suspicious requests."
            action = f"Block IP {ip}, review application input validation, enable WAF."
        else:
            severity = "Medium"
            summary = f"SQL injection attempt detected from {ip}."
            action = f"Monitor IP {ip}, review input sanitization on affected endpoints."

        # Check for malicious tools
        agents = {l.get("user_agent", "").lower() for l in sqli_logs}
        for agent_keyword in MALICIOUS_AGENTS:
            if any(agent_keyword in a for a in agents):
                severity = "Critical"
                summary += f" Automated attack tool detected in user agent."
                break

        sample_path = sqli_logs[0].get("path", "")
        if len(sample_path) > 100:
            sample_path = sample_path[:100] + "..."

        incidents.append({
            "incident_detected": True,
            "severity": severity,
            "threat_type": "SQL Injection",
            "source_ip": ip,
            "summary": summary,
            "recommended_action": action,
            "timestamp": sqli_logs[0]["timestamp"],
        })

    return incidents


def detect_unauthorized_access(logs: list) -> list:
    """Detect attempts to access sensitive/admin paths."""
    incidents = []
    access_by_ip = defaultdict(list)

    for log in logs:
        path = log.get("path", "")
        status = log.get("status_code", 200)

        if path in SENSITIVE_PATHS and status in (401, 403, 404):
            access_by_ip[log["ip"]].append(log)

    for ip, access_logs in access_by_ip.items():
        count = len(access_logs)
        paths_hit = list(set(l.get("path", "") for l in access_logs))

        if count >= 5 or len(paths_hit) >= 3:
            severity = "High"
            summary = (
                f"Directory/path enumeration from {ip}: {count} unauthorized access attempts "
                f"to {len(paths_hit)} sensitive paths ({', '.join(paths_hit[:3])})."
            )
            action = f"Block IP {ip}, review access controls, audit for data exposure."
        elif count >= 2:
            severity = "Medium"
            summary = f"Unauthorized access attempts from {ip} to: {', '.join(paths_hit)}."
            action = f"Monitor IP {ip}, verify access controls on sensitive paths."
        else:
            severity = "Low"
            summary = f"Single unauthorized access attempt from {ip} to {paths_hit[0]}."
            action = f"Monitor IP {ip}."

        # Escalate if malicious agent is used
        agents = {l.get("user_agent", "").lower() for l in access_logs}
        for agent_keyword in MALICIOUS_AGENTS:
            if any(agent_keyword in a for a in agents):
                severity = "High" if severity != "High" else "Critical"
                summary += " Automated scanning tool detected."
                break

        incidents.append({
            "incident_detected": True,
            "severity": severity,
            "threat_type": "Unauthorized Access Attempt",
            "source_ip": ip,
            "summary": summary,
            "recommended_action": action,
            "timestamp": access_logs[0]["timestamp"],
        })

    return incidents


def detect_suspicious_ips(logs: list) -> list:
    """Flag any activity from known-malicious IP addresses."""
    incidents = []
    activity_by_ip = defaultdict(list)

    for log in logs:
        if log.get("ip") in BLOCKLISTED_IPS:
            activity_by_ip[log["ip"]].append(log)

    for ip, ip_logs in activity_by_ip.items():
        # Only flag if not already caught by other detectors
        count = len(ip_logs)
        paths = list(set(l.get("path", "") for l in ip_logs))

        severity = "Medium" if count < 5 else "High"
        summary = (
            f"Activity from blocklisted IP {ip}: {count} requests to "
            f"{len(paths)} unique paths. This IP is associated with known malicious activity."
        )

        incidents.append({
            "incident_detected": True,
            "severity": severity,
            "threat_type": "Suspicious IP Activity",
            "source_ip": ip,
            "summary": summary,
            "recommended_action": f"Block IP {ip} at firewall level, investigate any data accessed.",
            "timestamp": ip_logs[0]["timestamp"],
        })

    return incidents


def analyze_with_gemini(logs: list) -> str:
    """Use Gemini AI to provide a heuristic analysis of the log batch."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Gemini AI analysis is unavailable (API key not configured)."

    # Prepare a condensed version of logs for analysis
    log_samples = []
    for l in logs[:15]:  # Send up to 15 logs for context
        log_samples.append({
            "ip": l.get("ip"),
            "path": l.get("path"),
            "status": l.get("status_code"),
            "method": l.get("method"),
            "ua": l.get("user_agent")
        })

    prompt = f"""
    You are a Senior SOC Analyst. Analyze these server logs for security threats.
    Logs: {json.dumps(log_samples)}

    Provide a concise (2-3 sentences) high-level security summary. 
    If you see suspicious patterns (brute force, SQLi, scanning), mention them.
    If everything looks normal, say so.
    """

    try:
        response_text = call_gemini(prompt)
        return response_text.strip()
    except Exception as e:
        return f"Error during AI analysis: {str(e)}"


def analyze_manual_log(log_text: str) -> dict:
    """Specialized AI analysis for a manually entered log string."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {
            "error": "Gemini AI analysis is unavailable (API key not configured).",
            "fix_tip": None
        }

    prompt = f"""
    You are a Senior SOC Analyst and Security Researcher. 
    A user has manually provided the following log entry for analysis:
    
    LOG ENTRY:
    {log_text}

    Please provide a detailed analysis in JSON format with the following fields:
    1. "threat_level": (Low, Medium, High, or Critical)
    2. "analysis": (A detailed explanation of what is happening in this log)
    3. "fix_tip": (Concrete, actionable steps to fix or mitigate the issue)
    
    Return ONLY valid JSON.
    """

    try:
        content = call_gemini(prompt).strip()
        # Attempt to parse JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
            
        result = json.loads(content)
        return {
            "threat_level": result.get("threat_level", "Unknown"),
            "analysis": result.get("analysis", "No analysis provided."),
            "fix_tip": result.get("fix_tip", "No remediation steps found."),
            "incident_detected": result.get("threat_level", "Low") != "Low"
        }
    except Exception as e:
        return {
            "error": f"AI Parsing Error: {str(e)}",
            "fix_tip": "Review the log manually for suspicious patterns."
        }

def chat_with_ai(message: str, context: list) -> str:
    """Send a user message and current SOC context to Gemini for an interactive chat response."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Gemini AI is unavailable (API key not configured)."

    # Format the context (e.g., recent incidents) into a string
    context_str = json.dumps(context, indent=2) if context else "No critical incidents or logs provided."
    
    prompt = f"""
    You are an expert AI SOC Analyst assistant. The user is asking a question about the current security state.
    
    CURRENT SOC CONTEXT (Recent incidents):
    {context_str}
    
    USER QUESTION:
    "{message}"
    
    Provide a concise, professional, and helpful response based ONLY on the provided context (if applicable).
    If the context doesn't contain the answer, say "Based on the current data, I cannot determine..."
    Use markdown for formatting if needed (like bolding IP addresses).
    """

    try:
        response_text = call_gemini(prompt)
        return response_text.strip()
    except Exception as e:
        return f"Error communicating with AI: {str(e)}"

def analyze_logs(logs: list) -> list:
    """
    Run all detectors on a batch of logs and return deduplicated incidents.
    If no threats are found, returns a single 'all clear' entry.
    """
    all_incidents = []

    all_incidents.extend(detect_brute_force(logs))
    all_incidents.extend(detect_sql_injection(logs))
    all_incidents.extend(detect_unauthorized_access(logs))
    all_incidents.extend(detect_suspicious_ips(logs))

    # Deduplicate by (ip, threat_type) — keep highest severity
    severity_rank = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
    seen = {}
    for inc in all_incidents:
        key = (inc["source_ip"], inc["threat_type"])
        if key not in seen or severity_rank.get(inc["severity"], 0) > severity_rank.get(seen[key]["severity"], 0):
            seen[key] = inc

    deduplicated = list(seen.values())
    
    # Get AI Insights
    ai_insight = analyze_with_gemini(logs)

    if not deduplicated:
        return [{
            "incident_detected": False,
            "severity": None,
            "threat_type": None,
            "source_ip": None,
            "summary": "No threats detected in the analyzed logs.",
            "recommended_action": None,
            "ai_insight": ai_insight,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }]

    # Add AI insight to the primary incident
    if deduplicated:
        deduplicated[0]["ai_insight"] = ai_insight

    # Sort by severity (highest first)
    deduplicated.sort(key=lambda x: severity_rank.get(x.get("severity", ""), 0), reverse=True)
    return deduplicated
