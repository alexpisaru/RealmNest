// The one Chat composer. The same element sits centred under the greeting in
// an empty chat and docks at the bottom once the conversation starts (the
// screen only changes the layout around it, so focus and text survive).
//
// [ attached files                               ]
// [ text…                                        ]
// [ + (agent chip)               AI picker   ↑   ]
//
// "+" adds files (also: drop them on the composer, or paste an image); each file reads on its own
// and shows its own error. Typing "@" lists the installed Skills: picking one turns it into a chip
// ([ Workspace Note × ]) that activates it for that message; the text keeps no `@` syntax.

import { ArrowUp, ListPlus, Plus, Sparkles, Square } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AttachmentSource } from '../../domain/attachment';
import { matchSkills, mentionAt, mentionedSkills, type SkillCatalogEntry } from '../../runtime/skills/mentions';
import { useT } from '../context';
import { FileChip, SkillChips, type PendingAttachment } from '../files/FileViews';

const MAX_HEIGHT = 240;
/** what the file dialog offers (the composer still checks every file) */
export const ATTACH_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/*,.md,.markdown,.csv,.tsv,.json,.jsonl,.yaml,.yml,.toml,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.kt,.c,.h,.cpp,.cs,.php,.sh,.ps1,.sql,.log,.svg';

export type { PendingAttachment };

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  queue,
  disabled,
  placeholder,
  leading,
  picker,
  autoFocus,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  skills = [],
  skillIds = [],
  onSkillIds,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  /** a reply is being written: the send button becomes Stop */
  busy?: boolean;
  /** while busy, a message can still be sent: it waits in the conversation's queue */
  queue?: boolean;
  disabled?: boolean;
  placeholder: string;
  leading?: ReactNode;
  picker?: ReactNode;
  autoFocus?: boolean;
  attachments?: PendingAttachment[];
  /** files chosen, dropped or pasted (the screen reads and checks them) */
  onAttach?: (files: File[], source: AttachmentSource) => void;
  onRemoveAttachment?: (key: string) => void;
  /** the Skills `@` can mention */
  skills?: SkillCatalogEntry[];
  /** Skills picked for this message (chips) */
  skillIds?: string[];
  onSkillIds?: (ids: string[]) => void;
}) {
  const t = useT();
  const area = useRef<HTMLTextAreaElement>(null);
  const picker_ = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // the `@` mention being typed, and the highlighted choice
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [pick, setPick] = useState(0);
  const caretAfter = useRef<number | null>(null);
  const choices = mention ? matchSkills(skills, mention.query) : [];
  const open = choices.length > 0;
  // `@id` typed out in full still counts (shown, not removable: delete the text)
  const typed = useMemo(() => mentionedSkills(value, skills.map((s) => s.id)).filter((id) => !skillIds.includes(id)), [value, skills, skillIds]);
  const track = (el: HTMLTextAreaElement) => {
    const m = skills.length && el.selectionStart === el.selectionEnd ? mentionAt(el.value, el.selectionStart) : null;
    setMention((old) => (m?.start !== old?.start || m?.query !== old?.query ? (setPick(0), m) : old));
  };
  const choose = (s: SkillCatalogEntry) => {
    const el = area.current;
    if (!el || !mention) return;
    setMention(null);
    if (onSkillIds) {
      // the chip replaces what was typed: "@work" goes, the Skill stays with the message
      const before = value.slice(0, mention.start);
      const after = value.slice(el.selectionStart).replace(/^[a-z0-9.-]*/i, '');
      const text = before.endsWith(' ') && after.startsWith(' ') ? before + after.slice(1) : before + after;
      caretAfter.current = before.length;
      if (!skillIds.includes(s.id)) onSkillIds([...skillIds, s.id]);
      onChange(text);
      return;
    }
    const before = value.slice(0, mention.start);
    const after = value.slice(el.selectionStart).replace(/^[a-z0-9.-]*/i, '');
    const token = `@${s.id}${after.startsWith(' ') ? '' : ' '}`;
    caretAfter.current = before.length + token.length;
    onChange(before + token + after);
  };
  useLayoutEffect(() => {
    if (caretAfter.current === null || !area.current) return;
    area.current.focus();
    area.current.setSelectionRange(caretAfter.current, caretAfter.current);
    caretAfter.current = null;
  }, [value]);

  // grow with the text up to a limit, then scroll inside
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const loading = attachments.some((a) => a.status === 'loading');
  const sendable = attachments.some((a) => !a.status);
  const canSend = (!!value.trim() || sendable) && !disabled && (!busy || !!queue) && !loading;
  return (
    <form
      className={`composer ${disabled ? 'disabled' : ''} ${dragging ? 'dragging' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
      onClick={(e) => e.target === e.currentTarget && area.current?.focus()}
      onDragOver={(e) => {
        if (!onAttach || disabled || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
      onDrop={(e) => {
        if (!onAttach || disabled) return;
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) onAttach([...e.dataTransfer.files], 'drop');
      }}
    >
      {attachments.length > 0 && (
        <ul className="composer-files" aria-label={t('chat.attached')}>
          {attachments.map((a) => (
            <FileChip key={a.key} a={a} onRemove={onRemoveAttachment ? () => onRemoveAttachment(a.key) : undefined} />
          ))}
        </ul>
      )}
      {open && (
        <ul className="mention-pop" role="listbox" aria-label={t('skills.mentionList')}>
          {choices.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === pick}>
              <button
                type="button"
                className={i === pick ? 'on' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setPick(i)}
                onClick={() => choose(s)}
              >
                <Sparkles size={14} />
                <span>
                  <b>{s.name}</b>
                  <small>@{s.id}</small>
                </span>
                <em>{s.description}</em>
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={area}
        rows={1}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          track(e.target);
        }}
        onSelect={(e) => track(e.currentTarget)}
        onBlur={() => setMention(null)}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setPick((p) => (p + (e.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length);
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              choose(choices[Math.min(pick, choices.length - 1)]);
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setMention(null);
              return;
            }
          }
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
        onPaste={(e) => {
          // a pasted screenshot or copied file becomes an attachment
          const files = [...e.clipboardData.files];
          if (onAttach && files.length) {
            e.preventDefault();
            onAttach(files, 'paste');
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={t('a.chat.message')}
        aria-autocomplete={skills.length ? 'list' : undefined}
        aria-expanded={skills.length ? open : undefined}
      />
      {(skillIds.length > 0 || typed.length > 0) && (
        <div className="composer-skills" aria-live="polite">
          <SkillChips ids={skillIds} catalog={skills} onRemove={onSkillIds ? (id) => onSkillIds(skillIds.filter((x) => x !== id)) : undefined} />
          <SkillChips ids={typed} catalog={skills} />
        </div>
      )}
      <div className="composer-bar">
        {onAttach && (
          <>
            <button type="button" className="composer-add" onClick={() => picker_.current?.click()} disabled={disabled} aria-label={t('chat.attach')} title={t('chat.attach')}>
              <Plus size={18} />
            </button>
            <input
              ref={picker_}
              type="file"
              multiple
              hidden
              accept={ATTACH_ACCEPT}
              onChange={(e) => {
                if (e.target.files?.length) onAttach([...e.target.files], 'picker');
                e.target.value = '';
              }}
            />
          </>
        )}
        {leading}
        <span className="composer-gap" />
        {picker}
        {busy && queue && canSend && (
          <button type="submit" className="composer-send" aria-label={t('chat.queue')} title={t('chat.queue')}>
            <ListPlus size={17} />
          </button>
        )}
        {busy && onStop ? (
          <button type="button" className="composer-send stop" onClick={onStop} aria-label={t('chat.stop')} title={t('chat.stop')}>
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button type="submit" className="composer-send" disabled={!canSend} aria-label={t('chat.send')} title={loading ? t('files.waiting') : t('chat.send')}>
            <ArrowUp size={17} />
          </button>
        )}
      </div>
      {dragging && <div className="composer-drop">{t('chat.dropHere')}</div>}
    </form>
  );
}
