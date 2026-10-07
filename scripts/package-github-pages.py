"""Add the tutorial and its media to the static build. Run after npm run build:pages."""
from __future__ import annotations

import shutil
from pathlib import Path
from urllib.parse import unquote, urlsplit

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist-pages'
REPOSITORY = 'https://github.com/AccelByte/sa-signal-range'
DEMO = 'https://accelbyte.github.io/sa-signal-range/'

if not (OUTPUT / 'index.html').is_file():
    raise SystemExit('Build the demo first: cd prototype && npm run build:pages')

soup = BeautifulSoup((ROOT / 'battle-pass-tutorial.html').read_text(encoding='utf-8'), 'html.parser')
media = set()
for element in soup.find_all(['a', 'img', 'source', 'video']):
    for attribute in ['href', 'src', 'poster']:
        value = element.get(attribute)
        if not value:
            continue
        if value == DEMO:
            element[attribute] = './'
            continue
        parts = urlsplit(value)
        if parts.scheme or parts.netloc or not parts.path:
            continue
        path = unquote(parts.path)
        source = (ROOT / path).resolve()
        if not source.is_relative_to(ROOT):
            raise SystemExit('Tutorial reference escapes repository')
        if not source.exists():
            raise SystemExit(f'Missing tutorial reference: {path}')
        relative = source.relative_to(ROOT).as_posix()
        if relative == 'battle-pass-tutorial.html':
            element[attribute] = './battle-pass-tutorial.html'
            continue
        if source.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4'}:
            media.add(relative)
        else:
            route = 'tree' if source.is_dir() else 'blob'
            element[attribute] = f'{REPOSITORY}/{route}/main/{relative}' + (f'#{parts.fragment}' if parts.fragment else '')

for relative in sorted(media):
    target = OUTPUT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / relative, target)
(OUTPUT / 'battle-pass-tutorial.html').write_text(str(soup), encoding='utf-8')
(OUTPUT / '.nojekyll').touch()
print(f'Packaged tutorial and {len(media)} media files in dist-pages/.')
