import React, { useState, useEffect, useRef } from 'react';
import { ComponentPackage, QueuedComponent, QueueItemStatus } from '../types';
import { SandboxedPreview } from './SandboxedPreview';
import { 
  X, 
  Layers, 
  Sparkles, 
  Clipboard, 
  Check, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Eye, 
  Play, 
  ArrowRight, 
  FileCode, 
  Code2, 
  ChevronRight, 
  ChevronLeft,
  ListOrdered,
  RefreshCw,
  Globe,
  Sliders
} from 'lucide-react';

interface QueueLibraryDockProps {
  theme: 'obsidian' | 'frost';
  isOpen: boolean;
  onToggleOpen: () => void;
  onAddToCanvas: (comp: ComponentPackage) => void;
  onAddToMixer: (comp: ComponentPackage) => void;
  onInspectComponent: (comp: ComponentPackage) => void;
  initialQueue?: QueuedComponent[];
  onQueueChange?: (queue: QueuedComponent[]) => void;
}

/**
 * Auto-detects component title from HTML or CSS class
 */
function deriveNameFromCode(html: string, css: string): string {
  const classMatch = html.match(/class=["']([a-zA-Z0-9_-]+)/i);
  if (classMatch && classMatch[1]) {
    return classMatch[1]
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  const cssClassMatch = css.match(/\.([a-zA-Z0-9_-]+)\s*\{/i);
  if (cssClassMatch && cssClassMatch[1]) {
    return cssClassMatch[1]
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return `UI Component ${Math.floor(100 + Math.random() * 900)}`;
}

/**
 * Quick diagnostic parser for queued snippets
 */
function analyzeCode(html: string, css: string) {
  const htmlLines = html.split('\n').filter((l) => l.trim().length > 0).length;
  const cssRules = (css.match(/\{/g) || []).length;
  const hasKeyframes = /@keyframes/i.test(css);
  const hasHoverStates = /:hover/i.test(css);
  return { htmlLines, cssRules, hasKeyframes, hasHoverStates };
}

export const QueueLibraryDock: React.FC<QueueLibraryDockProps> = ({
  theme,
  isOpen,
  onToggleOpen,
  onAddToCanvas,
  onAddToMixer,
  onInspectComponent,
  initialQueue = [],
  onQueueChange,
}) => {
  const [activeTab, setActiveTab] = useState<'intake' | 'library'>('intake');
  const [queue, setQueue] = useState<QueuedComponent[]>(initialQueue);

  // Intake Form Fields
  const [htmlInput, setHtmlInput] = useState('');
  const [cssInput, setCssInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [autoQueueOnPaste, setAutoQueueOnPaste] = useState(false);
  const [directToMixer, setDirectToMixer] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [isUrlFetching, setIsUrlFetching] = useState(false);

  const isFrost = theme === 'frost';

  // Synchronize queue changes with parent / persistent storage
  useEffect(() => {
    if (initialQueue && initialQueue.length > 0 && queue.length === 0) {
      setQueue(initialQueue);
    }
  }, [initialQueue]);

  const updateAndNotifyQueue = (newQueue: QueuedComponent[]) => {
    setQueue(newQueue);
    if (onQueueChange) onQueueChange(newQueue);
  };

  const showNotification = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3500);
  };

  // 1-Click Clipboard Paste for HTML
  const handlePasteHtml = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setHtmlInput(text);
        if (!nameInput) {
          const derived = deriveNameFromCode(text, cssInput);
          setNameInput(derived);
        }
        showNotification('HTML pasted from clipboard!');
        checkAutoQueue(text, cssInput);
      }
    } catch {
      showNotification('Clipboard permission needed. Use manual paste.');
    }
  };

  // 1-Click Clipboard Paste for CSS
  const handlePasteCss = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCssInput(text);
        if (!nameInput) {
          const derived = deriveNameFromCode(htmlInput, text);
          setNameInput(derived);
        }
        showNotification('CSS pasted from clipboard!');
        checkAutoQueue(htmlInput, text);
      }
    } catch {
      showNotification('Clipboard permission needed. Use manual paste.');
    }
  };

  // Auto-enqueue trigger if enabled
  const checkAutoQueue = (h: string, c: string) => {
    if (autoQueueOnPaste && h.trim() && c.trim()) {
      setTimeout(() => {
        handleEnqueue(h, c);
      }, 700);
    }
  };

  // Enqueue new component
  const handleEnqueue = (overrideHtml?: string, overrideCss?: string) => {
    const rawHtml = (overrideHtml !== undefined ? overrideHtml : htmlInput).trim();
    const rawCss = (overrideCss !== undefined ? overrideCss : cssInput).trim();

    if (!rawHtml && !rawCss) {
      showNotification('Please paste HTML or CSS to enqueue.');
      return;
    }

    const compName = nameInput.trim() || deriveNameFromCode(rawHtml, rawCss);
    const diagnostics = analyzeCode(rawHtml, rawCss);

    const queuedItem: QueuedComponent = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: compName,
      status: 'ready',
      html: rawHtml || '<div class="preview-box">Pasted Component</div>',
      css: rawCss || '.preview-box { padding: 20px; color: #fff; }',
      js: '',
      sourceUrl: urlInput.trim() || undefined,
      sourceType: urlInput.trim() ? 'url_fetch' : 'manual_paste',
      createdAt: Date.now(),
      tags: ['queued', 'intake'],
      diagnostics,
    };

    const updated = [queuedItem, ...queue];
    updateAndNotifyQueue(updated);

    // If directToMixer is toggled on, immediately stage in Mixer
    if (directToMixer) {
      const pkg = convertToComponentPackage(queuedItem);
      onAddToMixer(pkg);
      showNotification(`Enqueued "${compName}" and sent to Mixer!`);
    } else {
      showNotification(`"${compName}" added to Queue Library! Ready for next component.`);
    }

    // Reset fields for the next quick paste!
    setHtmlInput('');
    setCssInput('');
    setNameInput('');
    setUrlInput('');
  };

  // Convert queued item to standard ComponentPackage
  const convertToComponentPackage = (q: QueuedComponent): ComponentPackage => {
    return {
      id: q.id.replace('queue-', 'comp-'),
      name: q.name,
      description: `Intake component queued via Quick Intake (${q.sourceType})`,
      author: 'User Intake',
      license: 'MIT',
      sourceUrl: q.sourceUrl || '',
      framework: 'html-css',
      html: q.html,
      css: q.css,
      js: q.js,
      tags: [...q.tags, 'intake'],
      canvasX: Math.round(150 + Math.random() * 400),
      canvasY: Math.round(150 + Math.random() * 300),
      width: 400,
      height: 470,
      createdAt: q.createdAt,
      updatedAt: Date.now(),
    };
  };

  // Handle URL fetch
  const handleFetchUrl = async () => {
    const target = urlInput.trim();
    if (!target || !/^https?:\/\//i.test(target)) {
      showNotification('Enter a valid http/https URL');
      return;
    }

    setIsUrlFetching(true);
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('Fetch failed');
      const text = await res.text();

      // Check Uiverse __NEXT_DATA__
      let extractedName = '';
      let extractedHtml = '';
      let extractedCss = '';

      if (text.includes('__NEXT_DATA__')) {
        const match = text.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            const post = data.props?.pageProps?.post;
            if (post) {
              extractedName = post.name || '';
              extractedHtml = post.html || '';
              extractedCss = post.css || '';
            }
          } catch {
            // ignore
          }
        }
      }

      if (extractedHtml || extractedCss) {
        setHtmlInput(extractedHtml);
        setCssInput(extractedCss);
        setNameInput(extractedName || deriveNameFromCode(extractedHtml, extractedCss));
        showNotification('Component extracted from link! Click Enqueue.');
      } else {
        showNotification('No clear HTML/CSS found at link.');
      }
    } catch (err) {
      showNotification('Could not load link. Paste directly into fields.');
    } finally {
      setIsUrlFetching(false);
    }
  };

  const handleDeleteItem = (id: string) => {
    const updated = queue.filter((q) => q.id !== id);
    updateAndNotifyQueue(updated);
    showNotification('Removed item from queue.');
  };

  const handleSendItemToCanvas = (item: QueuedComponent) => {
    const pkg = convertToComponentPackage(item);
    onAddToCanvas(pkg);
    showNotification(`Added "${item.name}" to Canvas!`);
  };

  const handleSendItemToMixer = (item: QueuedComponent) => {
    const pkg = convertToComponentPackage(item);
    onAddToMixer(pkg);
    showNotification(`Staged "${item.name}" in Mixer Tray!`);
  };

  const handleInspect = (item: QueuedComponent) => {
    const pkg = convertToComponentPackage(item);
    onInspectComponent(pkg);
  };

  const handleAddAllToCanvas = () => {
    queue.forEach((item, idx) => {
      const pkg = convertToComponentPackage(item);
      pkg.canvasX = 200 + (idx % 3) * 440;
      pkg.canvasY = 200 + Math.floor(idx / 3) * 510;
      onAddToCanvas(pkg);
    });
    showNotification(`Added all ${queue.length} components to Canvas!`);
  };

  const handleStageAllInMixer = () => {
    queue.forEach((item) => {
      const pkg = convertToComponentPackage(item);
      onAddToMixer(pkg);
    });
    showNotification(`Staged all ${queue.length} components in Mixer!`);
  };

  const handleClearAllQueue = () => {
    updateAndNotifyQueue([]);
    showNotification('Queue cleared.');
  };

  // If dock is closed, render a sleek floating toggle pill on the right screen edge
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggleOpen}
        className={`fixed top-20 right-0 z-40 px-3 py-2.5 rounded-l-2xl border-l border-t border-b shadow-2xl flex items-center gap-2 transition-all transform hover:-translate-x-1 ${
          isFrost 
            ? 'bg-white/95 border-slate-300 text-slate-800 shadow-slate-300/50' 
            : 'bg-[#0a0a0e]/95 border-sky-500/30 text-neutral-100 shadow-[0_4px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl'
        }`}
        title="Open Quick Intake & Queue Library"
      >
        <ChevronLeft className="w-4 h-4 text-sky-400" />
        <div className="flex flex-col items-start text-left">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-xs font-bold tracking-tight">Queue Library</span>
          </div>
          <span className="text-[10px] font-mono text-sky-400">
            {queue.length} {queue.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </button>
    );
  }

  return (
    <aside
      className={`fixed top-14 right-0 bottom-0 w-[420px] max-w-[95vw] z-40 border-l flex flex-col shadow-2xl backdrop-blur-2xl transition-all duration-300 ${
        isFrost
          ? 'bg-white/95 border-slate-200 text-slate-800'
          : 'bg-[#07070a]/95 border-white/10 text-neutral-100 shadow-[0_0_50px_rgba(0,0,0,0.9)]'
      }`}
    >
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
        isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-900/50 border-white/10'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
              <span>Quick Intake & Queue</span>
              {queue.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  {queue.length}
                </span>
              )}
            </h3>
            <p className="text-[10px] text-neutral-400">Paste HTML & CSS continuously into queue</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleOpen}
            className={`p-1.5 rounded-lg border transition-colors ${
              isFrost ? 'hover:bg-slate-200 border-slate-300' : 'hover:bg-white/10 border-white/10 text-neutral-400 hover:text-white'
            }`}
            title="Minimize Dock"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className={`px-4 pt-3 pb-2 border-b flex items-center gap-2 shrink-0 ${
        isFrost ? 'border-slate-200 bg-white' : 'border-white/5 bg-black/40'
      }`}>
        <button
          type="button"
          onClick={() => setActiveTab('intake')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'intake'
              ? isFrost
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Quick Intake</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'library'
              ? isFrost
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          <span>Queue Library</span>
          {queue.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-sky-500 text-black text-[9px] font-black flex items-center justify-center">
              {queue.length}
            </span>
          )}
        </button>
      </div>

      {/* Notification Toast */}
      {statusNotification && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-sky-400" />
          <span className="flex-1 truncate">{statusNotification}</span>
        </div>
      )}

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'intake' ? (
          <div className="space-y-4">
            {/* Quick URL Grab (Optional) */}
            <div className={`p-2.5 rounded-xl border space-y-1.5 ${
              isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-900/40 border-white/5'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-sky-400" />
                  <span>Direct URL (Uiverse / CodePen)</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://uiverse.io/name/card-123..."
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                    isFrost ? 'bg-white border-slate-300 text-slate-800' : 'bg-black/60 border-white/10 text-neutral-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleFetchUrl}
                  disabled={isUrlFetching}
                  className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-medium transition-colors shrink-0 flex items-center gap-1"
                >
                  {isUrlFetching ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Fetch'}
                </button>
              </div>
            </div>

            {/* Field 1: HTML Markup (Top) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold tracking-tight flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-sky-400" />
                  <span>1. HTML Markup</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500">
                    {htmlInput.length} chars
                  </span>
                  <button
                    type="button"
                    onClick={handlePasteHtml}
                    className={`px-2 py-0.5 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors ${
                      isFrost
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                        : 'bg-white/10 hover:bg-white/20 border-white/10 text-neutral-200'
                    }`}
                  >
                    <Clipboard className="w-3 h-3 text-sky-400" />
                    <span>Paste HTML</span>
                  </button>
                </div>
              </div>
              <textarea
                value={htmlInput}
                onChange={(e) => {
                  setHtmlInput(e.target.value);
                  if (!nameInput) setNameInput(deriveNameFromCode(e.target.value, cssInput));
                  checkAutoQueue(e.target.value, cssInput);
                }}
                rows={5}
                placeholder="Paste HTML here (e.g. <button class='btn'>Launch</button>)..."
                className={`w-full p-2.5 rounded-xl font-mono text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 transition-colors resize-y ${
                  isFrost
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-black/60 border-white/10 text-neutral-200 placeholder:text-neutral-600'
                }`}
              />
            </div>

            {/* Field 2: CSS Stylesheet (Bottom) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold tracking-tight flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>2. CSS Stylesheet</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500">
                    {cssInput.length} chars
                  </span>
                  <button
                    type="button"
                    onClick={handlePasteCss}
                    className={`px-2 py-0.5 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors ${
                      isFrost
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                        : 'bg-white/10 hover:bg-white/20 border-white/10 text-neutral-200'
                    }`}
                  >
                    <Clipboard className="w-3 h-3 text-indigo-400" />
                    <span>Paste CSS</span>
                  </button>
                </div>
              </div>
              <textarea
                value={cssInput}
                onChange={(e) => {
                  setCssInput(e.target.value);
                  if (!nameInput) setNameInput(deriveNameFromCode(htmlInput, e.target.value));
                  checkAutoQueue(htmlInput, e.target.value);
                }}
                rows={6}
                placeholder="Paste CSS rules here (e.g. .btn { background: #38bdf8; color: #000; })..."
                className={`w-full p-2.5 rounded-xl font-mono text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors resize-y ${
                  isFrost
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-black/60 border-white/10 text-neutral-200 placeholder:text-neutral-600'
                }`}
              />
            </div>

            {/* Component Name & Automation Toggles */}
            <div className={`p-3 rounded-xl border space-y-2.5 ${
              isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-900/40 border-white/5'
            }`}>
              <div>
                <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                  Component Title (Auto-Detected)
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Obsidian Cyan Telemetry Gauge"
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                    isFrost ? 'bg-white border-slate-300 text-slate-800' : 'bg-black/60 border-white/10 text-neutral-100'
                  }`}
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={autoQueueOnPaste}
                    onChange={(e) => setAutoQueueOnPaste(e.target.checked)}
                    className="rounded border-neutral-700 text-sky-500 focus:ring-0"
                  />
                  <span className="text-neutral-300">Auto-enqueue once both fields are pasted</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={directToMixer}
                    onChange={(e) => setDirectToMixer(e.target.checked)}
                    className="rounded border-neutral-700 text-sky-500 focus:ring-0"
                  />
                  <span className="text-neutral-300">Automatically stage in Mixer Tray</span>
                </label>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => handleEnqueue()}
              disabled={!htmlInput.trim() && !cssInput.trim()}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                htmlInput.trim() || cssInput.trim()
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-black shadow-sky-500/25 cursor-pointer transform hover:-translate-y-0.5'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4 text-black" />
              <span>Enqueue & Generate (Ready Next)</span>
            </button>
          </div>
        ) : (
          /* Tab 2: Queue Library */
          <div className="space-y-4">
            {/* Batch Controls */}
            {queue.length > 0 ? (
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/5">
                <div className="text-xs font-semibold text-neutral-400">
                  {queue.length} {queue.length === 1 ? 'component' : 'components'} ready
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddAllToCanvas}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[11px] font-semibold transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Send All to Canvas</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStageAllInMixer}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Stage in Mixer</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllQueue}
                    className="p-1 rounded-lg hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 transition-colors"
                    title="Clear All Queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-500">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-neutral-300">Queue is Empty</h4>
                  <p className="text-xs text-neutral-500">
                    Paste HTML & CSS in the Quick Intake tab to start stacking components here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('intake')}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-sky-500/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start Pasting</span>
                </button>
              </div>
            )}

            {/* List of Queued Components */}
            <div className="space-y-3">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    isFrost
                      ? 'bg-white border-slate-200 shadow-sm'
                      : 'bg-[#0f1016]/90 border-white/10 hover:border-sky-500/40 shadow-lg'
                  }`}
                >
                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                        <span>{item.name}</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          READY
                        </span>
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono mt-0.5">
                        <span>{item.diagnostics?.htmlLines || 1} HTML lines</span>
                        <span>•</span>
                        <span>{item.diagnostics?.cssRules || 1} CSS rules</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1 rounded-md text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Remove from Queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Micro Live Preview */}
                  <div className="w-full h-32 rounded-xl overflow-hidden border border-white/5 bg-black/50 relative mb-3">
                    <SandboxedPreview
                      html={item.html}
                      css={item.css}
                      js={item.js}
                      theme={theme}
                      scopeClass={`queue-preview-${item.id}`}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleInspect(item)}
                      className={`py-1.5 px-2 rounded-xl border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${
                        isFrost
                          ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300 hover:text-white'
                      }`}
                    >
                      <Eye className="w-3 h-3 text-sky-400" />
                      <span>Inspect</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendItemToCanvas(item)}
                      className="py-1.5 px-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Canvas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendItemToMixer(item)}
                      className="py-1.5 px-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      <span>Mixer</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
