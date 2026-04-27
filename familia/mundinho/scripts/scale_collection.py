#!/usr/bin/env python3
"""
Escala todos os PNGs de um Image Collection tileset (e o .tmj) por um fator.
Pra pixel art usa nearest-neighbor: cada pixel vira N×N, sem borrar.

Uso:
    python3 scripts/scale_collection.py --map mundojulia --tileset houses-drummyfish [--factor 2]

Efeitos:
- Sobrescreve cada PNG do tileset com a versão escalada (in-place).
- Atualiza imagewidth/imageheight de cada tile dentro do tileset no .tmj.
- Atualiza width/height de cada object já pintado que use tiles desse tileset
  (assim casas pintadas no Tiled continuam batendo com a imagem).

Reverter: rodar com --factor 0.5 nos arquivos já escalados.
"""
import argparse
import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent  # familia/mundinho/
MAPS_DIR = ROOT / "assets" / "maps"


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--map", dest="mapa", required=True)
    parser.add_argument("--tileset", dest="tileset", required=True)
    parser.add_argument("--factor", type=float, default=2.0)
    args = parser.parse_args(argv)

    map_path = MAPS_DIR / f"{args.mapa}.tmj"
    if not map_path.is_file():
        print(f"✗ Mapa não encontrado: {map_path}")
        return 1

    mapa = json.loads(map_path.read_text())
    ts = next((t for t in mapa["tilesets"] if t.get("name") == args.tileset), None)
    if not ts:
        print(f"✗ Tileset '{args.tileset}' não está em {args.mapa}.tmj")
        return 1
    if "tiles" not in ts:
        print(f"✗ '{args.tileset}' não é Image Collection")
        return 1

    f = args.factor
    print(f"  Escalando '{args.tileset}' por {f}× (nearest-neighbor)")

    # 1. Escala cada PNG e atualiza imagewidth/imageheight no .tmj
    for tile in ts["tiles"]:
        # tile["image"] é relativo a ../assets/maps/, ex: "../tilesets/.../foo.png"
        png_path = (MAPS_DIR / tile["image"]).resolve()
        if not png_path.is_file():
            print(f"  ✗ PNG não encontrado: {png_path}")
            continue
        img = Image.open(png_path)
        new_w = int(img.width * f)
        new_h = int(img.height * f)
        img.resize((new_w, new_h), Image.NEAREST).save(png_path)
        print(f"  ✓ {png_path.name}: {img.width}×{img.height} → {new_w}×{new_h}")
        tile["imagewidth"] = new_w
        tile["imageheight"] = new_h

    # 2. Atualiza objects já pintados que usam esses gids
    gid_min = ts["firstgid"]
    gid_max = gid_min + max((t["id"] for t in ts["tiles"]), default=0)
    objs_atualizados = 0
    for layer in mapa.get("layers", []):
        if layer.get("type") != "objectgroup":
            continue
        for obj in layer.get("objects", []):
            gid = obj.get("gid")
            if gid is None:
                continue
            # Tiled grava flags de flip nos bits altos do gid; máscara abaixo.
            base_gid = gid & 0x0FFFFFFF
            if gid_min <= base_gid <= gid_max:
                obj["width"] = int(obj["width"] * f)
                obj["height"] = int(obj["height"] * f)
                objs_atualizados += 1

    map_path.write_text(json.dumps(mapa, indent=2))
    print(f"\n  Tilesets atualizados em {map_path.name}")
    print(f"  Objects atualizados: {objs_atualizados}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
