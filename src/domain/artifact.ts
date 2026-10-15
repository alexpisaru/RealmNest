// ─────────────────────────────────────────────────────────────
// Artifacts: files RealmNest's runs PRODUCE (attachments are what goes IN).
//
//   a tool writes report.md in the workspace ─┐
//   an MCP tool returns an image              ├─▶ ArtifactService.register ─▶ Artifact
//   (later: anything else that makes a file) ─┘        (bytes in the FileStore, by storageRef)
//
// An Artifact always knows where it came from (provenance) and what it was made from (lineage:
// source attachments and artifacts). Deleting one removes its bytes, never its history: the
// record stays as a tombstone. docs/FILES.md has the rules.
// ─────────────────────────────────────────────────────────────

export type ArtifactKind = 'image' | 'document' | 'text' | 'spreadsheet' | 'presentation' | 'audio' | 'video' | 'archive' | 'data' | 'code' | 'other';
export const ARTIFACT_KINDS: ArtifactKind[] = ['image', 'document', 'text', 'spreadsheet', 'presentation', 'audio', 'video', 'archive', 'data', 'code', 'other'];

/** how a Skill came to be active in a run */
export type SkillActivationMode = 'explicit' | 'assigned' | 'automatic';

export interface ArtifactSkillRef {
  id: string;
  version: string;
  name: string;
  activation: SkillActivationMode;
}

/** where an Artifact came from: every id that is known */
export interface ArtifactProvenance {
  /** how it was made: a file a tool wrote, a binary part of an MCP result, or added by hand */
  origin: 'tool-file' | 'tool-part' | 'manual' | 'crew' | 'workflow';
  /** a workflow run's output node */
  workflowRunId?: string;
  /** a Crew run's output or final deliverable */
  crewRunId?: string;
  createdByAgentId?: string;
  conversationId?: string;
  /** the assistant message of the chat turn that produced it */
  messageId?: string;
  taskId?: string;
  runId?: string;
  toolId?: string;
  toolCallId?: string;
  /** an MCP server's id, for tools of a server */
  serverId?: string;
  /** the path the tool wrote, relative to its workspace (never absolute) */
  workspacePath?: string;
  skills?: ArtifactSkillRef[];
  sourceAttachmentIds: string[];
  sourceArtifactIds: string[];
  createdAt: number;
}

export interface Artifact {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: ArtifactKind;
  /** the bytes in the FileStore (`sha256:<hex>`); absent once deleted */
  storageRef?: string;
  sha256?: string;
  createdAt: number;
  updatedAt?: number;
  provenance: ArtifactProvenance;
  metadata?: Record<string, string | number | boolean>;
  /** set when the user deleted it: the record stays for history */
  deletedAt?: number;
}

/** the views of the Artifacts screen */
export type ArtifactView = 'all' | 'images' | 'documents' | 'other';
export function inView(a: Pick<Artifact, 'kind'>, v: ArtifactView): boolean {
  if (v === 'all') return true;
  if (v === 'images') return a.kind === 'image';
  if (v === 'documents') return ['document', 'text', 'spreadsheet', 'presentation', 'code', 'data'].includes(a.kind);
  return ['audio', 'video', 'archive', 'other'].includes(a.kind);
}
