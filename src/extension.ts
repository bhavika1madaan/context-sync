import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Directories we never want to scan — junk/deps/build output
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'build', '__pycache__', '.venv'
]);

const EXCLUDE_FILE_PATTERNS = [
  /\.env(\..*)?$/,
  /package-lock\.json$/,
  /\.contextsync-state\.json$/
];

function hashContent(content: string): string {
  return crypto.createHash('sha1').update(content).digest('hex');
}

const STATE_FILE = '.contextsync-state.json';

function loadState(root: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(path.join(root, STATE_FILE), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveState(root: string, hashes: Record<string, string>): void {
  fs.writeFileSync(
    path.join(root, STATE_FILE),
    JSON.stringify(hashes, null, 2),
    'utf8'
  );
}

function shouldExcludeFile(relPath: string): boolean {
  return EXCLUDE_FILE_PATTERNS.some((re) => re.test(relPath));
}

// Find the root folder the user has open
function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  return folders[0].uri.fsPath;
}

// Recursive DFS over the directory tree (same pattern as your graph problems)
function walkFiles(root: string, dir: string, results: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory — skip, don't crash
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      walkFiles(root, fullPath, results); // recurse into subfolder
    } else if (entry.isFile()) {
      const relPath = path.relative(root, fullPath);
      if (shouldExcludeFile(relPath)) continue;
      results.push(relPath);
    }
  }
}

function readFileSafe(root: string, relPath: string): string | null {
  try {
    return fs.readFileSync(path.join(root, relPath), 'utf8');
  } catch {
    return null;
  }
}

function buildContextBlock(root: string, files: string[]): string {
  const parts: string[] = [];

  parts.push(`# Project: ${path.basename(root)}`);
  parts.push(`Files: ${files.length}`);
  parts.push('');

  for (const relPath of files) {
    const content = readFileSafe(root, relPath);
    if (content === null) continue;

    parts.push(`### File: ${relPath}`);
    parts.push('```');
    parts.push(content);
    parts.push('```');
    parts.push('');
  }

  return parts.join('\n');
}


export function activate(context: vscode.ExtensionContext) {
  const syncFull = vscode.commands.registerCommand('contextSync.syncFullContext', async () => {
    const root = getWorkspaceRoot();
    if (!root) {
      vscode.window.showErrorMessage('Context Sync: open a folder first.');
      return;
    }

    const files: string[] = [];
    walkFiles(root, root, files);

    const block = buildContextBlock(root, files);
    await vscode.env.clipboard.writeText(block);

    vscode.window.showInformationMessage(
      `Context Sync: copied ${files.length} files to clipboard.`
    );
  });

  const syncChanged = vscode.commands.registerCommand('contextSync.syncChangedOnly', async () => {
    const root = getWorkspaceRoot();
    if (!root) {
      vscode.window.showErrorMessage('Context Sync: open a folder first.');
      return;
    }

    // 1. Find all current files
    const files: string[] = [];
    walkFiles(root, root, files);

    // 2. Load the memory (old fingerprints)
    const oldHashes = loadState(root);

    // 3. Compare: which files are new or changed?
    const changed: string[] = [];
    const newHashes: Record<string, string> = {};

    for (const relPath of files) {
      const content = readFileSafe(root, relPath);
      if (content === null) continue;

      const h = hashContent(content);
      newHashes[relPath] = h;

      if (oldHashes[relPath] !== h) {
        changed.push(relPath);
      }
    }

    // 4. Update the memory
    saveState(root, newHashes);

    // 5. Nothing changed? Say so and stop.
    if (changed.length === 0) {
      vscode.window.showInformationMessage('Context Sync: no changes since last sync.');
      return;
    }

    // 6. Copy only the changed files
    const block = buildContextBlock(root, changed);
    await vscode.env.clipboard.writeText(block);

    vscode.window.showInformationMessage(
      `Context Sync: copied ${changed.length} changed file(s) to clipboard.`
    );
  });

  context.subscriptions.push(syncFull, syncChanged);
}

export function deactivate() {}