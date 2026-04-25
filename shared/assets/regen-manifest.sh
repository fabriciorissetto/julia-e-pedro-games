#!/usr/bin/env bash
# Regenera manifest.json varrendo sprites/ e sounds/ (todos os fornecedores).
# Rode sempre que adicionar ou remover arquivos.
# Uso: ./regen-manifest.sh  (a partir de shared/assets/)
set -e
cd "$(dirname "$0")"
python3 << 'EOF'
import os, json
def collect(root, exts):
    result = {}
    for dirpath, _, files in os.walk(root):
        matches = sorted([f for f in files if f.lower().endswith(exts)])
        if matches:
            result[os.path.relpath(dirpath, root)] = matches
    return result
manifest = {
    'sprites': collect('sprites', ('.png',)),
    'sounds': collect('sounds', ('.ogg', '.mp3', '.wav')),
}
with open('manifest.json', 'w') as f:
    json.dump(manifest, f, indent=2)
s = sum(len(v) for v in manifest['sprites'].values())
a = sum(len(v) for v in manifest['sounds'].values())
print(f"OK — {s} sprites, {a} sons")
EOF
