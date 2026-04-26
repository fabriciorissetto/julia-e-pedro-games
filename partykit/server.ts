// Servidor PartyKit do "10 Dias na Floresta" multiplayer.
// Mundo único compartilhado (mesma sala "mundo" pra todo mundo).
// Por enquanto, autoritativo só pras posições/identidade dos jogadores.
// Terreno (árvores, baús) é gerado deterministicamente no cliente, então
// já é igual pra todo mundo sem precisar sincronizar.

import type * as Party from "partykit/server";

type Equipado = {
  veiculo: string | null;
  capa: string | null;
  chapeu: string | null;
  rosto: string | null;
  arma: string | null;
  escudo: string | null;
  pet: string | null;
  petItem: string | null;
};

type Jogador = {
  id: string;
  nome: string;
  skin: string;       // chave de skin (ex: 'princesaRosa') ou emoji
  spriteFrame: number | null; // frame do spritesheet 'dungeon' se for skin de sprite
  emoji: string | null;       // se for skin de emoji
  x: number;
  y: number;
  vx: number;         // pra interpolação no cliente
  vy: number;
  flipX: boolean;
  equipado: Equipado;
  ultimoInput: number; // ms epoch — pra detectar idle
};

const EQUIPADO_VAZIO: Equipado = {
  veiculo: null, capa: null, chapeu: null, rosto: null,
  arma: null, escudo: null, pet: null, petItem: null,
};

function sanitizaEquipado(e: any): Equipado {
  const limpa = (v: any) => (typeof v === 'string' && v.length > 0 && v.length < 32) ? v : null;
  return {
    veiculo: limpa(e?.veiculo),
    capa: limpa(e?.capa),
    chapeu: limpa(e?.chapeu),
    rosto: limpa(e?.rosto),
    arma: limpa(e?.arma),
    escudo: limpa(e?.escudo),
    pet: limpa(e?.pet),
    petItem: limpa(e?.petItem),
  };
}

type MsgIdentificar = {
  tipo: "identificar";
  nome: string;
  skin: string;
  spriteFrame: number | null;
  emoji: string | null;
};

type MsgMover = {
  tipo: "mover";
  x: number;
  y: number;
  vx: number;
  vy: number;
  flipX: boolean;
  equipado?: Equipado;
};

type MsgMagia = {
  tipo: "magia";
  x: number;
  y: number;
  raio?: number;
};

type MsgChat = {
  tipo: "chat";
  texto: string;
};

type MsgEntrada = MsgIdentificar | MsgMover | MsgMagia | MsgChat;

const TICK_MS = 75; // ~13Hz — suave o bastante, leve no broadcast

export default class FlorestaServer implements Party.Server {
  jogadores = new Map<string, Jogador>();

  constructor(readonly room: Party.Room) {}

  async onStart() {
    // Agenda o primeiro tick
    await this.room.storage.setAlarm(Date.now() + TICK_MS);
  }

  onConnect(conn: Party.Connection) {
    const novo: Jogador = {
      id: conn.id,
      nome: "Visitante",
      skin: "padrao",
      spriteFrame: null,
      emoji: "🧑",
      x: 1500, // WORLD_W/2 default — cliente reposiciona depois
      y: 1500,
      vx: 0,
      vy: 0,
      flipX: false,
      equipado: { ...EQUIPADO_VAZIO },
      ultimoInput: Date.now(),
    };
    this.jogadores.set(conn.id, novo);

    // Manda pro recém-chegado o estado completo imediatamente
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
      j.nome = String(data.nome ?? "").slice(0, 20) || "Visitante";
      j.skin = String(data.skin ?? "padrao").slice(0, 32);
      j.spriteFrame = typeof data.spriteFrame === "number" ? data.spriteFrame : null;
      j.emoji = data.emoji ? String(data.emoji).slice(0, 8) : null;
      j.ultimoInput = Date.now();
    } else if (data.tipo === "mover") {
      // valida números
      const nx = Number(data.x);
      const ny = Number(data.y);
      if (Number.isFinite(nx) && Number.isFinite(ny)) {
        j.x = nx;
        j.y = ny;
        j.vx = Number(data.vx) || 0;
        j.vy = Number(data.vy) || 0;
        j.flipX = !!data.flipX;
        if (data.equipado) j.equipado = sanitizaEquipado(data.equipado);
        j.ultimoInput = Date.now();
      }
    } else if (data.tipo === "magia") {
      const mx = Number(data.x), my = Number(data.y);
      if (Number.isFinite(mx) && Number.isFinite(my)) {
        const raio = Number.isFinite(Number(data.raio)) ? Math.min(800, Math.max(20, Number(data.raio))) : 128;
        this.room.broadcast(JSON.stringify({
          tipo: "magia", id: sender.id, x: mx, y: my, raio
        }), [sender.id]);
      }
    } else if (data.tipo === "chat") {
      const texto = String(data.texto ?? "").slice(0, 80).trim();
      if (texto) {
        this.room.broadcast(JSON.stringify({
          tipo: "chat", id: sender.id, nome: j.nome, texto, t: Date.now()
        }));
      }
    }
  }

  onClose(conn: Party.Connection) {
    this.jogadores.delete(conn.id);
    // Avisa todo mundo que o jogador saiu
    this.room.broadcast(JSON.stringify({
      tipo: "saiu",
      id: conn.id,
    }));
  }

  onError(_conn: Party.Connection, _err: Error) {
    // PartyKit já loga; nada a fazer aqui.
  }

  async onAlarm() {
    // Tick: limpa fantasmas (idle > 30s) e faz broadcast do estado
    const agora = Date.now();
    const TIMEOUT = 30_000;
    for (const [id, j] of this.jogadores) {
      if (agora - j.ultimoInput > TIMEOUT) {
        this.jogadores.delete(id);
      }
    }

    if (this.jogadores.size > 0) {
      this.room.broadcast(JSON.stringify({
        tipo: "estado",
        t: agora,
        jogadores: Array.from(this.jogadores.values()),
      }));
    }

    // Reagenda
    await this.room.storage.setAlarm(Date.now() + TICK_MS);
  }
}

FlorestaServer satisfies Party.Worker;
