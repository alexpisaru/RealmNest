// Data Center — the pack's colour ramps (5–7 tones, shadows lean violet-blue,
// lights lean cool white; warm only where there is lamp or window light).
// A snowy northern site by a fjord: snow, ice and dark water, slate-blue
// ribbed cladding, charred timber, falu-red cabins, black racks with LEDs.
import type { Ramp } from '../../kit4';

// ── snow, ice, water, rock ──────────────────────────────────
export const SNOW: Ramp = ['#4c6a8c', '#6e8cae', '#93aed0', '#b4c9e4', '#cddcf0', '#e2ecf9', '#f6fafe'];
export const ICE: Ramp = ['#2f5476', '#4a7398', '#6893b8', '#8bb2d4', '#acccea', '#cbe0f4', '#e8f3fd'];
export const DEEP: Ramp = ['#03101a', '#061826', '#092234', '#0c2b42', '#11354e', '#18415a', '#244f68', '#38667e'];
export const ROCK: Ramp = ['#141922', '#212834', '#2f3744', '#414957', '#555e6c', '#6c7584', '#8a93a2'];
export const ROCKW: Ramp = ['#2a2624', '#3a3430', '#4c443e', '#5e554d', '#72685e', '#887d72'];
export const HEATH: Ramp = ['#2e2418', '#46341e', '#5e4626', '#76592e', '#8e6e3c', '#a8864e'];

// ── conifers and birch ──────────────────────────────────────
export const SPRUCE: Ramp = ['#041216', '#08201f', '#0d2c29', '#143a33', '#1d4b3e', '#295e4b', '#3c7558'];
export const PINEG: Ramp = ['#08190f', '#0e2617', '#16341f', '#204428', '#2c5632', '#3c6a3c', '#52804a'];
export const BARKR: Ramp = ['#2a1810', '#422418', '#5e3420', '#7c482a', '#985c36', '#b47448'];
export const BARKD: Ramp = ['#1a1412', '#261e1a', '#342a24', '#443830', '#56483e', '#6a5a4e'];
export const BIRCH: Ramp = ['#3a3836', '#5a5652', '#8a857e', '#b8b2a8', '#dcd6cc', '#f2eee6'];

// ── the data hall ───────────────────────────────────────────
/** slate-blue ribbed steel cladding */
export const CLAD: Ramp = ['#12161c', '#1a2029', '#232a34', '#2d353f', '#38414b', '#48525c', '#606a74'];
/** the light grey cladding of the rooftop plant and trims */
export const ALU: Ramp = ['#4a525e', '#5e6774', '#76808c', '#909aa4', '#aab2ba', '#c4cad0', '#dee2e6'];
/** charred timber of the admin wing */
export const CHAR: Ramp = ['#110e0c', '#1b1714', '#26201c', '#322a24', '#3f352d', '#4e4238'];
/** roof membrane under the snow */
export const MEMB: Ramp = ['#22262c', '#2e333a', '#3a4048', '#484e56', '#585e66'];
/** concrete */
export const CONC: Ramp = ['#545a62', '#666c74', '#7a8088', '#8e949b', '#a2a7ad', '#b6babf', '#c9ccd0'];
/** galvanised steel (gantries, fences, pylons) */
export const GALV: Ramp = ['#3c424a', '#525962', '#6a727b', '#848c94', '#9ea5ac', '#babfc4', '#d6dade'];
/** safety yellow, orange plant paint, hazard red */
export const YEL: Ramp = ['#5a4210', '#866218', '#b08424', '#d4a432', '#ecc24a', '#f8dc78'];
export const ORA: Ramp = ['#5a2408', '#82340c', '#a84812', '#cc5e1a', '#e47a2a', '#f49c4a'];
export const RED: Ramp = ['#3e0e10', '#5e1616', '#82201e', '#a62c26', '#c63c30', '#e05844'];
/** falu red of the cabins, their white trims */
export const FALU: Ramp = ['#2e0e0c', '#481612', '#661e18', '#84281e', '#9e3424', '#b8472e'];
export const TRIM: Ramp = ['#6a7080', '#8e94a2', '#b0b6c2', '#ced3dc', '#e6e9ee', '#f8f9fb'];
/** warm window and lamp light */
export const WARM: Ramp = ['#5a3416', '#9a5c22', '#d08a34', '#eeb252', '#f8d27a', '#fff0b8', '#fffae6'];

// ── the data hall's inside ──────────────────────────────────
/** black rack steel */
export const RACK: Ramp = ['#08090c', '#0f1116', '#161a21', '#1f242d', '#2a3039', '#363e49', '#46505c'];
/** light grey wall panels */
export const PANEL: Ramp = ['#5e6670', '#78808a', '#959ca4', '#b0b6bd', '#c8cdd2', '#dce0e4', '#eef1f3'];
/** off-white plant cabinets (cooling unit, UPS) */
export const CAB: Ramp = ['#5e646c', '#767c84', '#8e949c', '#a8adb4', '#c0c4ca', '#d6d9de', '#eaecef'];
/** anthracite laminate of the monitoring desk */
export const ANTH: Ramp = ['#14161a', '#1c1f24', '#25292f', '#2f343b', '#3a4048', '#474e57'];
/** pale birch plywood (coffee nook, bench) */
export const PLY: Ramp = ['#6e5a40', '#8a7252', '#a68c66', '#bea47c', '#d2ba92', '#e4cea8', '#f2e2c2'];
/** stainless steel */
export const STEEL: Ramp = ['#3c4148', '#545a62', '#6e747c', '#8a9098', '#a6acb2', '#c4c8cc', '#e2e4e6'];

// ── light colours ───────────────────────────────────────────
export const LED = {
  green: '#5cf08a',
  greenDim: '#1e5a34',
  blue: '#4aa8ff',
  blueDim: '#163a62',
  amber: '#ffb43a',
  amberDim: '#5a3a12',
  red: '#ff4a3a',
  redDim: '#5a1814',
  white: '#e8f6ff',
  cyan: '#62e6f0',
};

/** cable colours: fibre yellow, cat6 blue, red, green, orange, white, purple */
export const CABLES = ['#f2c230', '#3a86e0', '#d8402e', '#3cb45a', '#ee8a2a', '#e8eaee', '#9a5ad0'];
