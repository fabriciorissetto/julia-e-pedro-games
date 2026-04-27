#!/usr/bin/env python3
"""
Adiciona PNGs de tileset a um mapa .tmj — calcula firstgid, columns,
tilecount automaticamente. Funciona sem dependências extras (não usa PIL).

Uso:
    python3 scripts/add_tilesets.py [--map <nome>] <pngs...>
    python3 scripts/add_tilesets.py --collection --name <nome> [--map <nome>] <pngs...>

Modo padrão (tileset em grade 32x32):
    Cada PNG vira um tileset clássico (precisa ser múltiplo de 32×32).
    Exemplo:
        python3 scripts/add_tilesets.py --map mundojulia \\
            assets/tilesets/caves-dungeons/tiles-all-32x32.png

Modo --collection (Image Collection — imagens soltas de tamanhos variados):
    Vários PNGs ficam DENTRO de UM mesmo tileset, cada um virando um
    "tile gigante" individual. Útil pra casas, árvores grandes, props.
    O nome do tileset vem de --name. Exemplo:
        python3 scripts/add_tilesets.py --collection --name houses-drummyfish \\
            --map mundojulia \\
            assets/tilesets/houses-drummyfish/house.png \\
            assets/tilesets/houses-drummyfish/house2.png \\
            assets/tilesets/houses-drummyfish/house3.png

Argumentos:
    --map <nome>      Mapa alvo (default: inicial).
                      Disponíveis: inicial, mundojulia, mundopedro, test-paredes.
    --collection      Cria/usa um Image Collection tileset.
    --name <nome>     Nome do Image Collection (obrigatório com --collection).
    <pngs...>         Caminhos pra PNGs, relativos à raiz mundinho/ ou absolutos.

Comportamento:
- Modo padrão: pula PNGs que não dividem por 32×32, pula tilesets já presentes.
- Modo --collection: pula tiles já presentes (mesma imagem). Se o tileset
  com --name já existe, adiciona novos tiles nele em vez de criar outro.
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


def proximo_gid(tilesets):
    """Calcula o próximo firstgid disponível dado os tilesets existentes."""
    next_gid = 1
    for ts in tilesets:
        next_gid = max(next_gid, ts["firstgid"] + ts.get("tilecount", 0))
    return next_gid


def adicionar_collection(mapa, nome_ts, pngs_args):
    """Cria ou atualiza um Image Collection tileset com os PNGs informados."""
    # Procura tileset existente com esse nome
    existente = next((t for t in mapa["tilesets"] if t.get("name") == nome_ts), None)

    if existente:
        if "tiles" not in existente:
            print(f"  ✗ Tileset '{nome_ts}' existe mas não é Image Collection")
            return 0
        ts = existente
        ids_existentes = {t["id"] for t in ts.get("tiles", [])}
        imagens_existentes = {t.get("image") for t in ts.get("tiles", [])}
        next_id = (max(ids_existentes) + 1) if ids_existentes else 0
        print(f"  Adicionando ao tileset existente '{nome_ts}'")
    else:
        ts = {
            "firstgid": proximo_gid(mapa["tilesets"]),
            "name": nome_ts,
            "tilecount": 0,
            "columns": 0,
            "tilewidth": 32,
            "tileheight": 32,
            "grid": {"orientation": "orthogonal", "width": 1, "height": 1},
            "margin": 0,
            "spacing": 0,
            "tiles": [],
        }
        mapa["tilesets"].append(ts)
        ids_existentes = set()
        imagens_existentes = set()
        next_id = 0
        print(f"  Criando Image Collection '{nome_ts}' (firstgid={ts['firstgid']})")

    adicionados = 0
    for arg in pngs_args:
        png_abs = Path(arg) if Path(arg).is_absolute() else (ROOT / arg).resolve()
        if not png_abs.is_file():
            print(f"  ✗ {arg}: arquivo não existe")
            continue
        rel = (Path("..") / png_abs.relative_to(ROOT / "assets")).as_posix()
        if rel in imagens_existentes:
            print(f"  ⊘ {arg}: já está no tileset")
            continue
        iw, ih = png_size(png_abs)
        ts["tiles"].append({
            "id": next_id,
            "image": rel,
            "imagewidth": iw,
            "imageheight": ih,
        })
        imagens_existentes.add(rel)
        print(f"  ✓ {arg} → tile id={next_id} ({iw}×{ih})")
        next_id += 1
        adicionados += 1

    ts["tilecount"] = len(ts["tiles"])
    return adicionados


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--map", dest="mapa", default="inicial")
    parser.add_argument("--collection", action="store_true")
    parser.add_argument("--name", dest="nome_ts")
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

    if args.collection and not args.nome_ts:
        print("✗ --collection exige --name <nome-do-tileset>")
        return 1

    mapa = json.loads(map_path.read_text())
    print(f"  Mapa alvo: {map_path.relative_to(ROOT)}")

    if args.collection:
        adicionados = adicionar_collection(mapa, args.nome_ts, args.pngs)
        if adicionados:
            map_path.write_text(json.dumps(mapa, indent=2))
            print(f"\n{adicionados} tile(s) gravado(s) em {map_path.relative_to(ROOT)}")
        else:
            print("\nNada adicionado.")
        return 0

    # Próximo firstgid disponível e nomes já em uso (modo clássico)
    next_gid = proximo_gid(mapa["tilesets"])
    nomes_existentes = {ts["name"] for ts in mapa["tilesets"]}

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
