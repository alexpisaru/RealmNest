// Logistics Port — the harbour's own ramps (dark → light, shadows toward
// purple, lights toward warm cream). Painted steel, rust, wet concrete,
// granite, Hanseatic brick, sea water.
import type { Ramp } from '../../kit4';

export const CONC: Ramp = ['#6e675a', '#807868', '#928a78', '#a39b88', '#aea692', '#bab29e', '#c9c2ad'];
export const ASPH: Ramp = ['#2e3038', '#383a44', '#42454f', '#4b4e58', '#555863', '#61646f'];
export const GRAN: Ramp = ['#4e4a48', '#605b57', '#736d67', '#878079', '#9b938a', '#b0a79b', '#c6bcae'];
export const SETT: Ramp = ['#46404a', '#57515a', '#69626a', '#7c7579', '#8b8386', '#9c9392', '#b2a9a4'];
export const SETTR: Ramp = ['#4a3634', '#5c4440', '#6e524c', '#80615a', '#927168', '#a48378'];
export const PAVER: Ramp = ['#8a7e6c', '#9e917e', '#b0a28e', '#c0b29d', '#ccbfaa', '#dacdb8'];

/** harbour water: deep saturated blue (the reference's #00547e … #07618b … #257aa0), deep → light; then crest and foam */
export const SEA: Ramp = ['#00335a', '#003e6a', '#004a7c', '#04588e', '#0a659c', '#1272a8', '#2080b4', '#3494c2', '#58acd0', '#94cce0', '#d6eef6'];
/** open sea: a touch brighter (#015a8f … #22779e) */
export const OCEAN: Ramp = ['#003660', '#004272', '#035084', '#085e96', '#0e6ba4', '#1878b0', '#2888bc', '#3e9cc8', '#62b4d6', '#9ad2e4', '#daf0f6'];
export const FOAM = ['#f2f9fb', '#cfe6ee', '#a2cfde'];

export const RUST: Ramp = ['#341a12', '#4e2414', '#6a3018', '#86401e', '#a25426', '#bc6c32', '#d08844'];
export const BRICK: Ramp = ['#401a14', '#5a221a', '#74291f', '#8e3426', '#a8432e', '#bc5a3c', '#cf7552'];
export const BRICKY: Ramp = ['#5e3a24', '#764a2e', '#8e5c38', '#a46e44', '#b88252', '#c99864'];
export const MORTAR = '#a89a88';

/** galvanised steel, corrugated sheds, rails */
export const GALV: Ramp = ['#444c58', '#566070', '#6a7484', '#808a98', '#96a0ac', '#adb5bf', '#c6ccd3'];
export const STEEL: Ramp = ['#1a1b20', '#24252b', '#2f3037', '#3b3d45', '#4a4c55', '#5c5f68'];
export const IRON: Ramp = ['#16151a', '#201f25', '#2b2a31', '#38363e', '#47454d', '#58565e'];
export const TIMBER: Ramp = ['#2e2420', '#40322a', '#544236', '#685343', '#7c6551', '#907861', '#a48c74'];
export const TIMBERW: Ramp = ['#3e3a36', '#524c46', '#666058', '#7b746b', '#908980', '#a69f95'];
export const ROPE: Ramp = ['#5a4a30', '#77633e', '#94804f', '#ad9a64', '#c4b37e', '#d8ca9a'];
export const RUBBER: Ramp = ['#121216', '#1b1b20', '#25252b', '#303037', '#3d3d45'];
export const GLASS: Ramp = ['#14304a', '#1c4260', '#285878', '#386e90', '#5088a8', '#78a8c2', '#b4d4e2'];

/** steel paints */
export const P = {
  red: ['#5a1010', '#7e1816', '#a2201e', '#c42c26', '#de3c30', '#f05444', '#fa7a64'],
  blue: ['#0e2458', '#14317a', '#1c449c', '#2556bc', '#3069d6', '#4a82e6', '#6e9ef0'],
  green: ['#0e3218', '#144522', '#1c5a2e', '#25703c', '#30864c', '#44a060', '#64b878'],
  yellow: ['#6a3e04', '#94580a', '#be7810', '#dc9614', '#f0ae1c', '#f8c43c', '#fcd868'],
  teal: ['#0a3634', '#0f4a48', '#156260', '#1c7a76', '#26928c', '#3eaaa2', '#62c2b8'],
  orange: ['#5a1c06', '#80280a', '#a8380e', '#cc4814', '#e45c1e', '#f07836', '#f89a58'],
  white: ['#7a7c80', '#9a9a9a', '#b8b6b2', '#d0cec8', '#e4e0d8', '#f0ece4', '#fbf8f2'],
  grey: ['#30343c', '#3e434c', '#4e545e', '#606670', '#747a86', '#8a909a', '#a2a8b0'],
  brown: ['#3a1a0e', '#522414', '#6c301a', '#863e22', '#9e4e2c', '#b4643c', '#c87e54'],
  maroon: ['#3a0c14', '#521220', '#6c1a2a', '#862434', '#a03040', '#b64652', '#c86468'],
  navy: ['#08142e', '#0e1d42', '#142858', '#1c3670', '#264688', '#34589e', '#4a70b4'],
  sky: ['#103e66', '#165484', '#1e6aa2', '#2a82bc', '#3e9ad0', '#5cb2de', '#86caea'],
  lime: ['#2a3a0c', '#3a5210', '#4c6a16', '#60841e', '#78a028', '#92b83a', '#acce54'],
  cream: ['#5e5446', '#7a6e5c', '#968a74', '#b0a48c', '#c8bca2', '#dcd2b8', '#ece4cc'],
} satisfies Record<string, Ramp>;

export type PaintName = keyof typeof P;

/** Container colours (playable variants first, then the scenery's extras). */
export const BOX_COLOURS: PaintName[] = ['red', 'blue', 'green', 'yellow', 'teal', 'orange', 'white', 'grey', 'brown', 'maroon', 'navy', 'sky'];

/** Warm-purple contact shadow and the pack's outline tone. */
export const SHADOW = '#2a1a2a';
export const INK = '#2a2024';
