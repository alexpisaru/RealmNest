// The approval prompt: shown whenever a tool set to "ask" is requested. It
// says who asks, which tool, where, and shows the whole input; nothing runs
// until the user chooses. The decision goes to ToolRuntime (never executed here).

import { ShieldAlert } from 'lucide-react';
import type { TKey } from '../../i18n';
import { useServices, useT, useTools } from '../context';

export function ToolApprovals() {
  const tools = useTools();
  const pending = tools.runtime.approvals();
  if (!pending.length) return null;
  return <ApprovalPrompt key={pending[0].call.id} index={0} count={pending.length} />;
}

function ApprovalPrompt({ count }: { index: number; count: number }) {
  const t = useT();
  const tools = useTools();
  const { live } = useServices();
  const p = tools.runtime.approvals()[0];
  const tool = tools.registry.get(p.call.toolId);
  const input = (p.call.input ?? {}) as Record<string, unknown>;
  const path = typeof input.path === 'string' ? input.path : undefined;
  const workspace = p.call.agentId ? (live.agent(p.call.agentId).workspace ?? tools.policy.get().workspace) : tools.policy.get().workspace;
  const decide = (d: 'deny' | 'once' | 'run' | 'always') => tools.runtime.decide(p.call.id, d);
  const json = JSON.stringify(p.call.input, null, 2);
  const server = tool?.source === 'mcp' ? tool.metadata?.mcpServerName : undefined;

  return (
    <div className="modal-backdrop approval-backdrop">
      <div className="modal approval" role="alertdialog" aria-modal aria-labelledby="approval-title" aria-describedby="approval-desc">
        <header className="approval-head">
          <span className={`approval-icon risk-${tool?.risk ?? 'high'}`}>
            <ShieldAlert size={20} />
          </span>
          <div>
            <h2 id="approval-title">{t('tools.approveTitle', { who: p.requester })}</h2>
            <p id="approval-desc">
              <code>{tool?.title ?? tool?.metadata?.mcpToolName ?? tool?.name ?? p.call.toolId}</code> · {tool && t(`tools.risk.${tool.risk}` as TKey)}
            </p>
          </div>
          {count > 1 && <span className="approval-count">1 / {count}</span>}
        </header>
        {tool && <p className="approval-desc">{tool.description}</p>}
        {p.call.approvalReason && <p className="approval-reason">{p.call.approvalReason}</p>}
        {(path || (tool?.needsWorkspace && workspace) || server) && (
          <dl className="approval-where">
            {server && (
              <>
                <dt>{t('tools.approveServer')}</dt>
                <dd>
                  {server} <code>{tool?.metadata?.mcpToolName}</code>
                </dd>
              </>
            )}
            {path && (
              <>
                <dt>{t('tools.approvePath')}</dt>
                <dd>
                  <code>{path}</code>
                </dd>
              </>
            )}
            {tool?.needsWorkspace && workspace && (
              <>
                <dt>{t('tools.approveFolder')}</dt>
                <dd>
                  <code>{workspace}</code>
                </dd>
              </>
            )}
          </dl>
        )}
        <div className="approval-input">
          <span>{t('tools.approveInput')}</span>
          <pre>{json}</pre>
        </div>
        <footer className="approval-actions">
          <button className="btn btn-danger" onClick={() => decide('deny')}>
            {t('tools.deny')}
          </button>
          <span className="approval-gap" />
          <button className="btn" onClick={() => decide('run')}>
            {p.call.agentId ? t('tools.allowRun') : t('tools.allowRunChat')}
          </button>
          {p.call.agentId && (
            <button className="btn" onClick={() => decide('always')}>
              {t('tools.allowAlways', { name: p.requester })}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => decide('once')} autoFocus>
            {t('tools.allowOnce')}
          </button>
        </footer>
      </div>
    </div>
  );
}
