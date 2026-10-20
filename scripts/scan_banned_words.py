import os
import re
import sys

BANNED_PATTERNS = [
    (r'\bcryptographic\s+proof\b', 'cryptographic proof'),
    (r'\btamper-?proof\b', 'tamper-proof'),
    (r'\btampered\b', 'tampered'),
    (r'\btampering\b', 'tampering'),
    (r'\bbytecode\b', 'bytecode'),
    (r'\btestnet\b', 'testnet'),
    (r'\bunanimous(ly)?\b', 'unanimous'),
    (r'\brevolutionary\b', 'revolutionary'),
    (r'\bautonomous\b', 'autonomous'),
]

IGNORE_DIRS = {'.git', 'node_modules', 'dist', '__pycache__'}
ALLOWED_FILES = {'scan_banned_words.py'}

def scan():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    violations = []
    
    for r, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            if f in ALLOWED_FILES:
                continue
            if not f.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.py', '.css')):
                continue
            path = os.path.join(r, f)
            rel_path = os.path.relpath(path, root).replace('\\', '/')
            
            with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                for line_idx, line in enumerate(fp, 1):
                    # Check finalized in docs/markdown (must only be used if referring to literal status_name)
                    if f.endswith('.md') and re.search(r'\bfinalized\b', line, re.IGNORECASE):
                        if 'status_name' not in line and 'FINALIZED' not in line:
                            violations.append((rel_path, line_idx, 'finalized', line.strip()))

                    # Check 'live' as a status word or descriptor
                    if re.search(r'\b(status[:\s]+[*_`"\']*\s*live|is\s+live|currently\s+live|live\s+(site|network|contract|mainnet|testnet|system|mode|environment|execution|evidence|timer|script))\b', line, re.IGNORECASE):
                        violations.append((rel_path, line_idx, 'live as status/descriptor', line.strip()))

                    for pat, name in BANNED_PATTERNS:
                        m = re.search(pat, line, re.IGNORECASE)
                        if m:
                            violations.append((rel_path, line_idx, m.group(0), line.strip()))
    
    if violations:
        print(f"FAILED: Found {len(violations)} banned word violations:")
        for path, line_no, matched, text in violations:
            print(f"  {path}:{line_no} [{matched}] -> {text[:100]}")
        sys.exit(1)
    else:
        print("PASSED: Zero banned words detected across codebase and docs.")
        sys.exit(0)

if __name__ == '__main__':
    scan()
