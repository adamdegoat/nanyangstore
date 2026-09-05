// Nanyang Terrace customiser.
// Renders each COMPLETE model (his house_scene export) with real colours, grouped by
// PART (walls, roof, windows, floor, fence...) so each part is its own control.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// The selectable colours ARE the Bambu Lab Matte PLA series — every pick is a filament we stock.
// Names + hex from Bambu Lab's official Matte PLA hex-code table. Two of Bambu's table values are
// idealised (Ivory White as pure #fff, Charcoal as pure #000); the swatches below use the REAL
// measured filament colour so the picker shows what actually prints (off-white, dark grey).
export const PALETTE = [
  { name: 'Ivory White', hex: '#ebebe3' }, { name: 'Bone White', hex: '#cbc6b8' },
  { name: 'Desert Tan', hex: '#e8dbb7' }, { name: 'Latte Brown', hex: '#d3b7a7' },
  { name: 'Caramel', hex: '#ae835b' }, { name: 'Terracotta', hex: '#b15533' },
  { name: 'Dark Brown', hex: '#7d6556' }, { name: 'Dark Chocolate', hex: '#4d3324' },
  { name: 'Lemon Yellow', hex: '#f7d959' }, { name: 'Mandarin Orange', hex: '#f99963' },
  { name: 'Scarlet Red', hex: '#de4343' }, { name: 'Dark Red', hex: '#bb3d43' },
  { name: 'Sakura Pink', hex: '#e8afcf' }, { name: 'Plum', hex: '#950051' },
  { name: 'Lilac Purple', hex: '#ae96d4' }, { name: 'Ice Blue', hex: '#a3d8e1' },
  { name: 'Sky Blue', hex: '#56b7e6' }, { name: 'Marine Blue', hex: '#0078bf' },
  { name: 'Dark Blue', hex: '#042f56' }, { name: 'Apple Green', hex: '#c2e189' },
  { name: 'Grass Green', hex: '#61c680' }, { name: 'Dark Green', hex: '#68724d' },
  { name: 'Ash Gray', hex: '#9b9ea0' }, { name: 'Nardo Gray', hex: '#757575' },
  { name: 'Charcoal', hex: '#424344' },
];
// Every design colour mapped to the EXACT Bambu Matte filament he prints it in (from his no04/05/06
// production files). Explicit, not nearest-pixel: a dark green is numerically close to charcoal, so a
// blind snap would wrongly turn the Peranakan window frames grey. Keyed by the model's own hex (lowercase).
const BAMBU_MAP = {
  '#3a3835': '#424344', '#3d3b38': '#424344', '#232327': '#424344', '#1b1917': '#424344',   // all his darks -> Charcoal (his only dark filament)
  '#ffffff': '#ebebe3', '#fffffe': '#ebebe3', '#efece3': '#ebebe3', '#f4efe3': '#ebebe3',   // whites -> Ivory White
  '#9b9ea0': '#9b9ea0', '#a29e94': '#9b9ea0', '#a8a6a0': '#9b9ea0',                          // greys -> Ash Gray
  '#b15533': '#b15533',                                                                       // Terracotta (already exact)
  '#6b4a32': '#7d6556',                                                                       // brown -> Dark Brown
  '#de4343': '#de4343',                                                                       // Scarlet Red (already exact)
  '#f99963': '#f99963', '#f99964': '#f99963',                                                 // Mandarin Orange (already exact)
  '#68724d': '#68724d', '#4a5d43': '#68724d',                                                 // greens -> Dark Green (Peranakan frames!)
  '#e4bd68': '#e4bd68',                                                                       // bian'e lettering: printed in Bambu gold, kept as gold
};
// Map any part colour to the real filament he stocks: exact map first, nearest Matte as a safety net.
function snapToBambu(hex){
  const k = (hex || '').toLowerCase();
  if (BAMBU_MAP[k]) return BAMBU_MAP[k];
  const c = toRGB(hex); let best = hex, bd = Infinity;
  PALETTE.forEach(p => { const d = dist(c, toRGB(p.hex)); if (d < bd) { bd = d; best = p.hex; } });
  return best;
}
const PRICE = '$168';
// ORDER STEP — personalisation captured at "Review & send" (engraved by hand; not previewed live)
const ORDER_CAPS = { houseName: 22, madeFor: 24, nameBoard: 12 };
const NAMEBOARD_PRESETS = ['平安', '福', '吉祥', '富貴', '和', '囍'];   // popular blessing boards + "type your own"
// PLACEHOLDERS — replace with the real ones before go-live
const SEND = { whatsapp: '6583219747', paynow: '+65 8000 0000', biz: 'Nanyang Model Co.' };

const STYLES = [
  { key: 'colonial',  label: 'Colonial',  file: 'model04.json', enabled: true },
  { key: 'chinese',   label: 'Chinese',   file: 'model05.json', enabled: true },
  { key: 'peranakan', label: 'Peranakan', file: 'model06.json', enabled: true },
];

// classify each real part into a customer-facing PART by what it actually is
function isWhiteHex(hex){ return lum(hex) > 230; }
function partOf(name, stage, hex){
  const n = (name || '').toLowerCase();
  if (n.includes("bian'e") || n.includes('museum board') || n.includes('name board') || n.includes('museum plaque')) return null;   // handled by the plaques / shown as-is
  if (n.includes('poche') || n.includes('downpipe')) return null;        // always black, not editable
  if (n.includes('ceiling')) return 'Ceilings';   // no04/05 'ceiling*' AND no06 'roof uceiling *'
  // no06 groups all openings under 'Joinery' (windows, doors, upper floors mixed) — classify by name
  if (stage === 'Joinery') {
    if (n.includes('win') || n.includes('transom') || n.includes('vent')) return 'Windows';
    if (n.includes('ufloor')) return 'Floor';
    if (n.includes('door') || n.includes('pagar') || n.includes('arch') || n.includes('hatch')) return 'Doors';
    return 'Windows';
  }
  switch (stage) {
    case 'Base': case 'Base and forecourt': return 'Base';
    case 'Ground storey': case 'Upper storey': return 'Walls';
    case 'Floors': case 'Upper floors': return 'Floor';
    case 'Facade plates': return isWhiteHex(hex) ? 'Walls' : 'Trim';   // white planes = wall, dark = beams
    case 'Windows and doors': return 'Windows';
    case 'Arches and doors': return 'Doors';
    case 'Roof': case 'Roofs': return 'Roof';
    case 'Fence and gate': case 'Fence': return 'Fence';
    case 'Pipes': return 'Trim';
  }
  return 'Walls';
}
const PART_ORDER = ['Walls', 'Trim', 'Ceilings', 'Roof', 'Windows', 'Doors', 'Floor', 'Fence', 'Base'];
// plain names for each colour within a part
const SUBLABEL = {
  Walls:    { light:'Walls', other:'Walls' },
  Trim:     { dark:'Facade trim', other:'Facade trim' },
  Ceilings: { dark:'Ceilings', other:'Ceilings' },
  Roof:     { terra:'Roof tiles', dark:'Ridge', light:'Roof edge', other:'Roof' },
  Windows:  { light:'Window frames', dark:'Shutters', other:'Window frames' },
  Doors:    { dark:'Arches', brown:'Doors', other:'Doors' },
  Floor:    { light:'Floor tiles (light)', dark:'Floor tiles (dark)', brown:'Upper floor', other:'Back floor' },
  Fence:    { light:'Fence posts', dark:'Fence lattice', other:'Fence' },
  Base:     { light:'Forecourt tile', dark:'Forecourt tile', terra:'Forecourt tile', brown:'Forecourt tile', other:'Ground base' },
};
// which parts are OUTSIDE the house vs INSIDE, so the panel splits into two plain groups
const EXTERIOR_PARTS = ['Walls', 'Trim', 'Roof', 'Windows', 'Doors', 'Fence', 'Base'];
const INTERIOR_PARTS = ['Ceilings', 'Floor'];

// Section + group order for the explicit per-house maps
const SECTION_ORDER = ['Outside', 'Floors & ceilings', 'Plaques', 'Outside colours', 'Inside colours'];
const GROUP_ORDER = ['Walls', 'Facade accent', 'Roof', 'Windows', 'Doors & arches', 'Fence', 'Base',
  'Veranda & courtyard', 'Courtyard', 'Halls', 'Service floors', 'Upstairs rooms', 'Ceilings',
  'Name board', 'Museum plaque', 'Shop sign'];
