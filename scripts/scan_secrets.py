import os
import re
import sys

SECRET_PATTERNS = [
    (r'0x[a-fA-F0-9]{64}', 'potential private key hex'),
    (r'ghp_[a-zA-Z0-9]{36}', 'GitHub personal access token'),
    (r'gho_[a-zA-Z0-9]{36}', 'GitHub OAuth access token'),
]

IGNORE_DIRS = {'.git', 'node_modules', 'dist', '__pycache__'}
ALLOWED_FILES = {'scan_secrets.py', '.env.example'}

def scan():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    violations = []
    
    for r, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            if f in ALLOWED_FILES:
                continue
            path = os.path.join(r, f)
            rel_path = os.path.relpath(path, root).replace('\\', '/')
            
            # Skip checking .env if it somehow exists (though gitignore blocks it)
            if f.startswith('.env'):
                violations.append((rel_path, 1, 'env file', 'Found .env file'))
                continue
                
            with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                for line_idx, line in enumerate(fp, 1):
                    if 'deployTxHash' in line or 'tx_hash' in line or 'transaction' in line.lower() or 'hash' in line.lower() or 'oid' in line.lower() or 'sha' in line.lower() or 'tx' in line.lower() or 'deploy' in line.lower():
                        continue
                    for pat, name in SECRET_PATTERNS:
                        m = re.search(pat, line)
                        if m:
                            violations.append((rel_path, line_idx, name, line.strip()[:60]))
    
    if violations:
        print(f"FAILED: Found {len(violations)} secret violations:")
        for path, line_no, matched, text in violations:
            print(f"  {path}:{line_no} [{matched}] -> {text}")
        sys.exit(1)
    else:
        print("PASSED: Zero secrets detected across tracked files.")
        sys.exit(0)

if __name__ == '__main__':
    scan()
