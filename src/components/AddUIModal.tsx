import React, { useState } from 'react';
import { ComponentPackage } from '../types';
import { SandboxedPreview } from './SandboxedPreview';
import { 
  X, 
  Sparkles, 
  Clipboard, 
  Check, 
  AlertCircle, 
  FileCode, 
  Layers,
  ArrowRight,
  Globe,
  Code2,
  Trash2,
  Loader2
} from 'lucide-react';

interface AddUIModalProps {
  theme: 'obsidian' | 'frost';
  onClose: () => void;
  onSaveComponent: (pkg: ComponentPackage) => void;
}

/**
 * Intelligent parser that extracts HTML, CSS, and JS even if <style> tags are omitted.
 */
function splitCombinedHtmlCssJs(rawText: string): {
  html: string;
  css: string;
  js: string;
  name?: string;
} {
  let text = rawText.trim();
  let extractedCss = '';
  let extractedJs = '';
  let extractedHtml = '';

  // 1. Extract <style> blocks if present
  const styleMatches = text.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  if (styleMatches) {
    styleMatches.forEach((m) => {
      extractedCss += m.replace(/<\/?style[^>]*>/gi, '') + '\n';
      text = text.replace(m, '');
    });
  }

  // 2. Extract <script> blocks if present
  const scriptMatches = text.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  if (scriptMatches) {
    scriptMatches.forEach((m) => {
      extractedJs += m.replace(/<\/?script[^>]*>/gi, '') + '\n';
      text = text.replace(m, '');
    });
  }

  // 3. Remove outer html / body wrappers
  text = text
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<html[^>]*>([\s\S]*?)<\/html>/gi, '$1')
    .replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, '')
    .replace(/<body[^>]*>([\s\S]*?)<\/body>/gi, '$1')
    .trim();

  // 4. If no <style> was found, check if text has raw CSS without <style> tags
  if (!extractedCss.trim()) {
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(text);
    const hasCssBlocks = /[{][\s\S]*?[}]/.test(text);

    if (!hasHtmlTags && hasCssBlocks) {
      // Entire snippet is raw CSS
      extractedCss = text;
      text = '';
    } else if (hasHtmlTags && hasCssBlocks) {
      // Mixed text: HTML above or below raw CSS
      const firstCssIdx = text.search(/(?:\/\*[\s\S]*?\*\/|\.[a-zA-Z0-9_-]+|#[a-zA-Z0-9_-]+|@keyframes|@media)\s*\{/);
      if (firstCssIdx !== -1) {
        extractedHtml = text.slice(0, firstCssIdx).trim();
        extractedCss = text.slice(firstCssIdx).trim();
        text = '';
      }
    }
  }

  if (text) extractedHtml = text;

  // Auto-derive a clean component name from the primary class
  let name: string | undefined;
  const classMatch = extractedHtml.match(/class=["']([a-zA-Z0-9_-]+)/i);
  if (classMatch) {
    name = classMatch[1]
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return { html: extractedHtml.trim(), css: extractedCss.trim(), js: extractedJs.trim(), name };
}

/**
 * Derives a human-readable title from an HTML string or URL.
 */
function deriveComponentName(html: string, sourceUrl?: string): string {
  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      const slug = parts[parts.length - 1];
      if (slug && slug.length > 2) {
        return slug
          .split(/[-_]/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
    } catch {
      // ignore
    }
  }

  const classMatch = html.match(/class=["']([a-zA-Z0-9_-]+)/i);
  if (classMatch && classMatch[1]) {
    return classMatch[1]
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  const tagMatch = html.match(/<([a-zA-Z0-9]+)/i);
  if (tagMatch && tagMatch[1]) {
    return `${tagMatch[1].charAt(0).toUpperCase() + tagMatch[1].slice(1)} Component`;
  }

  return 'Custom UI Component';
}

const SAMPLE_TEMPLATE = {
  name: 'Cyberpunk Neon Button',
  html: `<button class="cyber-neon-btn">
  <span>INITIALIZE</span>
</button>`,
  css: `body {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
.cyber-neon-btn {
  position: relative;
  padding: 14px 32px;
  background: #080808;
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.5);
  border-radius: 10px;
  font-family: monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
  cursor: pointer;
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.25);
  transition: all 0.3s ease;
}
.cyber-neon-btn:hover {
  background: #38bdf8;
  color: #000;
  box-shadow: 0 0 30px rgba(56, 189, 248, 0.7);
  transform: translateY(-2px);
}`,
  js: `const btn = document.querySelector('.cyber-neon-btn');
if (btn) {
  btn.addEventListener('click', () => {
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => { btn.style.transform = ''; }, 150);
  });
}`
};

export const AddUIModal: React.FC<AddUIModalProps> = ({
  theme,
  onClose,
  onSaveComponent,
}) => {
  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [tags, setTags] = useState('custom, ui');
  const [html, setHtml] = useState(SAMPLE_TEMPLATE.html);
  const [css, setCss] = useState(SAMPLE_TEMPLATE.css);
  const [js, setJs] = useState(SAMPLE_TEMPLATE.js);
  const [showJs, setShowJs] = useState(false);
  const [activeTab, setActiveTab] = useState<'separate' | 'smart' | 'url'>('separate');
  const [smartInput, setSmartInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const isFrost = theme === 'frost';

  const showStatus = (text: string, type: 'success' | 'error' | 'info' = 'info', duration = 4000) => {
    setStatusMessage({ text, type });
    if (duration > 0) {
      setTimeout(() => setStatusMessage(null), duration);
    }
  };

  // Smart combined paste handler
  const handleSmartPaste = (rawText: string) => {
    setSmartInput(rawText);
    const trimmed = rawText.trim();
    if (!trimmed) return;

    // Detect if pasted a URL
    if (/^https?:\/\//i.test(trimmed)) {
      setUrlInput(trimmed);
      setSourceUrl(trimmed);
      showStatus('Detected URL. Click "Import from Link" to fetch this component.', 'info');
      return;
    }

    try {
      const parsed = splitCombinedHtmlCssJs(trimmed);
      if (parsed.html) setHtml(parsed.html);
      if (parsed.css) setCss(parsed.css);
      if (parsed.js) setJs(parsed.js);
      if (parsed.name && !name) setName(parsed.name);

      showStatus('Smart Paste: Extracted HTML and CSS successfully!', 'success');
    } catch {
      showStatus('Could not cleanly separate blocks. You can edit HTML and CSS in the Separate tab.', 'error');
    }
  };

  // Fetch component directly from URL (e.g. Uiverse.io, GitHub, CodePen)
  const handleFetchUrl = async () => {
    const targetUrl = urlInput.trim();
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      showStatus('Please enter a valid http:// or https:// URL.', 'error');
      return;
    }

    setUrlBusy(true);
    setStatusMessage({ text: 'Fetching component from link...', type: 'info' });

    try {
      // 1. Try direct fetch first
      let pageText = '';
      try {
        const res = await fetch(targetUrl, { signal: AbortSignal.timeout(6000) });
        if (res.ok) pageText = await res.text();
      } catch {
        // Direct fetch failed (likely CORS), try CORS proxy gateway
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const resProxy = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
        if (resProxy.ok) pageText = await resProxy.text();
      }

      if (!pageText) {
        throw new Error('Could not fetch page. The site may block external scripts.');
      }

      // Check for Uiverse Next.js __NEXT_DATA__
      let extractedName = '';
      let extractedHtml = '';
      let extractedCss = '';

      if (pageText.includes('__NEXT_DATA__')) {
        const nextDataMatch = pageText.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
          try {
            const nextData = JSON.parse(nextDataMatch[1]);
            const post = nextData.props?.pageProps?.post;
            if (post) {
              extractedName = post.name || '';
              extractedHtml = post.html || '';
              extractedCss = post.css || '';
            }
          } catch {
            // fallback
          }
        }
      }

      // Fallback: parse raw HTML & <style> tags from page
      if (!extractedHtml && !extractedCss) {
        const parsed = splitCombinedHtmlCssJs(pageText);
        extractedHtml = parsed.html;
        extractedCss = parsed.css;
        extractedName = parsed.name || '';
      }

      if (extractedHtml || extractedCss) {
        if (extractedHtml) setHtml(extractedHtml);
        if (extractedCss) setCss(extractedCss);
        setSourceUrl(targetUrl);
        const derived = extractedName || deriveComponentName(extractedHtml, targetUrl);
        setName(derived);
        showStatus(`Imported "${derived}" successfully!`, 'success');
        setActiveTab('separate');
      } else {
        throw new Error('No usable HTML/CSS found on that page.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fetch failed';
      showStatus(
        `${msg} Tip: On Uiverse or CodePen, click "HTML" and "CSS" and paste them in the Separate tab.`,
        'error',
        6000
      );
    } finally {
      setUrlBusy(false);
    }
  };

  // Clipboard paste helpers
  const handlePasteClipboard = async (target: 'html' | 'css' | 'smart') => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          if (target === 'html') {
            // Check if user accidentally pasted CSS into HTML box
            if (text.includes('{') && !text.includes('<')) {
              setCss(text);
              showStatus('Detected CSS in clipboard — applied to CSS Styles!', 'info');
            } else {
              setHtml(text);
              if (!name) setName(deriveComponentName(text, sourceUrl));
              showStatus('Pasted HTML from clipboard!', 'success');
            }
          } else if (target === 'css') {
            setCss(text);
            showStatus('Pasted CSS from clipboard!', 'success');
          } else if (target === 'smart') {
            handleSmartPaste(text);
          }
        }
      }
    } catch {
      showStatus('Clipboard permission not granted. Use Cmd+V or Ctrl+V to paste.', 'info');
    }
  };

  const handleClear = () => {
    setName('');
    setHtml('');
    setCss('');
    setJs('');
    setSmartInput('');
    setSourceUrl('');
    showStatus('Cleared all fields.', 'info', 2000);
  };

  const handleLoadSample = () => {
    setName(SAMPLE_TEMPLATE.name);
    setHtml(SAMPLE_TEMPLATE.html);
    setCss(SAMPLE_TEMPLATE.css);
    setJs(SAMPLE_TEMPLATE.js);
    showStatus('Loaded starter template.', 'info', 2000);
  };

  const handleSave = () => {
    if (!html.trim() && !css.trim()) {
      showStatus('Component code cannot be empty. Paste HTML or CSS first.', 'error');
      return;
    }

    const finalName = name.trim() || deriveComponentName(html, sourceUrl);

    const newPkg: ComponentPackage = {
      id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: finalName,
      description: 'Imported user component',
      author: 'Community',
      license: 'Free / public',
      sourceUrl: sourceUrl.trim() || 'Direct Paste',
      framework: 'html-css',
      html: html.trim(),
      css: css.trim(),
      js: js.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      canvasX: 200 + Math.random() * 200,
      canvasY: 200 + Math.random() * 200,
      width: 400,
      height: 470,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      variationType: 'original',
    };

    onSaveComponent(newPkg);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className={`w-full max-w-6xl h-[88vh] rounded-3xl flex flex-col shadow-2xl border overflow-hidden ${
        isFrost ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0a0a0a] border-white/10 text-neutral-100'
      }`}>
        {/* Header Bar */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${
          isFrost ? 'border-slate-100 bg-slate-50' : 'border-white/[0.08] bg-black/40'
        }`}>
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-bold tracking-tight">Add UI Component to Canvas</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Switcher Tabs */}
            <div className={`flex items-center p-0.5 rounded-lg border text-xs ${
              isFrost ? 'bg-slate-100 border-slate-200' : 'bg-neutral-900 border-white/10'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('separate')}
                className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'separate'
                    ? (isFrost ? 'bg-white shadow text-slate-900' : 'bg-white/15 text-white')
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-sky-400" />
                <span>HTML & CSS</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('smart')}
                className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'smart'
                    ? (isFrost ? 'bg-white shadow text-slate-900' : 'bg-white/15 text-white')
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Smart Paste</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'url'
                    ? (isFrost ? 'bg-white shadow text-slate-900' : 'bg-white/15 text-white')
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Import Link</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg border transition-colors ${
                isFrost ? 'hover:bg-slate-100 border-slate-200 text-slate-600' : 'hover:bg-white/10 border-white/10 text-neutral-400'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div className={`px-6 py-2 border-b text-xs flex items-center justify-between transition-colors ${
            statusMessage.type === 'error'
              ? 'bg-red-500/15 border-red-500/30 text-red-300'
              : statusMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
          }`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Content Body: Left Input Editor + Right Sandboxed Preview */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Pane */}
          <div className={`w-full md:w-1/2 p-6 overflow-y-auto border-r flex flex-col gap-4 ${
            isFrost ? 'border-slate-100' : 'border-white/[0.08]'
          }`}>
            {/* Component Name & Source URL */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Component Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Glowing Neon Card (auto-generated if empty)"
                  className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-none ${
                    isFrost ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-neutral-900 border-white/10 text-white'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Source Reference URL
                </label>
                <input
                  type="text"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://uiverse.io/..."
                  className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-none ${
                    isFrost ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-neutral-900 border-white/10 text-white'
                  }`}
                />
              </div>
            </div>

            {/* TAB 1: Separate HTML & CSS (Default & Most Common for Uiverse) */}
            {activeTab === 'separate' && (
              <div className="flex-1 flex flex-col gap-4">
                {/* HTML Input Box */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      1. HTML Markup
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePasteClipboard('html')}
                      className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 transition-colors ${
                        isFrost ? 'bg-slate-100 border-slate-200 hover:bg-slate-200' : 'bg-white/5 border-white/10 hover:bg-white/10 text-neutral-300'
                      }`}
                    >
                      <Clipboard className="w-2.5 h-2.5 text-sky-400" />
                      <span>Paste from Clipboard</span>
                    </button>
                  </div>
                  <textarea
                    value={html}
                    onChange={(e) => {
                      setHtml(e.target.value);
                      if (!name && e.target.value.trim()) {
                        setName(deriveComponentName(e.target.value, sourceUrl));
                      }
                    }}
                    placeholder="Paste HTML snippet here, e.g. <div class='card'>...</div>"
                    rows={6}
                    className={`w-full p-3 rounded-lg font-mono text-xs border resize-none focus:outline-none ${
                      isFrost ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-neutral-950 border-white/10 text-neutral-200'
                    }`}
                    spellCheck={false}
                  />
                </div>

                {/* CSS Input Box */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      2. CSS Styles
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePasteClipboard('css')}
                      className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 transition-colors ${
                        isFrost ? 'bg-slate-100 border-slate-200 hover:bg-slate-200' : 'bg-white/5 border-white/10 hover:bg-white/10 text-neutral-300'
                      }`}
                    >
                      <Clipboard className="w-2.5 h-2.5 text-purple-400" />
                      <span>Paste from Clipboard</span>
                    </button>
                  </div>
                  <textarea
                    value={css}
                    onChange={(e) => setCss(e.target.value)}
                    placeholder="Paste CSS styles here, e.g. .card { width: 280px; background: #111; ... }"
                    rows={7}
                    className={`w-full p-3 rounded-lg font-mono text-xs border resize-none focus:outline-none ${
                      isFrost ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-neutral-950 border-white/10 text-neutral-200'
                    }`}
                    spellCheck={false}
                  />
                </div>

                {/* Optional JS Accordion */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowJs(!showJs)}
                    className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <span>{showJs ? '▾ Hide JavaScript Logic' : '▸ + Add JavaScript Logic (Optional)'}</span>
                  </button>
                  {showJs && (
                    <textarea
                      value={js}
                      onChange={(e) => setJs(e.target.value)}
                      placeholder="Optional vanilla JS for interactions..."
                      rows={3}
                      className={`w-full mt-2 p-2.5 rounded-lg font-mono text-xs border resize-none focus:outline-none ${
                        isFrost ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-neutral-950 border-white/10 text-neutral-200'
                      }`}
                      spellCheck={false}
                    />
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Smart Combined Paste */}
            {activeTab === 'smart' && (
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    Paste Combined Snippet or Document
                  </label>
                  <button
                    type="button"
                    onClick={() => handlePasteClipboard('smart')}
                    className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 transition-colors ${
                      isFrost ? 'bg-slate-100 border-slate-200 hover:bg-slate-200' : 'bg-white/5 border-white/10 hover:bg-white/10 text-neutral-300'
                    }`}
                  >
                    <Clipboard className="w-2.5 h-2.5 text-amber-400" />
                    <span>Paste Clipboard</span>
                  </button>
                </div>
                <textarea
                  value={smartInput}
                  onChange={(e) => handleSmartPaste(e.target.value)}
                  placeholder="Paste any combined snippet here! Works with or without <style> tags, CodePen exports, or mixed HTML & CSS..."
                  className={`w-full flex-1 min-h-[260px] p-3 rounded-lg font-mono text-xs border resize-none focus:outline-none ${
                    isFrost ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-neutral-950 border-white/10 text-neutral-200'
                  }`}
                  spellCheck={false}
                />
                <p className="text-[10px] text-neutral-500 leading-snug">
                  Smart Paste automatically isolates CSS rules and HTML elements, even without &lt;style&gt; tags.
                </p>
              </div>
            )}

            {/* TAB 3: Import from Link / URL */}
            {activeTab === 'url' && (
              <div className="flex-1 flex flex-col gap-4">
                <div className={`p-4 rounded-2xl border flex flex-col gap-3 ${
                  isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-white/10'
                }`}>
                  <label className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span>Paste Component URL</span>
                  </label>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Enter a direct link from Uiverse.io, CodePen, or GitHub. The engine extracts HTML, CSS, and metadata automatically.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !urlBusy && urlInput.trim()) {
                          handleFetchUrl();
                        }
                      }}
                      placeholder="https://uiverse.io/author/component-name"
                      className={`flex-1 px-3 py-2 rounded-lg text-xs border focus:outline-none ${
                        isFrost ? 'bg-white border-slate-200 text-slate-800' : 'bg-neutral-900 border-white/10 text-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleFetchUrl}
                      disabled={urlBusy || !urlInput.trim()}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                    >
                      {urlBusy ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <Globe className="w-3.5 h-3.5" />
                          <span>Fetch & Load</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border text-[11px] leading-relaxed ${
                  isFrost ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                }`}>
                  💡 <b>Quick Tip:</b> If the remote site protects their pages against direct cross-origin fetching, simply copy the <b>HTML</b> and <b>CSS</b> from the website and paste them into the <b>HTML & CSS</b> tab!
                </div>
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1 transition-colors ${
                    isFrost ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-red-500' : 'bg-white/5 border-white/10 text-neutral-400 hover:text-red-400'
                  }`}
                  title="Clear inputs"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1 transition-colors ${
                    isFrost ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                  }`}
                  title="Load a sample neon button"
                >
                  <Sparkles className="w-3 h-3 text-sky-400" />
                  <span>Load Sample</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    isFrost ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                  }`}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold transition-all shadow-lg shadow-sky-500/25 flex items-center gap-1.5"
                >
                  <span>Save to Canvas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Live Sandbox Preview */}
          <div className={`w-full md:w-1/2 p-6 flex flex-col ${
            isFrost ? 'bg-slate-50/50' : 'bg-[#050505]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Live Sandboxed Preview
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
                Interactive
              </span>
            </div>
            <div className={`flex-1 rounded-2xl overflow-hidden border shadow-inner ${
              isFrost ? 'bg-white border-slate-200' : 'bg-black border-white/10'
            }`}>
              {html || css ? (
                <SandboxedPreview
                  html={html}
                  css={css}
                  js={js}
                  theme={theme}
                  interactive={true}
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-neutral-500 gap-3">
                  <FileCode className="w-8 h-8 text-neutral-600" />
                  <p className="text-xs max-w-xs">
                    Paste HTML and CSS on the left to see the live interactive component rendered here in real time.
                  </p>
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sky-400 text-xs font-medium"
                  >
                    Load Sample Template
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