// COLOUR PICKERS = his real print spools (one filament per role). Each picker sets EVERY part of that
// colour together, exactly how a spool covers the whole house, so any order maps 1:1 to the plates.
const ROLE_LABELS = {   // keyed by the part's default (snapped) colour = the spool
  '#ebebe3': 'Walls', '#cbc6b8': 'Walls',
  '#b15533': 'Roof & tiles',
  '#f99963': 'Orange details',
  '#de4343': 'Red details', '#bb3d43': 'Red details',
  '#68724d': 'Windows & lattice',
  '#7d6556': 'Timber & floors', '#4d3324': 'Timber & floors',
  '#424344': 'Shutters & trim',
  '#9b9ea0': 'Base', '#757575': 'Base',
  '#e4bd68': 'Name board (gold)',
};
const ROLE_ORDER = ['#ebebe3', '#cbc6b8', '#b15533', '#f99963', '#de4343', '#bb3d43',
  '#68724d', '#7d6556', '#4d3324', '#424344', '#9b9ea0', '#757575', '#e4bd68'];
// the SPOOL name each colour role prints as (matches the words in his plate filenames),
// so an order reads spool-by-spool and lines up with the plates when loading AMS slots
const ROLE_SPOOL = {
  '#ebebe3': 'IVORY', '#cbc6b8': 'IVORY', '#b15533': 'TERRACOTTA', '#f99963': 'MANDARIN',
  '#de4343': 'SCARLET', '#bb3d43': 'SCARLET', '#68724d': 'GREEN', '#7d6556': 'DARK BROWN',
  '#4d3324': 'DARK BROWN', '#424344': 'CHARCOAL', '#9b9ea0': 'ASH GRAY', '#757575': 'ASH GRAY',
  '#e4bd68': 'GOLD',
};
// print order: base first, then up to the accents and name board (how the plates run 1..N)
const SPOOL_PRINT_ORDER = ['ASH GRAY', 'IVORY', 'CHARCOAL', 'DARK BROWN', 'GREEN', 'TERRACOTTA', 'MANDARIN', 'SCARLET', 'GOLD'];
// name a spool by the most prominent real part it covers (per house, so it's never a wrong guess)
const LABEL_PRIORITY = ['Walls', 'Roof', 'Windows', 'Doors & arches', 'Facade accent', 'Fence', 'Base',
  'Veranda & courtyard', 'Courtyard', 'Halls', 'Service floors', 'Upstairs rooms', 'Ceilings', 'Museum plaque', 'Name board', 'Shop sign'];
