// Antigravity Code Mixer - Quick Ingest Content Script
(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__antigravityCopierInjected) return;
  window.__antigravityCopierInjected = true;

  console.log('[Antigravity Copier] Active on', window.location.href);

  // Extract component payload from current page
  function extractComponentData() {
    let name = document.title || 'Extracted Component';
    let html = '';
    let css = '';
    let js = '';

    // 1. Try Uiverse __NEXT_DATA__
    const nextDataEl = document.getElementById('__NEXT_DATA__');
    if (nextDataEl) {
      try {
        const nextData = JSON.parse(nextDataEl.textContent || '{}');
        const post = nextData.props?.pageProps?.post;
        if (post) {
          name = post.name || name;
          html = post.html || '';
          css = post.css || '';
        }
      } catch (err) {
        console.warn('[Antigravity Copier] NextData parsing failed:', err);
      }
    }

    // 2. Fallback: Parse code blocks / pre tags
    if (!html && !css) {
      const codeBlocks = Array.from(document.querySelectorAll('pre, code'));
      codeBlocks.forEach((block) => {
        const text = block.textContent || '';
        if (text.includes('{') && text.includes('}') && (text.includes('px') || text.includes('color') || text.includes('background'))) {
          if (!css) css = text;
        } else if (text.includes('<') && text.includes('>')) {
          if (!html) html = text;
        }
      });
    }

    // Clean up name
    name = name.replace(/\s*[-|]\s*Uiverse\.io.*$/i, '').trim();

    return {
      name,
      html: html.trim(),
      css: css.trim(),
      js: js.trim(),
      sourceUrl: window.location.href,
      copiedAt: Date.now(),
    };
  }

  // Show floating HUD button
  function createFloatingHud() {
    const hud = document.createElement('div');
    hud.id = 'antigravity-copier-hud';
    hud.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const btn = document.createElement('button');
    btn.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 18px;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#000;font-weight:700;font-size:12px;border-radius:14px;border:1px solid rgba(255,255,255,0.4);box-shadow:0 8px 30px rgba(14,165,233,0.4);cursor:pointer;transition:transform 0.15s ease;">
        <span style="font-size:16px;">⚡</span>
        <span>Copy to Code Mixer</span>
      </div>
    `;
    btn.style.border = 'none';
    btn.style.background = 'transparent';
    btn.style.padding = '0';
    btn.style.cursor = 'pointer';

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1.0)';
    });

    btn.addEventListener('click', async () => {
      const data = extractComponentData();
      if (!data.html && !data.css) {
        showToast('⚠️ No HTML/CSS detected. Copy code manually or open component view.', '#ef4444');
        return;
      }

      // Copy structured JSON to clipboard
      const payload = JSON.stringify(data, null, 2);
      try {
        await navigator.clipboard.writeText(payload);
        showToast(`✅ Copied "${data.name}"! Ready in Code Mixer.`, '#10b981');
      } catch {
        showToast('⚠️ Clipboard write failed. Please check permissions.', '#ef4444');
      }
    });

    hud.appendChild(btn);
    document.body.appendChild(hud);
  }

  // Floating Toast
  function showToast(text, bgColor = '#0ea5e9') {
    let toast = document.getElementById('antigravity-copier-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'antigravity-copier-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 24px;
        z-index: 1000000;
        padding: 10px 16px;
        border-radius: 12px;
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        box-shadow: 0 6px 20px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        transition: opacity 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.style.background = bgColor;
    toast.textContent = text;
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
    }, 3500);
  }

  // Inject once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingHud);
  } else {
    createFloatingHud();
  }
})();
