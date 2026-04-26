#!/usr/bin/env python3
"""
Renomeia mundinho.tmj → inicial.tmj e cria mundojulia.tmj, mundopedro.tmj
e test-paredes.tmj (mapa pequeno de teste com uma parede vertical).

Mantém os mesmos tilesets do mapa atual pros novos — paleta consistente.

Uso:
    python3 scripts/criar_mapas.py
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAPS = ROOT / "assets" / "maps"
TILE = 32


def template_mapa(width, height, tilesets, parede_col=None, spawn=None):
    total = width * height
    chao = [1] * total
    decoracao = [0] * total
    colisao = [0] * total
    if parede_col is not None:
        for row in range(height):
            colisao[row * width + parede_col] = 1

    if spawn is None:
        spawn_x = (width * TILE) / 2
        spawn_y = (height * TILE) / 2
    else:
        spawn_x, spawn_y = spawn[0] * TILE + TILE / 2, spawn[1] * TILE + TILE / 2

    return {
        "compressionlevel": -1,
        "type": "map",
        "version": "1.10",
        "tiledversion": "1.10.2",
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "infinite": False,
        "width": width,
        "height": height,
        "tilewidth": TILE,
        "tileheight": TILE,
        "nextlayerid": 5,
        "nextobjectid": 2,
        "tilesets": tilesets,
        "layers": [
            {"id": 1, "name": "chao", "type": "tilelayer", "x": 0, "y": 0,
             "width": width, "height": height, "opacity": 1, "visible": True, "data": chao},
            {"id": 2, "name": "decoracao", "type": "tilelayer", "x": 0, "y": 0,
             "width": width, "height": height, "opacity": 1, "visible": True, "data": decoracao},
            {"id": 3, "name": "colisao", "type": "tilelayer", "x": 0, "y": 0,
             "width": width, "height": height, "opacity": 1, "visible": True, "data": colisao},
            {"id": 4, "name": "spawns", "type": "objectgroup", "draworder": "topdown",
             "x": 0, "y": 0, "opacity": 1, "visible": True,
             "objects": [{"id": 1, "name": "player", "type": "",
                          "x": spawn_x, "y": spawn_y,
                          "width": 0, "height": 0, "rotation": 0,
                          "visible": True, "point": True}]},
        ],
    }


def main():
    mundinho = MAPS / "mundinho.tmj"
    inicial = MAPS / "inicial.tmj"
    if mundinho.exists() and not inicial.exists():
        shutil.move(str(mundinho), str(inicial))
        print(f"✓ {mundinho.name} → {inicial.name}")
    elif inicial.exists():
        print(f"  {inicial.name} já existe — pulando rename")
    else:
        print(f"✗ {mundinho.name} não existe e {inicial.name} também não — abortando")
        return 1

    tilesets = json.loads(inicial.read_text())["tilesets"]
    print(f"  Reusando {len(tilesets)} tilesets do {inicial.name}")

    for nome in ["mundojulia", "mundopedro"]:
        path = MAPS / f"{nome}.tmj"
        if path.exists():
            print(f"  ⊘ {nome}.tmj já existe")
            continue
        path.write_text(json.dumps(template_mapa(30, 20, tilesets), indent=2))
        print(f"✓ Criado {nome}.tmj (30x20)")

    # Mapa de teste: 20x10, parede vertical na coluna 10, spawn na coluna 5 linha 5.
    # Usado pelos testes automatizados pra verificar colisão.
    test_path = MAPS / "test-paredes.tmj"
    if not test_path.exists():
        test_path.write_text(json.dumps(
            template_mapa(20, 10, tilesets, parede_col=10, spawn=(5, 5)), indent=2
        ))
        print(f"✓ Criado test-paredes.tmj (20x10, parede col=10)")
    else:
        print(f"  ⊘ test-paredes.tmj já existe")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
