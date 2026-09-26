import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { randomUUID } from 'node:crypto'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type TokenState = { jwt: string; verification: string; exp: number }

async function obtainToken(): Promise<TokenState> {
  const verification = randomUUID()
  const apiTokRes = await fetch('https://air.sviva.gov.il/Account/GetApiToken', {
    method: 'POST',
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'content-type': 'application/json; charset=UTF-8',
      origin: 'https://air.sviva.gov.il',
      referer: 'https://air.sviva.gov.il/',
      'user-agent': UA,
    },
    body: JSON.stringify({ userName: 'Guest' }),
  })
  if (!apiTokRes.ok) throw new Error(`GetApiToken ${apiTokRes.status}`)
  let apiToken = (await apiTokRes.text()).trim()
  if (apiToken.startsWith('"')) apiToken = JSON.parse(apiToken) as string

  const genRes = await fetch('https://air-papi.sviva.gov.il/v1/GenerateToken', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      origin: 'https://air.sviva.gov.il',
      referer: 'https://air.sviva.gov.il/',
      domainname: 'sviva',
      'envi-data-source': 'MANA',
      authorization: `ApiToken ${apiToken}`,
      'x-requestverificationtoken': verification,
      'user-agent': UA,
    },
    body: '{}',
  })
  if (!genRes.ok) throw new Error(`GenerateToken ${genRes.status}`)
  const setCookie = typeof genRes.headers.getSetCookie === 'function'
    ? genRes.headers.getSetCookie()
    : []
  const cookieHeader = genRes.headers.get('set-cookie') ?? ''
  const all = [...setCookie, cookieHeader].join('\n')
  const m = /X-Access-Token=([^;]+)/.exec(all)
  if (!m) throw new Error('No X-Access-Token')
  // JWT ~1h; refresh early
  return { jwt: m[1], verification, exp: Date.now() + 50 * 60 * 1000 }
}

function moepDevProxy(): Plugin {
  let token: TokenState | null = null
  let inflight: Promise<TokenState> | null = null

  async function ensureToken() {
    if (token && token.exp > Date.now()) return token
    if (!inflight) {
      inflight = obtainToken()
        .then((t) => {
          token = t
          return t
        })
        .finally(() => {
          inflight = null
        })
    }
    return inflight
  }

  return {
    name: 'moep-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/moep/')) return next()
        try {
          const t = await ensureToken()
          const path = req.url.replace(/^\/api\/moep/, '')
          const target = `https://air-papi.sviva.gov.il${path}`
          const headers: Record<string, string> = {
            accept: 'application/json',
            origin: 'https://air.sviva.gov.il',
            referer: 'https://air.sviva.gov.il/',
            domainname: 'sviva',
            'envi-data-source': 'MANA',
            authorization: `JwtToken ${t.jwt}`,
            cookie: `X-Access-Token=${t.jwt}`,
            'x-requestverificationtoken': t.verification,
            'user-agent': UA,
          }
          let body: Buffer | undefined
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(Buffer.from(chunk))
            body = Buffer.concat(chunks)
            headers['content-type'] = req.headers['content-type'] ?? 'application/json'
          }
          const upstream = await fetch(target, {
            method: req.method,
            headers,
            body,
          })
          const buf = Buffer.from(await upstream.arrayBuffer())
          res.statusCode = upstream.status
          res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
          res.setHeader('cache-control', 'no-store')
          res.end(buf)
        } catch (err) {
          res.statusCode = 502
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    },
  }
}

export default defineConfig({
  base: '/israeli-air-quality/',
  plugins: [react(), tailwindcss(), moepDevProxy()],
  server: {
    host: true,
    port: 5175,
    strictPort: true,
  },
})
