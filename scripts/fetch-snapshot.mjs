/**
 * Fetches live MoEP Envista readings + data.gov.il regional forecast,
 * writes public/data/latest.json for GitHub Pages (Envista is CORS-locked).
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'public', 'data', 'latest.json')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const CKAN_FORECAST_RESOURCE = 'a976089d-e8e5-4013-8f3d-777b8551c684'
const CKAN_STATIONS_RESOURCE = '782cfb94-ebbd-4f41-aba2-80c298457a58'

async function getGuestJwt() {
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
  if (apiToken.startsWith('"')) apiToken = JSON.parse(apiToken)

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
  const setCookie = genRes.headers.getSetCookie?.() ?? []
  const cookieHeader = genRes.headers.get('set-cookie') ?? ''
  const all = [...setCookie, cookieHeader].join('\n')
  const m = /X-Access-Token=([^;]+)/.exec(all)
  if (!m) throw new Error('No X-Access-Token cookie from GenerateToken')
  return { jwt: m[1], verification }
}

function envistaHeaders(jwt, verification) {
  return {
    accept: 'application/json',
    origin: 'https://air.sviva.gov.il',
    referer: 'https://air.sviva.gov.il/',
    domainname: 'sviva',
    'envi-data-source': 'MANA',
    authorization: `JwtToken ${jwt}`,
    cookie: `X-Access-Token=${jwt}`,
    'x-requestverificationtoken': verification,
    'user-agent': UA,
  }
}

async function ckanSearch(resourceId, limit = 1000) {
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CKAN ${resourceId} ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(`CKAN ${resourceId} unsuccessful`)
  return json.result.records ?? []
}

async function main() {
  console.log('Authenticating with MoEP Envista…')
  const { jwt, verification } = await getGuestJwt()
  const headers = envistaHeaders(jwt, verification)

  console.log('Fetching regions…')
  const regionsRes = await fetch('https://air-papi.sviva.gov.il/v1/envista/regions', {
    headers,
  })
  if (!regionsRes.ok) throw new Error(`regions ${regionsRes.status}`)
  const regions = await regionsRes.json()

  console.log('Fetching stations/index/latest…')
  const indexRes = await fetch(
    'https://air-papi.sviva.gov.il/v1/envista/stations/index/latest?hoursBack=24',
    { headers },
  )
  if (!indexRes.ok) throw new Error(`index ${indexRes.status}`)
  const indexPayload = await indexRes.json()
  const indexData = Array.isArray(indexPayload?.data) ? indexPayload.data : []

  const regionIds = [
    ...new Set(
      (regions ?? [])
        .map((r) => r.regionId)
        .filter((id) => typeof id === 'number' && id > 0),
    ),
  ]
  console.log(`Fetching latest channel data for regions: ${regionIds.join(',')}`)
  const latestUrl =
    'https://air-papi.sviva.gov.il/v1/envista/regions/data/latest?unitConversion=true&regionsIds=' +
    regionIds.join(',') +
    '&hoursBack=6'
  const latestRes = await fetch(latestUrl, { headers })
  let latestReadings = []
  if (latestRes.ok) {
    latestReadings = await latestRes.json()
    if (!Array.isArray(latestReadings)) latestReadings = []
  } else {
    console.warn('regions/data/latest failed', latestRes.status)
  }

  console.log('Fetching data.gov.il forecast + station catalog…')
  const [forecastRecords, stationCatalog] = await Promise.all([
    ckanSearch(CKAN_FORECAST_RESOURCE, 50),
    ckanSearch(CKAN_STATIONS_RESOURCE, 500),
  ])

  const stations = []
  for (const region of regions ?? []) {
    for (const s of region.stations ?? []) {
      stations.push({
        stationId: s.stationId,
        name: s.name,
        shortName: s.shortName,
        active: !!s.active,
        owner: s.owner ?? null,
        regionId: region.regionId,
        regionName: region.name,
        latitude: s.location?.latitude ?? null,
        longitude: s.location?.longitude ?? null,
        monitors: (s.monitors ?? [])
          .filter((m) => m.active)
          .map((m) => ({
            channelId: m.channelId,
            name: m.name,
            alias: m.alias,
            units: m.units,
            pollutantId: m.pollutantId,
            isIndex: !!m.isIndex,
          })),
      })
    }
  }

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    sources: {
      envista: {
        regions: 'https://air-papi.sviva.gov.il/v1/envista/regions',
        indexLatest:
          'https://air-papi.sviva.gov.il/v1/envista/stations/index/latest',
        regionsLatest:
          'https://air-papi.sviva.gov.il/v1/envista/regions/data/latest',
        portal: 'https://air.sviva.gov.il/',
      },
      dataGovIl: {
        forecastResourceId: CKAN_FORECAST_RESOURCE,
        stationsResourceId: CKAN_STATIONS_RESOURCE,
        datastoreSearch: 'https://data.gov.il/api/3/action/datastore_search',
        packages: ['cf-output', 'air-stations'],
      },
    },
    stations,
    index: indexData,
    readings: latestReadings,
    forecast: forecastRecords,
    stationCatalog,
  }

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(snapshot), 'utf8')
  console.log(
    `Wrote ${outPath} — stations=${stations.length} index=${indexData.length} readings=${latestReadings.length} forecast=${forecastRecords.length}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
