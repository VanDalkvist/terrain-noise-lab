import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import './App.css'
import {
  DEFAULT_CONTROLS,
  PRESET_DEFINITIONS,
  TERRAIN_LEGEND,
  generateMap,
  type GeneratedMap,
  type GeneratorControls,
  type MapCell,
} from './lib/mapGenerator'

type NumericControlKey = Exclude<keyof GeneratorControls, 'seed'>

const CONTROL_GROUPS: Array<{
  title: string
  description: string
  controls: Array<{
    key: NumericControlKey
    label: string
    min: number
    max: number
    step: number
    format?: (value: number) => string
  }>
}> = [
  {
    title: 'World shape',
    description: 'Landmass size and how aggressively the edges sink into the ocean.',
    controls: [
      { key: 'width', label: 'Width', min: 96, max: 320, step: 4 },
      { key: 'height', label: 'Height', min: 96, max: 220, step: 4 },
      { key: 'scale', label: 'Noise scale', min: 1.5, max: 6, step: 0.1 },
      {
        key: 'islandFalloff',
        label: 'Island falloff',
        min: 0.3,
        max: 1.4,
        step: 0.02,
      },
    ],
  },
  {
    title: 'Terrain detail',
    description: 'Controls inspired by the Red Blob Games noise stack: octaves, persistence, and redistribution.',
    controls: [
      { key: 'octaves', label: 'Octaves', min: 2, max: 7, step: 1 },
      {
        key: 'persistence',
        label: 'Persistence',
        min: 0.35,
        max: 0.75,
        step: 0.01,
      },
      {
        key: 'lacunarity',
        label: 'Lacunarity',
        min: 1.6,
        max: 2.8,
        step: 0.02,
      },
      {
        key: 'redistribution',
        label: 'Elevation power',
        min: 0.8,
        max: 2.3,
        step: 0.02,
      },
    ],
  },
  {
    title: 'Biomes',
    description: 'Thresholds for sea, coast, mountains, and snow. These are the levers that actually matter visually.',
    controls: [
      { key: 'waterLevel', label: 'Water level', min: 0.22, max: 0.55, step: 0.01 },
      { key: 'beachBand', label: 'Beach band', min: 0.01, max: 0.08, step: 0.005 },
      {
        key: 'mountainLevel',
        label: 'Mountain level',
        min: 0.52,
        max: 0.82,
        step: 0.01,
      },
      { key: 'snowLevel', label: 'Snow line', min: 0.65, max: 0.94, step: 0.01 },
    ],
  },
]

