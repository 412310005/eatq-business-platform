'use client'

/** OSM 列表卡片 UI 版本（標題旁應看到此字串） */
export const OSM_CARD_UI_REV = 'v15-lead-btn'

export type OsmPlaceCardProps = {
  displayName: string
  categoryLabel: string
  address: string
  distanceLabel: string
  icon: string
  osmId: string
  adding?: boolean
  onOpenDiagnosis: () => void
  onAddLead: () => void
}

export function OsmPlaceCard({
  displayName,
  categoryLabel,
  address,
  distanceLabel,
  icon,
  osmId,
  adding = false,
  onOpenDiagnosis,
  onAddLead,
}: OsmPlaceCardProps) {
  return (
    <div
      data-osm-place-id={osmId}
      data-osm-card-ui={OSM_CARD_UI_REV}
      style={{
        width: '100%',
        marginBottom: 8,
        border: '2px solid #97C459',
        borderRadius: 8,
        background: 'white',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenDiagnosis}
        onKeyDown={e => { if (e.key === 'Enter') onOpenDiagnosis() }}
        style={{
          display: 'flex',
          alignItems: 'start',
          gap: 8,
          padding: '8px 9px 6px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 18, marginTop: 2 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#2C2C2A' }}>{displayName}</div>
            <span style={{ fontSize: 9, color: '#185FA5', flexShrink: 0, marginLeft: 4, fontWeight: 600 }}>
              {distanceLabel}
            </span>
          </div>
          <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>{categoryLabel}</div>
          <div style={{ fontSize: 9, color: '#888' }}>📍{address || '—'}</div>
        </div>
      </div>

      <div
        style={{
          padding: '8px',
          background: '#F8F5EF',
          borderTop: '1px solid #E8E5DE',
        }}
      >
        <button
          type="button"
          data-testid="osm-add-lead-btn"
          disabled={adding}
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            onAddLead()
          }}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px 12px',
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.35,
            border: 'none',
            borderRadius: 6,
            background: adding ? '#97C459' : '#3B6D11',
            color: '#FFFFFF',
            cursor: adding ? 'wait' : 'pointer',
            boxShadow: '0 2px 6px rgba(59,109,17,.4)',
          }}
        >
          {adding ? '加入中…' : '🎯 加入欲開發'}
        </button>
      </div>
    </div>
  )
}
