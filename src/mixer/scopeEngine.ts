export function generateScopeId(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return `scope_${Math.abs(hash).toString(36)}`;
}

/**
 * Scopes CSS selectors to a specific container class,
 * preserving @keyframes, @media queries, and font faces,
 * while safely remapping 'body', ':root', and 'html'.
 */
export function scopeCss(rawCss: string, scopeClass: string): string {
  if (!rawCss) return '';

  // Clean comments
  const clean = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');

  let result = '';
  let i = 0;
  const len = clean.length;

  while (i < len) {
    // Check for @ rules
    if (clean[i] === '@') {
      const atRuleMatch = clean.slice(i).match(/^@[a-zA-Z-]+[^{;]*/);
      if (atRuleMatch) {
        const atRule = atRuleMatch[0].trim();
        i += atRule.length;

        if (atRule.startsWith('@keyframes') || atRule.startsWith('@-webkit-keyframes') || atRule.startsWith('@font-face')) {
          // Keyframes and font-face blocks shouldn't prefix inner selectors
          let braceDepth = 0;
          let blockStart = i;
          while (i < len) {
            if (clean[i] === '{') {
              braceDepth++;
            } else if (clean[i] === '}') {
              braceDepth--;
              if (braceDepth === 0) {
                i++;
                break;
              }
            }
            i++;
          }
          result += `${atRule} ${clean.slice(blockStart, i)}\n`;
          continue;
        } else if (atRule.startsWith('@media') || atRule.startsWith('@supports')) {
          // Media query: recursively scope interior rules
          while (i < len && clean[i] !== '{') i++;
          if (i < len && clean[i] === '{') {
            i++; // skip '{'
            let braceDepth = 1;
            let innerStart = i;
            while (i < len && braceDepth > 0) {
              if (clean[i] === '{') braceDepth++;
              else if (clean[i] === '}') braceDepth--;
              if (braceDepth === 0) break;
              i++;
            }
            const innerCss = clean.slice(innerStart, i);
            i++; // skip closing '}'
            result += `${atRule} {\n${scopeCss(innerCss, scopeClass)}\n}\n`;
            continue;
          }
        }
      }
    }

    // Find selector block
    const nextBrace = clean.indexOf('{', i);
    if (nextBrace === -1) {
      break;
    }

    const rawSelectors = clean.slice(i, nextBrace).trim();
    i = nextBrace + 1;

    let braceDepth = 1;
    const bodyStart = i;
    while (i < len && braceDepth > 0) {
      if (clean[i] === '{') braceDepth++;
      else if (clean[i] === '}') braceDepth--;
      if (braceDepth === 0) break;
      i++;
    }
    const ruleBody = clean.slice(bodyStart, i);
    i++; // skip closing '}'

    if (!rawSelectors) continue;

    // Process selectors
    const selectors = rawSelectors.split(',').map(s => s.trim()).filter(Boolean);
    const scopedSelectors = selectors.map(sel => {
      // Remap body, html, :root to scopeClass
      if (sel === 'body' || sel === 'html' || sel === ':root' || sel === '*') {
        return `.${scopeClass}`;
      }
      if (sel.startsWith('body ') || sel.startsWith('html ')) {
        return `.${scopeClass} ${sel.slice(5)}`;
      }
      return `.${scopeClass} ${sel}`;
    });

    result += `${scopedSelectors.join(', ')} {\n${ruleBody}\n}\n`;
  }

  return result;
}

/**
 * Builds a sandboxed standalone HTML document with strict CSP and error telemetry.
 */
export function buildSandboxedDocument(
  html: string,
  css: string,
  js: string,
  options: {
    theme?: 'obsidian' | 'frost';
    scopeClass?: string;
  } = {}
): string {
  const { theme = 'obsidian', scopeClass } = options;
  const processedCss = scopeClass ? scopeCss(css, scopeClass) : css;
  const bg = theme === 'frost' ? '#f8fafc' : '#000000';
  const fg = theme === 'frost' ? '#0f172a' : '#ffffff';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'none'; font-src * data:; img-src * data: blob:;">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: ${bg};
      color: ${fg};
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .sandboxed-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    ${processedCss}
  </style>
  <script>
    window.onerror = function(msg, url, line, col, error) {
      window.parent.postMessage({
        type: 'SANDBOX_ERROR',
        error: { message: msg, line: line, col: col }
      }, '*');
      return false;
    };
  </script>
</head>
<body>
  <div class="sandboxed-container ${scopeClass || ''}">
    ${html}
  </div>
  <script>
    try {
      (function() {
        ${js}
      })();
    } catch(err) {
      window.parent.postMessage({
        type: 'SANDBOX_RUNTIME_ERROR',
        error: { message: err.message, stack: err.stack }
      }, '*');
    }
  </script>
</body>
</html>`;
}
