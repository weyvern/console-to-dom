/*
 * Console to DOM
 * -----------------------
 * Pipe console output into any HTMLElement with optional colour‑coding,
 * line numbers and XSS‑safe HTML sanitisation.
 *
 * Example (ESM):
 *   import { createConsoleOverride } from 'console-override';
 *   createConsoleOverride({ output: document.getElementById('out') });
 */

// ────────────────────────────────────────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────────────────────────────────────────
export interface ConsoleOverrideClassNames {
  /** Wrapper element for every logged line */
  outputLine: string;
  /** Additional class appended when `console.log` is used */
  log: string;
  /** Additional class appended when `console.warn` is used */
  warn: string;
  /** Additional class appended when `console.info` is used */
  info: string;
  /** Additional class appended when `console.error` is used */
  error: string;
}

export interface CreateConsoleOverrideOptions {
  /** Element that receives the rendered log lines (default: `document.body`) */
  output?: HTMLElement;
  /** Class names used to decorate the DOM elements (see `defaultClassNames`) */
  classNames?: ConsoleOverrideClassNames;
  /** Whether to append the originating source line to each log line (default: `true`) */
  showLineNumber?: boolean;
  /** Custom HTML sanitiser to avoid XSS in stringified output */
  sanitiseHTML?: (input: string) => string;
}

export type ConsoleMethod = 'log' | 'warn' | 'info' | 'error';
export type HandleFunction = (...args: unknown[]) => void;

// ────────────────────────────────────────────────────────────────────────────────
//  Defaults
// ────────────────────────────────────────────────────────────────────────────────

/** Default class names applied to DOM nodes */
const defaultClassNames: ConsoleOverrideClassNames = {
  outputLine: 'console-line',
  log: 'console-log',
  warn: 'console-warn',
  info: 'console-info',
  error: 'console-error'
};

/** Naïve HTML sanitiser – escapes HTML entities to mitigate XSS */
const defaultSanitise = (input: string): string => {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
};

// ────────────────────────────────────────────────────────────────────────────────
//  Implementation helpers (internal)
// ────────────────────────────────────────────────────────────────────────────────

const customStringify = (
  value: unknown,
  sanitiseHTML: (s: string) => string,
  indent = 1
): string => {
  const pad = (lvl: number) => '  '.repeat(lvl);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return (
      '[' +
      value.map(v => `\n${pad(indent)}${customStringify(v, sanitiseHTML, indent + 1)}`).join(', ') +
      `\n${pad(indent - 1)}]`
    );
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const inner = entries
      .map(
        ([k, v]) =>
          `${pad(indent)}<span class='console-key'>${sanitiseHTML(k)}:</span> ${customStringify(
            v,
            sanitiseHTML,
            indent + 1
          )}`
      )
      .join(',\n');
    return `{\n${inner}\n${pad(indent - 1)}}`;
  }
  if (typeof value === 'string') return `'${sanitiseHTML(value)}'`;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return `<span class='console-primitive'>${value}</span>`;
  if (value === null) return "<span class='console-null'>null</span>";
  if (typeof value === 'undefined') return "<span class='console-undefined'>undefined</span>";
  return sanitiseHTML(String(value));
};

const extractLocation = (): string => {
  const err = new Error();
  if (!err.stack) return '';
  const frames = err.stack.split(/\n+/).slice(1); // skip error message line
  const skipPattern = /createConsoleOverride|consoleOverride|node_modules|<anonymous>/;

  for (const frame of frames) {
    if (skipPattern.test(frame)) continue;

    // Chrome / Firefox:   at func (https://…/file.js:10:15)
    const m = frame.match(/(?:at\s+.*?\(|\s*)([\w.:/~-]+?):(\d+):(\d+)/);
    if (m) {
      const [, , line, col] = m;
      return `main.ts:${line}:${col}`; // Replace file name with deterministic placeholder
    }

    // Safari: func@https://…/file.js:10:15
    const s = frame.match(/@([\w.:/~-]+):(\d+):(\d+)/);
    if (s) {
      const [, , line, col] = s;
      return `main.ts:${line}:${col}`;
    }
  }
  return '';
};

const buildOutputLine = (
  method: ConsoleMethod,
  classNames: ConsoleOverrideClassNames,
  html: string,
  fileAndLine = '',
  emoji?: string
): HTMLDivElement => {
  const wrapper = document.createElement('div');
  wrapper.className = `${classNames.outputLine} ${classNames[method] ?? ''}`.trim();

  const line = document.createElement('div');
  line.innerHTML = `${emoji ? `<span style='margin-right:.5rem;'>${emoji}</span>` : ''}${html}`;
  wrapper.appendChild(line);

  if (fileAndLine) {
    const meta = document.createElement('div');
    meta.textContent = fileAndLine;
    wrapper.appendChild(meta);
  }
  return wrapper;
};

const makeHandler =
  (
    originalConsole: Console,
    output: HTMLElement,
    method: ConsoleMethod,
    classNames: ConsoleOverrideClassNames,
    showLineNumber: boolean,
    sanitiseHTML: (input: string) => string,
    emoji?: string
  ): HandleFunction =>
  (...args: unknown[]): void => {
    let html = '';

    args.forEach(arg => {
      if (arg instanceof Error) {
        arg = arg.message ?? String(arg);
      }
      if (typeof arg === 'string') {
        html += sanitiseHTML(arg);
      } else if (
        typeof arg === 'number' ||
        typeof arg === 'boolean' ||
        typeof arg === 'bigint' ||
        arg === null ||
        typeof arg === 'undefined'
      ) {
        html += `<pre>${customStringify(arg, sanitiseHTML)}</pre>`;
      } else {
        html += `<pre>${customStringify(arg, sanitiseHTML)}</pre>`;
      }
    });

    const line = buildOutputLine(
      method,
      classNames,
      html,
      showLineNumber ? extractLocation() : '',
      emoji
    );
    output.appendChild(line);

    // Auto‑scroll to newest entry
    document.documentElement.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });

    // Preserve original console behaviour asynchronously to keep ordering intact
    queueMicrotask(originalConsole[method].bind(originalConsole, ...args));
  };

// ────────────────────────────────────────────────────────────────────────────────
//  Public API
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Overrides the global `console` object and pipes its output into a DOM
 * container of your choice.
 */
const consoleToDOM = ({
  output = document.body,
  classNames = defaultClassNames,
  showLineNumber = true,
  sanitiseHTML = defaultSanitise
}: CreateConsoleOverrideOptions = {}): void => {
  if (!output) throw new Error("createConsoleOverride › 'output' element not found");

  // Preserve native console implementation
  const originalConsole: Console = { ...console } as Console;

  console.log = makeHandler(
    originalConsole,
    output,
    'log',
    classNames,
    showLineNumber,
    sanitiseHTML
  );
  console.warn = makeHandler(
    originalConsole,
    output,
    'warn',
    classNames,
    showLineNumber,
    sanitiseHTML,
    '⚠️'
  );
  console.info = makeHandler(
    originalConsole,
    output,
    'info',
    classNames,
    showLineNumber,
    sanitiseHTML,
    'ℹ️'
  );
  console.error = makeHandler(
    originalConsole,
    output,
    'error',
    classNames,
    showLineNumber,
    sanitiseHTML,
    '🚨'
  );
};

export default consoleToDOM;
