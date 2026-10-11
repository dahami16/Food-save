/**
 * Hard-coded Australian location dataset for the Find Restaurants
 * screen (/restaurants).
 *
 * Mock data only — no API, no geolocation service, no backend.
 * The first entries match the Figma reference
 * (design-reference/05-find-restaurants.png).
 *
 * Search behaviour (see filterLocations):
 *   - empty query -> ALL locations (the 21st.dev ScrollArea on the
 *                    page owns vertical scrolling for the list)
 *   - typed query -> case-insensitive partial match on name + region,
 *                    with ALL matches shown (scrollable)
 */
export const locations = [
  // ---- Western Australia ----
  { id: 1, name: 'HayStreet, Perth', region: 'Western Australia' },
  { id: 2, name: 'St Georges Terrace, Perth', region: 'Western Australia' },
  { id: 3, name: 'Murray Street, Perth', region: 'Western Australia' },
  { id: 4, name: 'Kings Square, Perth', region: 'Western Australia' },
  { id: 5, name: 'Elizabeth Quay, Perth', region: 'Western Australia' },
  { id: 6, name: 'Northbridge, Perth', region: 'Western Australia' },
  { id: 7, name: 'Fremantle, Western Australia', region: 'Western Australia' },
  { id: 8, name: 'Scarborough, Western Australia', region: 'Western Australia' },
  { id: 9, name: 'Subiaco, Western Australia', region: 'Western Australia' },
  // ---- New South Wales ----
  { id: 10, name: 'George Street, Sydney', region: 'New South Wales' },
  { id: 11, name: 'Circular Quay, Sydney', region: 'New South Wales' },
  { id: 12, name: 'Darling Harbour, Sydney', region: 'New South Wales' },
  { id: 13, name: 'Parramatta, New South Wales', region: 'New South Wales' },
  { id: 14, name: 'Bondi Junction, New South Wales', region: 'New South Wales' },
  { id: 15, name: 'Chatswood, New South Wales', region: 'New South Wales' },
  { id: 16, name: 'Newcastle, New South Wales', region: 'New South Wales' },
  // ---- Victoria ----
  { id: 17, name: 'Collins Street, Melbourne', region: 'Victoria' },
  { id: 18, name: 'Flinders Street, Melbourne', region: 'Victoria' },
  { id: 19, name: 'Federation Square, Melbourne', region: 'Victoria' },
  { id: 20, name: 'Southbank, Melbourne', region: 'Victoria' },
  { id: 21, name: 'St Kilda, Victoria', region: 'Victoria' },
  { id: 22, name: 'Richmond, Victoria', region: 'Victoria' },
  { id: 23, name: 'Geelong, Victoria', region: 'Victoria' },
  // ---- Queensland ----
  { id: 24, name: 'Queen Street, Brisbane', region: 'Queensland' },
  { id: 25, name: 'South Bank, Brisbane', region: 'Queensland' },
  { id: 26, name: 'Fortitude Valley, Brisbane', region: 'Queensland' },
  { id: 27, name: 'Gold Coast, Queensland', region: 'Queensland' },
  { id: 28, name: 'Surfers Paradise, Queensland', region: 'Queensland' },
  { id: 29, name: 'Cairns, Queensland', region: 'Queensland' },
  { id: 30, name: 'Townsville, Queensland', region: 'Queensland' },
  // ---- South Australia ----
  { id: 31, name: 'Rundle Mall, Adelaide', region: 'South Australia' },
  { id: 32, name: 'North Terrace, Adelaide', region: 'South Australia' },
  { id: 33, name: 'Glenelg, South Australia', region: 'South Australia' },
  // ---- Australian Capital Territory ----
  { id: 34, name: 'Civic, Canberra', region: 'Australian Capital Territory' },
  { id: 35, name: 'Braddon, Canberra', region: 'Australian Capital Territory' },
  // ---- Tasmania ----
  { id: 36, name: 'Hobart CBD, Tasmania', region: 'Tasmania' },
  { id: 37, name: 'Launceston, Tasmania', region: 'Tasmania' },
  // ---- Northern Territory ----
  { id: 38, name: 'Darwin City, Northern Territory', region: 'Northern Territory' },
  { id: 39, name: 'Alice Springs, Northern Territory', region: 'Northern Territory' },
]

/** Lowercase + strip everything except a-z / 0-9 for loose matching. */
function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Frontend-only search over the mock locations.
 *
 * Case-insensitive and partial-match capable across BOTH
 * location.name and location.region — e.g. "perth", "sydney",
 * "victoria", "darling", "brisbane" all work, as does
 * "HayStreet, Perth" thanks to the punctuation-normalised compare.
 *
 * Empty query -> ALL locations. No slices/caps anywhere: the
 * 21st.dev ScrollArea on the Find Restaurants page owns vertical
 * scrolling, so long lists stay fully accessible.
 */
export function filterLocations(query) {
  const normalizedQuery = normalize(query)

  if (!normalizedQuery) {
    return locations
  }

  return locations.filter((location) => {
    const haystack = normalize(`${location.name} ${location.region}`)
    return haystack.includes(normalizedQuery)
  })
}
