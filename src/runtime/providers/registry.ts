// The providers this RealmNest install knows about. UI and runtime look
// providers up here by id; nothing else imports an adapter directly.

import type { AIProvider } from './types';

export class ProviderRegistry {
  private providers = new Map<string, AIProvider>();

  register(provider: AIProvider): this {
    if (!provider.id) throw new Error('Provider id is required');
    if (this.providers.has(provider.id)) throw new Error(`Provider "${provider.id}" is already registered`);
    this.providers.set(provider.id, provider);
    return this;
  }

  unregister(id: string): boolean {
    return this.providers.delete(id);
  }

  get(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  /** like get(), but throws for an unknown id */
  require(id: string): AIProvider {
    const p = this.providers.get(id);
    if (!p) throw new Error(`Unknown provider "${id}"`);
    return p;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  /** in registration order */
  list(): AIProvider[] {
    return [...this.providers.values()];
  }
}
