"""
Core threat detection engine.
Analyzes batches of server log entries and identifies security incidents.
"""
import re
import os
import json
import time
import hashlib
import anthropic
from collections import defaultdict
from datetime import datetime, timezone

# Import shared severity rank and blocklist helpers from db layer
from db import SEVERITY_RANK, get_blocklist

# ── AI insight cache — keyed by batch hash, expires after CACHE_TTL seconds ──
_ai_cache: dict = {}   # {hash: (result_str, expiry_epoch)}
CACHE_TTL = 60         # seconds

# ── MITRE ATT&CK Framework mapping ────────────────────────────────────────────
MITRE_MAPPING = {
    "Brute Force Attack": {
        "tactic": "Credential Access",
        "technique_id": "T1110.001",
        "technique_name": "Password Guessing",
    },
    "Credential Stuffing": {
        "tactic": "Credential Access",
        "technique_id": "T1110.004",
        "technique_name": "Credential Stuffing",
    },
    "SQL Injection": {
        "tactic": "Initial Access",
        "technique_id": "T1190",
        "technique_name": "Exploit Public-Facing Application",
    },
    "XSS Injection": {
        "tactic": "Initial Access",
        "technique_id": "T1190",
        "technique_name": "Exploit Public-Facing Application",
    },
    "Path Traversal": {
        "tactic": "Collection",
        "technique_id": "T1005",
        "technique_name": "Data from Local System",
    },
    "Unauthorized Access Attempt": {
        "tactic": "Discovery",
        "technique_id": "T1083",
        "technique_name": "File and Directory Discovery",
    },
    "Suspicious IP Activity": {
        "tactic": "Command and Control",
        "technique_id": "T1071",
        "technique_name": "Application Layer Protocol",
    },
    "Request Flood / DoS": {
        "tactic": "Impact",
        "technique_id": "T1499",
        "technique_name": "Endpoint Denial of Service",
    },
}

