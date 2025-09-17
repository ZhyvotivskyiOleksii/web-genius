import type { Plugin } from 'prettier';

export type SupportedParser =
  | 'html'
  | 'css'
  | 'babel'
  | 'typescript'
  | 'json'
  | 'markdown'
  | 'yaml';

function pickParser(path: string): SupportedParser {
  const ext = (path.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
    case 'vue': // Vue SFC → форматиться як JS/TS
      return 'babel';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'json':
      return 'json';
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'yml':
    case 'yaml':
      return 'yaml';
    default:
      return 'babel';
  }
}

export async function prettierFormat(
  code: string,
  path: string
): Promise<string> {
  if (typeof window === 'undefined') return code;
  try {
    const prettier = await import('prettier/standalone');
    const parser = pickParser(path);

    const plugins: Plugin[] = [];

    if (parser === 'html') {
      plugins.push((await import('prettier/plugins/html')).default as Plugin);
    }
    if (parser === 'css') {
      plugins.push((await import('prettier/plugins/postcss')).default as Plugin);
    }
    if (parser === 'babel' || parser === 'json') {
      const babel = (await import('prettier/plugins/babel')).default as Plugin;
      const estree = (await import('prettier/plugins/estree')).default as Plugin;
      plugins.push(babel, estree);
    }
    if (parser === 'typescript') {
      const ts = (await import('prettier/plugins/typescript')).default as Plugin;
      const estree = (await import('prettier/plugins/estree')).default as Plugin;
      plugins.push(ts, estree);
    }
    if (parser === 'markdown') {
      plugins.push(
        (await import('prettier/plugins/markdown')).default as Plugin
      );
    }
    if (parser === 'yaml') {
      plugins.push((await import('prettier/plugins/yaml')).default as Plugin);
    }

    return prettier.format(code, {
      parser,
      plugins,
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      singleQuote: true,
      trailingComma: 'es5',
      bracketSpacing: true,
      jsxSingleQuote: false,
    } as any);
  } catch (e) {
    console.error('Prettier format failed', e);
    return code;
  }
}
