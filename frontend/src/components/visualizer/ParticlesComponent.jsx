import React from 'react'

export default function ParticlesComponent({ particles, cellSize, gridOffsetX, gridOffsetY, particleTexture }) {
  if (!particles || !particleTexture) return null

  return (
    <>
      {particles.map((p, i) => (
        <sprite
          key={i}
          texture={particleTexture}
          x={gridOffsetX + p.x * cellSize}
          y={gridOffsetY + p.y * cellSize}
          width={cellSize * 0.3}
          height={cellSize * 0.3}
          anchor={0.5}
          alpha={p.alpha}
        />
      ))}
    </>
  )
}
