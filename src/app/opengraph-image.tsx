import { ImageResponse } from 'next/og'

export const alt = 'LensSpace — Software de gestión para ópticas'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: '#F0FBF9',
        color: '#07322F',
        display: 'flex',
        fontFamily: 'sans-serif',
        height: '100%',
        overflow: 'hidden',
        padding: '72px 82px',
        position: 'relative',
        width: '100%',
      }}
    >
      <div style={{ background: '#CFEFE9', borderRadius: 999, height: 520, position: 'absolute', right: -120, top: -180, width: 520 }} />
      <div style={{ border: '2px solid #B9DFD9', borderRadius: 999, height: 420, position: 'absolute', right: 35, top: 115, width: 420 }} />
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 820, position: 'relative' }}>
        <div style={{ alignItems: 'center', display: 'flex', gap: 18 }}>
          <div style={{ alignItems: 'center', background: '#07322F', borderRadius: 18, display: 'flex', height: 72, justifyContent: 'center', position: 'relative', width: 72 }}>
            <div style={{ border: '4px solid #35C2A8', borderRadius: 999, display: 'flex', height: 40, width: 40 }} />
            <div style={{ background: '#FF6B4A', borderRadius: 999, display: 'flex', height: 11, position: 'absolute', width: 11 }} />
          </div>
          <div style={{ display: 'flex', fontSize: 42, fontWeight: 800, letterSpacing: '-1.5px' }}>LensSpace</div>
        </div>
        <div style={{ display: 'flex', fontSize: 68, fontWeight: 800, letterSpacing: '-3px', lineHeight: 1.03, marginTop: 52 }}>
          De la receta a la entrega, todo en el mismo espacio.
        </div>
        <div style={{ color: '#486A65', display: 'flex', fontSize: 26, lineHeight: 1.4, marginTop: 30 }}>
          Clientes, ventas, cobros y producción claramente conectados.
        </div>
      </div>
    </div>,
    size,
  )
}
