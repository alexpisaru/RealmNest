# Usage

What the AI connections consume, shown where the work happens. There are three places:

- **The ring** next to the model in the chat composer.
- **The same ring** in an agent's AI panel (Simulation › inspector).
- **A summary** on each connection's card in Settings › AI Connections.

RealmNest records usage locally from the events every provider turn already emits: chat, agent tasks, Deep Research, titles. It makes no extra calls, and prices are never guessed. The one exception is OpenRouter: when the popup opens, RealmNest asks the key's own spending, at most once a minute.

## Where it lives

| | |
| --- | --- |
| ledger | `src/runtime/usage/service.ts` (`UsageService`): rows per day × connection × kind (chat, agent, research, other) × agent; totals per chat; plan limits; budgets. Stored under `usage-ledger`. Rows are kept 120 days, chats the latest 400. |
| owners | `main.tsx` (`usageOwner`): the turn's `runId` gives its owner. A chat run gives the conversation (and its agent); an agent run gives the agent; a research run gives the research (and its agent). Research calls and its web searches carry `<research id>~n` run ids for this. |
| plan limits | `limits.updated`, a provider event (`PlanLimits`), from Claude Code's `rate_limit_event` (`claude-code/parser.ts`) |
| OpenRouter | Rust `openrouter_credits` (`GET /key`: `usage`, `usage_daily/weekly/monthly`, `limit`, `limit_remaining`, `limit_reset`, `is_free_tier`). The key never leaves Rust. The TS side is `src/runtime/usage/credits.ts`. |
| UI | `src/ui/usage/UsageRing.tsx`: `UsageRing`, `ConnectionUsage`, `useUsageGauge` |
| tests | `src/tests/usage.test.ts`, `src/tests/claudeParser.test.ts` (the real stream's limits), Rust `openrouter::tests::reads_the_keys_spending_and_cap` |

## The ring

It is 18 px and sits next to the model. Its fill is the most telling gauge for that connection:

| connection | the ring shows | the popup |
| --- | --- | --- |
| Claude (account) | the **fullest plan window**: the 5-hour session or the week, whichever is higher | Session (5 hours) and Week, each with a bar, a percentage and when it resets. The time of the last report. This chat, the agent, today and 30 days in tokens (and the list-price value Claude reports, marked as included in the plan). |
| OpenRouter | the **key's cap** spent, when the key has one | Credits left of the cap; today / week / month spent, as OpenRouter reports them; then this chat, the agent, today and 30 days |
| any other, with a budget | this **month's cost against the budget** set in Settings | the budget bar, then the same totals |
| any other, without a budget | an empty ring | the totals |

The colours follow the fill: under 60% the theme accent, from 60% amber, from 85% red. The popup is placed against the window, so a panel that scrolls or clips (the agent inspector) never cuts it. It closes on Escape or on a click outside.

Claude's plan windows arrive with every reply: the stream carries `rate_limit_event` with `unifiedWindows.five_hour` / `seven_day` (`utilization`, `resetsAt`). The ring shows the last report and says how long ago it came. Before the first reply on a connection, it says the limits will appear then.

## The summary (Settings › AI Connections)

Each connection's card shows:
- its ring;
- today, 7 days and 30 days, in tokens and cost;
- the agents that used it in the last 30 days;
- for connections without a plan, a **monthly budget** in US dollars (empty means none), which gives the ring its scale.

## What is counted

- **Tokens**:
  - input: new prompt text, including text written to a prompt cache;
  - output;
  - cache reads, kept apart because they are the repeated context.
- **Cost**: only what the provider reports (Claude Code's `total_cost_usd`, OpenRouter's usage cost). For a Claude subscription this is the list value of the turn, not a charge. The popup says so.
- **When**: once per provider turn, on its end event, from its last cumulative usage. A failed or cancelled turn counts what it reported before stopping.

## Acceptance on the release (14 October 2026)

- **Chat on Claude (Haiku 5.5):** after one reply the ring read 33%. The popup showed Session 0% (resets Thu 04:00), Week 33% (resets Thu 17:00), and this chat 782 tokens.
- **OpenRouter 2:** the key's real data: a $100 cap with $100 left, $0 today, week and month. The account itself has no credits; the key's cap is separate from them.
- **Agent panel:** Hana's ring showed Claude's windows and Hana's own usage. After the fix the popup is anchored to the ring and not clipped.
- **Settings:** both connection cards show their summary; the budget field appears for OpenRouter only.

## Limits

- Claude's windows are as of the last reply on that connection. RealmNest does not poll the plan.
- Anthropic API keys have no spending endpoint, so their cost is shown only when a turn reports it. The key's rate-limit headers are not read yet.
- Usage before 14 October evening was not recorded.
