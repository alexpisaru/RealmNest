// Model capabilities from model metadata only (modalities, accepted request
// parameters, reasoning info), never from model names. What the metadata
// does not settle stays unknown. Works for any provider whose catalogue fills
// ModelInfo; OpenRouter is the first (docs/CAPABILITIES.md lists the mapping).

import type { CapabilityDescriptor, CapabilityId, CapabilitySet, Support } from '../../domain/capability';
import type { ModelInfo } from '../providers/types';

export function modelCapabilities(m: ModelInfo, origin: string): CapabilitySet {
  const set: CapabilitySet = {};
  const put = (id: CapabilityId, support: Support, evidence: string) => {
    set[id] = { id, support, source: { level: 'model', origin, evidence, via: 'native' } } satisfies CapabilityDescriptor;
  };
  const input = m.inputModalities ?? [];
  const output = m.outputModalities ?? [];
  const params = m.supportedParameters ?? [];

  if (input.length && output.length) put('text.chat', input.includes('text') && output.includes('text') ? 'supported' : 'unsupported', `modalities ${input.join('+')} → ${output.join('+')}`);
  if (input.length) {
    put('vision.input', input.includes('image') ? 'supported' : 'unsupported', `input modalities: ${input.join(', ')}`);
    put('files.input', input.includes('file') ? 'supported' : 'unsupported', `input modalities: ${input.join(', ')}`);
  }
  if (output.length) {
    put('image.generate', output.includes('image') ? 'supported' : 'unsupported', `output modalities: ${output.join(', ')}`);
    // editing needs image output; the catalogue never says more than that
    if (!output.includes('image')) put('image.edit', 'unsupported', `no image output (${output.join(', ')})`);
  }
  if (params.length) {
    put('tools.calling', params.includes('tools') ? 'supported' : 'unsupported', params.includes('tools') ? 'accepts the "tools" parameter' : 'does not list the "tools" parameter');
    const so = params.includes('structured_outputs') || params.includes('response_format');
    put('structured.output', so ? 'supported' : 'unsupported', so ? 'accepts structured_outputs / response_format' : 'lists neither structured_outputs nor response_format');
    if (params.includes('web_search_options')) put('web.search', 'supported', 'accepts "web_search_options" (provider-native web search)');
  }
  // reasoning: positive evidence only; absence proves nothing
  if (m.reasoning) put('text.reasoning', 'supported', `reasoning metadata${m.reasoning.mandatory ? ' (always on)' : ''}${m.reasoning.efforts?.length ? `, efforts ${m.reasoning.efforts.join('/')}` : ''}`);
  else if (params.includes('reasoning') || params.includes('include_reasoning')) put('text.reasoning', 'supported', 'accepts the "reasoning" parameter');
  return set;
}

/** support of one capability on a model (unknown when the metadata does not say) */
export const modelSupport = (m: ModelInfo, cap: CapabilityId, origin = 'model catalogue'): Support => modelCapabilities(m, origin)[cap]?.support ?? 'unknown';