function App() {
  const [controls, setControls] = useState(DEFAULT_CONTROLS)
  const deferredControls = useDeferredValue(controls)
  const map = useMemo(() => generateMap(deferredControls), [deferredControls])
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number } | null>(null)
  const [isPending, startTransition] = useTransition()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const projection = useMemo(() => createIsometricProjection(map), [map])
  const hoveredCell: MapCell | null = hoveredPoint
    ? map.cells[hoveredPoint.y * map.width + hoveredPoint.x] ?? null
    : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    canvas.width = projection.width
    canvas.height = projection.height

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    renderIsometricMap(context, map, projection)
  }, [map, projection])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) {
      return
    }

    overlay.width = projection.width
    overlay.height = projection.height

    const context = overlay.getContext('2d')
    if (!context) {
      return
    }

    context.clearRect(0, 0, projection.width, projection.height)

    if (!hoveredCell) {
      return
    }

    const point = projectCell(hoveredCell.x, hoveredCell.y, projection)
    context.strokeStyle = hoveredCell.terrain === 'snow' ? '#17324d' : '#ffffff'
    context.lineWidth = Math.max(2, projection.tileWidth * 0.18)
    context.beginPath()
    traceDiamond(context, point.x, point.y, projection)
    context.stroke()
  }, [hoveredCell, projection])

  const isRendering = deferredControls !== controls || isPending

  function updateNumericControl(key: NumericControlKey, nextValue: number) {
    setControls((current) => ({
      ...current,
      [key]: nextValue,
    }))
  }

  function applyPreset(presetId: string) {
    const preset = PRESET_DEFINITIONS.find((entry) => entry.id === presetId)

    if (!preset) {
      return
    }

    startTransition(() => {
      setControls((current) => ({
        ...current,
        ...preset.controls,
      }))
    })
  }

  function randomizeSeed() {
    startTransition(() => {
      setControls((current) => ({
        ...current,
        seed: buildSeed(),
      }))
    })
  }

  function resetControls() {
    startTransition(() => {
      setControls(DEFAULT_CONTROLS)
    })
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const canvasX = ((event.clientX - rect.left) / rect.width) * projection.width
    const canvasY = ((event.clientY - rect.top) / rect.height) * projection.height
    const point = unprojectPoint(canvasX, canvasY, projection, map)

    setHoveredPoint(point)
  }

  function exportPng() {
    downloadMap(map, projection)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">Procedural terrain sandbox</p>
          <h1>Terrain Noise Lab</h1>
          <p className="lede">
            A small map generator built around the same core ideas from Red Blob Games:
            layered noise, elevation redistribution, moisture, climate, and island
            falloff, now shown as an isometric tile field.
          </p>
        </div>
        <div className="header-meta">
          <p>
            This is deliberately presentation-first. Isometry reads better as a world
            mockup, even if it is worse than top-down for exact area judgment.
          </p>
          <a
            href="https://www.redblobgames.com/maps/terrain-from-noise/"
            target="_blank"
            rel="noreferrer"
          >
            Read the reference article
          </a>
        </div>
      </header>

      <main className="workspace">
        <aside className="controls-panel">
          <section className="panel-section panel-section--seed">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Seed</p>
                <h2>Regenerate fast</h2>
              </div>
              <span className={`status-pill${isRendering ? ' is-live' : ''}`}>
                {isRendering ? 'Rendering' : 'Stable'}
              </span>
            </div>
            <label className="seed-input">
              <span>Seed string</span>
              <input
                value={controls.seed}
                onChange={(event) =>
                  setControls((current) => ({
                    ...current,
                    seed: event.currentTarget.value,
                  }))
                }
                placeholder="Enter any string"
              />
            </label>
            <div className="button-row">
              <button type="button" onClick={randomizeSeed}>
                Random seed
              </button>
              <button type="button" className="button-secondary" onClick={resetControls}>
                Reset defaults
              </button>
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Presets</p>
                <h2>Useful starting points</h2>
              </div>
            </div>
            <div className="preset-grid">
              {PRESET_DEFINITIONS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="preset-button"
                  onClick={() => applyPreset(preset.id)}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>
          </section>

          {CONTROL_GROUPS.map((group) => (
            <section key={group.title} className="panel-section">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Controls</p>
                  <h2>{group.title}</h2>
                </div>
              </div>
              <p className="section-description">{group.description}</p>
              <div className="control-stack">
                {group.controls.map((control) => {
                  const value = controls[control.key]
                  const displayValue =
                    control.format?.(value) ??
                    (control.step >= 1 ? value.toFixed(0) : value.toFixed(2))

                  return (
                    <label key={control.key} className="control">
                      <div className="control-header">
                        <span>{control.label}</span>
                        <strong>{displayValue}</strong>
                      </div>
                      <input
                        type="range"
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        value={value}
                        onChange={(event) =>
                          updateNumericControl(control.key, Number(event.currentTarget.value))
                        }
                      />
                    </label>
                  )
                })}
              </div>
            </section>
          ))}
        </aside>

        <section className="map-panel">
          <div className="map-toolbar">
            <div>
              <p className="section-kicker">Current world</p>
              <h2>
                {map.width} x {map.height} isometric tiles
              </h2>
            </div>
            <div className="button-row">
              <button type="button" onClick={exportPng}>
                Export PNG
              </button>
            </div>
          </div>

          <div
            className="map-stage"
            style={{ aspectRatio: `${projection.width} / ${projection.height}` }}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoveredPoint(null)}
          >
            <canvas ref={canvasRef} className="map-canvas" aria-label="Generated terrain map" />
            <canvas ref={overlayRef} className="map-overlay" aria-hidden="true" />
          </div>

          <div className="inspector-grid">
            <section className="inspector-card">
              <p className="section-kicker">Hover inspector</p>
              <h2>{hoveredCell ? TERRAIN_LEGEND.find((item) => item.id === hoveredCell.terrain)?.label : 'Move over the map'}</h2>
              <p className="section-description">
                {hoveredCell
                  ? `Cell ${hoveredCell.x}, ${hoveredCell.y}`
                  : 'You need this because otherwise tuning thresholds is blind guesswork.'}
              </p>
              <dl className="metric-list">
                <div>
                  <dt>Elevation</dt>
                  <dd>{hoveredCell ? hoveredCell.elevation.toFixed(3) : '—'}</dd>
                </div>
                <div>
                  <dt>Moisture</dt>
                  <dd>{hoveredCell ? hoveredCell.moisture.toFixed(3) : '—'}</dd>
                </div>
                <div>
                  <dt>Temperature</dt>
                  <dd>{hoveredCell ? hoveredCell.temperature.toFixed(3) : '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="inspector-card">
              <p className="section-kicker">Biome mix</p>
              <h2>Coverage snapshot</h2>
              <div className="coverage-list">
                {map.coverage.map((entry) => (
                  <div key={entry.id} className="coverage-item">
                    <div className="coverage-label">
                      <span className="coverage-swatch" style={{ background: entry.color }} />
                      <span>{entry.label}</span>
                    </div>
                    <strong>{Math.round(entry.ratio * 100)}%</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="legend-panel">
            <p className="section-kicker">Biome legend</p>
            <div className="legend-grid">
              {TERRAIN_LEGEND.map((terrain) => (
                <article key={terrain.id} className="legend-item">
                  <span className="legend-swatch" style={{ background: terrain.color }} />
                  <div>
                    <h3>{terrain.label}</h3>
                    <p>{terrain.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}

function downloadMap(map: GeneratedMap, baseProjection: IsometricProjection) {
  const exportScale = 2
  const projection = scaleProjection(baseProjection, exportScale)
  const canvas = document.createElement('canvas')
  canvas.width = projection.width
  canvas.height = projection.height

  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  renderIsometricMap(context, map, projection)

  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = `terrain-noise-lab-${Date.now()}.png`
  link.click()
}

function buildSeed(): string {
  return `${pick(SEED_TOKENS)}-${pick(SEED_TOKENS)}-${Math.floor(Math.random() * 1000)}`
}

function pick(values: string[]): string {
  return values[Math.floor(Math.random() * values.length)]
}

interface IsometricProjection {
  tileWidth: number
  tileHeight: number
  halfWidth: number
  halfHeight: number
  width: number
  height: number
  originX: number
  originY: number
}

function createIsometricProjection(map: GeneratedMap): IsometricProjection {
  const diagonal = map.width + map.height
  const tileWidth = clampEven(Math.floor((1680 * 2) / diagonal), 4, 12)
  const tileHeight = Math.max(2, Math.round(tileWidth / 2))
  const halfWidth = tileWidth / 2
  const halfHeight = tileHeight / 2
  const paddingX = tileWidth * 3
  const paddingY = tileHeight * 3

  return {
    tileWidth,
    tileHeight,
    halfWidth,
    halfHeight,
    width: Math.ceil(diagonal * halfWidth + paddingX * 2),
    height: Math.ceil(diagonal * halfHeight + paddingY * 2),
    originX: Math.ceil(map.height * halfWidth + paddingX),
    originY: paddingY,
  }
}

function scaleProjection(projection: IsometricProjection, scale: number): IsometricProjection {
  return {
    tileWidth: projection.tileWidth * scale,
    tileHeight: projection.tileHeight * scale,
    halfWidth: projection.halfWidth * scale,
    halfHeight: projection.halfHeight * scale,
    width: projection.width * scale,
    height: projection.height * scale,
    originX: projection.originX * scale,
    originY: projection.originY * scale,
  }
}

function renderIsometricMap(
  context: CanvasRenderingContext2D,
  map: GeneratedMap,
  projection: IsometricProjection,
) {
  context.clearRect(0, 0, projection.width, projection.height)
  context.fillStyle = '#f1eee6'
  context.fillRect(0, 0, projection.width, projection.height)

  for (let diagonal = 0; diagonal < map.width + map.height - 1; diagonal += 1) {
    const startX = Math.max(0, diagonal - (map.height - 1))
    const endX = Math.min(map.width - 1, diagonal)

    for (let x = startX; x <= endX; x += 1) {
      const y = diagonal - x
      const cell = map.cells[y * map.width + x]
      const point = projectCell(x, y, projection)

      context.fillStyle = cell.color
      context.strokeStyle = shadeColor(cell.color, -18)
      context.lineWidth = Math.max(0.7, projection.tileWidth * 0.08)
      context.beginPath()
      traceDiamond(context, point.x, point.y, projection)
      context.fill()
      context.stroke()
    }
  }
}

function projectCell(x: number, y: number, projection: IsometricProjection) {
  return {
    x: projection.originX + (x - y) * projection.halfWidth,
    y: projection.originY + (x + y) * projection.halfHeight,
  }
}

function unprojectPoint(
  canvasX: number,
  canvasY: number,
  projection: IsometricProjection,
  map: GeneratedMap,
): { x: number; y: number } | null {
  const dx = (canvasX - projection.originX) / projection.halfWidth
  const dy = (canvasY - projection.originY) / projection.halfHeight
  const x = Math.floor((dx + dy) / 2)
  const y = Math.floor((dy - dx) / 2)

  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return null
  }

  return { x, y }
}

function traceDiamond(
  context: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  projection: IsometricProjection,
) {
  context.moveTo(screenX, screenY)
  context.lineTo(screenX + projection.halfWidth, screenY + projection.halfHeight)
  context.lineTo(screenX, screenY + projection.tileHeight)
  context.lineTo(screenX - projection.halfWidth, screenY + projection.halfHeight)
  context.closePath()
}

function shadeColor(hex: string, amount: number): string {
  const normalized = hex.replace('#', '')
  const parts = [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]

  return `rgb(${parts
    .map((part) => Math.max(0, Math.min(255, part + amount)))
    .join(', ')})`
}

function clampEven(value: number, min: number, max: number): number {
  const clamped = Math.max(min, Math.min(max, value))
  return clamped % 2 === 0 ? clamped : clamped - 1
}

const SEED_TOKENS = [
  'amber',
  'atlas',
  'basalt',
  'delta',
  'ember',
  'fjord',
  'granite',
  'lagoon',
  'mistral',
  'terra',
]

export default App
