// Small shared pieces for AI connections: a selector of the user's saved
// connections (never raw provider ids) and a status label.

import type { AIConnection, ConnectionStatus } from '../domain/connection';
import type { TKey } from '../i18n';
import { useConnections, useT } from './context';

/** a connection status in the user's language ('Connected', 'Sign-in required'…) */
export function statusLabel(t: (k: TKey) => string, status: ConnectionStatus): string {
  return t(`a.conn.${status}` as TKey);
}

export function ConnectionStatusBadge({ c }: { c: AIConnection | undefined }) {
  const t = useT();
  const status = c?.status ?? 'disconnected';
  return (
    <span className={`conn-status ${status}`} title={c?.statusMessage ? `${c.statusMessage}${c.statusHint ? ` ${c.statusHint}` : ''}` : undefined}>
      <i /> {c ? statusLabel(t, status) : t('a.conn.noConnection')}
    </span>
  );
}

/** "Alex Claude · Claude Code" */
export function useConnectionLabel() {
  const t = useT();
  const connections = useConnections();
  return (id: string | undefined) => {
    const c = connections.get(id);
    if (!c) return t('a.conn.noAI');
    const provider = connections.catalog.get(c.providerId)?.name ?? c.providerId;
    return `${c.name}${c.name === provider ? '' : ` · ${provider}`}${c.removedAt ? ` ${t('a.conn.removed')}` : ''}`;
  };
}

/** value of the "use the routing policy" option */
export const AUTO_ROUTE = '__auto__';

export function ConnectionSelect({
  value,
  onChange,
  disabled,
  label,
  autoLabel,
}: {
  value: string | undefined;
  onChange: (id: string) => void;
  disabled?: boolean;
  label?: string;
  /** offer "Auto" (resolve the routing policy) with this label */
  autoLabel?: string;
}) {
  const t = useT();
  const connections = useConnections();
  const labelOf = useConnectionLabel();
  const active = connections.list();
  const current = connections.get(value);
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label ?? t('a.conn.label')}>
      {autoLabel && <option value={AUTO_ROUTE}>{autoLabel}</option>}
      {!current && value !== AUTO_ROUTE && <option value="">{t('a.conn.choose')}</option>}
      {current?.removedAt && <option value={current.id}>{labelOf(current.id)}</option>}
      {active.map((c) => (
        <option key={c.id} value={c.id}>
          {labelOf(c.id)}
        </option>
      ))}
    </select>
  );
}
