import React from 'react'

export default function PelletsComponent({ pellets, cellSize, gridOffsetX, gridOffsetY, extraSprites }) {
  if (!pellets || !extraSprites.bonusx1 || !extraSprites.bonusx5) return null

  return (
    <>
      {pellets.map((p, i) => {
        const texture = p.value === 10 ? extraSprites.bonusx5 : extraSprites.bonusx1
        const scale = p.value === 10 ? 0.6 : 0.3
        const size = cellSize * scale
        return (
          <sprite
            key={i}
            texture={texture}
            x={gridOffsetX + p.x * cellSize + cellSize / 2}
            y={gridOffsetY + p.y * cellSize + cellSize / 2}
            width={size}
            height={size}
            anchor={0.5}
          />
        )
      })}
    </>
  )
}
