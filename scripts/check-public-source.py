"""Check current public source without printing sensitive values.

Checks tracked and publishable untracked files, not Git history or binary pixels.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def git(*args: str, data: bytes | None = None) -> bytes:
    return subprocess.check_output(['git', '-c', 'core.excludesFile=', *args], cwd=ROOT, input=data)

def source_files() -> list[str]:
    paths = sorted(set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split(b'\0')) - {b''})
    ignored = subprocess.run(
        ['git', '-c', 'core.excludesFile=', 'check-ignore', '--no-index', '--stdin', '-z'],
        cwd=ROOT, input=b'\0'.join(paths)+b'\0', stdout=subprocess.PIPE, check=False,
    )
    if ignored.returncode not in (0, 1): raise RuntimeError('Could not determine ignore rules.')
    ignored_paths = set(ignored.stdout.split(b'\0'))
    return [p.decode('utf-8') for p in paths if p not in ignored_paths and (ROOT / p.decode('utf-8')).is_file()]

RULES = {
    'private key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'JWT': re.compile(r'eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}'),
    'provider credential': re.compile(r'(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,})'),
    'personal filesystem path': re.compile(r'(?:[A-Z]:[\\/](?:Users|AccelByteRepo)[\\/]|/[U]sers/|/home/[a-z])'),
    'private hosting metadata': re.compile(r'(?:appgprj_[a-z0-9]+|[a-z0-9-]+\.workspace-[a-z0-9]+\.chatgpt\.site|[a-z0-9-]+\.[a-z0-9-]+\.chatgpt\.site|bitbucket\.org/accelbyte)'),
    'hardcoded live AGS host': re.compile(r'https?://(?!(?:your-game|example)\.)[a-z0-9-]+\.prod\.gamingservices\.accelbyte\.io'),
    'non-synthetic deployment/player ID': re.compile(r'(?<![a-zA-Z0-9])[a-f0-9]{32}(?![a-f0-9])'),
    'credential literal': re.compile(r'''(?i)(?:client[_-]?secret|access[_-]?token|refresh[_-]?token|password|api[_-]?key)["']?\s*[:=]\s*["']([^"'\r\n]{16,})["']'''),
    'credential environment value': re.compile(r'(?m)^[A-Z_]*(?:SECRET|PASSWORD|TOKEN|API_KEY)[A-Z_]*=([^\r\n]+)'),
}

def scan(paths: list[str]) -> list[str]:
    findings = []
    for relative in paths:
        data = (ROOT / relative).read_bytes()
        if b'\0' in data[:8000]: continue
        text = data.decode('utf-8', errors='replace')
        for kind, pattern in RULES.items():
            for match in pattern.finditer(text):
                if kind == 'non-synthetic deployment/player ID' and (len(set(match[0])) == 1 or re.fullmatch(r'0{31}[1-9]', match[0])): continue
                if kind == 'credential literal' and (match[1].startswith(('replace-with-', 'fake-', 'example-')) or '${' in match[1]): continue
                if kind == 'credential environment value' and (not match[1].strip() or match[1].strip().startswith(('replace-with-', 'fake-', 'example-', '${'))): continue
                line = text.count('\n', 0, match.start()) + 1
                findings.append(f'{relative}:{line}: {kind}')
    return sorted(set(findings))

def check() -> list[str]:
    ignored_tracked = git('ls-files', '-ci', '--exclude-standard', '-z').split(b'\0')
    ignored_count = sum(bool(p) for p in ignored_tracked)
    files = source_files()
    findings = scan(files)
    if ignored_count: findings.append(f'{ignored_count} ignored files are still tracked; remove them from the index while preserving local copies.')
    if findings:
        raise SystemExit('Public source check failed (values redacted):\n'+'\n'.join(findings))
    print(f'PASS: {len(files)} public source files checked; no configured secret/private-data patterns found.')
    return files

if __name__ == '__main__': check()
