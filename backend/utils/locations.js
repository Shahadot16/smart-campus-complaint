const { Location } = require('../models');
const ApiError = require('./ApiError');

/**
 * Builds a complaint's location from the request. When `place` (a location id
 * from the campus tree or a scanned QR code) is given, the building and room
 * names come from the tree; otherwise the typed building/room are used.
 */
async function resolvePlace({ place, building, room }) {
  if (!place) return { building: String(building || '').trim(), room: String(room || '').trim(), place: null, department: '' };

  const loc = await Location.findOne({ _id: place, isActive: true }).populate('building', 'name department').populate('parent', 'name type');
  if (!loc) throw ApiError.badRequest('The selected location no longer exists');
  const department = loc.department || loc.building?.department || '';

  if (loc.type === 'building') return { building: loc.name, room: String(room || '').trim(), place: loc._id, department };
  const floor = loc.type === 'room' && loc.parent?.type === 'floor' ? `${loc.parent.name}, ` : '';
  return { building: loc.building?.name || '', room: `${floor}${loc.name}`.slice(0, 40), place: loc._id, department };
}

/** Nests a flat location list into building -> floor -> room. */
function buildTree(locations) {
  const byId = new Map(locations.map((l) => [String(l._id), { ...l, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    const parent = node.parent && byId.get(String(node.parent));
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list) => {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    list.forEach((n) => sort(n.children));
    return list;
  };
  return sort(roots);
}

module.exports = { resolvePlace, buildTree };
