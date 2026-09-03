# Project instructions

## Linear tracking
- Track implementation and verification in the Mohamed Mostafa Linear workspace.
- Project: GitHub Account & Git Identity Manager (`7a20f368-ece9-483c-a3af-7012d4a79db0`).
- Plan before starting a new feature; update its issue when work starts and after testing. Mark only implemented, verified work done and record remaining platform or live-account checks.
- Desktop milestones: MOH-81 workspace/context; MOH-82 secure desktop authentication; MOH-83 authenticated MCP agent access; MOH-84 workflow controls and releases.

## Development
- The VS Code extension remains under `src/`; the Electron desktop app is under `desktop/`.
- Reuse existing TypeScript models and Git helpers where applicable.
- Desktop defaults to a companion view of the running local VS Code extension. ProfileManager and VS Code SecretStorage remain authoritative. Never copy vault internals or put tokens in desktop responses, metadata, agent outputs, logs, URLs or arguments. The old M1 metadata registry is preserved only for legacy context tests/CLI.
- Run `npm run test:unit` for extension changes; `npm test --prefix desktop` and `npm run test:ui --prefix desktop` for desktop changes.

## graphify
- **graphify** (`~/.Codex/skills/graphify/SKILL.md`) — any input to a knowledge graph. Trigger: `/graphify`.
- When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.
