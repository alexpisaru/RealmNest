// ─────────────────────────────────────────────────────────────
// ProcessRunner: the one way RealmNest starts local programs.
//
// CLI-based providers (Claude Code today) describe *what* to run; a runner
// decides *where*: Node in the dev server and in tests, Tauri in the desktop
// app later. Callers never pass an executable path or a shell string: they
// name a program id that the host resolves and checks against its own
// allowlist (see process/node/host.ts).
// ─────────────────────────────────────────────────────────────

export interface ProcessSpec {
  /** logical program id, resolved by the host (e.g. 'claude'), never a path */
  program: string;
  /** passed as separate argv entries, no shell involved */
  args: readonly string[];
  /** written to stdin, then stdin is closed */
  stdin?: string;
  /** absolute working directory; the host picks a safe default when omitted */
  cwd?: string;
  /** extra environment variables; the host accepts only those the program allows */
  env?: Readonly<Record<string, string>>;
  /** the process tree is killed when it runs longer than this */
  timeoutMs?: number;
  /** aborting kills the process tree */
  signal?: AbortSignal;
}

export interface ProcessCallbacks {
  /** the process is running */
  onSpawn?(): void;
  /** stdout as UTF-8 text, in arbitrary chunks */
  onStdout?(chunk: string): void;
  onStderr?(chunk: string): void;
}

export type SpawnErrorCode =
  /** the program is not installed / could not be found */
  | 'not_found'
  /** the host refused the request (program, arguments or cwd not allowed) */
  | 'denied'
  /** no host can run processes here (plain browser build) */
  | 'host_unavailable'
  /** spawning failed for another reason */
  | 'failed';

/** how a process run ended; exactly one per run */
export type ProcessEnd =
  | { kind: 'exit'; code: number | null; signal: string | null }
  | { kind: 'timeout'; timeoutMs: number }
  | { kind: 'cancelled' }
  | { kind: 'spawn_error'; code: SpawnErrorCode; message: string };

export interface ProgramLocation {
  found: boolean;
  /** absolute path of the executable */
  path?: string;
  /** how it was found, e.g. 'env', 'path', 'desktop-app' */
  source?: string;
}

export interface ProcessRunner {
  /** whether this runner can start processes at all in this environment */
  readonly available: boolean;
  run(spec: ProcessSpec, callbacks?: ProcessCallbacks): Promise<ProcessEnd>;
  /** where the host would find a program (for status messages) */
  locate?(program: string): Promise<ProgramLocation>;
}

/** A runner for environments that cannot start processes. */
export class UnavailableProcessRunner implements ProcessRunner {
  readonly available = false;
  constructor(private reason = 'This build of RealmNest cannot start local programs.') {}
  async run(): Promise<ProcessEnd> {
    return { kind: 'spawn_error', code: 'host_unavailable', message: this.reason };
  }
  async locate(): Promise<ProgramLocation> {
    return { found: false };
  }
}
