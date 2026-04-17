export type TerrainId =
  | 'deep-water'
  | 'water'
  | 'beach'
  | 'grassland'
  | 'forest'
  | 'rainforest'
  | 'desert'
  | 'highlands'
  | 'mountain'
  | 'snow'

export interface GeneratorControls {
  seed: string
  width: number
  height: number
  scale: number
  octaves: number
  persistence: number
  lacunarity: number
  redistribution: number
  islandFalloff: number
  waterLevel: number
  beachBand: number
  mountainLevel: number
  snowLevel: number
}

export interface MapCell {
  x: number
  y: number
  elevation: number
  moisture: number
  temperature: number
  terrain: TerrainId
  color: string
}

export interface TerrainDefinition {
  id: TerrainId
  label: string
  color: string
  description: string
}

export interface GeneratedMap {
  width: number
  height: number
  cells: MapCell[]
  coverage: Array<{
    id: TerrainId
    label: string
    color: string
    ratio: number
  }>
}

export const DEFAULT_CONTROLS: GeneratorControls = {
  seed: 'red-blob-starter',
  width: 220,
  height: 140,
  scale: 3.3,
  octaves: 5,
  persistence: 0.52,
  lacunarity: 2.08,
  redistribution: 1.42,
  islandFalloff: 0.9,
  waterLevel: 0.38,
  beachBand: 0.035,
  mountainLevel: 0.7,
  snowLevel: 0.84,
}

export const PRESET_DEFINITIONS: Array<{
  id: string
  label: string
  description: string
  controls: Partial<GeneratorControls>
}> = [
  {
    id: 'archipelago',
    label: 'Archipelago',
    description: 'More water, stronger falloff, smaller landmasses.',
    controls: {
      scale: 4.5,
      waterLevel: 0.44,
      redistribution: 1.58,
      islandFalloff: 1.1,
      mountainLevel: 0.74,
      snowLevel: 0.88,
    },
  },
  {
    id: 'continent',
    label: 'Continent',
    description: 'Larger coherent land areas with softer coasts.',
    controls: {
      scale: 2.5,
      waterLevel: 0.33,
      redistribution: 1.28,
      islandFalloff: 0.58,
      persistence: 0.56,
      mountainLevel: 0.68,
    },
  },
  {
    id: 'highlands',
    label: 'Highlands',
    description: 'Less water and more dramatic elevation contrast.',
    controls: {
      scale: 3.8,
      waterLevel: 0.29,
      redistribution: 1.85,
      islandFalloff: 0.72,
      persistence: 0.58,
      mountainLevel: 0.62,
      snowLevel: 0.76,
    },
  },
]

const TERRAIN_DEFINITIONS: TerrainDefinition[] = [
  {
    id: 'deep-water',
    label: 'Deep water',
    color: '#12345a',
    description: 'Oceans and trenches anchoring the outer edge.',
  },
  {
    id: 'water',
    label: 'Shallow water',
    color: '#2d6a9f',
    description: 'Continental shelves and inland seas.',
  },
  {
    id: 'beach',
    label: 'Beach',
    color: '#dac087',
    description: 'Thin coast band between sea and land.',
  },
  {
    id: 'grassland',
    label: 'Grassland',
    color: '#86ad56',
    description: 'Open plains and mild steppe areas.',
  },
  {
    id: 'forest',
    label: 'Forest',
    color: '#447043',
    description: 'Temperate woodland with medium moisture.',
  },
  {
    id: 'rainforest',
    label: 'Rainforest',
    color: '#235a39',
    description: 'Warm and wet lowlands.',
  },
  {
    id: 'desert',
    label: 'Desert',
    color: '#c58d57',
    description: 'Dry hot regions with low moisture.',
  },
  {
    id: 'highlands',
    label: 'Highlands',
    color: '#8f8266',
    description: 'Transitional rocky uplands.',
  },
  {
    id: 'mountain',
    label: 'Mountain',
    color: '#6a6769',
    description: 'High elevation ridges and peaks.',
  },
  {
    id: 'snow',
    label: 'Snow',
    color: '#f2f4f7',
    description: 'Cold summits and polar caps.',
  },
]

const terrainById = Object.fromEntries(
  TERRAIN_DEFINITIONS.map((terrain) => [terrain.id, terrain]),
) as Record<TerrainId, TerrainDefinition>

export const TERRAIN_LEGEND = TERRAIN_DEFINITIONS

