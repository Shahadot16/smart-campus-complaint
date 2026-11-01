import { Building2, DoorOpen } from 'lucide-react'
import useApi from '../hooks/useApi'
import { locationApi } from '../services/api'
import { Field } from './ui'

const OTHER = '__other__'

/**
 * Building -> room picker driven by the campus location tree, with a
 * "not listed" fallback for typing a place by hand.
 * value: { place, buildingId, building, room }  (place = chosen room or building id)
 */
export default function LocationPicker({ value, onChange, errors = {} }) {
  const { data } = useApi(() => locationApi.tree(), [])
  const buildings = data?.tree || []
  const building = buildings.find((b) => b._id === value.buildingId)
  const floors = building?.children || []
  const roomId = value.place && value.place !== value.buildingId ? value.place : ''
  const typingBuilding = value.buildingId === OTHER
  const typingRoom = value.roomMode === OTHER

  function pickBuilding(id) {
    if (id === OTHER) return onChange({ buildingId: OTHER, place: '', building: '', room: '' })
    const b = buildings.find((x) => x._id === id)
    onChange({ buildingId: id, place: id || '', building: b?.name || '', room: '' })
  }

  function pickRoom(id) {
    if (id === OTHER) return onChange({ ...value, place: value.buildingId, roomMode: OTHER, room: '' })
    onChange({ ...value, place: id || value.buildingId, roomMode: '', room: '' })
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Building" htmlFor="loc-building" error={errors.building || errors.place} required>
        <div className="relative">
          <Building2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <select id="loc-building" className="input pl-9" value={value.buildingId || ''} onChange={(e) => pickBuilding(e.target.value)}>
            <option value="">Select a building</option>
            {buildings.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
            <option value={OTHER}>Other / not listed…</option>
          </select>
        </div>
        {typingBuilding && (
          <input
            className="input mt-2"
            placeholder="Type the building or area name"
            value={value.building}
            maxLength={80}
            onChange={(e) => onChange({ ...value, building: e.target.value })}
            aria-label="Building name"
          />
        )}
      </Field>

      <Field label="Room / area" htmlFor="loc-room" error={errors.room}>
        {typingBuilding || (building && !floors.length) ? (
          <input
            id="loc-room"
            className="input"
            placeholder="e.g. 204 or 2nd floor washroom"
            value={value.room}
            maxLength={40}
            onChange={(e) => onChange({ ...value, room: e.target.value })}
          />
        ) : (
          <>
            <div className="relative">
              <DoorOpen className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <select
                id="loc-room"
                className="input pl-9"
                value={typingRoom ? OTHER : roomId}
                onChange={(e) => pickRoom(e.target.value)}
                disabled={!building}
              >
                <option value="">{building ? 'Whole building / not specific' : 'Choose a building first'}</option>
                {floors.map((f) =>
                  f.children.length ? (
                    <optgroup key={f._id} label={f.name}>
                      {f.children.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={f._id} value={f._id}>
                      {f.name}
                    </option>
                  )
                )}
                {building && <option value={OTHER}>Not listed — type it…</option>}
              </select>
            </div>
            {typingRoom && (
              <input
                className="input mt-2"
                placeholder="Type the room or area"
                value={value.room}
                maxLength={40}
                onChange={(e) => onChange({ ...value, room: e.target.value })}
                aria-label="Room name"
              />
            )}
          </>
        )}
      </Field>
    </div>
  )
}
