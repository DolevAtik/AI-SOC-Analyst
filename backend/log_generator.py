"""
Simulated server log generator.
Produces realistic log entries including normal traffic and various attack patterns.
"""
import random
import string
from datetime import datetime, timedelta


# --- Realistic data pools ---

NORMAL_IPS = [
    "192.168.1.10", "192.168.1.25", "192.168.1.42", "192.168.1.88",
    "10.0.0.15", "10.0.0.23", "10.0.0.50", "10.0.0.101",
    "172.16.0.5", "172.16.0.19", "172.16.0.77",
]

SUSPICIOUS_IPS = [
    "185.220.101.34", "185.220.101.45",  # Known Tor exit nodes
    "45.155.205.233", "45.155.205.100",  # Abuse-listed IPs
    "193.142.146.22", "89.248.167.131",  # Scanner IPs
    "103.43.75.118", "23.129.64.130",
]

NORMAL_USERS = ["alice", "bob", "charlie", "diana", "eve", "frank", "grace"]
ADMIN_USERS = ["admin", "root", "sysadmin"]

NORMAL_PATHS = [
    "/", "/index.html", "/dashboard", "/api/v1/users", "/api/v1/profile",
    "/api/v1/settings", "/images/logo.png", "/css/main.css", "/js/app.js",
    "/about", "/contact", "/api/v1/notifications", "/api/v1/reports",
]

SENSITIVE_PATHS = [
    "/admin", "/admin/users", "/admin/config", "/admin/logs",
    "/etc/passwd", "/etc/shadow", "/.env", "/wp-admin",
    "/phpmyadmin", "/server-status", "/debug", "/api/v1/admin/export",
]

SQL_INJECTION_PAYLOADS = [
    "' OR 1=1 --",
    "' UNION SELECT username, password FROM users --",
    "'; DROP TABLE users; --",
    "' OR ''='",
    "1' AND 1=CONVERT(int, (SELECT TOP 1 table_name FROM information_schema.tables))--",
    "admin'--",
    "' UNION ALL SELECT NULL, NULL, NULL --",
    "1; EXEC xp_cmdshell('whoami')--",
    "' OR 'x'='x",
    "1' ORDER BY 10--",
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Mobile/15E148",
    "python-requests/2.31.0",
    "curl/8.4.0",
    "Wget/1.21.4",
]

MALICIOUS_USER_AGENTS = [
    "sqlmap/1.7.12",
    "nikto/2.5.0",
    "Nmap Scripting Engine",
    "masscan/1.3",
    "DirBuster-1.0-RC1",
    "gobuster/3.6",
]


def _random_timestamp(base: datetime = None, spread_seconds: int = 300):
    """Generate a random timestamp near the base time."""
    if base is None:
        base = datetime.utcnow()
    offset = random.randint(-spread_seconds, spread_seconds)
    return (base + timedelta(seconds=offset)).isoformat() + "Z"


def _rapid_timestamps(count: int, base: datetime = None, window_seconds: int = 30):
    """Generate rapid-fire timestamps within a small window (for brute force)."""
    if base is None:
        base = datetime.utcnow()
    timestamps = []
    for i in range(count):
        offset = random.uniform(0, window_seconds)
        timestamps.append((base + timedelta(seconds=offset)).isoformat() + "Z")
    return sorted(timestamps)


def generate_normal_log(base_time: datetime = None):
    """Generate a single normal-looking log entry."""
    return {
        "timestamp": _random_timestamp(base_time),
        "ip": random.choice(NORMAL_IPS),
        "method": random.choice(["GET", "GET", "GET", "POST", "PUT", "DELETE"]),
        "path": random.choice(NORMAL_PATHS),
        "status_code": random.choice([200, 200, 200, 200, 201, 301, 304]),
        "user_agent": random.choice(USER_AGENTS),
        "user": random.choice(NORMAL_USERS),
    }


