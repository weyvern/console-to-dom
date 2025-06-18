# Console to DOM

Pipe your browser’s `console.*` output into any DOM element with style‑aware, XSS‑safe rendering — perfect for demos, online editors and in‑app consoles.

```ts
import consoleToDOM from '@weyvern/console-to-dom';

consoleToDOM({ output: document.getElementById('out') });
console.log({ answer: 42 });
```

---

## Features

- **Zero‑dependency**
- Customisable classes, emojis and sanitiser
- Optional source line numbers (`main.ts:12:5`)
- Works in all evergreen browsers
- Ships with full **TypeScript** definitions
- Dual **ESM + CommonJS** builds

## Installation

```bash
npm i @weyveren/console-to-dom
```

or directly from a CDN:

```html
<script type="module">
  import consoleToDOM from 'https://unpkg.com/console-to-dom/dist/esm/console-to-dom.js';
  consoleToDOM();
</script>
```

## Usage

```ts
import consoleToDOM from '@weyveren/console-to-dom';

consoleToDOM({
  output: document.querySelector('#console'),
  classNames: {
    outputLine: 'console-line',
    log: 'console-log',
    warn: 'console-warn',
    info: 'console-info',
    error: 'console-error'
  },
  showLineNumber: true
});
```

### Options

| Option           | Type                        | Default         | Description                          |
| ---------------- | --------------------------- | --------------- | ------------------------------------ |
| `output`         | `HTMLElement`               | `document.body` | Container that receives log lines    |
| `classNames`     | `ConsoleOverrideClassNames` | built‑in object | CSS classes for each log level       |
| `showLineNumber` | `boolean`                   | `true`          | Append `file:line:col` to each entry |
| `sanitiseHTML`   | `(input: string) => string` | basic escape fn | Override to customise XSS handling   |

### Styling

Bring your own CSS or start from the included `style.css`:

```css
.console-line {
}
.console-log {
}
.console-info {
}
.console-warn {
}
.console-error {
}
.console-key {
}
.console-undefined {
}
.console-primitive,
.console-null {
}
```

### TypeScript

```ts
import type { CreateConsoleOverrideOptions } from '@weyvern/console-to-dom';
```

---

## License

MIT — see [LICENSE](LICENSE) for details.
