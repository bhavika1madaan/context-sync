# Context Sync

A VS Code extension that packages your project's code into clean, structured context and copies it to your clipboard — ready to paste into any AI chatbot (ChatGPT, Claude, Gemini, etc.). No more manually opening files one by one and pasting them in.

Its core feature: **hash-based change detection**. After your first sync, the extension fingerprints every file. On future syncs, it only includes files that actually changed — so you're not re-sending your whole codebase every time you ask a follow-up question.

## Why

Sharing project context with an AI chatbot usually means manually copying files one at a time, and re-copying everything again after every change. Context Sync automates both problems: one command bundles your whole workspace, and a second command sends only what's different since the last sync.

## Features

- **Full sync** — scans your entire workspace and copies all eligible files, formatted with clear file-path headers and language-tagged code blocks
- **Changed-only sync** — computes a SHA-1 hash of every file and compares it against a saved fingerprint from the last sync; only modified or new files are included
- **Security filtering** — `.env` files and other secrets are excluded by pattern matching, so credentials never leave your machine
- **Noise pruning** — automatically skips `node_modules`, `.git`, build output, and other non-source directories
- **Crash-safe reads** — unreadable or binary files are skipped individually instead of failing the whole sync
- **Zero runtime dependencies** — built entirely on Node.js built-ins (`fs`, `path`, `crypto`) and the VS Code API

## Usage

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

- **`Context Sync: Copy Full Workspace Context`** — copies your whole project to the clipboard
- **`Context Sync: Copy Only Changed Files`** — copies only files changed since the last sync

Paste the result into any chatbot.

## How Change Detection Works

1. On sync, every eligible file's contents are hashed with SHA-1.
2. Hashes are stored in a local `.contextsync-state.json` file at the project root.
3. On the next "changed-only" sync, each file's current hash is compared against the stored one:
   - No match (or file didn't exist before) → included in the sync
   - Match → skipped
   - File in the old state but missing now → reported as deleted
4. The state file is updated with the latest hashes after every sync.

This keeps repeat syncs small — after editing one file out of fifty, only that one file gets sent.

## Tech Stack

- TypeScript
- VS Code Extension API
- Node.js built-in modules: `fs`, `path`, `crypto`
- Webpack (bundling)

## Installation (development)

```bash
git clone https://github.com/bhavika1madaan/context-sync.git
cd context-sync
npm install
```

Open the folder in VS Code and press `F5` to launch the Extension Development Host, then run the commands from the Command Palette in the new window.

## Project Structure

```
src/
└── extension.ts   # All extension logic: file walking, filtering, hashing, state, formatting
```
