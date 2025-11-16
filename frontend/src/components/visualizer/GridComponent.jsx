import React from 'react'

export default function GridComponent({ grid, cellSize, gridOffsetX, gridOffsetY, tileTextures }) {
  if (!grid || !tileTextures) return null

  return (
    <>
      {grid.map((row, y) => row.map((cell, x) => {
        if (cell !== '#') return null
        const mask = calculateTileMask(grid, x, y)
        const texture = tileTextures[mask]
        if (!texture) return null
        return (
          <sprite
            key={`${x}-${y}`}
            texture={texture}
            x={gridOffsetX + x * cellSize}
            y={gridOffsetY + y * cellSize}
            width={cellSize}
            height={cellSize}
          />
        )
      }))}
    </>
  )
}

function calculateTileMask(grid, x, y) {
  const H = grid[y - 1]?.[x] === '#' ? 2 : 0
  const D = grid[y]?.[x + 1] === '#' ? 16 : 0
  const B = grid[y + 1]?.[x] === '#' ? 64 : 0
  const G = grid[y]?.[x - 1] === '#' ? 8 : 0
  
  let mask = H + D + B + G
  
  if ((mask & 10) === 10 && grid[y - 1]?.[x - 1] !== '#') mask += 1
  if ((mask & 18) === 18 && grid[y - 1]?.[x + 1] !== '#') mask += 4
  if ((mask & 72) === 72 && grid[y + 1]?.[x - 1] !== '#') mask += 32
  if ((mask & 80) === 80 && grid[y + 1]?.[x + 1] !== '#') mask += 128
  
  return mask
}
