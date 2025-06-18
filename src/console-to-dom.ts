export interface ConsoleOverrideClassNames {
  outputLine: string;
  log: string;
  warn: string;
  info: string;
  error: string;
}

export interface CreateConsoleOverrideOptions {
  output?: HTMLElement;
  classNames?: ConsoleOverrideClassNames;
  showLineNumber?: boolean;
  sanitiseHTML?: (input: string) => string;
}

export type ConsoleMethod = 'log' | 'warn' | 'info' | 'error';
export type HandleFunction = (...args: unknown[]) => void;

const defaultClassNames: ConsoleOverrideClassNames = {
  outputLine: 'console-line',
  log: 'console-log',
  warn: 'console-warn',
  info: 'console-info',
  error: 'console-error'
};

const defaultSanitise = (input: string): string => {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
};

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

const extractLocationFromStack = (stack: string): string => {
  const lastFrame = stack.split(/\n+/).pop()!;
  const skipPattern = /consoleToDOM|makeHandler|node_modules|vite|<anonymous>|setTimeout/;

  if (skipPattern.test(lastFrame)) return '';

  const match = lastFrame.match(/(?:at\s+.*?\(|\s*)(.*?):(\d+):(\d+)/);
  if (match) {
    const [, file, line, col] = match;
    return `${file.split('/').pop()?.split('?')[0]}:${line}:${col}`;
  }

  const safariMatch = lastFrame.match(/@(.*?):(\d+):(\d+)/);
  if (safariMatch) {
    const [, file, line, col] = safariMatch;
    return `${file.split('/').pop()?.split('?')[0]}:${line}:${col}`;
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
    output: HTMLElement,
    method: ConsoleMethod,
    classNames: ConsoleOverrideClassNames,
    showLineNumber: boolean,
    sanitiseHTML: (input: string) => string,
    emoji?: string
  ): HandleFunction =>
  (...args: unknown[]): void => {
    let html = '';
    const stack = args.pop() as string | undefined;
    args.forEach(arg => {
      if (arg instanceof Error) {
        arg = arg.message ?? String(arg);
      }
      if (typeof arg === 'string') {
        html += sanitiseHTML(arg);
      } else {
        html += `<pre>${customStringify(arg, sanitiseHTML)}</pre>`;
      }
    });
    const fileAndLine = showLineNumber && stack ? extractLocationFromStack(stack) : '';
    const line = buildOutputLine(method, classNames, html, fileAndLine, emoji);
    output.appendChild(line);
    document.documentElement.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
  };

const createConsoleProxy = (method: ConsoleMethod, handler: HandleFunction): HandleFunction => {
  return new Proxy(console[method], {
    apply(_target, _thisArg, args) {
      const error = new Error();
      const capturedStack = error.stack;
      queueMicrotask(_target.bind(console, ...args));
      handler(...args, capturedStack);
    }
  });
};

const consoleToDOM = ({
  output = document.body,
  classNames = defaultClassNames,
  showLineNumber = true,
  sanitiseHTML = defaultSanitise
}: CreateConsoleOverrideOptions): void => {
  if (!output) throw new Error("consoleToDOM › 'output' element not found");
  console.log = createConsoleProxy(
    'log',
    makeHandler(output, 'log', classNames, showLineNumber, sanitiseHTML)
  );
  console.warn = createConsoleProxy(
    'warn',
    makeHandler(output, 'warn', classNames, showLineNumber, sanitiseHTML, '⚠️')
  );
  console.info = createConsoleProxy(
    'info',
    makeHandler(output, 'info', classNames, showLineNumber, sanitiseHTML, 'ℹ️')
  );
  console.error = createConsoleProxy(
    'error',
    makeHandler(output, 'error', classNames, showLineNumber, sanitiseHTML, '🚨')
  );
};

export default consoleToDOM;
