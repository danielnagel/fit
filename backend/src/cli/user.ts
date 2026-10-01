import readline from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { pool } from '../db.js';
import { assignData, createUser, deleteUser, listUsers, setPassword, type CliIo } from './userCommands.js';

const KEY_ENTER = new Set(['\n', '\r']);
const KEY_EOF = '\u0004'; // Ctrl-D
const KEY_INTERRUPT = '\u0003'; // Ctrl-C
const KEY_BACKSPACE = new Set(['\u007f', '\b']);

// Liest eine Zeile ohne Echo, damit ein interaktiv eingegebenes Passwort (docker compose exec ist
// standardmaessig ein TTY) weder in der Shell-History noch in `ps` landet wie ein Argument.
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (KEY_ENTER.has(char) || char === KEY_EOF) {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === KEY_INTERRUPT) {
          process.stdout.write('\n');
          process.exit(130);
        }
        if (KEY_BACKSPACE.has(char)) {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function prompt(question: string) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

const io: CliIo = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
  isTTY: Boolean(process.stdin.isTTY),
  prompt,
  promptHidden,
};

const USAGE = `Befehle:
  create [<username> <password>] [--no-seed]
  list
  set-password <username> [<password>]
  delete <username|id> [--yes]
  assign-data --from <username|id> --to <username|id>`;

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    allowNegative: true,
    options: {
      seed: { type: 'boolean', default: true },
      yes: { type: 'boolean', default: false },
      from: { type: 'string' },
      to: { type: 'string' },
    },
  });
  const [first, second] = positionals;

  switch (command) {
    case 'create':
      return createUser(io, { username: first, password: second, seed: values.seed });
    case 'list':
      return listUsers(io);
    case 'set-password':
      return setPassword(io, { username: first, password: second });
    case 'delete':
      return deleteUser(io, { ref: first, yes: values.yes });
    case 'assign-data':
      return assignData(io, { from: values.from, to: values.to });
    default:
      io.err(USAGE);
      return 1;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: Error) => {
    console.error(`Fehler: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