def generate_brute_force_logs(base_time: datetime = None, count: int = None):
    """Generate a burst of failed login attempts from the same IP."""
    if count is None:
        count = random.randint(5, 20)
    attacker_ip = random.choice(SUSPICIOUS_IPS)
    target_user = random.choice(ADMIN_USERS + NORMAL_USERS)
    timestamps = _rapid_timestamps(count, base_time, window_seconds=60)

    logs = []
    for ts in timestamps:
        logs.append({
            "timestamp": ts,
            "ip": attacker_ip,
            "method": "POST",
            "path": random.choice(["/login", "/api/v1/auth/login", "/auth/signin"]),
            "status_code": 401,
            "user_agent": random.choice(USER_AGENTS + MALICIOUS_USER_AGENTS),
            "user": target_user,
        })
    # Sometimes the last attempt succeeds (account compromise)
    if random.random() < 0.2:
        logs[-1]["status_code"] = 200
    return logs


def generate_sql_injection_logs(base_time: datetime = None, count: int = None):
    """Generate requests with SQL injection payloads."""
    if count is None:
        count = random.randint(3, 8)
    attacker_ip = random.choice(SUSPICIOUS_IPS)
    logs = []
    for _ in range(count):
        payload = random.choice(SQL_INJECTION_PAYLOADS)
        base_path = random.choice(["/search?q=", "/login?user=", "/api/v1/users?id=", "/products?category="])
        logs.append({
            "timestamp": _random_timestamp(base_time, spread_seconds=120),
            "ip": attacker_ip,
            "method": random.choice(["GET", "POST"]),
            "path": base_path + payload,
            "status_code": random.choice([200, 400, 500, 500]),
            "user_agent": random.choice(MALICIOUS_USER_AGENTS + USER_AGENTS[:2]),
            "user": None,
        })
    return logs


def generate_unauthorized_access_logs(base_time: datetime = None, count: int = None):
    """Generate attempts to access sensitive/admin paths by non-privileged users."""
    if count is None:
        count = random.randint(2, 6)
    attacker_ip = random.choice(SUSPICIOUS_IPS + NORMAL_IPS[-3:])
    logs = []
    for _ in range(count):
        logs.append({
            "timestamp": _random_timestamp(base_time, spread_seconds=180),
            "ip": attacker_ip,
            "method": "GET",
            "path": random.choice(SENSITIVE_PATHS),
            "status_code": random.choice([403, 403, 403, 404, 401]),
            "user_agent": random.choice(MALICIOUS_USER_AGENTS + USER_AGENTS),
            "user": random.choice(NORMAL_USERS + [None]),
        })
    return logs


def generate_suspicious_ip_logs(base_time: datetime = None, count: int = None):
    """Generate activity from known-malicious IP addresses."""
    if count is None:
        count = random.randint(3, 10)
    attacker_ip = random.choice(SUSPICIOUS_IPS)
    logs = []
    for _ in range(count):
        logs.append({
            "timestamp": _random_timestamp(base_time, spread_seconds=300),
            "ip": attacker_ip,
            "method": random.choice(["GET", "HEAD", "OPTIONS"]),
            "path": random.choice(NORMAL_PATHS + SENSITIVE_PATHS),
            "status_code": random.choice([200, 301, 403, 404]),
            "user_agent": random.choice(MALICIOUS_USER_AGENTS),
            "user": None,
        })
    return logs


def generate_log_batch(count: int = 50, attack_ratio: float = 0.3):
    """
    Generate a mixed batch of logs: normal traffic + attack patterns.

    Args:
        count: approximate total number of log entries
        attack_ratio: fraction of logs that should be attack-related (0.0 - 1.0)
    """
    base_time = datetime.utcnow()
    normal_count = int(count * (1 - attack_ratio))
    attack_count = count - normal_count

    logs = []

    # Normal logs
    for _ in range(normal_count):
        logs.append(generate_normal_log(base_time))

    # Attack logs — randomly pick attack types
    attack_generators = [
        generate_brute_force_logs,
        generate_sql_injection_logs,
        generate_unauthorized_access_logs,
        generate_suspicious_ip_logs,
    ]

    remaining = attack_count
    while remaining > 0:
        generator = random.choice(attack_generators)
        batch_size = min(remaining, random.randint(3, 8))
        attack_logs = generator(base_time, count=batch_size)
        logs.extend(attack_logs)
        remaining -= len(attack_logs)

    # Shuffle to simulate interleaved traffic
    random.shuffle(logs)
    return logs
