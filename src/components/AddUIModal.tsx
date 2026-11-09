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
  ArrowRight
} from 'lucide-react';

interface AddUIModalProps {
  theme: 'obsidian' | 'frost';
  onClose: () => void;
  onSaveComponent: (pkg: ComponentPackage) => void;
}

export const AddUIModal: React.FC<AddUIModalProps> = ({
  theme,
  onClose,
  onSaveComponent,
}) => {
  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [tags, setTags] = useState('card, custom');
  const [html, setHtml] = useState('<div class="my-component">\n  <h2>Hello World</h2>\n  <button>Click me</button>\n</div>');
  const [css, setCss] = useState('.my-component {\n  padding: 24px;\n  border-radius: 12px;\n  background: #111;\n  color: #fff;\n  border: 1px solid #333;\n  text-align: center;\n}\nbutton {\n  margin-top: 12px;\n  padding: 8px 16px;\n  border-radius: 6px;\n  background: #38bdf8;\n  color: #000;\n  border: none;\n  font-weight: 600;\n  cursor: pointer;\n}');
  const [js, setJs] = useState('const btn = document.querySelector(".my-component button");\nif (btn) {\n  btn.addEventListener("click", () => alert("Component Interactive!"));\n}');
  const [activeTab, setActiveTab] = useState<'smart' | 'manual'>('smart');
  const [smartInput, setSmartInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isFrost = theme === 'frost';

  // Smart paste parser that extracts <style>, <script>, and HTML automatically
  const handleSmartPaste = (rawText: string) => {
    setSmartInput(rawText);
    try {
      let extractedCss = '';
      let extractedJs = '';
      let extractedHtml = rawText;

      // Extract style tags
      const styleMatches = rawText.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      if (styleMatches) {
        styleMatches.forEach((m) => {
          extractedCss += m.replace(/<\/?style[^>]*>/gi, '') + '\n';
          extractedHtml = extractedHtml.replace(m, '');
        });
      }

      // Extract script tags
      const scriptMatches = rawText.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      if (scriptMatches) {
        scriptMatches.forEach((m) => {
          extractedJs += m.replace(/<\/?script[^>]*>/gi, '') + '\n';
          extractedHtml = extractedHtml.replace(m, '');
        });
      }

      // Remove outer html/body tags if present
      extractedHtml = extractedHtml
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<html[^>]*>([\s\S]*?)<\/html>/gi, '$1')
        .replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, '')
        .replace(/<body[^>]*>([\s\S]*?)<\/body>/gi, '$1')
        .trim();

      if (extractedCss.trim()) setCss(extractedCss.trim());
      if (extractedJs.trim()) setJs(extractedJs.trim());
      if (extractedHtml.trim()) setHtml(extractedHtml.trim());

      setStatusMessage('Smart Paste: Extracted HTML, CSS, and Scripts successfully!');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch {
      setStatusMessage('Smart parse failed to split blocks cleanly. Using manual fallback.');
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      setStatusMessage('Please enter a component name.');
      return;
    }
    if (!html.trim() && !css.trim()) {
      setStatusMessage('Component code cannot be empty.');
      return;
    }

    const newPkg: ComponentPackage = {
      id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      description: 'Imported user component',
      // Author and license are no longer collected: components come from free public sources,
      // and the source URL is the reference. The fields stay on the type for older saved data.
      author: 'Community',
      license: 'Free / public',
      sourceUrl: sourceUrl.trim() || 'Direct Paste',
      framework: 'html-css',
      html,
      css,
      js,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
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
      <div className={`w-full max-w-5xl h-[88vh] rounded-3xl flex flex-col shadow-2xl border overflow-hidden ${
        isFrost ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0a0a0a] border-white/10 text-neutral-100'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${
          isFrost ? 'border-slate-100 bg-slate-50' : 'border-white/[0.08] bg-black/40'
        }`}>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-bold tracking-tight">Add UI Component to Canvas</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center p-0.5 rounded-lg border text-xs ${
              isFrost ? 'bg-slate-100 border-slate-200' : 'bg-neutral-900 border-white/10'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('smart')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === 'smart' ? (isFrost ? 'bg-white shadow text-slate-900' : 'bg-white/15 text-white') : 'text-neutral-500'
                }`}
              >
                Smart Paste
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === 'manual' ? (isFrost ? 'bg-white shadow text-slate-900' : 'bg-white/15 text-white') : 'text-neutral-500'
                }`}
              >
                Manual Split
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

        {/* Status Alert if any */}
        {statusMessage && (
          <div className="px-6 py-2 bg-sky-500/15 border-b border-sky-500/30 text-sky-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Content Body: Left Form + Right Live Sandbox Preview */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Edit Pane */}
          <div className={`w-full md:w-1/2 p-6 overflow-y-auto border-r flex flex-col gap-4 ${
            isFrost ? 'border-slate-100' : 'border-white/[0.08]'
          }`}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Component Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Glowing Neon Cyber Card"
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

            {activeTab === 'smart' ? (
              <div className="flex-1 flex flex-col">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Paste Combined HTML + CSS Code Snippet
                </label>
                <textarea
                  value={smartInput}
                  onChange={(e) => handleSmartPaste(e.target.value)}
                  placeholder="Paste direct snippet from Uiverse, CodePen, or GitHub containing HTML and <style>...</style> blocks here..."
                  className={`w-full flex-1 min-h-[220px] p-3 rounded-lg font-mono text-xs border resize-none focus:outline-none ${
                    isFrost ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-neutral-950 border-white/10 text-neutral-200'
                  }`}
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 mb-1">HTML Markup</label>
                  <textarea
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    rows={4}
                    className={`w-full p-2 rounded-lg font-mono text-xs border resize-none focus:outline-none ${
                      isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-white/10 text-neutral-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 mb-1">CSS Styles</label>
                  <textarea
                    value={css}
                    onChange={(e) => setCss(e.target.value)}
                    rows={5}
                    className={`w-full p-2 rounded-lg font-mono text-xs border resize-none focus:outline-none ${
                      isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-white/10 text-neutral-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 mb-1">JavaScript Logic (Optional)</label>
                  <textarea
                    value={js}
                    onChange={(e) => setJs(e.target.value)}
                    rows={3}
                    className={`w-full p-2 rounded-lg font-mono text-xs border resize-none focus:outline-none ${
                      isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-white/10 text-neutral-200'
                    }`}
                  />
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
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

          {/* Right Live Sandbox Preview */}
          <div className={`w-full md:w-1/2 p-6 flex flex-col ${
            isFrost ? 'bg-slate-50/50' : 'bg-[#050505]'
          }`}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
              Live Sandboxed Preview
            </span>
            <div className={`flex-1 rounded-2xl overflow-hidden border shadow-inner ${
              isFrost ? 'bg-white border-slate-200' : 'bg-black border-white/10'
            }`}>
              <SandboxedPreview
                html={html}
                css={css}
                js={js}
                theme={theme}
                interactive={true}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