// cluster the model's parts by their spool colour -> one picker per spool
function roleGroups(){
  const by = {}, order = [];
  zones.forEach(z => { const k = (z.hex || '').toLowerCase();
    if (!by[k]) { by[k] = { key: k, hex: z.hex, zones: [] }; order.push(by[k]); }
    by[k].zones.push(z); });
  order.forEach(g => { const gs = [...new Set(g.zones.map(z => z.group).filter(Boolean))];
    g.label = LABEL_PRIORITY.find(p => gs.includes(p)) || gs[0] || 'Colour'; });
  // two spools can land on the same part name (e.g. three facade accent colours) — make each distinct by its colour
  const seen = {}; order.forEach(g => seen[g.label] = (seen[g.label] || 0) + 1);
  order.forEach(g => { if (seen[g.label] > 1) g.label = g.label + ' (' + (paletteName(g.hex) || '') + ')'; });
  order.sort((a, b) => { const ia = ROLE_ORDER.indexOf(a.key), ib = ROLE_ORDER.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  return order;
}
// The ON-SCREEN pickers = one tab per PART GROUP (Walls, Facade accent, Roof, Doors, Fence, floors...),
// exactly how we grouped the model. A group with several slots (e.g. Windows -> frames + shutters) shows
// one swatch row per slot, so each part is independently colourable. (Orders/plates still group by spool.)
function controlGroups(){
  const by = {}, order = [];
  zones.forEach(z => { const k = z.group || 'Colour';
    if (!by[k]) { by[k] = { label: k, group: k, section: z.section, zones: [] }; order.push(by[k]); }
    by[k].zones.push(z); });
  order.sort((a, b) => { const ia = GROUP_ORDER.indexOf(a.group), ib = GROUP_ORDER.indexOf(b.group);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  return order;
}

// PERANAKAN (No.06) — explicit grouping locked with the maker. Each piece -> a named group + colour slot,
// exactly matching what he prints. Returns {locked:true} for forever-black pieces (no control).
function greenish(hex){ const c = toRGB(hex); return c[1] > c[0] + 8 && c[1] > c[2] + 8; }
function peranakanSlot(name, stage, hex){
  const n = (name || '').toLowerCase(), L = lum(hex), light = L > 200, dark = L < 90;
  if (n.includes('downpipe') || n.includes('poche') || n.includes('kvent')) return { locked: true };
  // facade plates: ivory follows the walls, terracotta is the facade accent
  if (stage === 'Facade plates') return light ? { section: 'Outside', group: 'Walls', slot: 'Colour' } : { section: 'Outside', group: 'Facade accent', slot: 'Colour' };
  if (n.includes('name board'))  return { section: 'Plaques', group: 'Name board',   slot: light ? 'Lettering' : 'Board' };   // ivory = raised lettering, dark = board base
  if (n.includes('museum'))      return { section: 'Plaques', group: 'Museum plaque', slot: light ? 'Lettering' : 'Plaque' };
  if (n.includes('sign board'))  return { section: 'Plaques', group: 'Shop sign',     slot: light ? 'Lettering' : 'Sign' };
  // the verandah STRIP at the door follows the halls (his call 2026-09-05) - it is the hall chequer now, not the open courtyard
  if (n.includes('floor porch'))
    return { section: 'Floors & ceilings', group: 'Halls', slot: light ? 'Base' : 'Pattern' };
  if (n.includes('forecourt') || n.includes('air-well'))
    return { section: 'Floors & ceilings', group: 'Courtyard', slot: light ? 'Base' : 'Pattern' };
  if (n.includes('floor hall') || n.includes('floor family'))
    return { section: 'Floors & ceilings', group: 'Halls', slot: light ? 'Base' : 'Pattern' };
  if (n.includes('floor kitchen') || n.includes('floor wc') || n.includes('ufloor bath'))
    return { section: 'Floors & ceilings', group: 'Service floors', slot: 'Colour' };
  if (n.includes('ufloor'))        return { section: 'Floors & ceilings', group: 'Upstairs rooms', slot: 'Colour' };
  if (n.includes('ceiling'))       return { section: 'Floors & ceilings', group: 'Ceilings', slot: 'Colour' };
  if (n.includes('roof sect'))     return { locked: true };   // dark roof section, prints with the poché — forever black
  if (n.startsWith('roof') && n.indexOf('roof', 4) !== -1 && !n.includes('upstand'))
    return { section: 'Outside', group: 'Roof', slot: 'Roof tiles' };
  if (n.includes('eave'))   // eave valance = facade decoration: ivory follows walls, coloured band follows the facade accent
    return light ? { section: 'Outside', group: 'Walls', slot: 'Colour' } : { section: 'Outside', group: 'Facade accent', slot: 'Colour' };
  if ((n.includes('win') || n.includes('transom')) && !n.includes('kvent'))
    return { section: 'Outside', group: 'Windows', slot: greenish(hex) ? 'Frames' : 'Shutters' };
  if (n.includes('idoor') || n.includes('kdoor') || n.includes('pintu') || n.includes('arch') || n.includes('hatch'))
    return { section: 'Outside', group: 'Doors & arches', slot: 'Colour' };
  if (n.includes('lattice'))       return { section: 'Outside', group: 'Fence', slot: 'Lattice' };
  if (n.includes('fence gate') || n.includes('finial')) return { section: 'Outside', group: 'Fence', slot: 'Gate & finial' };
  if (n.includes('facade') && !light) return { section: 'Outside', group: 'Facade accent', slot: 'Colour' };
  if (n === 'base' || n.startsWith('base ')) return { section: 'Outside', group: 'Base', slot: 'Colour' };
  return { section: 'Outside', group: 'Walls', slot: 'Colour' };   // everything ivory left: walls, posts, roof edge, facade base
}
// COLONIAL (No.04) & the classic-structure houses. Older piece naming (stages: Windows and doors,
// Arches and doors, Roof, Facade plates with bian'e/museum board, Fence and gate, Pipes).
function classicSlot(name, stage, hex){
  const n = (name || '').toLowerCase(), L = lum(hex), light = L > 200, dark = L < 90;
  if (n.includes('poche') || n.includes('downpipe') || stage === 'Pipes') return { locked: true };
  if (n.includes("bian'e"))       return { section: 'Plaques', group: 'Name board',   slot: L > 150 ? 'Lettering' : 'Board' };
  if (n.includes('museum board')) return { section: 'Plaques', group: 'Museum plaque', slot: L > 150 ? 'Lettering' : 'Plaque' };
  if (stage === 'Facade plates')  return light ? { section: 'Outside', group: 'Walls', slot: 'Colour' } : { section: 'Outside', group: 'Facade accent', slot: roleName(hex) };   // one slot per accent colour (Chinese has 3)
  if (n.includes('ceiling'))      return { section: 'Floors & ceilings', group: 'Ceilings', slot: 'Colour' };
  if (stage === 'Base') {
    if (n.includes('forecourt')) return { section: 'Floors & ceilings', group: 'Courtyard', slot: light ? 'Base' : 'Pattern' };
    return { section: 'Outside', group: 'Base', slot: 'Colour' };
  }
  if (stage === 'Floors') {
    // the verandah STRIP at the door is the chequer, hall-coloured - it follows the Halls, not the open courtyard (his call 2026-09-05)
    if (n.startsWith('porch')) return { section: 'Floors & ceilings', group: 'Halls', slot: light ? 'Base' : 'Pattern' };
    if (n.includes('air-well') || n.includes('forecourt')) return { section: 'Floors & ceilings', group: 'Courtyard', slot: light ? 'Base' : 'Pattern' };
    if (n.startsWith('hall') || n.includes('family hall')) return { section: 'Floors & ceilings', group: 'Halls', slot: light ? 'Base' : 'Pattern' };
    return { section: 'Floors & ceilings', group: 'Service floors', slot: 'Colour' };   // kitchen, wc
  }
  if (stage === 'Upper floors') return n.includes('bath') ? { section: 'Floors & ceilings', group: 'Service floors', slot: 'Colour' } : { section: 'Floors & ceilings', group: 'Upstairs rooms', slot: 'Colour' };
  if (stage === 'Roof') {
    if (light) return { section: 'Outside', group: 'Walls', slot: 'Colour' };   // firewall upstand / parapet (ivory) follow walls
    if (n.includes('roof') || n.includes('gallery link')) return { section: 'Outside', group: 'Roof', slot: 'Roof tiles' };
    return { locked: true };   // sect / fascia — dark roof structure, forever black
  }
  if (stage === 'Windows and doors') {
    // the main front door is "door wall unit 3" - match it exactly, NOT any "unit 3":
    // "upper storey unit 3" and "west flank unit 3" are WINDOWS and were wrongly
    // following the doors (his catch 2026-09-05).
    if (n.includes('kdoor') || n.includes('hatch') || n.includes('door wall unit 3')) return { section: 'Outside', group: 'Doors & arches', slot: 'Colour' };
    return { section: 'Outside', group: 'Windows', slot: dark ? 'Shutters' : 'Frames' };
  }
  if (stage === 'Arches and doors') return { section: 'Outside', group: 'Doors & arches', slot: 'Colour' };
  if (stage === 'Fence and gate') {
    if (n.includes('lattice') || (n.includes('pier plate') && !light)) return { section: 'Outside', group: 'Fence', slot: 'Lattice' };   // decorative pier panel = lattice colour
    if (n.includes('gate') || n.includes('finial')) return { section: 'Outside', group: 'Fence', slot: 'Gate & finial' };
    return { section: 'Outside', group: 'Walls', slot: 'Colour' };   // piers, screens, side walls follow walls
  }
  return { section: 'Outside', group: 'Walls', slot: 'Colour' };   // ground/upper storey shell
}
const HOUSE_MAP = { peranakan: peranakanSlot, colonial: classicSlot, chinese: classicSlot };
const PLAQUE_FONTS = [
  { font: 'Marcellus', label: 'Classic' },
  { font: 'Georgia', label: 'Traditional' },
  { font: 'Arial', label: 'Plain' },
];

const ROLE = [
  ['#ffffff', 'White'], ['#3a3835', 'Charcoal'], ['#b15533', 'Terracotta'],
  ['#9b9ea0', 'Grey'], ['#6b4a32', 'Brown'], ['#e4bd68', 'Gold'],
  ['#68724d', 'Olive'], ['#de4343', 'Red'], ['#f99963', 'Ochre'],
];
function toRGB(h){ h = h.replace('#',''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }
function dist(a,b){ return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2; }
function lum(hex){ const c = toRGB(hex); return 0.299*c[0] + 0.587*c[1] + 0.114*c[2]; }
function quantKey(hex){ const [r,g,b]=toRGB(hex); const q=v=>Math.round(v/16); return `${q(r)}_${q(g)}_${q(b)}`; }
function roleName(hex){ const c=toRGB(hex); let best='Accent', bd=1e9;
  ROLE.forEach(([h,n])=>{ const d=dist(c,toRGB(h)); if(d<bd){bd=d;best=n;} }); return best; }
function bucket(hex){ const l=lum(hex), r=roleName(hex);
  if(r==='Gold')return'gold'; if(r==='Red')return'red'; if(r==='Terracotta')return'terra';
  if(r==='Olive')return'green'; if(r==='Brown')return'brown';
  if(l>175)return'light'; if(l<95)return'dark'; return'other'; }
function subLabel(part, hex){ const m=SUBLABEL[part]||{}; return m[bucket(hex)] || m.other || part; }

// palettes keyed by colour-role; 'As designed' restores real filament colours
const PALETTES = [
  { key: 'original', name: 'Original', roles: null },
  // Black & White uses ONLY real Bambu Matte filaments he stocks: Ivory White + Charcoal (their true measured hex)
  { key: 'bw',   name: 'Black & White', roles: { White:'#ebebe3', Charcoal:'#424344', Terracotta:'#424344', Grey:'#424344', Brown:'#424344', Gold:'#424344', Olive:'#424344', Red:'#424344', Ochre:'#424344', Accent:'#424344' } },
];

export const recipe = {
  style: 'colonial', palette: 'original', colours: {},
  plaque: { text: '', font: 'Marcellus' },   // small gold name board (over the door)
  story: { title: '', subtitle: '', place: '', story: '', madeFor: '', font: 'Marcellus' },
  order: { customerName: '', contact: '', houseName: '', madeFor: '', nameBoard: '' },   // captured at the Review & send step
};
window.__recipe = recipe;
const NAME_CAP = 14;   // small name board
// pre-filled example wording per style, so buyers edit rather than start blank
const STORY_DEFAULTS = {
  colonial: { title: 'The Shutter House', subtitle: 'Black and white terrace', place: 'Singapore 1936',
              story: 'A timber frame painted black,\nplaster between the posts,\nevery opening is louvred,\ndeep eaves over the street.', madeFor: 'the Leong family' },
  chinese:  { title: 'The Fortune House', subtitle: 'Chinese fronted terrace', place: 'Singapore 1928',
              story: 'Clouds at the shoulders,\ncoins in the spandrels,\nfret in every band,\nevery mark means luck.', madeFor: 'the Ong family' },
  peranakan:{ title: 'Peranakan Terrace', subtitle: '', place: 'Singapore 1928',
              story: 'Before the flats, Singapore was\nrows of houses like this,\nthe Peranakans built them\nand dressed the front.', madeFor: 'the Phang family' },
};
const STORY_MAXLINES = 4;
const STORY_LINE_CAP = 32;   // max letters per story line, so it always fits the real plaque
const STORY_FIELDS = [
  { key: 'title',    label: 'Title (house name)', cap: 22, ph: 'The Tan House' },
  { key: 'subtitle', label: 'Subtitle',          cap: 30, ph: 'Black and white terrace' },
  { key: 'place',    label: 'Year / place',      cap: 22, ph: 'Singapore 1928' },
  { key: 'story',    label: 'Story (up to 4 lines)', cap: 160, ph: 'A few short lines about the house', multiline: true },
  { key: 'madeFor',  label: 'Made for', cap: 24, ph: 'the Tan family' },
];

let scene, camera, renderer, controls, houseGroup, stageView;
let needsRender = true;   // on-demand rendering: only draw a frame when something actually changed
function requestRender(){ needsRender = true; }
let zones = [];            // [{id, part, hex, role, label}]
let parts = [];            // ordered distinct part names present
let currentPart = null;
const mats = {};
let camGoal = null, tgtGoal = null;   // smooth camera move (e.g. to the name board)
let homeCamPos = null, homeTarget = null;   // the default framed view
let fh = null;   // {d,h} from frameHouse, for the quick-view buttons
let loadedStyle = null, applyingPalette = false;
const storyCache = {}, nameCache = {}, colourCache = {};   // remember plaque text AND colours per style across switches
let signMeshes = [];       // the model's own gold sign meshes (hidden when custom text set)
let plaqueMesh = null, plaqueTex = null, plaqueCanvas = null, plaqueCtx = null;
let storyMeshes = [];      // original museum-board text+border (hidden when custom story set)
let storyMesh = null, storyTex = null, storyCanvas = null, storyCtx = null;
let storyInk = '#2a241c';  // text colour, follows the board's ink
let storyBgZoneId = null;  // museum-plaque base colour zone (overlay bg follows it)
let storyInkZoneId = null; // museum-plaque lettering colour zone (overlay text follows it)
let plaqueInkZoneId = null;// name-board lettering colour zone (overlay text follows it)

function disposeGroup(g){
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
  scene.remove(g);
}

async function loadModel(styleKey){
  const mount = document.getElementById('stage3d');
  const hint = mount && mount.querySelector('.stage-hint');
  const style = STYLES.find(s => s.key === styleKey); if (!style) return;
  if (hint) hint.textContent = 'Loading ' + style.label + '…';
  try {
    const data = await fetch('assets/models/' + style.file + '?v=86').then(r => r.json());
    if (loadedStyle && loadedStyle !== styleKey) {   // remember the outgoing style's text AND colours
      storyCache[loadedStyle] = Object.assign({}, recipe.story);
      nameCache[loadedStyle] = recipe.plaque.text;
      colourCache[loadedStyle] = Object.assign({}, recipe.colours);
    }
    if (houseGroup) disposeGroup(houseGroup);
    Object.values(mats).forEach(m => m.dispose && m.dispose());

    // === Group pieces into control zones ===
    // Peranakan uses an explicit maker-locked map (HOUSE_MAP); others use the generic exact-colour path.
    const mapper = HOUSE_MAP[styleKey];
    zones = []; const byKey = {}, byZone = {}, clusterOf = {};
    for (const k in mats) delete mats[k];
    recipe.colours = {};
    let zi = 0;
    const matFor = (hex, rough) => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, metalness: 0, side: THREE.DoubleSide, flatShading: true, envMapIntensity: 0.9 });

    if (mapper) {
      const tally = {};   // section|group|slot -> {r, hexes}
      data.parts.forEach(p => {
        const r = mapper(p.name, p.stage, p.colour); if (!r || r.locked) return;
        const key = r.section + '|' + r.group + '|' + r.slot;
        (tally[key] || (tally[key] = { r, hexes: {} })).hexes[p.colour] = (tally[key].hexes[p.colour] || 0) + 1;
      });
      Object.keys(tally).forEach(key => {
        const { r, hexes } = tally[key];
        const raw = Object.keys(hexes).sort((a, b) => hexes[b] - hexes[a])[0];
        const hex = snapToBambu(raw);   // default colour IS a real filament we stock (dark -> Charcoal)
        const rough = (r.section.startsWith('Floors') || r.group === 'Base') ? 0.95 : 0.82;
        const z = { id: 'z' + (zi++), section: r.section, group: r.group, slot: r.slot, label: r.slot, hex, role: roleName(hex) };
        byKey[key] = z; zones.push(z);
        mats[z.id] = matFor(hex, rough); recipe.colours[z.id] = hex;
      });
      // facade accents: show as plain "Accent 1 / 2 / 3" (lightest first) instead of colour names
      const fa = zones.filter(z => z.group === 'Facade accent').sort((a, b) => lum(b.hex) - lum(a.hex));
      if (fa.length > 1) fa.forEach((z, i) => { z.label = 'Accent ' + (i + 1); });
    } else {
      const MERGE = 150;   // only collapse rounding twins; every real filament stays its own picker
      const partColours = {};
      data.parts.forEach(p => {
        const part = partOf(p.name, p.stage, p.colour); if (!part) return;
        (partColours[part] || (partColours[part] = {}));
        partColours[part][p.colour] = (partColours[part][p.colour] || 0) + 1;
      });
      const raw = [];
      Object.keys(partColours).forEach(part => {
        const entries = Object.entries(partColours[part]).sort((a, b) => b[1] - a[1]);
        const reps = []; const map = {};
        entries.forEach(([hex, cnt]) => {
          const c = toRGB(hex);
          const rp = reps.find(x => dist(toRGB(x.hex), c) < MERGE);
          if (rp) { map[hex] = rp.hex; rp.count += cnt; } else { reps.push({ hex, count: cnt }); map[hex] = hex; }
        });
        clusterOf[part] = map;
        reps.forEach(rp => raw.push({ part, hex: rp.hex }));
      });
      PART_ORDER.filter(pn => raw.some(z => z.part === pn)).forEach(pn => {
        const zs = raw.filter(z => z.part === pn).sort((a, b) => lum(b.hex) - lum(a.hex));
        const baseOf = z => zs.length > 1 ? subLabel(pn, z.hex) : pn;
        const baseCount = {}; zs.forEach(z => { const b = baseOf(z); baseCount[b] = (baseCount[b] || 0) + 1; });
        const seen = {};
        zs.forEach(z => {
          let b = baseOf(z);
          if (baseCount[b] > 1) b = `${b} (${roleName(z.hex).toLowerCase()})`;
          seen[b] = (seen[b] || 0) + 1;
          const label = seen[b] > 1 ? `${b} ${seen[b]}` : b;
          const section = EXTERIOR_PARTS.includes(pn) ? 'Outside colours' : 'Inside colours';
          const shex = snapToBambu(z.hex);   // default colour IS a real filament we stock (dark -> Charcoal)
          const zone = { id: 'z' + (zi++), section, group: pn, slot: label, label: label === pn ? '' : label, hex: shex, role: roleName(shex) };
          byZone[pn + '|' + z.hex] = zone; zones.push(zone);   // key stays the mesh's own colour so lookup matches
          mats[zone.id] = matFor(shex, pn === 'Base' || pn === 'Floor' ? 0.95 : 0.82); recipe.colours[zone.id] = shex;
        });
      });
    }
    parts = [...new Set(zones.map(z => z.group))];
    // RESTORE this style's remembered colours so switching styles never loses a buyer's
    // edits (the "Original" theme is still their reset to defaults, since z.hex stays the default).
    let restored = false;
    if (colourCache[styleKey]) {
      for (const id in colourCache[styleKey]) {
        if (mats[id]) { recipe.colours[id] = colourCache[styleKey][id]; mats[id].color.set(colourCache[styleKey][id]); restored = true; }
      }
    }
    // mesh -> zone id (null = standalone / forever-black)
    var zoneIdForMesh = (name, stage, hex) => {
      if (mapper) { const r = mapper(name, stage, hex); if (!r || r.locked) return null; const z = byKey[r.section + '|' + r.group + '|' + r.slot]; return z ? z.id : null; }
      const part = partOf(name, stage, hex); if (!part) return null;
      const cl = clusterOf[part]; const z = cl && byZone[part + '|' + cl[hex]]; return z ? z.id : null;
    };
    recipe.palette = restored ? null : 'original';   // restored edits = a custom design, no theme chip active
    recipe.story = storyCache[styleKey]
      ? Object.assign({}, storyCache[styleKey])
      : Object.assign({ font: recipe.story.font || 'Marcellus' }, STORY_DEFAULTS[styleKey] || {});
    recipe.plaque.text = (styleKey in nameCache) ? nameCache[styleKey] : '';
    // plaque overlay colours follow the plaque's own zones (lettering = lighter, base = darker)
    const nameZones = zones.filter(z => z.group === 'Name board').sort((a, b) => lum(b.hex) - lum(a.hex));
    plaqueInkZoneId = (nameZones[0] || {}).id;
    const museZones = zones.filter(z => z.group === 'Museum plaque').sort((a, b) => lum(b.hex) - lum(a.hex));
    storyInkZoneId = (museZones[0] || {}).id;
    storyBgZoneId = (museZones[museZones.length - 1] || zones.filter(z => z.group === 'Walls').sort((a, b) => lum(b.hex) - lum(a.hex))[0] || {}).id;
    currentPart = parts[0];
    disposeStoryMesh();

    houseGroup = new THREE.Group();
    signMeshes = []; storyMeshes = [];
    const gbox = new THREE.Box3(), sbox = new THREE.Box3();
    data.parts.forEach(p => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.verts, 3));
      g.setIndex(p.tris); g.computeVertexNormals();
      const zid = zoneIdForMesh(p.name, p.stage, p.colour);
      const material = zid ? mats[zid]
        : new THREE.MeshStandardMaterial({ color: new THREE.Color(snapToBambu(p.colour)), roughness: 0.82, metalness: 0, side: THREE.DoubleSide, flatShading: true, envMapIntensity: 0.9 });
      const m = new THREE.Mesh(g, material);
      m.castShadow = true; m.receiveShadow = true;
      houseGroup.add(m);
      const nlc = p.name.toLowerCase();
      // NAME BOARD: the lettering (lighter colour) is hidden + replaced by the custom-text overlay
      if ((nlc.includes("bian'e") || nlc.includes('name board')) && lum(p.colour) > 150) { g.computeBoundingBox(); gbox.union(g.boundingBox); signMeshes.push(m); }
      // MUSEUM PLAQUE: whole plaque hidden when edited, replaced by a built 3D plaque (panel + frame + raised text)
      if (nlc.includes('museum board') || nlc.includes('museum plaque')) { g.computeBoundingBox(); sbox.union(g.boundingBox); storyMeshes.push(m); }
    });
    houseGroup.rotation.x = -Math.PI / 2;
    scene.add(houseGroup); window.__house = houseGroup;
    setupPlaque(gbox);
    frameHouse();
    setupStoryPlaque(sbox);   // after frameHouse: world transform is final
    buildControls();
    loadedStyle = styleKey;
    if (hint) hint.remove();
    renderer.shadowMap.needsUpdate = true;   // refresh the (otherwise frozen) shadow for the new model
    requestRender();
  } catch (err) {
    console.error('model load failed', err);
    if (hint) { hint.textContent = 'Could not load the model'; hint.classList.add('error'); }
  }
}

