// How a run (an agent chat turn or an agent task) uses Memory: the port the runtimes call.
// Direct chats (no agent) have no memory: memory belongs to the logical agent, whatever
// connection or model it runs on.

import type { MemoryExtractionRecord, MemoryRunRecord } from '../../domain/memory';
import type { KnowledgeMode } from '../../domain/knowledge';

export interface MemoryRunner {
  usable(agentId: string): boolean;
  beginRun(runId: string, agentId: string, message: string, o: { canSearch: boolean; knowledgeMode?: KnowledgeMode }): Promise<{ context?: string; tool: boolean }>;
  finishRun(runId: string, completed: boolean): MemoryRunRecord | undefined;
  afterRun(i: {
    runId: string;
    agentId: string;
    sourceType: 'chat' | 'agent_run';
    conversationId?: string;
    messageId?: string;
    taskId?: string;
    userTexts: string[];
    answer: string;
    connectionId: string;
    model?: string;
    providerId?: string;
  }): Promise<MemoryExtractionRecord | undefined>;
}

/** prepend a context block to the message a provider gets ("# Message" once) */
export function withContext(content: string, context: string, heading = 'Message'): string {
  const framed = /^# (Knowledge|Memory|Web)\b/.test(content) && content.includes(`\n# ${heading}\n`);
  return framed ? `${context}\n\n${content}` : `${context}\n\n# ${heading}\n${content}`;
}
