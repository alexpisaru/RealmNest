// Chat: persistent conversations with an agent or directly with an AI connection.
// All logic lives in ConversationRuntime; this screen only shows it and
// forwards the user's actions.
//
// Layout (docs/UI_UX.md): a new chat is a greeting with the composer in the
// middle; once it starts, the conversation fills a centred reading column and
// the same composer docks at the bottom, with the text fading out behind it.
// History lives in a drawer; the connection/model picker lives in the composer.

import { ArrowDown, History, MoreHorizontal, PencilLine, Pin, PinOff, RotateCcw, SquarePen, Trash2, Wrench, X } from 'lucide-react';
import { ToolCallList } from '../tools/ToolCalls';
import { MAX_OFFERED_TOOLS } from '../../runtime/tools/service';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AttachmentInput, AttachmentKind } from '../../domain/attachment';
import type { ChatMessage, Conversation } from '../../domain/conversation';
import { ChatError } from '../../runtime/chat/conversationRuntime';
import { AIModelPicker, type AITarget } from '../chat/AIModelPicker';
import { EffortPicker, useEfforts } from '../chat/EffortPicker';
import { UsageRing } from '../usage/UsageRing';
import { AgentPicker } from '../chat/AgentPicker';
import { ChatComposer } from '../chat/ChatComposer';
import { ArtifactStrip, SkillChips, SkillsUsed, StoredAttachment, useArtifacts, usePendingFiles } from '../files/FileViews';
import { fileMessage } from '../files/importFiles';
import type { SkillCatalogEntry } from '../../runtime/skills/mentions';
import { shortModelName } from '../chat/AIModelPicker';
import { HistoryDrawer } from '../chat/HistoryDrawer';
import { useApp, useCapabilities, useChat, useConnections, useServices, useSkills, useT } from '../context';
import { Button } from '../kit';
import { CitationPanel, CitedText, KnowledgeControl } from '../knowledge/common';
import { WebSources, WebToggle } from '../web/WebViews';
import { MemoryProposed, MemoryUsed } from '../memory/MemoryViews';
import type { KnowledgeSelection } from '../../domain/knowledge';
import { greeting } from '../greeting';

/** how close to the end counts as "following the conversation" */
const STICK_PX = 96;