def call_claude(prompt: str, retries: int = 3) -> str:
    """Call Claude API with exponential backoff on transient errors."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise Exception("API key not configured.")

    client = anthropic.Anthropic(api_key=api_key)
    last_exc = None

    for attempt in range(retries):
        try:
            message = client.messages.create(
                model="claude-opus-4-8",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text

        except anthropic.RateLimitError:
            wait = 2 ** attempt
            print(f"Claude rate-limited — retrying in {wait}s (attempt {attempt+1}/{retries})")
            time.sleep(wait)
            last_exc = Exception(
                "API rate limit exceeded. Please wait a moment or check your Anthropic plan."
            )

        except anthropic.APIStatusError as e:
            if e.status_code >= 500:
                wait = 2 ** attempt
                print(f"Claude server error {e.status_code} — retrying in {wait}s")
                time.sleep(wait)
                last_exc = Exception(f"AI Provider Error ({e.status_code})")
            else:
                raise Exception(f"AI Provider Error ({e.status_code}): {e.message}")

        except anthropic.APIConnectionError as e:
            print(f"Connection error to Claude: {str(e)}")
            last_exc = Exception(f"Connection Error to AI Provider: {str(e)}")
            time.sleep(2 ** attempt)

    raise last_exc or Exception("Claude API failed after all retries.")


def _load_blocklist() -> set:
    """Load the current IP blocklist from the database (live, not cached)."""
    try:
        return set(get_blocklist())
    except Exception:
        # Fallback in case DB isn't ready yet
        return {"185.220.101.34", "185.220.101.45", "45.155.205.233",
                "45.155.205.100", "193.142.146.22", "89.248.167.131",
                "103.43.75.118",  "23.129.64.130"}

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

# --- XSS detection patterns ---
XSS_PATTERNS = [
    re.compile(r"<script", re.IGNORECASE),
    re.compile(r"javascript:", re.IGNORECASE),
    re.compile(r"on(error|load|click|mouseover)\s*=", re.IGNORECASE),
    re.compile(r"alert\s*\(", re.IGNORECASE),
    re.compile(r"document\.(cookie|write|location)", re.IGNORECASE),
    re.compile(r"eval\s*\(", re.IGNORECASE),
    re.compile(r"(%3C)script", re.IGNORECASE),   # URL-encoded <script
    re.compile(r"<svg[^>]*onload", re.IGNORECASE),
    re.compile(r"<iframe", re.IGNORECASE),
    re.compile(r"base64.*<", re.IGNORECASE),
]

# --- Path traversal detection patterns ---
PATH_TRAVERSAL_PATTERNS = [
    re.compile(r"\.\./", re.IGNORECASE),
    re.compile(r"\.\.\\", re.IGNORECASE),
    re.compile(r"%2e%2e[%/\\]", re.IGNORECASE),   # URL-encoded ../
    re.compile(r"%252e%252e", re.IGNORECASE),       # Double-encoded
    re.compile(r"etc/(passwd|shadow|hosts)", re.IGNORECASE),
    re.compile(r"proc/self/(environ|cmdline|exe)", re.IGNORECASE),
    re.compile(r"windows[/\\]system32", re.IGNORECASE),
    re.compile(r"boot\.ini", re.IGNORECASE),
    re.compile(r"win\.ini", re.IGNORECASE),
]


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
    """Flag any activity from known-malicious IP addresses (loaded live from DB)."""
    blocklist = _load_blocklist()
    incidents = []
    activity_by_ip = defaultdict(list)

    for log in logs:
        if log.get("ip") in blocklist:
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


def detect_xss(logs: list) -> list:
    """Detect Cross-Site Scripting (XSS) injection attempts in request paths."""
    incidents = []
    xss_by_ip = defaultdict(list)

    for log in logs:
        path = log.get("path", "")
        for pattern in XSS_PATTERNS:
            if pattern.search(path):
                xss_by_ip[log["ip"]].append(log)
                break

    for ip, xss_logs in xss_by_ip.items():
        count = len(xss_logs)
        server_errors = sum(1 for l in xss_logs if l.get("status_code", 0) >= 500)

        if server_errors > 0 or count >= 5:
            severity = "Critical"
            summary = (
                f"XSS attack from {ip}: {count} malicious requests detected. "
                f"{server_errors} server errors — possible successful injection."
            )
            action = f"Block IP {ip}, sanitize all user-controlled output, implement Content-Security-Policy headers."
        elif count >= 3:
            severity = "High"
            summary = f"Multiple XSS injection attempts from {ip}: {count} requests with script payloads."
            action = f"Block IP {ip}, audit templates for unescaped output, add CSP headers."
        else:
            severity = "Medium"
            summary = f"XSS injection attempt detected from {ip}."
            action = f"Monitor IP {ip}, review output encoding on affected endpoints."

        agents = {l.get("user_agent", "").lower() for l in xss_logs}
        for kw in MALICIOUS_AGENTS:
            if any(kw in a for a in agents):
                severity = "Critical"
                summary += " Automated attack tool detected."
                break

        incidents.append({
            "incident_detected": True,
            "severity": severity,
            "threat_type": "XSS Injection",
            "source_ip": ip,
            "summary": summary,
            "recommended_action": action,
            "timestamp": xss_logs[0]["timestamp"],
        })

    return incidents


def detect_path_traversal(logs: list) -> list:
    """Detect path traversal / directory traversal attacks."""
    incidents = []
    pt_by_ip = defaultdict(list)

    for log in logs:
        path = log.get("path", "")
        for pattern in PATH_TRAVERSAL_PATTERNS:
            if pattern.search(path):
                pt_by_ip[log["ip"]].append(log)
                break

    for ip, pt_logs in pt_by_ip.items():
        count = len(pt_logs)
        success = sum(1 for l in pt_logs if l.get("status_code", 0) == 200)

        if success > 0:
            severity = "Critical"
            summary = (
                f"Path traversal attack from {ip}: {count} attempts, {success} returned HTTP 200 "
                f"— possible file disclosure."
            )
            action = f"Block IP {ip} immediately, audit file access logs, restrict web root permissions."
        elif count >= 3:
            severity = "High"
            summary = f"Path traversal attack from {ip}: {count} directory traversal attempts detected."
            action = f"Block IP {ip}, validate and sanitize all file path inputs, chroot web process."
        else:
            severity = "Medium"
            summary = f"Path traversal attempt from {ip}."
            action = f"Monitor IP {ip}, ensure file path inputs are validated against a whitelist."

        incidents.append({
            "incident_detected": True,
            "severity": severity,
            "threat_type": "Path Traversal",
            "source_ip": ip,
            "summary": summary,
            "recommended_action": action,
            "timestamp": pt_logs[0]["timestamp"],
        })

    return incidents


def detect_rate_flood(logs: list) -> list:
    """Detect request-rate flooding — one IP sending an unusually high volume of requests."""
    incidents = []
    requests_by_ip = defaultdict(list)

    for log in logs:
        requests_by_ip[log["ip"]].append(log)

    for ip, ip_logs in requests_by_ip.items():
        count = len(ip_logs)
        if count < 20:
            continue

        timestamps = sorted([_parse_timestamp(l["timestamp"]) for l in ip_logs])
        if len(timestamps) >= 2:
            window = (timestamps[-1] - timestamps[0]).total_seconds() or 1
            rate = count / window  # requests per second
        else:
            rate = count

        severity = "Critical" if count >= 50 or rate >= 5 else "High"
        summary = (
            f"Request flood from {ip}: {count} requests"
            + (f" at {rate:.1f} req/s" if rate < 9999 else "")
            + ". Possible DoS or automated scanning."
        )

        incidents.append({
            "incident_detected": True,
            "severity": severity,
            "threat_type": "Request Flood / DoS",
            "source_ip": ip,
            "summary": summary,
            "recommended_action": f"Rate-limit and block IP {ip} at the WAF/firewall level. Enable CAPTCHA on public endpoints.",
            "timestamp": ip_logs[0]["timestamp"],
        })

    return incidents


def detect_credential_stuffing(logs: list) -> list:
    """Detect credential stuffing — many different usernames tried from the same IP."""
    incidents = []
    login_paths = {"/login", "/api/v1/auth/login", "/auth/signin", "/api/v1/auth"}
    attempts_by_ip = defaultdict(list)

    for log in logs:
        if log.get("method") == "POST" and log.get("path", "").lower() in login_paths:
            attempts_by_ip[log["ip"]].append(log)

    for ip, login_logs in attempts_by_ip.items():
        unique_users = {l.get("user") for l in login_logs if l.get("user")}
        if len(unique_users) < 3:
            continue

        count = len(login_logs)
        failures = sum(1 for l in login_logs if l.get("status_code") in (401, 403))
        successes = count - failures

        severity = "Critical" if successes > 0 else "High"
        summary = (
            f"Credential stuffing from {ip}: {count} login attempts using {len(unique_users)} "
            f"different accounts ({failures} failures"
            + (f", {successes} SUCCESSFUL — accounts may be compromised" if successes > 0 else "")
            + ")."
        )

        incidents.append({
            "incident_detected": True,
            "severity": severity,
            "threat_type": "Credential Stuffing",
            "source_ip": ip,
            "summary": summary,
            "recommended_action": f"Block IP {ip}, force password reset on targeted accounts ({', '.join(list(unique_users)[:5])}), enable MFA.",
            "timestamp": login_logs[0]["timestamp"],
        })

    return incidents


def analyze_with_claude(logs: list, rule_detections: list = None) -> str:
    """Use Claude AI to provide a heuristic analysis of the log batch.

    Results are cached for CACHE_TTL seconds based on the batch content
    to avoid burning API quota on identical live-stream iterations.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return "Claude AI analysis is unavailable (API key not configured)."

    # Build a stable cache key from the first 15 log IPs + paths
    key_data = json.dumps(
        [{"ip": l.get("ip"), "path": l.get("path")} for l in logs[:15]],
        sort_keys=True,
    )
    cache_key = hashlib.md5(key_data.encode()).hexdigest()
    now = time.time()

    if cache_key in _ai_cache:
        cached_result, expiry = _ai_cache[cache_key]
        if now < expiry:
            return cached_result  # serve from cache

    log_samples = [
        {
            "ip": l.get("ip"),
            "path": l.get("path"),
            "status": l.get("status_code"),
            "method": l.get("method"),
            "ua": l.get("user_agent"),
        }
        for l in logs[:15]
    ]

    # Summarize what rule-based detectors already found
    detections_summary = ""
    if rule_detections:
        real = [d for d in rule_detections if d.get("incident_detected")]
        if real:
            lines = [f"- {d['severity']} | {d['threat_type']} from {d['source_ip']}" for d in real[:5]]
            detections_summary = "\n\nRule-based detectors already flagged:\n" + "\n".join(lines)

    prompt = f"""You are a Senior Threat Intelligence Analyst at a SOC.

Analyze the following server log batch for security threats and attack patterns.
{detections_summary}

Log sample ({len(logs)} total entries):
{json.dumps(log_samples, indent=2)}

Provide a concise 2-3 sentence threat intelligence summary:
- Confirm or challenge the rule-based detections if present
- Identify any additional attack patterns, TTPs, or anomalies
- Assess the overall threat level (Low / Medium / High / Critical)
- If you recognize MITRE ATT&CK techniques, mention the tactic

Be direct and professional. No disclaimers."""

    try:
        response_text = call_claude(prompt)
        result = response_text.strip()
        _ai_cache[cache_key] = (result, now + CACHE_TTL)
        return result
    except Exception as e:
        return f"Error during AI analysis: {str(e)}"