function frameHouse(){
  let box = new THREE.Box3().setFromObject(houseGroup);
  const size = box.getSize(new THREE.Vector3());
  houseGroup.scale.setScalar(4.2 / size.y);
  box = new THREE.Box3().setFromObject(houseGroup);
  houseGroup.position.x -= (box.min.x + box.max.x) / 2;
  houseGroup.position.z -= (box.min.z + box.max.z) / 2;
  houseGroup.position.y -= box.min.y;
  box = new THREE.Box3().setFromObject(houseGroup);
  const h = box.max.y - box.min.y;
  const maxDim = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, h);
  const fov = camera.fov * Math.PI / 180;
  const d = (maxDim / 2) / Math.tan(fov / 2) * 0.92;
  const az = THREE.MathUtils.degToRad(40), el = THREE.MathUtils.degToRad(15);
  camera.position.set(d*Math.cos(el)*Math.sin(az), d*Math.sin(el)+h*0.35, d*Math.cos(el)*Math.cos(az));
  controls.minDistance = d*0.4; controls.maxDistance = d*2.4;
  controls.target.set(0, h*0.45, 0); controls.update();
  homeCamPos = camera.position.clone(); homeTarget = controls.target.clone();
  fh = { d, h };   // remembered so the quick-view buttons can pose the camera
}
function resetView(){ if (homeCamPos) { camGoal = homeCamPos.clone(); tgtGoal = homeTarget.clone(); } }

