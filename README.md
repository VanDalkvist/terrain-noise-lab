# Terrain Noise Lab

Small web app for procedural terrain generation inspired by Red Blob Games:

- layered fractal noise for elevation
- separate moisture and temperature fields
- biome classification from elevation + moisture
- island falloff shaping
- isometric tile renderer with hover inspection
- PNG export

## Stack

- React 19
- TypeScript
- Vite

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL and adjust the seed, world-shape controls, terrain detail, and biome thresholds.

## Build

```bash
npm run lint
npm run build
```

## Reference

The generator logic is based on the ideas from Red Blob Games’s article:

- https://www.redblobgames.com/maps/terrain-from-noise/

The isometric presentation was added separately on top of that terrain model.
