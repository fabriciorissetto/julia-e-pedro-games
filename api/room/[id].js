import { Redis } from '@upstash/redis'

// Suporta as duas convenções de nome (KV_* da integração antiga "Vercel KV"
// e UPSTASH_* da integração atual "Upstash Redis" no Marketplace).
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
})

// Salas expiram em 24h se ninguém escrever — evita lixo eterno no Redis.
const TTL_SECONDS = 60 * 60 * 24

const ID_REGEX = /^[A-Z0-9]{3,32}$/

export default async function handler(req, res) {
  const rawId = req.query?.id
  const id = typeof rawId === 'string' ? rawId.toUpperCase() : ''
  if (!ID_REGEX.test(id)) {
    return res.status(400).json({ error: 'id da sala inválido (3–32 caracteres A–Z, 0–9)' })
  }

  const key = `room:${id}`

  try {
    if (req.method === 'GET') {
      const data = await redis.get(key)
      if (!data) {
        return res.status(200).json({ state: null, version: 0, updatedAt: null })
      }
      return res.status(200).json(data)
    }

    if (req.method === 'POST') {
      const body = req.body ?? {}
      if (!('state' in body)) {
        return res.status(400).json({ error: 'campo "state" é obrigatório' })
      }
      const current = await redis.get(key)
      const version = (current?.version ?? 0) + 1
      const payload = { state: body.state, version, updatedAt: Date.now() }
      await redis.set(key, payload, { ex: TTL_SECONDS })
      return res.status(200).json(payload)
    }

    if (req.method === 'DELETE') {
      await redis.del(key)
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).end()
  } catch (err) {
    console.error('room handler erro:', err)
    return res.status(500).json({ error: 'erro interno', detail: String(err?.message ?? err) })
  }
}
