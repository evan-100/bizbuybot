export const TOP_METROS = [
  ['Orlando, FL', '36740'], ['Tampa, FL', '45300'], ['Miami-Fort Lauderdale-West Palm Beach, FL', '33100'],
  ['Jacksonville, FL', '27260'], ['Atlanta, GA', '12060'], ['Austin, TX', '12420'],
  ['Dallas-Fort Worth, TX', '19100'], ['Houston, TX', '26420'], ['San Antonio, TX', '41700'],
  ['New York-Newark-Jersey City, NY-NJ', '35620'], ['Los Angeles, CA', '31080'],
  ['Chicago, IL', '16980'], ['Phoenix, AZ', '38060'], ['Philadelphia, PA', '37980'],
  ['Boston, MA', '14460'], ['San Francisco, CA', '41860'], ['Seattle, WA', '42644'],
  ['Denver, CO', '19740'], ['Las Vegas, NV', '29820'], ['Portland, OR', '38900'],
  ['Charlotte, NC', '16740'], ['Nashville, TN', '34980'], ['Columbus, OH', '18140'],
  ['Indianapolis, IN', '26900'], ['Salt Lake City, UT', '41620'], ['Minneapolis-St Paul, MN', '33460'],
  ['Detroit-Warren-Dearborn, MI', '19804'], ['St. Louis, MO', '41180'], ['Baltimore, MD', '12580'],
  ['San Diego, CA', '41740'], ['Riverside, CA', '40140'], ['Sacramento, CA', '40900'],
].map(([name, code]) => ({ name, code }));

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// Splits "Portland, TX" -> { city: 'Portland', state: 'tx' }; inputs without a
// trailing ", ST" suffix carry state: null and keep legacy matching behavior.
export function parseMetroInput(input) {
  const raw = String(input || '');
  const m = raw.match(/^(.*),\s*([A-Za-z]{2})\s*$/);
  return m ? { city: m[1], state: m[2].toLowerCase() } : { city: raw, state: null };
}

// State segment of a metro name ("Portland, OR" / "... City, NY-NJ") as a list.
function nameStates(name) {
  return String(name).split(',').pop().trim().toLowerCase().split('-').map((s) => s.trim()).filter(Boolean);
}

export function resolveMetroStatic(input) {
  const n = norm(input);
  if (!n) return null;
  const { city, state } = parseMetroInput(input);
  const inState = (name) => !state || nameStates(name).includes(state);
  const cityNeedle = String(city).trim().toLowerCase();
  return TOP_METROS.find(({ name }) => inState(name) && norm(name).startsWith(n.slice(0, Math.max(6, n.length - 2)))) ||
         TOP_METROS.find(({ name }) => inState(name) && name.toLowerCase().includes(cityNeedle)) || null;
}

// Stage-2 resolution over dataset names (Map of code -> "…, ST Metro Area").
export function resolveMetroFromNames(names, input) {
  const { city, state } = parseMetroInput(input);
  const needle = String(city).trim().toLowerCase();
  if (!needle) return null;
  for (const [code, name] of names) {
    const bare = String(name || '').replace(/ Metro Area$/i, '');
    if (state && !nameStates(bare).includes(state)) continue;
    if (bare.toLowerCase().includes(needle)) return { name: bare, code };
  }
  return null;
}

export function scanMetroNames(rows) {
  const map = new Map();
  for (const r of rows) if (/ Metro Area$/.test(r.msaName || '')) map.set(String(r.msa), r.msaName);
  return map;
}
