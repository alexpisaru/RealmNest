# RealmNest OS 0.14.0 Public Beta

Crews that ask, share a folder and go through lists; queues for agents and chats; prices in the model menus; and Skills from GitHub that can be updated.

## New

- **A crew asks you instead of inventing.** When a crew member lacks something only you can give (an access, a file, a decision, a fact), its task waits for you (**needs you**) while the rest of the crew goes on. A Windows notification and Telegram tell you; the run shows the question with an answer box. Your answer restarts the task and becomes a confirmed fact for every task after it, its reviewer and the final result. **Skip** goes on without it.
- **A shared folder for a crew.** Crew editor › Shared working folder: every task of the crew's runs works in it, so what one member saves the others can read. The agents need their file tools on, and writing still asks first.
- **For each entry of a list.** A crew task can run once for every entry of another task's list ("find 10 companies", then "analyse each company"), up to 20 entries, shared among its assignee and the members you choose in **Also done by**. An entry can ask you without stopping the others; a failed entry is retried alone or skipped; the next tasks get every entry's result together. The Coordinator plans it by itself when the goal calls for it.
- **Tasks wait in the agent's queue.** A task given to an agent that is already working waits and starts by itself when the agent is done, oldest first (up to 20). The agent panel lists the queue with a remove button; Telegram says a task is queued and sends the answer when it has run. Queued tasks survive a restart.
- **Write while the AI answers.** In a chat, messages sent while a reply is being written wait above the composer and go by themselves after the reply, in order (up to 10). If the reply is stopped or fails, the queue pauses until **Send now**.
- **Prices in the model menus.** Next to the context each model shows its price per million tokens (*in $x · out $y /1M*). ChatGPT and Claude by account, which have no price of their own, show the API price of the same model, from OpenRouter's public model list.
- **Skills from GitHub can be updated.** A Skill installed from GitHub keeps its repository, branch, tag or commit, folder and commit. **Check for updates** (all Skills, or one) and a light daily check look for a newer version: a branch is compared with the newest commit of the Skill's folder, a tag reports a newer version tag, a commit stays as it is. Before installing you see the commits, the files with lines added and removed and, highlighted, any change to what the Skill may use (capabilities, tools, MCP, network, files, permissions). The update installs only when you agree, all or nothing, and asks again if you changed the Skill yourself. Updates show on the Skill, as a count next to **Skills** and as a Windows notification.

## Changed

- Crew results, task outputs and workflow steps use the same formatting as chat answers: tables, code blocks and links show properly.
- A Skill's `allowed-tools` written with commas (`Read, Grep`) is read as separate tools.
- A Skill installed from GitHub is now read at one commit, so a branch that moves during the download cannot mix two versions.
- Two copies of RealmNest with different identities (for example a test build) can run side by side.

## Install

- If you have 0.13.0, RealmNest offers this update by itself; you can also choose Settings › General › About › **Check for updates**.
- Otherwise download `RealmNest-OS_0.14.0_x64-setup.exe` and `SHA256SUMS.txt`, check the installer with `Get-FileHash RealmNest-OS_0.14.0_x64-setup.exe` and compare the result with the checksum, then run it. It installs for your Windows user, with no administrator rights, over any older version, and keeps your data.
- The installer is **not code-signed**, so Windows SmartScreen may show "Windows protected your PC". Choose *More info › Run anyway* only if the checksum matches.
- RealmNest needs Windows 10 or 11 (64-bit) and the Microsoft Edge WebView2 Runtime. Windows 11 already has WebView2; on other systems the installer downloads it.
- ChatGPT (account) connections need the [Codex CLI](https://github.com/openai/codex), and Claude (account) connections need [Claude Code](https://claude.com/claude-code).

## Privacy

- The model prices come from OpenRouter's public model list, read at most once a day when a model menu opens, with no key and nothing about you.
- The Skill update check asks GitHub's public API about the repositories of Skills you installed from GitHub, at most once a day (it can be turned off on the Skills screen); nothing is downloaded until you open an update.

## Known limitations

- The entries of a "for each" task run side by side and do not see each other's results, so similar entries can come back alike; the final result is assembled from all of them.
- GitHub answers at most 60 requests an hour without an account: with many GitHub Skills a check can be refused for a while, and RealmNest says so.
- Skills update only from public GitHub repositories.
- All other limitations are unchanged: see `docs/HARDENING.md`.
