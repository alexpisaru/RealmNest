// Wire format between the browser and the dev-server process host.
// POST {BRIDGE_PATH}/run    body: BridgeRunRequest  → NDJSON stream of BridgeMessage
// POST {BRIDGE_PATH}/locate body: { program }       → ProgramLocation
// Every request carries the per-server token from <meta name={BRIDGE_META}>.

import type { ProcessEnd } from './types';

export const BRIDGE_PATH = '/__realmnest/process';
export const BRIDGE_META = 'realmnest-process-bridge';
export const BRIDGE_HEADER = 'x-realmnest-bridge';

export interface BridgeRunRequest {
  program: string;
  args: string[];
  stdin?: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export type BridgeMessage =
  | { t: 'spawn' }
  | { t: 'out'; d: string }
  | { t: 'err'; d: string }
  | { t: 'end'; end: ProcessEnd };
