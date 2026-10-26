// How a run uses the Web: the port the runtimes call (WebService implements it).

import type { KnowledgeMode } from '../../domain/knowledge';
import type { WebRunRecord } from '../../domain/web';

export interface WebRunner {
  /** nativeSearch: the model searches the web itself (ProviderCapabilities.nativeWebInTurns), so it is told so */
  beginRun(runId: string, o: { canFetch: boolean; userTexts: string[]; knowledgeMode?: KnowledgeMode; nativeSearch?: boolean }): Promise<{ context: string; tools: boolean }>;
  finishRun(runId: string, answer: string | undefined): WebRunRecord | undefined;
  skipped(reason: string): WebRunRecord;
}