export function ChatScreen() {
  const chat = useChat();
  const connections = useConnections();
  const capabilities = useCapabilities();
  const { live, store } = useServices();
  const st = useApp();
  const t = useT();

  // what to show: a conversation, or a new one (null) — asked for by Home, the menu or the drawer
  const [selectedId, setSelectedId] = useState<string | null>(() => (st.chatRequest.conversationId && chat.get(st.chatRequest.conversationId) ? st.chatRequest.conversationId : null));
  const requestAt = useRef(st.chatRequest.at);
  useEffect(() => {
    if (st.chatRequest.at === requestAt.current) return;
    requestAt.current = st.chatRequest.at;
    setSelectedId(st.chatRequest.conversationId ?? null);
  }, [st.chatRequest]);
  const conv = selectedId ? chat.get(selectedId) : undefined;

  // a conversation not created yet: who to talk to and through what
  const [draftAgent, setDraftAgent] = useState('');
  const [draftTarget, setDraftTarget] = useState<AITarget>(() => (capabilities.targets('text.chat').length ? { auto: true } : { connectionId: connections.defaultId() ?? '' }));
  const [text, setText] = useState('');
  // Skills picked with @ for the next message (chips)
  const [skillIds, setSkillIds] = useState<string[]>([]);
  // RealmNest tools for a chat not created yet (a started chat keeps its own switch)
  const [draftTools, setDraftTools] = useState(false);
  // Knowledge for a chat not created yet (a started chat keeps its own)
  const [draftKnowledge, setDraftKnowledge] = useState<KnowledgeSelection | undefined>();
  // Web for a chat not created yet (undefined: the agent's setting, else off)
  const [draftWeb, setDraftWeb] = useState<boolean | undefined>();
  // reasoning effort for a chat not created yet (undefined: the agent's, else the model's default; '': the default)
  const [draftEffort, setDraftEffort] = useState<string | undefined>();
  const skills = useSkills();
  const skillCatalog = useMemo(() => skills.catalog(), [skills, skills.getVersion()]);
  const { tools } = useServices();
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [seed] = useState(() => Math.floor(Math.random() * 1000));

  const nameOf = (id?: string) => (id ? (st.characters.find((c) => c.id === id)?.name ?? t('a.chat.unknownAgent')) : undefined);
  const agentDef = !conv && draftAgent ? live.agent(draftAgent) : undefined;

  // the target the composer shows: the conversation's, the agent's, or the draft's
  const target: AITarget = conv
    ? { connectionId: conv.connectionId, model: conv.model }
    : agentDef
      ? agentDef.useDefaultRoute
        ? { auto: true }
        : { connectionId: agentDef.connectionId, model: draftTarget.auto ? agentDef.model : draftTarget.connectionId === agentDef.connectionId ? (draftTarget.model ?? agentDef.model) : agentDef.model }
      : draftTarget;
  const route = target.auto ? capabilities.resolveRoute('text.chat') : undefined;
  const connectionId = target.auto ? route?.target?.connectionId : target.connectionId;
  const connection = connections.get(connectionId);
  const busy = conv ? chat.isBusy(conv.id) : false;
  const lost = conv?.providerSession?.state === 'lost';
  const gone = !!conv && (!connection || !!connection.removedAt);

  const act = (fn: () => void) => {
    setError('');
    try {
      fn();
    } catch (err) {
      setError(err instanceof ChatError ? err.message : String(err));
    }
  };

  const modelId = target.auto ? route?.target?.modelId : (target.model ?? connection?.preferredModel);
  const modelName = connectionId ? (shortModelName(connections.models(connectionId).find((m) => m.id === modelId), modelId) ?? connection?.name ?? '') : '';
  // reasoning effort: only for a model that lists levels
  const effortChoice = useEfforts(connectionId, modelId);
  const effort = conv ? conv.effort : (draftEffort ?? agentDef?.effort);

  /** why the chosen AI cannot take this kind of file (undefined: it can) */
  const refuse = (kind: AttachmentKind): string | undefined => {
    if (kind === 'text') return undefined;
    if (!connectionId) return t('chat.attachNoAI');
    const eff = capabilities.effective(connectionId, modelId)[kind === 'image' ? 'vision.input' : 'files.input'];
    const what = t(kind === 'image' ? 'chat.whatImages' : 'chat.whatPdfs');
    // PDFs only where the model reads them itself (no paid conversion on the provider's side)
    if (eff.support === 'unsupported' || !eff.ready || (kind === 'pdf' && eff.support !== 'supported')) return t('chat.attachUnsupported', { model: modelName, what });
    return undefined;
  };

  // each file reads and is stored on its own (FileStore), with its own error
  const pending = usePendingFiles(refuse);
  const artifacts = useArtifacts();

  const send = (content = text, again?: { files: AttachmentInput[]; skillIds?: string[] }) =>
    act(() => {
      if (!again && pending.loading) throw new ChatError(t('files.waiting'));
      // a new installation has none (0.11.1): say where to add one, in the user's language
      if (!connections.list().length) throw new ChatError(t('chat.noConnections'));
      const outgoing = again?.files ?? pending.ready;
      // the AI may have changed since the files were added
      for (const f of outgoing) {
        const no = refuse(f.kind);
        if (no) throw new ChatError(no);
      }
      const model = target.auto ? route?.target?.modelId : target.model;
      // a connection with a model catalogue (e.g. OpenRouter) needs an explicit model
      if (!model && !connection?.preferredModel && connectionId && connections.models(connectionId).length) throw new ChatError(t('a.chat.chooseModel'));
      let c = conv;
      if (!c) {
        const m = !target.auto ? target.model : undefined;
        // Auto resolves the routing policy now; a chosen connection is used exactly
        const e = draftEffort !== undefined ? { effort: draftEffort } : {};
        c = draftAgent
          ? chat.create({ agentId: draftAgent, toolsEnabled: draftTools, ...(m && m !== agentDef?.model && { model: m }), ...e })
          : target.auto
            ? chat.create({ auto: true, toolsEnabled: draftTools, ...e })
            : chat.create({ connectionId: target.connectionId, toolsEnabled: draftTools, ...(m && { model: m }), ...e });
        if (draftKnowledge) chat.setKnowledge(c.id, draftKnowledge);
        if (draftWeb !== undefined) chat.setWeb(c.id, draftWeb);
        setSelectedId(c.id);
      }
      chat.send(c.id, content, outgoing, { skillIds: again ? (again.skillIds ?? []) : skillIds });
      if (!again) {
        setText('');
        setSkillIds([]);
        pending.clear();
      }
    });

  const pickTarget = (v: AITarget) =>
    act(() => {
      if (conv) {
        // a started conversation keeps its connection; only the model can change
        if (!v.auto && v.connectionId === conv.connectionId) chat.configure(conv.id, { model: v.model ?? '' });
        else if (!v.auto && !conv.messages.length) chat.configure(conv.id, { connectionId: v.connectionId, model: v.model ?? '' });
      } else setDraftTarget(v);
    });

  const newChat = () => {
    setSelectedId(null);
    setHistoryOpen(false);
    setError('');
    setText('');
    setSkillIds([]);
    setDraftKnowledge(undefined);
    setDraftWeb(undefined);
    setDraftEffort(undefined);
    pending.clear();
  };

  // Use in Chat / Send to Agent: a new chat that starts with the artifact attached
  useEffect(() => {
    if (!st.handoff) return;
    const h = store.takeHandoff();
    if (!h) return;
    newChat();
    if (h.agentId) setDraftAgent(h.agentId);
    artifacts
      .asAttachment(h.artifactId)
      .then((a) => {
        // the chosen AI may not take it: shown on the chip (send checks again)
        const no = refuse(a.kind);
        pending.set([{ ...a, key: `art-${h.artifactId}`, ...(no && { status: 'error' as const, error: no }) }]);
      })
      .catch((e) => setError(fileMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.handoff]);

  // ── scrolling: follow new text only while the reader is at the end ──
  const scroller = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLElement>(null);
  const [atEnd, setAtEnd] = useState(true);
  const stick = useRef(true);
  const last = conv?.messages.at(-1);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const end = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    stick.current = end;
    setAtEnd(end);
  };
  const toEnd = (smooth = false) => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  useLayoutEffect(() => {
    stick.current = true;
    setAtEnd(true);
    toEnd();
  }, [conv?.id]);
  useLayoutEffect(() => {
    if (stick.current) toEnd();
  }, [conv?.messages.length, last?.content.length, last?.status]);
  // the fade and the bottom space follow the composer's real height
  useLayoutEffect(() => {
    const el = dock.current;
    if (!el || !surface.current) return;
    const ro = new ResizeObserver(() => surface.current?.style.setProperty('--dock-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const empty = !conv || conv.messages.length === 0;
  const hello = useMemo(() => greeting(t, new Date(), st.settings.displayName, seed), [t, st.settings.displayName, seed]);
  const agentName = conv ? nameOf(conv.agentId) : nameOf(draftAgent || undefined);
  const locked = conv ? (conv.messages.length ? conv.connectionId : undefined) : agentDef && !agentDef.useDefaultRoute ? agentDef.connectionId : undefined;
  const lockedReason = conv?.messages.length ? t('picker.fixed') : agentDef && !agentDef.useDefaultRoute ? t('picker.agentFixed', { name: agentName ?? '' }) : undefined;

  // tools: only when this connection and model can call them
  const toolsOn = conv ? !!conv.toolsEnabled : draftTools;
  const toolOffer = connectionId ? tools.offer(connectionId, target.auto ? route?.target?.modelId : (target.model ?? connection?.preferredModel), undefined) : undefined;
  const toolsPossible = !!toolOffer && toolOffer.reason !== 'model';
  const toolsButton = (
    <button
      type="button"
      className={`composer-tools ${toolsOn && toolsPossible ? 'on' : ''}`}
      aria-label={t('tools.chatToggle')}
      disabled={!toolsPossible || busy}
      aria-pressed={toolsOn && toolsPossible}
      onClick={() => (conv ? act(() => chat.setTools(conv.id, !toolsOn)) : setDraftTools(!toolsOn))}
      title={!toolsPossible ? t('tools.chatNoModel') : `${toolsOn ? t('tools.chatOn') : t('tools.chatOff')}${toolOffer?.capped ? ` ${t('tools.capped', { n: toolOffer.capped, max: MAX_OFFERED_TOOLS })}` : ''}`}
    >
      <Wrench size={15} />
    </button>
  );
  // a Skill an older chat was set to for every message (Skills are now mentioned with @): shown, removable
  const chatSkill = conv?.skillId ? skills.get(conv.skillId) : undefined;
  const legacySkill = conv?.skillId ? (
    <button type="button" className="composer-skill-set" disabled={busy} onClick={() => act(() => chat.setSkill(conv.id, undefined))} title={t('skills.chatSetClear')}>
      @{chatSkill?.manifest.name ?? conv.skillId} <X size={12} />
    </button>
  ) : null;
  // Knowledge: the chat's own choice, else (agent chats) the agent's, shown as the starting point
  const agentKnowledge = (id?: string) => {
    const d = id ? live.agent(id) : undefined;
    return d?.knowledgeBaseIds?.length ? { baseIds: d.knowledgeBaseIds, mode: d.knowledgeMode ?? 'grounded' } : undefined;
  };
  const knowledgeValue = conv ? (conv.knowledge ?? agentKnowledge(conv.agentId)) : (draftKnowledge ?? agentKnowledge(draftAgent || undefined));
  const knowledgeButton = <KnowledgeControl value={knowledgeValue} disabled={busy || gone} onChange={(v) => (conv ? act(() => chat.setKnowledge(conv.id, v ?? { baseIds: [], mode: 'grounded' })) : setDraftKnowledge(v ?? { baseIds: [], mode: 'grounded' }))} />;
  // Web: the chat's switch, else the agent's "Web access"; off by default; Strict Knowledge keeps it off
  const webOn = conv ? (conv.web ?? !!(conv.agentId && live.agent(conv.agentId)?.webAccess)) : (draftWeb ?? !!agentDef?.webAccess);
  const webButton = <WebToggle on={webOn} strict={knowledgeValue?.mode === 'strict' && knowledgeValue.baseIds.length > 0} disabled={busy || gone} onChange={(on) => (conv ? act(() => chat.setWeb(conv.id, on)) : setDraftWeb(on))} />;
  const picker = (
    <>
      {legacySkill}
      {knowledgeButton}
      {webButton}
      {toolsButton}
      <AIModelPicker value={target} onChange={pickTarget} lockedConnectionId={locked} lockedReason={lockedReason} disabled={busy || gone || (!!agentDef?.useDefaultRoute && !conv)} />
      <EffortPicker {...effortChoice} value={effort} disabled={busy || gone} onChange={(v) => (conv ? act(() => chat.configure(conv.id, { effort: v })) : setDraftEffort(v))} />
      <UsageRing connectionId={connectionId} {...(conv && { conversationId: conv.id })} up />
    </>
  );
  const agentChip = !conv ? <AgentPicker value={draftAgent} agents={st.characters} onChange={setDraftAgent} /> : undefined;

  return (
    <section ref={surface} className={`chat-surface ${empty ? 'is-empty' : 'is-active'}`}>
      <div className="chat-tools">
        <button className="icon-btn" onClick={() => setHistoryOpen(true)} aria-label={t('chat.history')} title={t('chat.history')}>
          <History size={17} />
        </button>
        <button className="icon-btn" onClick={newChat} aria-label={t('chat.new')} title={t('chat.new')}>
          <SquarePen size={17} />
        </button>
      </div>

      {conv && !empty && <ChatHeader conv={conv} agentName={agentName} busy={busy} onDeleted={newChat} />}

      <div className="chat-scroll" ref={scroller} onScroll={onScroll}>
        {empty ? (
          <div className="chat-hello">
            <h1>{hello.hello}</h1>
            <p>{agentName ? t('chat.withAgent', { name: agentName }) : hello.line}</p>
          </div>
        ) : (
          <div className="chat-column">
            {conv!.messages.map((m) => (
              <Message
                key={m.id}
                m={m}
                conv={conv!}
                agentName={agentName}
                busy={busy}
                onRetry={(p, user) => send(p, { files: chat.attachmentInputs(user.id), skillIds: user.skillIds })}
                catalog={skillCatalog}
              />
            ))}
          </div>
        )}
      </div>

      <div className="chat-dock" ref={dock}>
        {!atEnd && !empty && (
          <button className="jump-latest" onClick={() => toEnd(true)} aria-label={t('chat.jump')}>
            <ArrowDown size={14} /> {t('chat.jump')}
          </button>
        )}
        {lost && conv && (
          <div className="chat-banner">
            {t('a.chat.lost')}
            <Button size="sm" onClick={() => act(() => chat.startNewSession(conv.id))}>
              {t('a.chat.newSession')}
            </Button>
          </div>
        )}
        {gone && <div className="chat-banner">{t('a.chat.gone')}</div>}
        {error && <p className="chat-error">{error}</p>}
        <ChatComposer
          value={text}
          onChange={setText}
          onSend={() => send()}
          onStop={conv ? () => void chat.stop(conv.id) : undefined}
          busy={busy}
          disabled={lost || gone}
          autoFocus
          placeholder={gone ? t('a.chat.goneShort') : lost ? t('a.chat.lostShort') : `${agentName ? t('chat.placeholderAgent', { name: agentName }) : t('chat.placeholder')}${skillCatalog.length ? `  ·  ${t('skills.mentionHint')}` : ''}`}
          leading={agentChip}
          picker={picker}
          attachments={pending.items}
          onAttach={lost || gone ? undefined : (f, source) => (setError(''), pending.add(f, source))}
          onRemoveAttachment={pending.remove}
          skills={skillCatalog}
          skillIds={skillIds}
          onSkillIds={setSkillIds}
        />
      </div>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        selectedId={selectedId}
        onSelect={(id) => (setSelectedId(id), setHistoryOpen(false), setError(''))}
        onNew={newChat}
      />
    </section>
  );
}

function ChatHeader({ conv, agentName, busy, onDeleted }: { conv: Conversation; agentName?: string; busy: boolean; onDeleted: () => void }) {
  const t = useT();
  const chat = useChat();
  const [renaming, setRenaming] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setMenu(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  return (
    <header className="chat-header">
      <div className="chat-title">
        {renaming ? (
          <input
            autoFocus
            defaultValue={conv.title}
            aria-label={t('chat.rename')}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== conv.title) chat.rename(conv.id, v);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') (e.currentTarget.value = conv.title), setRenaming(false);
            }}
          />
        ) : (
          <button className="chat-title-btn" onClick={() => setRenaming(true)} title={t('chat.rename')}>
            {conv.pinned && <Pin size={12} className="pin-mark" />}
            {conv.title === 'New conversation' ? t('a.chat.untitled') : conv.title}
          </button>
        )}
        <small>
          {agentName ? t('chat.withAgent', { name: agentName }) : t('chat.direct')}
          {conv.routedBy ? ` · ${t(conv.routedBy.source === 'fallback' ? 'chat.routedFallback' : 'chat.routedPolicy')}` : ''}
        </small>
      </div>
      <div className="chat-actions" ref={box}>
        {confirm ? (
          <span className="history-confirm">
            <span>{t('chat.deleteConfirm')}</span>
            <button className="link-btn danger" onClick={() => (chat.remove(conv.id), onDeleted())}>
              {t('chat.delete')}
            </button>
            <button className="link-btn" onClick={() => setConfirm(false)}>
              {t('creator.cancel')}
            </button>
          </span>
        ) : (
          <>
            <button className={`icon-btn ${conv.pinned ? 'on' : ''}`} onClick={() => chat.setPinned(conv.id, !conv.pinned)} aria-label={conv.pinned ? t('chat.unpin') : t('chat.pin')} title={conv.pinned ? t('chat.unpin') : t('chat.pin')} aria-pressed={!!conv.pinned}>
              {conv.pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
            <button className="icon-btn" onClick={() => setMenu((v) => !v)} aria-label={t('chat.actions')} aria-expanded={menu}>
              <MoreHorizontal size={16} />
            </button>
          </>
        )}
        {menu && (
          <div className="menu-pop" role="menu">
            <button role="menuitem" onClick={() => (setMenu(false), setRenaming(true))}>
              <PencilLine size={14} /> {t('chat.rename')}
            </button>
            <button role="menuitem" className="danger" disabled={busy} onClick={() => (setMenu(false), setConfirm(true))}>
              <Trash2 size={14} /> {t('chat.delete')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function Message({
  m,
  conv,
  agentName,
  onRetry,
  busy,
  catalog,
}: {
  m: ChatMessage;
  conv: Conversation;
  agentName?: string;
  onRetry: (text: string, user: ChatMessage) => void;
  busy: boolean;
  catalog: SkillCatalogEntry[];
}) {
  const t = useT();
  const chat = useChat();
  const artifacts = useArtifacts();
  if (m.role === 'system') return <div className="msg msg-system">{m.content}</div>;
  const who = m.role === 'user' ? t('a.chat.you') : (agentName ?? t('a.chat.assistant'));
  const knowledge = m.role === 'assistant' && m.status === 'complete' && m.runId ? chat.run(m.runId)?.knowledge : undefined;
  const web = m.role === 'assistant' && m.status === 'complete' && m.runId ? chat.run(m.runId)?.web : undefined;
  const asked = m.role === 'assistant' && m.status === 'failed' ? conv.messages.find((x) => x.role === 'user' && x.runId === m.runId) : undefined;
  const prompt = asked?.content;
  return (
    <article className={`msg msg-${m.role} ${m.status}`} aria-label={who}>
      {m.attachments?.length ? (
        <ul className="msg-files">
          {m.attachments.map((a) => (
            <StoredAttachment key={a.id} a={a} load={chat.attachmentBytes.bind(chat)} big />
          ))}
        </ul>
      ) : null}
      {m.role === 'user' && m.skillIds?.length ? <SkillChips ids={m.skillIds} catalog={catalog} /> : null}
      {m.role === 'assistant' && m.runId && <SkillsUsed refs={chat.run(m.runId)?.skills} />}
      {m.role === 'assistant' && <ToolCallList runId={m.runId} />}
      <div className="msg-body">{m.content ? <CitedText text={m.content} record={knowledge} web={web} render={(x) => <Inline text={x} />} /> : m.status === 'streaming' ? <span className="typing" aria-label={t('a.chat.writing')} /> : ''}</div>
      {m.role === 'assistant' && m.status === 'complete' && <CitationPanel record={knowledge} />}
      {m.role === 'assistant' && m.status === 'complete' && <WebSources record={web} />}
      {m.role === 'assistant' && m.status === 'complete' && m.runId && <MemoryUsed record={chat.run(m.runId)?.memory} />}
      {m.role === 'assistant' && m.status === 'complete' && <MemoryProposed runId={m.runId} />}
      {m.role === 'assistant' && <ArtifactStrip list={artifacts.forMessage(m.id)} />}
      {m.status === 'cancelled' && <small className="msg-note">{t('a.chat.stopped')}</small>}
      {m.status === 'failed' && (
        <div className="msg-error">
          <span>
            {m.error?.code === 'interrupted' ? t('a.chat.interrupted') : (m.error?.message ?? t('a.chat.failed'))}
            {m.error?.detail && <small> · {m.error.detail}</small>}
          </span>
          {asked && prompt !== undefined && m.error?.code !== 'session_not_found' && (
            <button className="link-btn" disabled={busy} onClick={() => onRetry(prompt, asked)}>
              <RotateCcw size={12} /> {t('a.chat.retry')}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/** **bold** and `code`, as React elements (never HTML); everything else stays plain text */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.length > 4 && p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : p.length > 2 && p.startsWith('`') && p.endsWith('`') ? (
          <code key={i}>{p.slice(1, -1)}</code>
        ) : (
          p
        ),
      )}
    </>
  );
}