def analyze_manual_log(log_text: str) -> dict:
    """Specialized AI analysis for a manually entered log string."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return {
            "error": "Claude AI analysis is unavailable (API key not configured).",
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
        content = call_claude(prompt).strip()
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

def chat_with_ai(message: str, context: list, stats: dict = None) -> str:
    """Send a user message and current SOC context to Claude for an interactive chat response."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return "Claude AI is unavailable (API key not configured)."

    incidents_str = json.dumps(context, indent=2) if context else "No incidents recorded yet."

    # Build a richer stats summary
    stats_summary = ""
    if stats:
        total = stats.get("total_incidents", 0)
        last_hour = stats.get("last_hour", 0)
        by_sev = stats.get("by_severity", {})
        by_type = stats.get("by_type", {})
        top_type = max(by_type, key=by_type.get, default="N/A") if by_type else "N/A"
        stats_summary = (
            f"\n\nDASHBOARD STATS:\n"
            f"- Total incidents recorded: {total}\n"
            f"- Incidents in last hour: {last_hour}\n"
            f"- Critical: {by_sev.get('Critical', 0)} | High: {by_sev.get('High', 0)} | "
            f"Medium: {by_sev.get('Medium', 0)} | Low: {by_sev.get('Low', 0)}\n"
            f"- Most common attack type: {top_type}\n"
        )

        # Detect potential APT pattern: same IP with multiple attack types
        ip_types: dict = {}
        for inc in context:
            ip = inc.get("source_ip")
            t = inc.get("threat_type")
            if ip and t:
                ip_types.setdefault(ip, set()).add(t)
        apt_ips = [ip for ip, types in ip_types.items() if len(types) >= 2]
        if apt_ips:
            stats_summary += f"- ⚠️ Potential multi-stage attack from: {', '.join(apt_ips[:3])}\n"

    prompt = f"""You are an expert AI SOC Analyst with deep knowledge of threat intelligence, MITRE ATT&CK framework, and incident response.
{stats_summary}
RECENT INCIDENTS (last 10):
{incidents_str}

ANALYST QUESTION: {message}

Instructions:
- Answer based on the provided data; be specific about IPs, attack types, and severity
- Reference MITRE ATT&CK techniques where applicable (e.g., "This matches T1110 - Brute Force")
- If you detect attack correlations or patterns across multiple incidents, highlight them
- Provide actionable recommendations
- If the data doesn't contain the answer, say so clearly
- Use **bold** for IPs and technique IDs, use bullet points for multiple items"""

    try:
        response_text = call_claude(prompt)
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
    all_incidents.extend(detect_xss(logs))
    all_incidents.extend(detect_path_traversal(logs))
    all_incidents.extend(detect_rate_flood(logs))
    all_incidents.extend(detect_credential_stuffing(logs))

    # Deduplicate by (ip, threat_type) — keep highest severity
    seen = {}
    for inc in all_incidents:
        key = (inc["source_ip"], inc["threat_type"])
        if key not in seen or SEVERITY_RANK.get(inc["severity"], 0) > SEVERITY_RANK.get(seen[key]["severity"], 0):
            seen[key] = inc

    deduplicated = list(seen.values())

    # Enrich each incident with MITRE ATT&CK data
    for inc in deduplicated:
        mitre = MITRE_MAPPING.get(inc.get("threat_type", ""))
        if mitre:
            inc["mitre_tactic"] = mitre["tactic"]
            inc["mitre_technique_id"] = mitre["technique_id"]
            inc["mitre_technique_name"] = mitre["technique_name"]

    # Get AI Insights — pass rule detections so Claude can reason on top of them
    ai_insight = analyze_with_claude(logs, rule_detections=deduplicated)

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
    deduplicated[0]["ai_insight"] = ai_insight

    # Sort by severity (highest first)
    deduplicated.sort(key=lambda x: SEVERITY_RANK.get(x.get("severity", ""), 0), reverse=True)
    return deduplicated
