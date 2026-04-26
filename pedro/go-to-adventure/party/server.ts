// Server PartyKit do Go To Adventure.
// Pra deploy: `npx partykit deploy --name gotoadventure --main party/server.ts`
// Sala única "mundo". Autoritativo só pra identidade/posição dos jogadores.
// Mobs e recursos são local-client por enquanto.

import type * as Party from "partykit/server";

type Classe = "warrior" | "archer" | "mage" | "healer";

type Jogador = {
  id: string;
  nickname: string;
  cls: Classe;
  x: number;
  y: number;
  facing: string;
  ultimoInput: number;
};

type MsgIdentificar = {
  tipo: "identificar";
  nickname: string;
  cls: string;
};

type MsgMover = {
  tipo: "mover";
  x: number;
  y: number;
  facing: string;
};

type MsgEntrada = MsgIdentificar | MsgMover;

const TICK_MS = 100;
const IDLE_TIMEOUT_MS = 30_000;
const CLASSES_VALIDAS: Classe[] = ["warrior", "archer", "mage", "healer"];

function sanitizaNickname(raw: any): string {
  const s = String(raw ?? "").trim();
  if (s.length < 3) return "Hero";
  return s.slice(0, 16);
}

function sanitizaClasse(raw: any): Classe {
  return CLASSES_VALIDAS.includes(raw) ? raw : "warrior";
}

function sanitizaFacing(raw: any): string {
  const f = String(raw ?? "down");
  return (f === "up" || f === "down" || f === "left" || f === "right") ? f : "down";
}

export default class GoToAdventureServer implements Party.Server {
  jogadores = new Map<string, Jogador>();

  constructor(readonly room: Party.Room) {}

  async onStart() {
    await this.room.storage.setAlarm(Date.now() + TICK_MS);
  }

  onConnect(conn: Party.Connection) {
    const novo: Jogador = {
      id: conn.id,
      nickname: "Hero",
      cls: "warrior",
      x: 1600, // centro default (WORLD_W/2 * TILE)
      y: 1600,
      facing: "down",
      ultimoInput: Date.now(),
    };
    this.jogadores.set(conn.id, novo);

    conn.send(JSON.stringify({
      tipo: "boasVindas",
      meuId: conn.id,
      jogadores: Array.from(this.jogadores.values()),
    }));
  }

  onMessage(raw: string, sender: Party.Connection) {
    let data: MsgEntrada;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    const j = this.jogadores.get(sender.id);
    if (!j) return;

    if (data.tipo === "identificar") {
      j.nickname = sanitizaNickname((data as MsgIdentificar).nickname);
      j.cls = sanitizaClasse((data as MsgIdentificar).cls);
      j.ultimoInput = Date.now();
    } else if (data.tipo === "mover") {
      const nx = Number((data as MsgMover).x);
      const ny = Number((data as MsgMover).y);
      if (Number.isFinite(nx) && Number.isFinite(ny)) {
        j.x = nx;
        j.y = ny;
        j.facing = sanitizaFacing((data as MsgMover).facing);
        j.ultimoInput = Date.now();
      }
    }
  }

  onClose(conn: Party.Connection) {
    if (this.jogadores.delete(conn.id)) {
      this.room.broadcast(JSON.stringify({
        tipo: "saiu",
        id: conn.id,
      }));
    }
  }

  onError(_conn: Party.Connection, _err: Error) {
    // PartyKit já loga
  }

  async onAlarm() {
    const agora = Date.now();
    for (const [id, j] of this.jogadores) {
      if (agora - j.ultimoInput > IDLE_TIMEOUT_MS) {
        this.jogadores.delete(id);
        this.room.broadcast(JSON.stringify({ tipo: "saiu", id }));
      }
    }

    if (this.jogadores.size > 0) {
      this.room.broadcast(JSON.stringify({
        tipo: "estado",
        t: agora,
        jogadores: Array.from(this.jogadores.values()),
      }));
    }

    await this.room.storage.setAlarm(Date.now() + TICK_MS);
  }
}

GoToAdventureServer satisfies Party.Worker;