export function generateMap(controls: GeneratorControls): GeneratedMap {
  const width = Math.max(48, Math.round(controls.width))
  const height = Math.max(48, Math.round(controls.height))
  const seed = stringToSeed(controls.seed)
  const cells = new Array<MapCell>(width * height)
  const coverageCounts = Object.fromEntries(
    TERRAIN_DEFINITIONS.map((terrain) => [terrain.id, 0]),
  ) as Record<TerrainId, number>

  let index = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / width - 0.5
      const ny = y / height - 0.5
      const edgeDistance = Math.hypot(nx * 1.08, ny * 1.18) / 0.74
      const edgeFalloff =
        Math.pow(clamp(edgeDistance, 0, 1), 1.6 + controls.islandFalloff * 1.4) *
        controls.islandFalloff

      const elevationBase = fractalNoise(nx, ny, controls, seed)
      const ridgeNoise = fractalNoise(
        nx + 7.1,
        ny - 3.4,
        {
          ...controls,
          scale: controls.scale * 1.8,
          octaves: Math.max(2, controls.octaves - 1),
          persistence: Math.min(0.72, controls.persistence + 0.05),
        },
        seed + 97,
      )

      let elevation =
        elevationBase * 0.86 +
        Math.pow(ridgeNoise, 1.35) * 0.22 -
        edgeFalloff +
        (1 - clamp(edgeDistance, 0, 1)) * 0.1
      elevation = clamp(Math.pow(clamp(elevation, 0, 1), controls.redistribution), 0, 1)

      const moistureNoise = fractalNoise(
        nx - 11.3,
        ny + 5.9,
        {
          ...controls,
          scale: controls.scale * 1.1,
          persistence: Math.min(0.8, controls.persistence + 0.08),
        },
        seed + 211,
      )
      const moisture = clamp(
        moistureNoise * 0.76 +
          (1 - elevation) * 0.18 +
          (1 - clamp(edgeDistance, 0, 1)) * 0.05,
        0,
        1,
      )

      const latitude = Math.abs((y / Math.max(1, height - 1)) * 2 - 1)
      const temperatureNoise = valueNoise(nx * 4.2 + 19.7, ny * 4.2 - 8.5, seed + 809)
      const temperature = clamp(
        1 - latitude * 0.78 - elevation * 0.58 + (temperatureNoise - 0.5) * 0.24,
        0,
        1,
      )

      const terrain = classifyTerrain(elevation, moisture, temperature, controls)
      const color = terrainById[terrain].color

      cells[index] = {
        x,
        y,
        elevation,
        moisture,
        temperature,
        terrain,
        color,
      }
      coverageCounts[terrain] += 1
      index += 1
    }
  }

  const totalCells = width * height
  const coverage = TERRAIN_DEFINITIONS.filter((terrain) => coverageCounts[terrain.id] > 0).map(
    (terrain) => ({
      id: terrain.id,
      label: terrain.label,
      color: terrain.color,
      ratio: coverageCounts[terrain.id] / totalCells,
    }),
  )

  return { width, height, cells, coverage }
}

function classifyTerrain(
  elevation: number,
  moisture: number,
  temperature: number,
  controls: GeneratorControls,
): TerrainId {
  const beachLevel = controls.waterLevel + controls.beachBand

  if (elevation < controls.waterLevel * 0.72) {
    return 'deep-water'
  }
  if (elevation < controls.waterLevel) {
    return 'water'
  }
  if (elevation < beachLevel) {
    return 'beach'
  }
  if (elevation > controls.snowLevel || (temperature < 0.24 && elevation > controls.mountainLevel)) {
    return 'snow'
  }
  if (elevation > controls.mountainLevel) {
    return 'mountain'
  }
  if (elevation > controls.mountainLevel - 0.08) {
    return 'highlands'
  }
  if (temperature > 0.62 && moisture < 0.22) {
    return 'desert'
  }
  if (moisture < 0.3) {
    return 'grassland'
  }
  if (moisture < 0.64 || temperature < 0.4) {
    return 'forest'
  }
  return 'rainforest'
}

function fractalNoise(
  x: number,
  y: number,
  controls: Pick<GeneratorControls, 'scale' | 'octaves' | 'persistence' | 'lacunarity'>,
  seed: number,
): number {
  let amplitude = 1
  let frequency = 1
  let total = 0
  let maxAmplitude = 0

  for (let octave = 0; octave < controls.octaves; octave += 1) {
    const octaveSeed = seed + octave * 134_775_813
    const offsetX = ((octaveSeed & 0xfff) / 0xfff) * 24 - 12
    const offsetY = (((octaveSeed >>> 12) & 0xfff) / 0xfff) * 24 - 12
    const sample = valueNoise(
      x * controls.scale * frequency + offsetX,
      y * controls.scale * frequency + offsetY,
      octaveSeed,
    )

    total += sample * amplitude
    maxAmplitude += amplitude
    amplitude *= controls.persistence
    frequency *= controls.lacunarity
  }

  return total / maxAmplitude
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = x0 + 1
  const y1 = y0 + 1
  const tx = x - x0
  const ty = y - y0
  const sx = smoothstep(tx)
  const sy = smoothstep(ty)

  const v00 = lattice(x0, y0, seed)
  const v10 = lattice(x1, y0, seed)
  const v01 = lattice(x0, y1, seed)
  const v11 = lattice(x1, y1, seed)

  return lerp(lerp(v00, v10, sx), lerp(v01, v11, sx), sy)
}

function lattice(x: number, y: number, seed: number): number {
  let hash = seed ^ Math.imul(x, 374_761_393) ^ Math.imul(y, 668_265_263)
  hash = (hash ^ (hash >>> 13)) >>> 0
  hash = Math.imul(hash, 1_274_126_177) >>> 0
  return ((hash ^ (hash >>> 16)) >>> 0) / 4_294_967_295
}

function stringToSeed(value: string): number {
  let hash = 2_166_136_261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }

  return hash >>> 0
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
