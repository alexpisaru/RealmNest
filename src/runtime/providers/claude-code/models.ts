// The Claude models a Claude account can use through Claude Code (`--model <id>`). The CLI
// cannot list them, so this is the catalogue; every id was run with the CLI on 2026-10-14.
// Every one of them takes every `--effort` level (checked with Claude Code 2.1.295).

import type { ModelInfo } from '../types';

/** `--effort` levels, lowest first (args.ts allows exactly these) */
export const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

const claude = (id: string, label: string): ModelInfo => ({
  id,
  label,
  providerLabel: 'anthropic',
  inputModalities: ['text', 'image', 'file'],
  outputModalities: ['text'],
  supportedParameters: ['tools', 'reasoning', 'structured_outputs'],
  reasoning: { efforts: CLAUDE_EFFORTS },
});

export const CLAUDE_MODELS: ModelInfo[] = [
  claude('claude-opus-5-5', 'Claude Opus 5.5'),
  claude('claude-fable-5-1', 'Claude Fable 5.1'),
  claude('claude-sonnet-5-5', 'Claude Sonnet 5.5'),
  claude('claude-haiku-5-5', 'Claude Haiku 5.5'),
];
