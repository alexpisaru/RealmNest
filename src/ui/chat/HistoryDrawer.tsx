// Chat history, out of the way until asked for: a drawer over the chat with
// New chat, a search, and the conversations grouped as Pinned / Today /
// Yesterday / Previous 7 days / Older. Each row can be renamed, pinned or
// deleted in place.

import { MoreHorizontal, Pin, PinOff, Plus, Search, Trash2, X, PencilLine } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation } from '../../domain/conversation';
import type { TKey } from '../../i18n';
import { ChatError } from '../../runtime/chat/conversationRuntime';
import { groupConversations, searchConversations } from '../../runtime/chat/history';
import { useConnectionLabel } from '../connections';
import { useApp, useChat, useServices, useT } from '../context';

export function HistoryDrawer({ open, onClose, selectedId, onSelect, onNew }: { open: boolean; onClose: () => void; selectedId: string | null; onSelect: (id: string) => void; onNew: () => void }) {
  const t = useT();
  const chat = useChat();
  const [q, setQ] = useState('');
  const list = chat.list();
  const groups = useMemo(() => groupConversations(searchConversations(list, q)), [list, q, chat.getVersion()]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !(e.target instanceof HTMLInputElement && e.target.dataset.rename) && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="history-scrim" onClick={onClose} />
      <aside className="history" aria-label={t('chat.history')}>
        <header>
          <b>{t('chat.history')}</b>
          <button className="icon-btn" onClick={onClose} aria-label={t('chat.close')} title={t('chat.close')}>
            <X size={16} />
          </button>
        </header>
        <button className="history-new" onClick={onNew}>
          <Plus size={16} /> {t('chat.new')}
        </button>
        <label className="history-search">
          <Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('chat.search')} aria-label={t('chat.search')} />
        </label>
        <div className="history-list">
          {list.length === 0 && <p className="muted small">{t('chat.none')}</p>}
          {groups.map((g) => (
            <section key={g.key}>
              <h4>{t(`chat.group.${g.key}` as TKey)}</h4>
              <ul>
                {g.items.map((c) => (
                  <HistoryItem key={c.id} c={c} on={c.id === selectedId} onSelect={() => onSelect(c.id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}

function HistoryItem({ c, on, onSelect }: { c: Conversation; on: boolean; onSelect: () => void }) {
  const t = useT();
  const chat = useChat();
  const st = useApp();
  const { store } = useServices();
  const labelOf = useConnectionLabel();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const box = useRef<HTMLLIElement>(null);
  const agent = c.agentId ? st.characters.find((x) => x.id === c.agentId)?.name : undefined;
  // the runtime's placeholder title, in the user's language
  const title = c.title === 'New conversation' ? t('a.chat.untitled') : c.title;

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setMenu(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  const act = (fn: () => void) => {
    try {
      fn();
    } catch (err) {
      store.toast(err instanceof ChatError ? err.message : String(err));
    }
  };

  return (
    <li ref={box} className={`history-item ${on ? 'on' : ''}`}>
      {renaming ? (
        <input
          className="history-rename"
          data-rename="1"
          autoFocus
          defaultValue={c.title}
          aria-label={t('chat.rename')}
          onBlur={(e) => (e.target.value.trim() && e.target.value.trim() !== c.title && act(() => chat.rename(c.id, e.target.value)), setRenaming(false))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') (e.currentTarget.value = c.title), setRenaming(false);
          }}
        />
      ) : confirm ? (
        <div className="history-confirm">
          <span>{t('chat.deleteConfirm')}</span>
          <button className="link-btn danger" onClick={() => act(() => chat.remove(c.id))}>
            {t('chat.delete')}
          </button>
          <button className="link-btn" onClick={() => setConfirm(false)}>
            {t('creator.cancel')}
          </button>
        </div>
      ) : (
        <button className="history-open" onClick={onSelect} title={title}>
          <span>
            {c.pinned && <Pin size={11} className="pin-mark" aria-label={t('chat.group.pinned')} />}
            {title}
          </span>
          <small>
            {agent ?? labelOf(c.connectionId)}
            {chat.isBusy(c.id) ? ' · …' : ''}
          </small>
        </button>
      )}
      {!renaming && !confirm && (
        <button className="icon-btn history-more" onClick={() => setMenu((v) => !v)} aria-label={`${t('chat.actions')}: ${title}`} aria-expanded={menu}>
          <MoreHorizontal size={15} />
        </button>
      )}
      {menu && (
        <div className="menu-pop" role="menu">
          <button role="menuitem" onClick={() => (setMenu(false), setRenaming(true))}>
            <PencilLine size={14} /> {t('chat.rename')}
          </button>
          <button role="menuitem" onClick={() => (setMenu(false), act(() => chat.setPinned(c.id, !c.pinned)))}>
            {c.pinned ? <PinOff size={14} /> : <Pin size={14} />} {c.pinned ? t('chat.unpin') : t('chat.pin')}
          </button>
          <button role="menuitem" className="danger" onClick={() => (setMenu(false), setConfirm(true))} disabled={chat.isBusy(c.id)}>
            <Trash2 size={14} /> {t('chat.delete')}
          </button>
        </div>
      )}
    </li>
  );
}
