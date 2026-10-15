# UI and UX foundation

RealmNest is a desktop AI product with two surfaces of equal weight:
- **Chat** with your AI connections;
- **Agents** that work in pixel **Worlds**.

The World stays the visual star. The chrome around it is calm, neutral and themeable.

## Application shell (`src/ui/App.tsx`, `Sidebar.tsx`)

**Layout.** The shell is one window, `[ sidebar ] [ stage ]` on the theme's background: the sidebar is a full-height column with a hairline on its right, and the stage fills the rest (with an 18 px margin, none in Chat and the World, which run edge to edge). No floating cards and no world showing through.

**Navigation entries:**
- Home
- Worlds
- Agents
- Simulation
- Chat
- Settings
- Quit

Outfit is not a destination any more. Outfits are chosen where an agent is created or edited: the creator, the agent tiles, and the World inspector.

**Sidebar.** Home, Worlds, Simulation, Chat and Agents; then Settings; at the bottom the **profile** and *Quit*. The logo goes to Home.
- **What it shows.** The user's photo, or the initial of their name until there is one, plus their name and role.
- **Editing it.** A click opens Settings › General › Profile: name, role, and upload or remove a photo.
- **How the photo is kept.** It is cropped to a square, saved as a 256 px JPEG with the settings, and never leaves the computer (`ui/profile.tsx`).

**Icon rail.** In **Chat** and the **World** (Simulation), and on any window narrower than 1240 px, the sidebar becomes a 68 px icon rail (`.nav-slot.compact`).
- **Opening.** When the pointer rests on it (after 120 ms) or keyboard focus enters it, it opens to 236 px over the page, as a panel above everything, labels included. It closes when the pointer leaves.
- **No tooltips.** There are no separate tooltips, which used to slip under the chat panel. Icons never shrink.

