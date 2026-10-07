"""Export checked current source without ignored files, Git history, or symlinks."""
from __future__ import annotations

import hashlib
import json
import shutil
import zipfile
from pathlib import Path
from importlib.util import module_from_spec, spec_from_file_location

ROOT = Path(__file__).resolve().parents[1]
spec = spec_from_file_location('public_check', ROOT / 'scripts/check-public-source.py')
checker = module_from_spec(spec)
spec.loader.exec_module(checker)
files = checker.check()
output = ROOT / '.local-publication'
output.mkdir(exist_ok=True)
destination = output / 'public-source'
destination.mkdir(exist_ok=True)
unexpected = [p.relative_to(destination).as_posix() for p in destination.rglob('*') if p.is_file() and p.relative_to(destination).as_posix() not in files]
if unexpected:
    raise SystemExit('Export directory contains files outside the public manifest; choose an empty directory before exporting again.')
manifest = []
for relative in files:
    source = ROOT / relative
    if source.is_symlink(): raise SystemExit(f'Refusing symlink: {relative}')
    target = destination / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    manifest.append({'path': relative, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
archive = output / 'public-source.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
    for row in manifest:
        bundle.writestr('public-source/'+row['path'], (destination / row['path']).read_bytes())
(output / 'public-source-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
print(f'Exported {len(files)} files to {destination} and {archive}. No Git history included.')
