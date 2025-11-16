import React from 'react'

export default function HUDComponent({ hudSprites, players, screenWidth, screenHeight }) {
  if (!hudSprites.maskRed || !hudSprites.maskBlue) return null

  const HUD_HEIGHT = 70
  const hudWidth = 200
  const hudHeight = HUD_HEIGHT
  const scale = hudWidth / 529

  return (
    <>
      {players.map((player, idx) => {
        const isPlayer = idx === 0
        const hudX = isPlayer ? 0 : (screenWidth - hudWidth)
        const hudY = 0

        const maskSprite = isPlayer ? hudSprites.maskRed : hudSprites.maskBlue
        const nameX = hudX + (isPlayer ? 70 : hudWidth - 70)
        const scoreX = hudX + (isPlayer ? 110 : hudWidth - 110)
        const avatarX = hudX + (isPlayer ? hudWidth - 45 : 45)
        const avatarY = hudY + 35

        return (
          <React.Fragment key={idx}>
            <sprite texture={maskSprite} x={hudX} y={hudY} width={hudWidth} height={hudHeight} />
            <text text={player.name} x={nameX} y={hudY + 10} anchor={0.5}
              style={{ fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold', fill: 0xffffff }} />
            <text text={String(player.score)} x={scoreX} y={hudY + 25} anchor={0.5}
              style={{ fontFamily: 'Arial', fontSize: 20, fontWeight: 'bold', fill: 0xffffff }} />
            <graphics draw={g => {
              g.clear()
              g.beginFill(isPlayer ? 0xb61e23 : 0x4444ff)
              g.drawCircle(0, 0, 18)
              g.endFill()
            }} x={avatarX} y={avatarY} />
            <text text={player.initials} x={avatarX} y={avatarY} anchor={0.5}
              style={{ fontFamily: 'Arial', fontSize: 28, fontWeight: 'bold', fill: 0xffffff }} />
          </React.Fragment>
        )
      })}
    </>
  )
}
