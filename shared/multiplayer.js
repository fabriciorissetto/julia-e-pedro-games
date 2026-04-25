// Multiplayer turn-based para jogos do jpgames.
// Backend: /api/room/[id] (Vercel Function + Upstash Redis).
// Modelo: estado compartilhado JSON, polling a cada N ms, last-write-wins.
//
// Uso típico num jogo:
//
//   <script src="/shared/multiplayer.js"></script>
//   <script>
//     const sala = JPMultiplayer.join('JOGO123', {
//       initialState: { jogadores: [], turno: 0 },
//       onUpdate: (state) => renderizar(state),
//       pollMs: 1000
//     })
//
//     // pra alterar o estado:
//     sala.setState({ ...sala.lastState, turno: sala.lastState.turno + 1 })
//
//     // pra sair:
//     sala.leave()
//   </script>
//
// Helpers extras: JPMultiplayer.generateCode() devolve um código de 4 letras
// fácil de ditar (sem caracteres ambíguos tipo 0/O, 1/I/L).

;(function (global) {
  const BASE = '/api/room'
  const SAFE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0 1 I L O

  function generateCode(len = 4) {
    let out = ''
    for (let i = 0; i < len; i++) {
      out += SAFE_LETTERS[Math.floor(Math.random() * SAFE_LETTERS.length)]
    }
    return out
  }

  function normalizeId(id) {
    if (typeof id !== 'string') throw new Error('roomId precisa ser string')
    const norm = id.trim().toUpperCase()
    if (!/^[A-Z0-9]{3,32}$/.test(norm)) {
      throw new Error('roomId inválido (3–32 caracteres A–Z, 0–9)')
    }
    return norm
  }

  async function fetchState(id) {
    const r = await fetch(`${BASE}/${id}`, { cache: 'no-store' })
    if (!r.ok) throw new Error(`GET sala falhou: ${r.status}`)
    return r.json()
  }

  async function postState(id, state) {
    const r = await fetch(`${BASE}/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state })
    })
    if (!r.ok) throw new Error(`POST sala falhou: ${r.status}`)
    return r.json()
  }

  async function deleteRoom(id) {
    const r = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(`DELETE sala falhou: ${r.status}`)
    return r.json()
  }

  function join(roomId, options = {}) {
    const id = normalizeId(roomId)
    const {
      initialState = null,
      onUpdate = null,
      onError = null,
      pollMs = 1000
    } = options

    const handle = {
      roomId: id,
      lastState: null,
      lastVersion: -1,
      _alive: true,
      _timer: null
    }

    function emitError(err) {
      if (onError) onError(err)
      else console.warn('[JPMultiplayer]', err)
    }

    async function tick() {
      if (!handle._alive) return
      try {
        const data = await fetchState(id)
        if (data.state === null && initialState !== null) {
          // Sala ainda não existe — semeia com o estado inicial.
          const seeded = await postState(id, initialState)
          handle.lastState = seeded.state
          handle.lastVersion = seeded.version
          if (onUpdate) onUpdate(seeded.state, seeded)
        } else if (data.version !== handle.lastVersion) {
          handle.lastState = data.state
          handle.lastVersion = data.version
          if (onUpdate && data.state !== null) onUpdate(data.state, data)
        }
      } catch (err) {
        emitError(err)
      } finally {
        if (handle._alive) handle._timer = setTimeout(tick, pollMs)
      }
    }

    handle.setState = async function (state) {
      const data = await postState(id, state)
      handle.lastState = data.state
      handle.lastVersion = data.version
      if (onUpdate) onUpdate(data.state, data)
      return data
    }

    handle.refresh = tick

    handle.leave = function () {
      handle._alive = false
      if (handle._timer) clearTimeout(handle._timer)
    }

    handle.destroy = async function () {
      handle.leave()
      try { await deleteRoom(id) } catch (err) { emitError(err) }
    }

    tick()
    return handle
  }

  global.JPMultiplayer = { join, generateCode }
})(window)