// ---- quick views: glide the camera to a set angle (uses the same lerp the nudges do) ----
function viewTo(azDeg, elDeg, distMul, tgtYMul){
  if (!fh) return;
  const az = THREE.MathUtils.degToRad(azDeg), el = THREE.MathUtils.degToRad(elDeg), d = fh.d * (distMul || 1);
  camGoal = new THREE.Vector3(d*Math.cos(el)*Math.sin(az), d*Math.sin(el) + fh.h*0.35, d*Math.cos(el)*Math.cos(az));
  tgtGoal = new THREE.Vector3(0, fh.h * (tgtYMul != null ? tgtYMul : 0.45), 0);
  setSpin(false); requestRender();
}
const QUICK_VIEWS = [
  { label: 'Front',   fn: () => viewTo(6, 10, 1.0) },
  { label: 'Corner',  fn: () => resetView() },
  { label: 'Side',    fn: () => viewTo(92, 12, 1.0) },
  { label: 'Top',     fn: () => viewTo(28, 70, 1.05) },
  { label: 'Inside',  fn: () => viewTo(34, 52, 0.72, 0.62) },   // peek down into the courtyard
];
let spinBtn = null;
function setSpin(on){ if (!controls) return; controls.autoRotate = !!on; if (spinBtn) spinBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); requestRender(); }
function toggleSpin(){ setSpin(!controls.autoRotate); }
// snapshot the current view onto a captioned card the buyer can save/share
function saveImage(){
  renderer.render(scene, camera);   // fresh frame in the buffer
  const src = renderer.domElement;
  const pad = Math.round(src.width * 0.05), capH = Math.round(src.width * 0.10);
  const c = document.createElement('canvas'); c.width = src.width + pad*2; c.height = src.height + pad + capH;
  const g = c.getContext('2d');
  g.fillStyle = '#efece4'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, pad, pad);
  const name = (recipe.story && recipe.story.title) ? recipe.story.title : 'Your design';
  g.textAlign = 'center';
  g.fillStyle = '#221e18'; g.font = '600 ' + Math.round(capH*0.34) + 'px Georgia, serif';
  g.fillText(name, c.width/2, src.height + pad + capH*0.46);
  g.fillStyle = '#8a8578'; g.font = Math.round(capH*0.22) + 'px -apple-system, Helvetica, Arial, sans-serif';
  g.fillText('Nanyang Model Co.  ·  design your own', c.width/2, src.height + pad + capH*0.80);
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = (name.replace(/[^a-z0-9]+/ig, '-').replace(/^-|-$/g, '') || 'nanyang-design') + '.png';
  a.click();
}
function buildViewBar(mount){
  const bar = el('div', 'viewbar');
  QUICK_VIEWS.forEach(v => { const b = el('button', 'vbtn', v.label); b.type = 'button'; b.addEventListener('click', v.fn); bar.appendChild(b); });
  const sep = el('span', 'vsep'); bar.appendChild(sep);
  spinBtn = el('button', 'vbtn vspin', 'Spin'); spinBtn.type = 'button'; spinBtn.setAttribute('aria-pressed', 'false');
  spinBtn.addEventListener('click', toggleSpin); bar.appendChild(spinBtn);
  const save = el('button', 'vbtn vsave', 'Save image'); save.type = 'button'; save.addEventListener('click', saveImage); bar.appendChild(save);
  mount.appendChild(bar);
}

// ---- 3D raised lettering, so custom text looks MOLDED like the real plaque (not a flat drawing) ----
const PLAQUE_FONT_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/fonts/gentilis_regular.typeface.json';
let plaqueFont = null;
new FontLoader().load(PLAQUE_FONT_URL, f => { plaqueFont = f; if (loadedStyle) { updatePlaque(); updateStory(); } });
// one centered, extruded (raised) line of text, scaled to fit (maxW, targetH) in local units
function extrudedLine(str, targetH, maxW, material, depth){
  if (!plaqueFont || !str) return null;
  const geo = new TextGeometry(str.toUpperCase(), { font: plaqueFont, size: targetH, height: depth, curveSegments: 4, bevelEnabled: false });
  geo.computeBoundingBox(); const b = geo.boundingBox;
  const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, 0);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  if (maxW && w > maxW) m.scale.setScalar(maxW / w);
  return m;
}
// ---- name board: custom house name as raised 3D letters ----
function setupPlaque(box){
  plaqueMesh = null;
  if (box.isEmpty()) return;
  const w = (box.max.x - box.min.x), h = (box.max.z - box.min.z);
  plaqueMesh = new THREE.Group();   // anchor on the board face, facing the street
  plaqueMesh.position.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
  plaqueMesh.rotation.x = Math.PI / 2;
  plaqueMesh.userData = { w, h };
  houseGroup.add(plaqueMesh); window.__plaque = plaqueMesh;
  updatePlaque();
}
function updatePlaque(){
  if (!plaqueMesh) return;
  signMeshes.forEach(m => m.visible = true);   // always show the real molded name board (custom text is captured at the order step)
  for (let i = plaqueMesh.children.length - 1; i >= 0; i--) { const c = plaqueMesh.children[i]; if (c.geometry) c.geometry.dispose(); plaqueMesh.remove(c); }
  requestRender();
}

