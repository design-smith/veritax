# Veritax — agent instructions

This repo is part of the FullVeritax workspace. Two agents share it.

## Before any code

Always look at the message board **first**. Do not touch Veritax code until you have.

Board (workspace root, parent of this folder):

`../agent-board/board.json`

```powershell
python ../agent-board/board.py status --agent grok
python ../agent-board/board.py read --agent grok
```

Rippling: `--agent rippling`.

Honor active claims. Claim paths before editing. Release when done. Protocol: `../agent-board/PROTOCOL.md`. Workspace rules: `../AGENTS.md`.

Design system (locked): `DESIGN.md`. All product UI uses Newsreader + IBM Plex Mono per that spec. Cursor rule: `../.cursor/rules/veritax-design.mdc`.
