import React, { useState } from 'react';
import { ComponentPackage } from '../types';
import { SandboxedPreview } from './SandboxedPreview';
import { 
  X, 
  Maximize2, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Code2, 
  Eye, 
  Copy, 
  Check, 
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface PopoutPreviewProps {
  component: ComponentPackage;
  theme: 'obsidian' | 'frost';
  onClose: () => void;
  onSaveUpdates: (updated: ComponentPackage) => void;
  onAddToMixer: (comp: ComponentPackage) => void;
}

export const PopoutPreview: React.FC<PopoutPreviewProps> = ({
  component,
  theme,
  onClose,
  onSaveUpdates,
  onAddToMixer,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [htmlCode, setHtmlCode] = useState(component.html);
  const [cssCode, setCssCode] = useState(component.css);
  const [jsCode, setJsCode] = useState(component.js);
  const [codeLanguage, setCodeLanguage] = useState<'html' | 'css' | 'js'>('html');
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const isFrost = theme === 'frost';

  const handleApplyChanges = () => {
    const updated: ComponentPackage = {
      ...component,
      html: htmlCode,
      css: cssCode,
      js: jsCode,
      updatedAt: Date.now(),
    };
    onSaveUpdates(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleCopyFull = () => {
    const combined = `<!-- HTML -->\n${htmlCode}\n\n/* CSS */\n${cssCode}\n\n// JS\n${jsCode}`;
    navigator.clipboard.writeText(combined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className={`w-full max-w-5xl h-[85vh] rounded-3xl flex flex-col shadow-2xl border overflow-hidden transition-colors ${
        isFrost 
          ? 'bg-white border-slate-200 shadow-slate-400/20 text-slate-800' 
          : 'bg-[#090909] border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-neutral-100'
      }`}>
        {/* Modal Top Header Bar */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${
          isFrost ? 'border-slate-100 bg-slate-50/80' : 'border-white/[0.08] bg-black/50'
        }`}>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold tracking-tight">{component.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${
              isFrost ? 'bg-slate-200/60 border-slate-300 text-slate-600' : 'bg-neutral-800 border-white/10 text-neutral-400'
            }`}>
              {component.author} • {component.license}
            </span>
          </div>

          {/* Controls: Viewport, Tabs, Close */}
          <div className="flex items-center gap-3">
            {/* Viewport Width Preset Selectors */}
            {activeTab === 'preview' && (
              <div className={`flex items-center p-0.5 rounded-lg border ${
                isFrost ? 'bg-slate-100 border-slate-200' : 'bg-neutral-900 border-white/10'
              }`}>
                <button
                  type="button"
                  onClick={() => setViewportMode('desktop')}
                  className={`p-1.5 rounded-md text-xs transition-colors ${viewportMode === 'desktop' ? (isFrost ? 'bg-white shadow text-slate-900' : 'bg-white/15 text-white') : 'text-neutral-500'}`}
                  title="Full Viewport"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewportMode('tablet')}
                  className={`p-1.5 rounded-md text-xs transition-colors ${viewportMode === 'tablet' ? (isFrost ? 'bg-white shadow text-slate-900' : 'bg-white/15 text-white') : 'text-neutral-500'}`}
                  title="Tablet View (768px)"
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewportMode('mobile')}
                  className={`p-1.5 rounded-md text-xs transition-colors ${viewportMode === 'mobile' ? (isFrost ? 'bg-white shadow text-slate-900' : 'bg-white/15 text-white') : 'text-neutral-500'}`}
                  title="Mobile View (375px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* View / Code Tabs */}
            <div className={`flex items-center p-0.5 rounded-lg border ${
              isFrost ? 'bg-slate-100 border-slate-200' : 'bg-neutral-900 border-white/10'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  activeTab === 'preview' 
                    ? isFrost ? 'bg-white shadow text-slate-900' : 'bg-white/15 text-white' 
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live View</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  activeTab === 'code' 
                    ? isFrost ? 'bg-white shadow text-slate-900' : 'bg-white/15 text-white' 
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Source Editor</span>
              </button>
            </div>

            {/* Add to Mixer Button */}
            <button
              type="button"
              onClick={() => onAddToMixer(component)}
              className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/40 text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Add to Mixer</span>
            </button>

            {/* Close Button */}
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

        {/* Modal Center Body */}
        <div className="flex-1 overflow-hidden relative flex">
          {activeTab === 'preview' ? (
            <div className={`w-full h-full flex items-center justify-center p-6 ${
              isFrost ? 'bg-slate-100/60' : 'bg-[#030303]'
            }`}>
              <div 
                className={`h-full rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 border ${
                  viewportMode === 'mobile' ? 'w-[375px]' : viewportMode === 'tablet' ? 'w-[768px]' : 'w-full'
                } ${isFrost ? 'border-slate-300 bg-white' : 'border-white/10 bg-black'}`}
              >
                <SandboxedPreview
                  html={htmlCode}
                  css={cssCode}
                  js={jsCode}
                  theme={theme}
                  interactive={true}
                  className="w-full h-full"
                />
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col md:flex-row">
              {/* Code Language Navigation */}
              <div className={`w-full md:w-48 p-4 border-r flex flex-col gap-2 ${
                isFrost ? 'border-slate-100 bg-slate-50' : 'border-white/[0.08] bg-black/40'
              }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Editor File</span>
                <button
                  type="button"
                  onClick={() => setCodeLanguage('html')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                    codeLanguage === 'html' ? (isFrost ? 'bg-white shadow text-sky-600 font-bold' : 'bg-sky-500/20 text-sky-400 border border-sky-500/30') : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  index.html
                </button>
                <button
                  type="button"
                  onClick={() => setCodeLanguage('css')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                    codeLanguage === 'css' ? (isFrost ? 'bg-white shadow text-sky-600 font-bold' : 'bg-sky-500/20 text-sky-400 border border-sky-500/30') : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  styles.css
                </button>
                <button
                  type="button"
                  onClick={() => setCodeLanguage('js')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                    codeLanguage === 'js' ? (isFrost ? 'bg-white shadow text-sky-600 font-bold' : 'bg-sky-500/20 text-sky-400 border border-sky-500/30') : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  script.js
                </button>

                <div className="mt-auto flex flex-col gap-2 pt-4">
                  <button
                    type="button"
                    onClick={handleCopyFull}
                    className={`w-full py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      isFrost ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-white/[0.05] border-white/10 text-neutral-300 hover:bg-white/[0.1]'
                    }`}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy All'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyChanges}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-emerald-900/30"
                  >
                    {isSaved ? <Check className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>{isSaved ? 'Applied!' : 'Apply Code'}</span>
                  </button>
                </div>
              </div>

              {/* Code TextArea */}
              <div className="flex-1 p-4 bg-[#0a0a0a] flex flex-col">
                <textarea
                  value={codeLanguage === 'html' ? htmlCode : codeLanguage === 'css' ? cssCode : jsCode}
                  onChange={(e) => {
                    if (codeLanguage === 'html') setHtmlCode(e.target.value);
                    else if (codeLanguage === 'css') setCssCode(e.target.value);
                    else setJsCode(e.target.value);
                  }}
                  className="w-full h-full bg-transparent text-emerald-400/90 font-mono text-xs p-4 resize-none focus:outline-none selection:bg-neutral-800"
                  spellCheck={false}
                  placeholder={`Write or edit ${codeLanguage.toUpperCase()} here...`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
