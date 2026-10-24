import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

/** Where intakes were recorded. Urgent open cases are drawn in red. */
export default function CaseMap({ records, t }) {
  const withGps = records.filter(r => r.gps)
  return (
    <MapContainer center={[15.38, 75.14]} zoom={9} scrollWheelZoom={false} className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {withGps.map(r => {
        const urgentOpen = r.issue.urgency === 'high' && r.status !== 'resolved'
        return (
          <CircleMarker
            key={r.id}
            center={[r.gps.lat, r.gps.lng]}
            radius={urgentOpen ? 7 : 5}
            pathOptions={{
              color: urgentOpen ? '#B3261E' : '#24306B',
              fillColor: urgentOpen ? '#B3261E' : r.status === 'resolved' ? '#9AA3BF' : '#24306B',
              fillOpacity: 0.75,
              weight: 1,
            }}
          >
            <Tooltip>
              <strong>{r.beneficiary.name}</strong>, {r.village}<br />
              {t(r.issue.category)} · {r.status.replace('_', ' ')}
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