// ---- story plaque (museum label): custom story as raised 3D letters on the real panel ----
function disposeStoryMesh(){ if (!storyMesh) return; storyMesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); scene.remove(storyMesh); storyMesh = null; }
function setupStoryPlaque(box){
  disposeStoryMesh();
  if (box.isEmpty()) return;
  const sc = houseGroup.scale.x || 1;
  const wy = (box.max.y - box.min.y) * sc, hz = (box.max.z - box.min.z) * sc;
  storyMesh = new THREE.Group();
  const localC = new THREE.Vector3((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2);
  const worldC = houseGroup.localToWorld(localC);
  const outward = new THREE.Vector3(-1, 0, 0);   // west flank faces world -X
  storyMesh.position.copy(worldC.clone().add(outward.clone().multiplyScalar(0.02)));
  storyMesh.lookAt(worldC.clone().add(outward));
  storyMesh.userData = { wy, hz };
  scene.add(storyMesh); window.__story = storyMesh;
  updateStory();
}
function storyIsDefault(){
  const d = STORY_DEFAULTS[recipe.style] || {}, s = recipe.story;
  return ['title', 'subtitle', 'place', 'story', 'madeFor'].every(k => (s[k] || '') === (d[k] || ''));
}
function updateStory(){
  if (!storyMesh) return;
  storyMeshes.forEach(m => m.visible = true);   // always show the real engraved museum plaque (custom story captured at the order step)
  for (let i = storyMesh.children.length - 1; i >= 0; i--) { const c = storyMesh.children[i]; if (c.geometry) c.geometry.dispose(); storyMesh.remove(c); }
  requestRender();
}

// ---- controls ----
function setColour(zoneId, hex){
  recipe.colours[zoneId] = hex;
  if (mats[zoneId]) mats[zoneId].color.set(hex);
  document.querySelectorAll(`.swatch[data-zone="${zoneId}"]`).forEach(s =>
    s.setAttribute('aria-pressed', s.dataset.hex === hex ? 'true' : 'false'));
  document.querySelectorAll(`.slot-label[data-zone="${zoneId}"]`).forEach(l => {
    const pre = l.dataset.prefix || ''; const nm = paletteName(hex);
    l.textContent = pre ? pre + ': ' + nm : nm;
  });
  if (zoneId === storyBgZoneId || zoneId === storyInkZoneId) updateStory();   // keep the story overlay matching the plaque colours
  if (zoneId === plaqueInkZoneId) updatePlaque();   // keep the name overlay matching the lettering colour
  requestRender();
  if (!applyingPalette) {   // a manual colour change means no preset theme is active
    recipe.palette = null;
    document.querySelectorAll('.pal-chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
  }
}
function roleHex(role){ const z = zones.find(z => z.role === role); return z ? z.hex : '#c9bfa8'; }
// Designer picks — hand-tuned, harmonious schemes (all real Bambu Matte filaments), mapped by role.
// The logic: big areas (walls) stay light and calm, shutters/trim go dark for contrast, and each
// scheme keeps to 2-3 hues that sit together on the colour wheel — so no ugly clashes.
const DESIGNER_PALETTES = [
  { name: 'Heritage White', roles: { White:'#ebebe3', Charcoal:'#424344', Terracotta:'#b15533', Grey:'#9b9ea0', Brown:'#7d6556', Gold:'#f7d959', Olive:'#68724d', Red:'#bb3d43', Ochre:'#f99963', Accent:'#bb3d43' } },
  { name: 'Warm Earth',     roles: { White:'#e8dbb7', Charcoal:'#4d3324', Terracotta:'#b15533', Grey:'#d3b7a7', Brown:'#7d6556', Gold:'#ae835b', Olive:'#ae835b', Red:'#b15533', Ochre:'#ae835b', Accent:'#7d6556' } },
  { name: 'Cool Stone',     roles: { White:'#ebebe3', Charcoal:'#424344', Terracotta:'#757575', Grey:'#9b9ea0', Brown:'#757575', Gold:'#a3d8e1', Olive:'#0078bf', Red:'#0078bf', Ochre:'#56b7e6', Accent:'#0078bf' } },
  { name: 'Peranakan Bold', roles: { White:'#ebebe3', Charcoal:'#424344', Terracotta:'#b15533', Grey:'#9b9ea0', Brown:'#b15533', Gold:'#f7d959', Olive:'#68724d', Red:'#de4343', Ochre:'#f99963', Accent:'#de4343' } },
  { name: 'Jade & Cream',   roles: { White:'#ebebe3', Charcoal:'#68724d', Terracotta:'#b15533', Grey:'#9b9ea0', Brown:'#7d6556', Gold:'#f7d959', Olive:'#68724d', Red:'#68724d', Ochre:'#61c680', Accent:'#68724d' } },
  { name: 'Indigo Night',   roles: { White:'#cbc6b8', Charcoal:'#042f56', Terracotta:'#424344', Grey:'#9b9ea0', Brown:'#042f56', Gold:'#a3d8e1', Olive:'#042f56', Red:'#0078bf', Ochre:'#56b7e6', Accent:'#042f56' } },
  { name: 'Rose Plaster',   roles: { White:'#ebebe3', Charcoal:'#950051', Terracotta:'#b15533', Grey:'#9b9ea0', Brown:'#7d6556', Gold:'#e8afcf', Olive:'#950051', Red:'#950051', Ochre:'#e8afcf', Accent:'#950051' } },
  { name: 'Sunbaked',       roles: { White:'#ebebe3', Charcoal:'#7d6556', Terracotta:'#f99963', Grey:'#e8dbb7', Brown:'#7d6556', Gold:'#f7d959', Olive:'#ae835b', Red:'#b15533', Ochre:'#f7d959', Accent:'#f99963' } },
  { name: 'Slate & Sage',   roles: { White:'#cbc6b8', Charcoal:'#424344', Terracotta:'#757575', Grey:'#9b9ea0', Brown:'#7d6556', Gold:'#9b9ea0', Olive:'#68724d', Red:'#68724d', Ochre:'#9b9ea0', Accent:'#68724d' } },
  { name: 'Forest & Clay',  roles: { White:'#e8dbb7', Charcoal:'#424344', Terracotta:'#b15533', Grey:'#9b9ea0', Brown:'#7d6556', Gold:'#f7d959', Olive:'#68724d', Red:'#bb3d43', Ochre:'#ae835b', Accent:'#68724d' } },
];
let lastDesigner = -1;
function applyDesignerPick(){
  // pick a random curated scheme (never the same one twice in a row), map its colours by role
  recipe.palette = null;
  let i; do { i = Math.floor(Math.random() * DESIGNER_PALETTES.length); } while (DESIGNER_PALETTES.length > 1 && i === lastDesigner);
  lastDesigner = i;
  const roles = DESIGNER_PALETTES[i].roles;
  applyingPalette = true;
  zones.forEach(z => setColour(z.id, roles[z.role] || z.hex));
  applyingPalette = false;
  buildControls();
}
function applyRandom(){
  // WILD — a random colour per SPOOL (chaotic but still printable: one colour per role)
  recipe.palette = null;
  applyingPalette = true;
  roleGroups().forEach(g => { const c = PALETTE[Math.floor(Math.random() * PALETTE.length)].hex; g.zones.forEach(z => setColour(z.id, c)); });
  applyingPalette = false;
  buildControls();
}
function applyPalette(key){
  const p = PALETTES.find(x => x.key === key); if (!p) return;
  recipe.palette = key;
  applyingPalette = true;
  zones.forEach(z => setColour(z.id, (p.roles && p.roles[z.role]) || z.hex));
  applyingPalette = false;
  buildControls();
}
// ---- order (Review & send) ----
function paletteName(hex){ if (!hex) return ''; const p = PALETTE.find(x => x.hex.toLowerCase() === hex.toLowerCase()); return p ? p.name : roleName(hex); }
function buildOrder(){
  const st = STYLES.find(s => s.key === recipe.style);
  const colours = roleGroups().map(g => {
    const hex = recipe.colours[g.zones[0].id] || g.zones[0].hex;
    const spool = ROLE_SPOOL[(g.hex || '').toLowerCase()] || g.label;
    const covers = [...new Set(g.zones.map(z => z.group).filter(Boolean))].join(' · ');
    return { spool, part: g.label, covers, hex, name: paletteName(hex) };
  });
  colours.sort((a, b) => ((SPOOL_PRINT_ORDER.indexOf(a.spool) + 1) || 99) - ((SPOOL_PRINT_ORDER.indexOf(b.spool) + 1) || 99));
  const s = recipe.story || {};
  return { v: 1, style: st ? st.label : recipe.style, styleKey: recipe.style, palette: recipe.palette,
    customerName: recipe.order.customerName, contact: recipe.order.contact,
    houseName: s.title, subtitle: s.subtitle, place: s.place, story: s.story, madeFor: s.madeFor,
    nameBoard: recipe.order.nameBoard, colours };
}
function orderTextSummary(o){
  const L = [];
  if (o.customerName) L.push('Name: ' + o.customerName);
  if (o.contact) L.push('Contact: ' + o.contact);
  L.push('Style: ' + o.style);
  if (o.houseName) L.push('House name: ' + o.houseName);
  if (o.madeFor) L.push('Made for: ' + o.madeFor);
  if (o.nameBoard) L.push('Name board: ' + o.nameBoard);
  L.push('Colours:');
  o.colours.forEach(c => L.push('  ' + (c.part || c.group) + ' - ' + c.name));
  return L.join('\n');
}
function sendOrder(){
  const o = buildOrder();
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const dir = location.pathname.replace(/[^/]*$/, '');
  const adminUrl = location.origin + dir + 'admin.html#' + code;
  const msg = `Hi ${SEND.biz}, I'd like to order this design:\n\n${orderTextSummary(o)}\n\nFull design: ${adminUrl}`;
  window.open('https://wa.me/' + SEND.whatsapp + '?text=' + encodeURIComponent(msg), '_blank');
}
function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function section(title, open){ const d = el('details', 'section'); if (open) d.open = true; d.appendChild(el('summary', null, title)); return d; }
function swatchRow(zone){
  const row = el('div', 'swatches');
  PALETTE.forEach(p => {
    const b = el('button', 'swatch'); b.type = 'button';
    b.dataset.hex = p.hex; b.dataset.zone = zone.id; b.style.setProperty('--sw', p.hex);
    b.title = p.name; b.setAttribute('aria-label', `${zone.group} ${zone.label}: ${p.name}`);
    b.setAttribute('aria-pressed', p.hex.toLowerCase() === (recipe.colours[zone.id]||'').toLowerCase() ? 'true' : 'false');
    b.addEventListener('click', () => setColour(zone.id, p.hex));
    row.appendChild(b);
  });
  return row;
}
// one swatch row for a whole spool/role — sets every part of that colour together
function roleSwatchRow(group){
  const row = el('div', 'swatches');
  const current = () => { const cs = [...new Set(group.zones.map(z => (recipe.colours[z.id] || z.hex).toLowerCase()))]; return cs.length === 1 ? cs[0] : null; };
  PALETTE.forEach(p => {
    const b = el('button', 'swatch'); b.type = 'button';
    b.dataset.hex = p.hex; b.style.setProperty('--sw', p.hex);
    b.title = p.name; b.setAttribute('aria-label', `${group.label}: ${p.name}`);
    b.setAttribute('aria-pressed', p.hex.toLowerCase() === current() ? 'true' : 'false');
    b.addEventListener('click', () => {
      applyingPalette = true; group.zones.forEach(z => setColour(z.id, p.hex)); applyingPalette = false;
      recipe.palette = null;
      row.querySelectorAll('.swatch').forEach(s => s.setAttribute('aria-pressed', s.dataset.hex === p.hex ? 'true' : 'false'));
      document.querySelectorAll('.pal-chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    });
    row.appendChild(b);
  });
  return row;
}
function buildControls(){
  const root = document.getElementById('controls'); if (!root) return;
  root.innerHTML = '';
  root.appendChild(el('div', 'price', PRICE + ' · one price, any colours'));
  // STYLE
  const sb = el('div', 'ctl-block'); sb.appendChild(el('div', 'ctl-label label', 'Style'));
  const sr = el('div', 'chip-row');
  STYLES.forEach(s => {
    const b = el('button', 'chip' + (s.enabled ? '' : ' chip-soon'), s.enabled ? s.label : s.label + ' · soon');
    b.type = 'button'; b.disabled = !s.enabled;
    b.setAttribute('aria-pressed', recipe.style === s.key ? 'true' : 'false');
    if (s.enabled) b.addEventListener('click', () => { if (recipe.style !== s.key) { recipe.style = s.key; loadModel(s.key); } });
    sr.appendChild(b);
  });
  sb.appendChild(sr); root.appendChild(sb);
  // PALETTE
  const pb = el('div', 'ctl-block'); pb.appendChild(el('div', 'ctl-label label', 'Colour themes'));
  const pr = el('div', 'chip-row');
  PALETTES.forEach(p => {
    const c = el('button', 'chip pal-chip'); c.type = 'button'; c.dataset.pal = p.key;
    c.setAttribute('aria-pressed', recipe.palette === p.key ? 'true' : 'false');
    const dots = el('span', 'pal-dots');
    ['White', 'Charcoal', 'Terracotta'].forEach(role => {
      const hex = (p.roles && p.roles[role]) || roleHex(role);
      const d = el('span', 'pal-dot'); d.style.setProperty('--sw', hex); dots.appendChild(d);
    });
    c.appendChild(dots); c.appendChild(el('span', 'pal-name', p.name));
    c.addEventListener('click', () => applyPalette(p.key));
    pr.appendChild(c);
  });
  const dpick = el('button', 'chip pal-chip', 'Designer picks'); dpick.type = 'button';
  dpick.addEventListener('click', applyDesignerPick);
  pr.appendChild(dpick);
  const wild = el('button', 'chip pal-chip', 'Wild'); wild.type = 'button';
  wild.addEventListener('click', applyRandom);
  pr.appendChild(wild);
  pb.appendChild(pr); root.appendChild(pb);
  // PLAQUE
  function fieldRow(labelText, val, cap, ph, onInput, onFocus, multiline){
    const w = el('div', 'field');
    const top = el('div', 'field-top');
    top.appendChild(el('span', 'field-label', labelText));
    const cnt = el('span', 'field-count', `${(val || '').length}/${cap}`);
    top.appendChild(cnt); w.appendChild(top);
    const i = document.createElement(multiline ? 'textarea' : 'input');
    if (!multiline) i.type = 'text';
    i.className = 'plaque-input' + (multiline ? ' plaque-area' : ''); i.maxLength = cap; i.value = val || ''; i.placeholder = ph || '';
    if (multiline) i.rows = 4;
    i.setAttribute('aria-label', labelText);
    i.addEventListener('input', () => {
      if (multiline) { i.value = i.value.split('\n').slice(0, STORY_MAXLINES).map(x => x.slice(0, STORY_LINE_CAP)).join('\n'); }
      cnt.textContent = `${i.value.length}/${cap}`; onInput(i.value);
    });
    if (onFocus) i.addEventListener('focus', onFocus);
    w.appendChild(i); return w;
  }
  function fontChips(current, onPick){
    const fr = el('div', 'chip-row'); fr.style.marginTop = '10px';
    PLAQUE_FONTS.forEach(f => {
      const b = el('button', 'chip', f.label); b.type = 'button'; b.style.fontFamily = f.font;
      b.setAttribute('aria-pressed', current() === f.font ? 'true' : 'false');
      b.addEventListener('click', () => { onPick(f.font); fr.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); });
      fr.appendChild(b);
    });
    return fr;
  }
  // helper: the text-editing fields for a plaque group (only when the model has that editable board)
  function plaqueTextFields(group, wrap){
    if (group === 'Name board' && plaqueMesh) {
      wrap.appendChild(fieldRow('House name (on the board)', recipe.plaque.text, NAME_CAP, 'Your house name',
        v => { recipe.plaque.text = v; updatePlaque(); }, focusPlaque));
      wrap.appendChild(fontChips(() => recipe.plaque.font, f => { recipe.plaque.font = f; updatePlaque(); }));
    }
    // Museum-plaque wording (title, story, made-for) is captured in "Review & send", not here — one place only.
  }
  // CHANGE COLOURS — one tab per part group (Walls, Facade accent, Roof, Doors, Fence, floors...).
  // A group with several slots shows a labelled row per slot, so each part is coloured on its own.
  const groups = controlGroups();
  const det = section('Colours'); det.open = true;
  det.addEventListener('toggle', () => { if (det.open) resetView(); });
  // The outside parts show first; floors, ceilings and plaques tuck behind "More parts" so the
  // first-time buyer isn't faced with 14 tabs at once. Tabs are big enough to tap on a phone.
  const tabs = el('div', 'part-tabs');
  const moreTabs = el('div', 'part-tabs more'); moreTabs.hidden = true;
  let sel = 0; const tabEls = [];
  groups.forEach((g, i) => {
    const t = el('button', 'part-tab', g.label); t.type = 'button';
    t.setAttribute('aria-pressed', i === sel ? 'true' : 'false');
    t.addEventListener('click', () => { sel = i; renderColours(); });
    tabEls[i] = t;
    (g.section === 'Outside' ? tabs : moreTabs).appendChild(t);
  });
  det.appendChild(tabs);
  if (moreTabs.children.length){
    const moreBtn = el('button', 'more-toggle', 'More parts'); moreBtn.type = 'button';
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.addEventListener('click', () => {
      const open = moreTabs.hidden; moreTabs.hidden = !open;
      moreBtn.textContent = open ? 'Fewer parts' : 'More parts';
      moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    det.appendChild(moreBtn); det.appendChild(moreTabs);
  }
  det.appendChild(el('p', 'pick-hint', 'Tap a part above, then tap a colour for it.'));
  const wrap = el('div', 'zone-wrap'); det.appendChild(wrap);
  root.appendChild(det);
  function renderColours(){
    tabEls.forEach((t, i) => t.setAttribute('aria-pressed', i === sel ? 'true' : 'false'));
    wrap.innerHTML = '';
    const g = groups[sel]; if (!g) return;
    const multi = g.zones.length > 1;
    g.zones.forEach(z => {
      const lab = z.label || z.slot || '';
      const prefix = multi ? lab : g.label;   // "Shutters" for a slot, or the part name for a single-colour part
      const name = paletteName(recipe.colours[z.id] || z.hex);
      const sl = el('div', 'slot-label', prefix ? prefix + ': ' + name : name);
      sl.dataset.zone = z.id; sl.dataset.prefix = prefix || '';   // setColour keeps this name live
      wrap.appendChild(sl);
      wrap.appendChild(swatchRow(z));
    });
  }
  renderColours();

  // ---- REVIEW & SEND YOUR DESIGN ----
  const rv = section('Review & send your design');
  rv.appendChild(el('p', 'note', 'Tell us who you are, then your plaque wording (filled in with the standard story, change any line or leave it). Your words are sent with your order.'));
  rv.appendChild(fieldRow('Your name', recipe.order.customerName, 30, 'Your name', v => { recipe.order.customerName = v; }));
  rv.appendChild(fieldRow('Contact (phone or handle)', recipe.order.contact, 30, 'e.g. 9123 4567', v => { recipe.order.contact = v; }));
  rv.appendChild(fieldRow('House name', recipe.story.title, 22, 'The Tan House', v => { recipe.story.title = v; }));
  // name board: presets + custom text, one unified control
  const nbWrap = el('div', 'field');
  const nbTop = el('div', 'field-top');
  nbTop.appendChild(el('span', 'field-label', 'Name board over the door'));
  const nbCnt = el('span', 'field-count', `${(recipe.order.nameBoard || '').length}/${ORDER_CAPS.nameBoard}`);
  nbTop.appendChild(nbCnt); nbWrap.appendChild(nbTop);
  const nbChips = el('div', 'chip-row nb-chips');
  const nbInput = document.createElement('input');
  nbInput.type = 'text'; nbInput.className = 'plaque-input'; nbInput.maxLength = ORDER_CAPS.nameBoard;
  nbInput.value = recipe.order.nameBoard || ''; nbInput.placeholder = 'Or type your own'; nbInput.setAttribute('aria-label', 'Name board text');
  const markNB = () => nbChips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.textContent === recipe.order.nameBoard ? 'true' : 'false'));
  const setNB = v => { recipe.order.nameBoard = v; nbInput.value = v; nbCnt.textContent = `${v.length}/${ORDER_CAPS.nameBoard}`; markNB(); };
  NAMEBOARD_PRESETS.forEach(p => { const c = el('button', 'chip', p); c.type = 'button'; c.addEventListener('click', () => setNB(p)); nbChips.appendChild(c); });
  nbInput.addEventListener('input', () => { recipe.order.nameBoard = nbInput.value; nbCnt.textContent = `${nbInput.value.length}/${ORDER_CAPS.nameBoard}`; markNB(); });
  nbWrap.appendChild(nbChips); nbWrap.appendChild(nbInput); markNB();
  rv.appendChild(nbWrap);
  rv.appendChild(fieldRow('Subtitle', recipe.story.subtitle, 30, 'Black and white terrace', v => { recipe.story.subtitle = v; }));
  rv.appendChild(fieldRow('Year / place', recipe.story.place, 22, 'Singapore 1928', v => { recipe.story.place = v; }));
  rv.appendChild(fieldRow('Story (up to 4 lines)', recipe.story.story, 160, 'A few short lines about the house', v => { recipe.story.story = v; }, null, true));
  rv.appendChild(fieldRow('Made for', recipe.story.madeFor, 24, 'the Tan family', v => { recipe.story.madeFor = v; }));
  const send = el('button', 'btn', 'Send my design'); send.type = 'button';
  send.addEventListener('click', sendOrder);
  rv.appendChild(send);
  rv.appendChild(el('p', 'note', 'No payment here. We confirm your order by message, then PayNow ' + SEND.paynow + '.'));
  root.appendChild(rv);
}

function init(){
  const mount = document.getElementById('stage3d'); if (!mount) return;
  scene = new THREE.Scene();
  const rect = mount.getBoundingClientRect();
  camera = new THREE.PerspectiveCamera(38, rect.width / rect.height, 0.3, 100);
  camera.position.set(5.6, 3.5, 7.6);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });   // keep the buffer so "Save image" can read it
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));   // cap fill-rate on high-density phones
  renderer.setSize(rect.width, rect.height);
  renderer.setClearColor(0x000000, 0);   // transparent, so the paper gradient behind shows through
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;   // the light + house never move; refresh the shadow only when the model rebuilds
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;   // keep colours TRUE: ACES was desaturating bright reds to pink
  renderer.toneMappingExposure = 0.82;
  // the 3D canvas lives in its own wrapper BELOW the view toolbar (a flex column),
  // so the buttons sit above the model, never on top of it.
  stageView = document.createElement('div'); stageView.className = 'stageview';
  mount.appendChild(stageView); stageView.appendChild(renderer.domElement);
  // STUDIO LIGHTING: the model is lit mostly by a soft all-around environment (like a photographer's
  // lightbox), with only a gentle sun for a little direction + the ground shadow. Even, clean, no glare.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe7decb, 0.5));
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  const key = new THREE.DirectionalLight(0xfff6ea, 0.15);   // very soft sun, mostly for the ground shadow: even light, no glary front
  key.position.set(3, 10, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 1; key.shadow.camera.far = 40;
  const sc = 8; Object.assign(key.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc });
  key.shadow.bias = -0.0004; key.shadow.radius = 4; scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.18); fill.position.set(-6, 4, 2); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.24 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.001; ground.receiveShadow = true; scene.add(ground);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
  controls.minDistance = 2.6; controls.maxDistance = 16;
  controls.minPolarAngle = 0.2; controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.target.set(0, 2, 0); controls.update();
  controls.autoRotate = false; controls.autoRotateSpeed = 2.6;   // ~23s per turn (time-based, see animate)
  controls.addEventListener('start', () => { camGoal = null; tgtGoal = null; setSpin(false); });  // user drag takes over: cancel the glide + stop the turntable
  controls.addEventListener('change', requestRender);   // redraw on any camera move (drag, zoom)
  addEventListener('resize', onResize);
  window.__cam = camera; window.__ctl = controls; window.__renderer = renderer; window.__scene = scene; window.__THREE = THREE; window.__house = null;
  buildViewBar(mount);
  onResize();   // size the canvas to the view area (below the toolbar)
  animate();
  loadModel('colonial');
}
function onResize(){
  if (!stageView || !renderer) return;
  const r = stageView.getBoundingClientRect();
  if (!r.width || !r.height) return;
  camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  renderer.setSize(r.width, r.height);
  requestRender();
}
const _clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = _clock.getDelta();   // real seconds; keeps the turntable the same pace on any device
  let changed = false;
  if (camGoal) {
    camera.position.lerp(camGoal, 0.12); controls.target.lerp(tgtGoal, 0.12);
    if (camera.position.distanceTo(camGoal) < 0.05) { camGoal = null; tgtGoal = null; }
    changed = true;
  }
  if (controls.update(dt)) changed = true;   // true while dragging / damping / auto-rotating
  if (changed || needsRender) { renderer.render(scene, camera); needsRender = false; }
}
function focusOn(mesh, dist){
  if (!mesh) return;
  const wp = new THREE.Vector3(); mesh.getWorldPosition(wp);
  const dir = new THREE.Vector3(wp.x, 0, wp.z); if (dir.lengthSq() < 0.01) dir.set(0, 0, 1); dir.normalize();
  camGoal = wp.clone().add(dir.multiplyScalar(dist || 2.6)); camGoal.y = wp.y + 0.25;
  tgtGoal = wp.clone();
}
function focusPlaque(){ focusOn(plaqueMesh, 2.6); }
function focusStory(){ focusOn(storyMesh, 3.2); }
if (document.readyState !== 'loading') init();
else addEventListener('DOMContentLoaded', init);
