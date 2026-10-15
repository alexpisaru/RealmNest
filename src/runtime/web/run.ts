// How a run uses the Web: the port the runtimes call (WebService implements it).

import type { KnowledgeMode } from '../../domain/knowledge';
import type { WebRunRecord } from '../../domain/web';

export interface WebRunner {
  beginRun(runId: string, o: { canFetch: boolean; userTexts: string[]; knowledgeMode?: KnowledgeMode }): Promise<{ context: string; tools: boolean }>;
  finishRun(runId: string, answer: string | undefined): WebRunRecord | undefined;
  skipped(reason: string): WebRunRecord;
}