**Home** (`screens/Home.tsx`, data in `ui/homeData.ts`) is also the main menu: the app opens on it, and there is no separate menu screen. It has three parts:
- **World map** (`ui/worldMapZones.ts`, image `public/home/world-map.webp`, the owner's illustration). Every world has its district on the picture: the station in orbit, the observatory on the mountain, the server complex in the snow, the solar labs, the town centre, the fields, the brick factory, the airfield hangars (Robotics), the beach village (Studio) and the container port.
  - The map fills its panel ("cover"; only sea and sky at the edges are cropped).
  - A tag sits on each world with agents, and on the current one: agents, active tasks, and the state with a dot and a word. Clicking a tag opens that world.
  - Tags never overlap and never leave the visible part (`placeTags`). There are no other click areas on the map.
  - The top-right buttons open *What's new* and the *Guide* (`screens/HelpModals.tsx`); "All worlds" opens Worlds.
- **Recent activity.** The last six events from data RealmNest really keeps: live tasks (started / completed / failed / stopped), chats and new agents, with portraits and times ("5 minuti fa").
- **Overview.** Total agents, working now, tasks done today, and failed tasks in the last 7 days.

No emoji anywhere: worlds have Lucide icons (`ui/worldIcons.tsx`), and the founder star and freeze marks are icons too.

## Chat (`src/ui/screens/Chat.tsx`, `src/ui/chat/*`)

### Empty state
```
                 Buonasera, Alex.
               Su cosa lavoriamo?
      ╭──────────────────────────────────────╮
      │ Scrivi a RealmNest…                     │
      │ Parla con RealmNest ▾      Auto · … ▾ ↑ │
      ╰──────────────────────────────────────╯
```
- **Greeting** (`ui/greeting.ts`):
  - the salutation follows the local time (05–12, 12–18, otherwise evening);
  - it adds the name from Settings › General › Your name, if one is set (nothing is hardcoded);
  - the second line comes from four curated phrases, picked once per empty chat;
  - no model is called.
- **Glow.** Behind the composer there is a soft radial glow, `--chat-glow`, derived from the theme accent. It fades out once the chat starts.
- **Agent choice.** "Talk to" (`agent-chip`) chooses RealmNest (a direct chat) or an agent.

### Active conversation
- **Messages.** They sit in a centred column, `--column: 760px`.
  - The assistant writes on the page, with no bubble.
  - The user's turns are in a soft bubble on the right.
  - Long text wraps; `code` is mono.
- **Composer.** The same `ChatComposer` element docks at the bottom. Only the layout around it changes (`.is-empty` / `.is-active`), so the text and focus survive.
- **Header.** It is minimal and overlaid:
  - the title (click to rename);
  - "Direct chat" or "with Alex", plus "Auto · default chat route" when the routing policy chose the connection;
  - Pin and a ⋯ menu (Rename, Delete).
  - No connection or model selectors appear here.

### Bottom fade (no divider)
The message area scrolls under the composer and is masked: `mask-image: linear-gradient(...)` on `.chat-scroll`.
- **Bottom:** text fades out over the last 72 px above the composer.
- **Top:** text fades out under the header.
- **Spacing:** `--dock-h` is the composer's real height (a `ResizeObserver`), so the last line always rests above the fade.

### Scrolling
- `.chat-scroll` owns scrolling; the page never scrolls.
- While the reader is within 96 px of the end, new streamed text is followed.
- After scrolling up, nothing pulls the reader back, and a small "Jump to latest" pill appears above the composer.

### Composer (`ChatComposer.tsx`)
- **Text area.** It grows up to 240 px. Enter sends; Shift+Enter adds a new line.
- **"+"** adds files (or drop them on the composer, or paste an image). Attached files show as chips above the text, with a thumbnail for images, and can be removed. See [CHAT.md › Attachments](CHAT.md#attachments).
- **Send / Stop.** Send becomes Stop while a reply is written.
- **Bar.** It holds the optional leading slot (the agent chip), the AI picker and Send.
- **Agent choice.** The agent select (RealmNest or an agent) sits right after "+".

### AI picker (`AIModelPicker.tsx`)
The picker is one compact button in the composer ("Claude Code ▾", "Nemotron 3 Super (free) ▾", "✦ Auto · Nemotron… ▾"). It opens a two-level menu, CONNECTION → MODEL:
```
┌──────────────────────┐ ┌───────────────────────────┐
│ ✦ Auto  → OpenRouter… ✓│ │ Models · OpenRouter 2      │
│ ● Claude Code       › │ │ 🔍 Search 458 models…      │
│ ● OpenRouter 2      › │ │ Recent                     │
│──────────────────────│ │   Nemotron 3 Super (free) ✓ │
│ Manage AI connections │ │ All models (458)  …        │
└──────────────────────┘ └───────────────────────────┘
```
**The first list:**
- **Auto**, with where the default chat route resolves now. When no route is set it is disabled and says so.
- **Each connection** with a status dot. The second line shows the model in use, the catalogue size, or the status ("Invalid credentials"…). A ✓ marks the connection in use.
- **Manage AI connections** opens Settings › AI Connections.

**The models panel.** Hovering (after a 140 ms pause, so a diagonal move towards the panel does not switch connection), focusing or clicking a connection opens its models beside the list. The list itself never moves: it stays under the button whether the panel is open or not. It opens on the right when there is room inside the chat, otherwise on the left. Its height fits the room above (active chat) or below (empty chat) the composer. It shows:
- a search over the chat-capable catalogue (`CapabilityService.modelsFor('text.chat')`, with "chat support not stated" badges);
- **Default**, when it means something: a preferred model is set, or the provider has its own default;
- **Recent**: the current model, the preferred one and models used in recent chats on that connection;
- **All models (n)**.

A connection without a catalogue (Claude Code) offers Default and "Other model…". A connection that is not working shows its message instead of models. The menu opens on the connection in use, so the ✓ is in view.

**Locks:**
- A started chat keeps its connection (only its model can change).
- An agent chat uses the agent's connection.
- The menu says why.
- The runtime still clears a model that belongs to another connection.

### History (`HistoryDrawer.tsx`, `runtime/chat/history.ts`)
- **Opening.** The ⟲ button at the top left opens a drawer over the chat; Esc, the scrim or ✕ close it.
- **Contents.** New chat, a search over titles and messages, and the groups:
  - **Pinned**;
  - **Today**, **Yesterday**, **Previous 7 days**, **Older**, by the local day of last use.
- **Row actions.** Each row has ⋯ for Rename (inline), Pin/Unpin and Delete (with an inline confirmation).
- **Persistence.** Pin and title are saved with the conversation. Renaming or pinning does not change its place by recency. Pinned chats are never pruned by the 200-conversation cap.

### Titles (`runtime/chat/titles.ts`)
- **First message.** The title is the first message, cut at a word (`titleSource: 'auto'`), and is set immediately.
- **Optional AI title.** Settings › General › "AI-written chat titles" is off by default because it costs one extra request. When it is on:
  - after the first good reply, one short stateless turn on the same connection and model asks for a 2–6 word title (`'ai'`);
  - it is asked for once (`titleRequestedAt`) and never awaited by the chat;
  - on failure, the first-message title stays.
- **Renamed titles.** A title the user set (`'user'`) is never replaced.

## Typography
| role | token | used for |
| --- | --- | --- |
| display | `--fs-display` 30 px, 600 | chat greeting |
| page | `--fs-page` 24 px, 600 | page titles (`.display`) |
| section | `--fs-section` 17 px | section titles |
| card | `--fs-card` 15 px, 600 | card and conversation titles |
| body | `--fs-body` 14 px | text (chat messages are 15 px / 1.65) |
| label | `--fs-label` 13 px | controls |
| meta | `--fs-meta` 12 px | secondary information |
| tech | `--fs-tech` 11.5 px, mono | ids, logs, debug, code |

- **UI face.** One face for the whole UI: **Inter** (bundled, `@fontsource-variable/inter`), falling back to SF Pro Text/Display, Segoe UI, `system-ui`. Headings get a slight negative tracking.
- **Mono.** JetBrains Mono is used only for technical data: code, model ids in Debug, event logs, provider diagnostics and keyboard keys. Counters use `tabular-nums` in the UI face.
- **Removed.** The serif display face (Fraunces) was removed.

## Themes and tokens (`src/themes.ts`)
A theme is data: one `ThemeTokens` object. `applyTheme()` writes the tokens as CSS custom properties on `<html>` and sets `data-theme`, `data-scheme` and `color-scheme`. The stylesheet uses only tokens: about 100 hard-coded colours were replaced with tokens or `color-mix()` of tokens. Light or dark is part of the theme; there is no separate appearance switch.

**Tokens:**
- `--background`, `--surface`, `--surface-elevated`, `--surface-hover`;
- `--border`, `--border-strong`;
- `--text-primary`, `--text-secondary`, `--text-muted`;
- `--accent`, `--accent-hover`, `--accent-ink`;
- `--success`, `--warning`, `--danger`, `--info`.

**Derived** (in `styles.css`):
- `--accent-soft`, `--accent-grad`;
- `--glow`, `--chat-glow`;
- `--surface-glass`, `--overlay`;
- `--*-text`, a status colour mixed toward the text colour for readable text on surfaces.

**Older names.** Older variable names (`--panel`, `--line`, `--text-2`…) are aliases of the tokens.

| theme | scheme | accent |
| --- | --- | --- |
| RealmNest (default) | dark | mint |
| Ember | dark | orange (the previous look; old `dusk`/`night` saves migrate here) |
| Azure | light | blue |
| Violet | dark | purple |
| Ocean | dark (navy) | cyan |
| Rose | dark | pink |
| Graphite | dark | neutral |
| Solar | light (cream) | amber |
| Forest | dark (green) | sage |
| Ice | light | deep cyan |

**Readability is tested** (`uiFoundation.test.ts`), with WCAG contrast:
- text on background ≥ 7;
- secondary on surface ≥ 4.5;
- muted ≥ 3;
- accent ink on accent ≥ 4.5;
- accent and statuses ≥ 3.

**Picking a theme.** Settings › Appearance shows each theme as a small preview (background, surface, text, accent, glow). A click applies it, and the choice is saved with the settings.

**World UI under light themes.** World colours (the pixel art, `STATE_COLORS`) do not change with the theme. Panels over the world use the theme surfaces. In light themes the blurred world background becomes a pale wash.

## Statuses
- Statuses are always a dot **and** a word, never colour alone: Connected, Checking…, Sign-in required, Invalid credentials, Unavailable, Idle / Walking / Working…, run badges, Coming soon.
- Connection statuses use `.conn-status`; agent states use `StateBadge`.

## Agents and worlds
- **Wording.** In the product they are **Agents** ("I tuoi agenti", "Agenti in questo mondo"). Internal code still says `crew` (screen id, CSS) where renaming would only add risk.
- **Moving agents.** `useMoveAgent()` (`ui/agentMove.ts`) is the only way the UI moves an agent; it calls `AppStore.moveCharacter(id, worldId, busy)`.
  - **Where:**
    - the World inspector (Identity › World is a select, "→ Office");
    - the Agents tiles;
    - the Worlds side panel.
  - **Rules:** a toast confirms the move; an agent with a live run is not moved (`busy`); every move emits `character.moved`.
  - **Outfits:** each agent remembers the outfit it wore in each world (`worldOutfits`), so a round trip restores it.
  - **Later:** a drag-and-drop target can call the same function.
- **Inspector.** Its sections are **Identity** (world, activity, station, outfit), **AI** (connection, model, runtime, instructions) and **Work** (task, Run/Cancel, output, history).
- **World screen.** It keeps the canvas as large as possible: HUD, the drawer (Controls · Debug · Events) and the inspector float over it.

## Settings
- **Tabs:** General · Appearance · AI Connections · AI Capabilities. Another screen can open a tab with `store.openSettings(tab)`; the AI picker's "Manage AI connections" does.
- **AI Connection cards.** Each card shows:
  - provider (small caps), connection name, status and account;
  - preferred model, catalogue size and version;
  - up to four capability chips, plus "+N";
  - the actions **Test connection**, **Refresh models** and **Manage**, in a wrapping row that always stays inside the card.
  - Debug metadata stays in Debug.
- **Debug.** Debug information (World · Providers · Capabilities) lives in the World drawer's Debug tab, in mono, apart from the product surfaces.

## Prepared, not built
Attachments, Skills, Tools, MCP, Gallery, Deep Research and Artifacts are not built. They plug into:
- **Tools / MCP / Skills:**
  - the picker's connection groups, using capability badges such as `tools.calling`;
  - a future composer menu.
- **Gallery and Artifacts:**
  - rail entries;
  - message parts in the chat column.
- **Deep Research:** `CapabilityService.canSatisfy(['text.chat', 'web.search'])` before its entry point is shown.
