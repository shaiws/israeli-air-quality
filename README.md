# Israeli Air Quality Dashboard

Hebrew RTL dashboard for Israeli air-quality monitoring data from the Ministry of Environmental Protection and [data.gov.il](https://data.gov.il).

**Live site:** https://shaiws.github.io/israeli-air-quality/

Deployed from this repository to GitHub Pages.

## Features

- Latest air-quality index (AQI-style Israeli scale) by monitoring station
- Pollutant breakdown when published (PM2.5, PM10, NO2, O3, SO2, CO, and others)
- Regional forecast cards from the MoEP half-daily forecast dataset
- Station search / region filter, loading / empty / error states
- 48-hour pollutant charts in local development (via authenticated Vite middleware)
- Fully Hebrew RTL UI

## Data sources

### MoEP Envista API (air.sviva.gov.il / air-papi.sviva.gov.il)

Public guest-token API used by the official portal:

| Endpoint | Purpose |
|----------|---------|
| POST https://air.sviva.gov.il/Account/GetApiToken | Guest API token ({"userName":"Guest"}) |
| POST https://air-papi.sviva.gov.il/v1/GenerateToken | JWT in X-Access-Token cookie (Authorization: ApiToken ...) |
| GET /v1/envista/regions | Regions + stations + monitors |
| GET /v1/envista/stations/index/latest?hoursBack=24 | Latest index per station |
| GET /v1/envista/regions/data/latest?unitConversion=true&regionsIds=...&hoursBack=6 | Latest channel readings |
| GET /v1/envista/stations/{id}/Average/{channelId}?... | Hourly history (dev charts) |

Portal: https://air.sviva.gov.il/

### data.gov.il (CKAN datastore_search)

| Dataset | resource_id | Notes |
|---------|-------------|-------|
| Air quality monitoring stations (air-stations) | 782cfb94-ebbd-4f41-aba2-80c298457a58 | Station catalog (ITM coords, measured pollutants) |
| Half-daily pollutant forecast (cf-output) | a976089d-e8e5-4013-8f3d-777b8551c684 | Regional air-quality categories + day parts; updates a few times per day |

API: https://data.gov.il/api/3/action/datastore_search

Emission-inventory packages (pm2-5, pm-10, nitrogen_oxides, carbon-monoxide) on data.gov.il are not live ambient readings and were intentionally not wired.

## CORS

- data.gov.il — Access-Control-Allow-Origin: * (browser-safe on GitHub Pages).
- Envista (air-papi.sviva.gov.il) — CORS locked to https://air.sviva.gov.il.
  - Local / LAN: Vite middleware at /api/moep/* authenticates and proxies.
  - GitHub Pages: CI runs npm run fetch-snapshot (hourly cron + every push) and ships public/data/latest.json with the build.

## Run locally

Requirements: Node.js 20+, npm.

```bash
npm install
npm run fetch-snapshot
npm run dev
```

Dev server: http://localhost:5175 (binds 0.0.0.0), base path /israeli-air-quality/.

```bash
npm run build
npm run preview
```

## Deploy

Push to main runs .github/workflows/deploy-pages.yml (snapshot fetch, build, actions/deploy-pages). A scheduled hourly rebuild refreshes the MoEP snapshot on Pages.

Site base path: /israeli-air-quality/.

## Sample station

Kikar Safra / Jerusalem region — typically reports NO2, O3, CO, PM10. Station id comes from the Envista API (stationId, e.g. 36).