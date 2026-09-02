// One-time: fetch Natural Earth 110m countries, slim to {iso, name, centroid} + rounded geometry, and write
// public/companies/world.geo.json (served publicly like the other company artifacts). Powers the footprint map.
//   node scripts/build-worldmap.mjs
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "companies")
const SRC = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
const r1 = (n) => Math.round(n * 10) / 10   // 1-decimal degrees (~11km) — sub-pixel at world scale

const round = (coords) => coords.map(c => Array.isArray(c[0]) ? round(c) : [r1(c[0]), r1(c[1])])

// centroid = bbox center of the largest ring (avoids skew from far-flung territories)
function centroid(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates
  let best = null, bestLen = -1
  for (const poly of polys) { const ring = poly[0]; if (ring.length > bestLen) { bestLen = ring.length; best = ring } }
  if (!best) return null
  let minX = 180, maxX = -180, minY = 90, maxY = -90
  for (const [x, y] of best) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
  return [r1((minX + maxX) / 2), r1((minY + maxY) / 2)]
}

const j = await (await fetch(SRC, { headers: { "User-Agent": "Veritax build" } })).json()
const features = j.features.map(f => {
  const iso = f.properties.ISO_A2_EH && f.properties.ISO_A2_EH !== "-99" ? f.properties.ISO_A2_EH : f.properties.ISO_A2
  return { type: "Feature", properties: { iso, name: f.properties.NAME, c: centroid(f.geometry) }, geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } }
})
const out = { type: "FeatureCollection", features }
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, "world.geo.json"), JSON.stringify(out))
console.log(`world.geo.json: ${features.length} countries, ${(JSON.stringify(out).length / 1024).toFixed(0)}KB`)
