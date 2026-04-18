import readline from 'node:readline';

export function createPrompt() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a)));
  const close = () => rl.close();
  return { ask, close };
}

export async function pickComponents(components, ask) {
  const selected = new Set();
  for (;;) {
    renderComponentList(components, selected);
    const input = (await ask("\nType numbers (e.g. '1 3'), 'a' all, 'n' none, Enter to confirm, 'q' to quit: ")).trim().toLowerCase();
    if (input === 'q') {
      throw new Error('Cancelled by user');
    }
    if (input === '') {
      if (selected.size === 0) {
        console.log('Nothing selected. Press q to quit, or pick at least one component.');
        continue;
      }
      return components.filter((_, i) => selected.has(i + 1));
    }
    if (input === 'a') {
      components.forEach((_, i) => selected.add(i + 1));
      continue;
    }
    if (input === 'n') {
      selected.clear();
      continue;
    }
    for (const tok of input.split(/\s+/)) {
      const n = Number.parseInt(tok, 10);
      if (Number.isNaN(n) || n < 1 || n > components.length) {
        console.log(`  ! ignored: '${tok}'`);
        continue;
      }
      if (selected.has(n)) selected.delete(n);
      else selected.add(n);
    }
  }
}

function renderComponentList(components, selected) {
  console.log('\nAvailable components:');
  components.forEach((c, i) => {
    const idx = i + 1;
    const mark = selected.has(idx) ? '[x]' : '[ ]';
    const desc = c.description ? `  ${c.description}` : '';
    console.log(`  ${mark} ${String(idx).padStart(2, ' ')}. ${c.id}${desc}`);
  });
}

export async function pickDefaultScope(ask) {
  console.log('\nWhere should components be installed?');
  console.log('  1) global  - user level (~/.claude/, applies across all projects)');
  console.log('  2) project - this project only (.claude/ in the project root)');
  for (;;) {
    const answer = (await ask('Choose [1/2, default 1]: ')).trim().toLowerCase();
    if (answer === '' || answer === '1' || answer === 'g' || answer === 'global' || answer === 'user') return 'global';
    if (answer === '2' || answer === 'p' || answer === 'project') return 'project';
    console.log(`  Invalid choice '${answer}'. Enter 1, 2, or press Enter for global.`);
  }
}

export async function pickProjectRoot(defaultRoot, ask) {
  const answer = (await ask(`Project root [${defaultRoot}]: `)).trim();
  return answer === '' ? defaultRoot : answer;
}

export async function confirm(message, ask, { defaultYes = false } = {}) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = (await ask(`${message} [${hint}]: `)).trim().toLowerCase();
  if (answer === '') return defaultYes;
  return answer === 'y' || answer === 'yes';
}
