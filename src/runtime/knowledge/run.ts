// How a run (a chat turn or an agent task) uses Knowledge: the port the runtimes
// call, the tools it is offered, and STRICT's own answer when nothing matches.

import type { KnowledgeRunRecord, KnowledgeSelection } from '../../domain/knowledge';
import { SEARCH_KNOWLEDGE_ID } from './tool';

/** what a run needs from Knowledge (KnowledgeService) */
export interface KnowledgeRunner {
  validSelection(sel: KnowledgeSelection | undefined): KnowledgeSelection | undefined;
  beginRun(runId: string, sel: KnowledgeSelection, message: string, o: { canSearch: boolean }): Promise<{ context: string; sources: number; lexicalOnly: boolean }>;
  finishRun(runId: string, answer: string | undefined): KnowledgeRunRecord | undefined;
}

/** STRICT with nothing retrieved and no way to search: RealmNest answers itself, no model call */
export const STRICT_NOTHING_FOUND = 'The selected Knowledge does not contain information about this.';

/** the tools a run with Knowledge is offered: STRICT keeps only search_knowledge and the active Skills' tools */
export function knowledgeTools(sel: KnowledgeSelection | undefined, canSearch: boolean, base: string[] | undefined, skillToolIds: string[] = []): string[] | undefined {
  if (!sel || !canSearch) return base;
  if (sel.mode === 'strict') return [...new Set([SEARCH_KNOWLEDGE_ID, ...skillToolIds])];
  return [...new Set([...(base ?? []), SEARCH_KNOWLEDGE_ID])];
}
