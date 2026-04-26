#!/usr/bin/env python3
"""
Adiciona PNGs de tileset a um mapa .tmj — calcula firstgid, columns,
tilecount automaticamente. Funciona sem dependências extras (não usa PIL).

Uso:
    python3 scripts/add_tilesets.py [--map <nome>] <pngs...>

Argumentos:
    --map <nome>   Mapa alvo (default: inicial). Carrega assets/maps/<nome>.tmj.
                   Mapas disponíveis: inicial, mundojulia, mundopedro, test-paredes.
    <pngs...>      Caminhos pra PNGs, relativos à raiz mundinho/ ou absolutos.

Exemplo:
    python3 scripts/add_tilesets.py \\
        --map mundojulia \\
        assets/tilesets/caves-dungeons/tiles-all-32x32.png

Comportamento:
- Pula PNGs cujas dimensões não são múltiplas de 32 (não casam com tiles
  32x32; podem ser tileset de tamanho diferente — adicione manualmente
  no Tiled).
- Pula tilesets já presentes no mapa (compara pelo nome gerado).
- Nome do tileset = nome do arquivo sem extensão, prefixado com a pasta
  pai (ex: "caves-dungeons/tiles-all-32x32.png" → "caves_dungeons_tiles_all_32x32").
"""
import argparse
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # familia/mundinho/
MAPS_DIR = ROOT / "assets" / "maps"
TILE = 32


def png_size(path: Path) -> tuple[int, int]:
    """Lê width/height de PNG diretamente do cabeçalho IHDR (sem PIL)."""
    with open(path, "rb") as f:
        header = f.read(24)
    # Bytes 16-23 do PNG: width (4 bytes BE), height (4 bytes BE)
    w, h = struct.unpack(">II", header[16:24])
    return w, h


def nome_amigavel(png_abs: Path) -> str:
    base = png_abs.stem.replace("-", "_").replace(" ", "_")
    pasta = png_abs.parent.name
    # Se o PNG está direto em tilesets/ (sem subpasta), só usa o stem
    if pasta == "tilesets":
        return base
    return f"{pasta.replace('-', '_')}_{base}"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--map", dest="mapa", default="inicial")
    parser.add_argument("pngs", nargs="*")
    parser.add_argument("-h", "--help", action="store_true")
    args = parser.parse_args(argv)

    if args.help:
        print(__doc__)
        return 0

    map_path = MAPS_DIR / f"{args.mapa}.tmj"
    if not map_path.is_file():
        print(f"✗ Mapa não encontrado: {map_path.relative_to(ROOT)}")
        disponiveis = sorted(p.stem for p in MAPS_DIR.glob("*.tmj"))
        print(f"  Disponíveis: {', '.join(disponiveis)}")
        return 1

    if not args.pngs:
        print(__doc__)
        return 1

    mapa = json.loads(map_path.read_text())
    print(f"  Mapa alvo: {map_path.relative_to(ROOT)}")

    # Próximo firstgid disponível e nomes já em uso
    next_gid = 1
    nomes_existentes = set()
    for ts in mapa["tilesets"]:
        nomes_existentes.add(ts["name"])
        next_gid = max(next_gid, ts["firstgid"] + ts["tilecount"])

    adicionados = 0
    for arg in args.pngs:
        # Aceita absoluto ou relativo a mundinho/
        png_abs = Path(arg) if Path(arg).is_absolute() else (ROOT / arg).resolve()
        if not png_abs.is_file():
            print(f"  ✗ {arg}: arquivo não existe")
            continue

        nome = nome_amigavel(png_abs)
        if nome in nomes_existentes:
            print(f"  ⊘ {arg}: já existe como '{nome}'")
            continue

        iw, ih = png_size(png_abs)
        if iw % TILE or ih % TILE:
            print(f"  ⚠ {arg}: {iw}x{ih} não divide por {TILE} — pulando")
            continue

        # Caminho relativo do .tmj pro PNG (mapa fica em assets/maps/)
        rel = Path("..") / png_abs.relative_to(ROOT / "assets")
        rel_str = rel.as_posix()

        cols = iw // TILE
        count = cols * (ih // TILE)

        mapa["tilesets"].append({
            "firstgid": next_gid,
            "name": nome,
            "image": rel_str,
            "imagewidth": iw,
            "imageheight": ih,
            "tilewidth": TILE,
            "tileheight": TILE,
            "tilecount": count,
            "columns": cols,
            "margin": 0,
            "spacing": 0,
        })
        nomes_existentes.add(nome)
        next_gid += count
        adicionados += 1
        print(f"  ✓ {arg} → '{nome}' ({count} tiles, firstgid={next_gid - count})")

    if adicionados:
        map_path.write_text(json.dumps(mapa, indent=2))
        print(f"\n{adicionados} tileset(s) gravado(s) em {map_path.relative_to(ROOT)}")
    else:
        print("\nNada adicionado.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
