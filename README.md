# Dimension Atlas

[![License: PolyForm Noncommercial](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-orange.svg)](LICENSE.md)
[![Platform: Linux](https://img.shields.io/badge/platform-Linux-green.svg)](#build-it)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-blue.svg)](https://tauri.app)

**By [In2infinity](https://in2infinity.com) · Powered by [Dragonfire](https://dragonfire1.com)**

Every shape is dots in space. Count the corners and the patterns appear.

![Dimension Atlas: the corners chart with the tesseract in the player](docs/screenshot.png)

Dimension Atlas is a chart of the regular shapes, from a single dot up to dimension 600, with a 3D player that turns each one in front of you. It runs offline as a desktop app (Tauri) or as a single HTML file in any browser.

## The patterns

| Line | Corners, dimension by dimension | Rule |
|---|---|---|
| Tetrahedron line (simplex) | 1, 2, 3, 4, 5, 6 … | counts: +1 |
| Octahedron line (cross-polytope) | 2, 4, 6, 8, 10 … | even numbers: +2 |
| Cube line (hypercube) | 1, 2, 4, 8, 16, 32 … | doubles: ×2 |
| Icosahedron, dodecahedron | 5 → 12 → 120, 5 → 20 → 600 | stop at 4D |
| 24-cell | 24 | 4D only |
| Polygons | 3, 4, 5, … any number of sides | 2D only |

Every other shape falls in between these three lines. Turn on **Archimedean** to add the 13 Archimedean solids; six of them grow into every dimension. The **Learn** pages go further: the nested tetrahedron, octahedron and cube, and the same numbers showing up in electron shells and crystals.

## Using it

- **By corners**: corners across, dimension up. Click a square to see what lives there; the side panel lists every shape with that many corners.
- **By dimension**: the table of lines, 0D to 8D, then one column for any dimension you type in.
- **Player**: Solid / Shadow, Bubble (stereographic) and Flat (Petrie polygon) views. ⤢ opens full screen, where the arrow keys step through the shapes in a dimension (← →) and between dimensions (↑ ↓).

## Big shapes and small computers

On start-up the app checks the computer (memory and cores, read by Rust in the desktop app) and the graphics card, and picks a detail level:

| Detail | Most corners built | Edges drawn |
|---|---|---|
| Light (under 2.5 GB free, 2 cores, or software graphics) | 6,000 | 20,000 |
| Standard (under 6 GB free or 4 cores) | 20,000 | 40,000 |
| Full | 50,000 | 60,000 |

A shape beyond that, such as the 8D omnitruncated cube with 10,321,920 corners, is never built. Instead the player shows a still stand-in: a circle of dots filled with criss-crossing edges, which is what the flat view of a shape that big actually looks like. If the graphics card resets, the player pauses and rebuilds when it comes back.

![The stand-in for a 10-million-corner shape](docs/stand-in.png)

## Download

Get the AppImage (any Linux) or the .deb (Debian, Ubuntu and friends) from the [Releases](../../releases) page.

```
chmod +x DimensionAtlas-1.6.0-x86_64.AppImage
./DimensionAtlas-1.6.0-x86_64.AppImage
```

## Build it

You need Node 20+ (the tests' jsdom needs it) and, for the desktop app, Rust and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

```
npm install
npm run build        # dist/index.html: one self-contained file, open it in any browser
npm test             # geometry, projection and UI checks
npm run app          # desktop app: AppImage and .deb in src-tauri/target/release/bundle/
```

Nothing is fetched at run time: three.js is bundled in and all fonts are system fonts.

## Files

```
src/geometry.js     exact corner coordinates and edges for every shape (no DOM)
src/catalog.js      what exists where, exact counts (BigInt), names and text
src/projection.js   N-D rotation, stereographic projection, Petrie layout
src/viewer.js       the three.js player
src/budget.js       the computer scan and detail levels
src/vgrid.js        the corners chart
src/main.js         dimension table, shape card, full screen, wiring
src/learn.js        the Learn pages
src/entry.js        the loading sequence
src-tauri/          the desktop wrapper; src/lib.rs holds the system scan
test/               geometry (counts, equal edges, Euler), projection, jsdom UI walk
```

## Adding a shape

Add its builder to `geometry.js` (corners on the unit sphere plus edges), its counts to `fVector` and its place to `cellsForColumn` in `catalog.js`. The tests check edge lengths, degrees and Euler's formula.

## Licence

Free for non-commercial use: learning, teaching, schools, research, hobbies and charities. Dimension Atlas is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). For commercial use, get in touch through [in2infinity.com](https://in2infinity.com).

Third-party parts keep their own licences; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Required Notice: Copyright 2026 In2infinity (https://in2infinity.com)
