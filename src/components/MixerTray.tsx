import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ComponentPackage, MixPull } from '../types';
import {
  EXTRACTION_OPTIONS,
  ExtractionTarget,
  PULL_TARGET_LABELS,
  PullTarget,
  STYLE_CATEGORIES,
  analyzeStyles,
  availableTargets,
  StyleInventory,
} from '../mixer/styleExtraction';
import { buildMixTrace, defaultPull, resolveMix } from '../mixer/mixPlan';
import {
  AiStatus,
  aiStatus,
  aiSupported,
  downloadLocalModel,
  openGeminiKeyPage,
  openOllamaDownloadPage,
  readClipboardKey,
  removeApiKey,
  saveApiKey,
} from '../ai/aiClient';
import type { PullProgress } from '../storage/nativeBridge';
import { useDictation } from '../ai/useDictation';
import {
  Sparkles,
  X,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Activity,
  Mic,
  Loader2,
  ArrowRight,
  KeyRound,
} from 'lucide-react';

/** How the mix is made: instant rule-based blend, local AI (Qwen via Ollama), or Gemini in the cloud. */
export type MixProvider = 'builtin' | 'local' | 'gemini';

export interface StartMixOptions {
  prompt: string;
  freedom: number;
  destinationId: string;
  pulls: MixPull[];
  provider: MixProvider;
}

interface MixerTrayProps {
  stagedComponents: ComponentPackage[];
  theme: 'obsidian' | 'frost';
  isMixing: boolean;
  supervisorStep: string;
  supervisorMessage: string;
  notice?: string | null;
  onRemoveFromTray: (id: string) => void;
  onClearTray: () => void;
  onStartMix: (options: StartMixOptions) => void;
}

export const MixerTray: React.FC<MixerTrayProps> = ({
  stagedComponents,
  theme,
  isMixing,
  supervisorStep,
  supervisorMessage,
  notice,
  onRemoveFromTray,
  onClearTray,
  onStartMix,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [freedom, setFreedom] = useState(0.75);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [pulls, setPulls] = useState<Record<string, MixPull>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  // AI. The Gemini key lives in the desktop app's secure storage, never on this page.
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [provider, setProvider] = useState<MixProvider>('builtin');
  const providerChosen = useRef(false);
  const [connecting, setConnecting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [pullState, setPullState] = useState<PullProgress | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Local Whisper handles dictation unless Gemini is the chosen engine
  const dictation = useDictation(
    (text) => setPrompt((p) => (p.trim() ? `${p.trim()} ${text}` : text)),
    provider === 'gemini' && ai?.hasKey ? 'gemini' : 'local'
  );

  const isFrost = theme === 'frost';
  const desktopAi = aiSupported();

  const refreshStatus = async () => {
    const s = await aiStatus();
    setAi(s);
    return s;
  };

  // Load status once, pick the best available engine, then keep local status fresh
  useEffect(() => {
    refreshStatus().then((s) => {
      if (providerChosen.current || !s) return;
      setProvider(s.hasKey ? 'gemini' : s.local.running && s.local.hasModel ? 'local' : 'builtin');
    });
  }, []);

  useEffect(() => {
    if (provider !== 'local' || pullState) return;
    const timer = window.setInterval(refreshStatus, 3000);
    return () => window.clearInterval(timer);
  }, [provider, pullState]);

  // While connecting, notice a Gemini key as soon as it is copied from Google's page
  useEffect(() => {
    if (!connecting || ai?.hasKey) return;
    let cancelled = false;
    const check = async () => {
      const key = await readClipboardKey().catch(() => null);
      if (!cancelled) setCopiedKey(key);
    };
    check();
    const timer = window.setInterval(check, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [connecting, ai?.hasKey]);

  const startConnect = () => {
    setConnecting(true);
    setKeyError(null);
    openGeminiKeyPage().catch((e) => setKeyError(e instanceof Error ? e.message : 'Could not open the browser.'));
  };

  const connectWithKey = async (key: string) => {
    setKeyBusy(true);
    setKeyError(null);
    try {
      await saveApiKey(key);
      setKeyDraft('');
      setCopiedKey(null);
      setConnecting(false);
      const s = await refreshStatus();
      if (s?.hasKey) setProvider('gemini');
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : 'Could not save the key.');
    } finally {
      setKeyBusy(false);
    }
  };

  const handleRemoveKey = async () => {
    await removeApiKey();
    const s = await refreshStatus();
    setProvider(s?.local.running && s.local.hasModel ? 'local' : 'builtin');
  };

  const handleDownloadModel = async () => {
    setLocalError(null);
    setPullState({ status: 'Starting...', completed: 0, total: 0 });
    try {
      await downloadLocalModel(setPullState);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'The download failed.');
    } finally {
      setPullState(null);
      await refreshStatus();
    }
  };

  // The destination receives the pulled traits. Default: the last component added.
  const destination = stagedComponents.find((c) => c.id === destinationId) ?? stagedComponents[stagedComponents.length - 1];
  const sources = stagedComponents.filter((c) => destination && c.id !== destination.id);

  const inventories = useMemo(() => {
    const out: Record<string, StyleInventory> = {};
    stagedComponents.forEach((c) => (out[c.id] = analyzeStyles(c.css)));
    return out;
  }, [stagedComponents]);

  const pullFor = (id: string): MixPull => pulls[id] ?? defaultPull(id);
  const updatePull = (id: string, patch: Partial<MixPull>) =>
    setPulls((prev) => ({ ...prev, [id]: { ...(prev[id] ?? defaultPull(id)), ...patch } }));

  const toggleCategory = (id: string, cat: ExtractionTarget) => {
    const current = pullFor(id).categories;
    updatePull(id, { categories: current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat] });
  };

  const toggleItem = (id: string, key: string) => {
    const current = pullFor(id).excludedItems;
    updatePull(id, { excludedItems: current.includes(key) ? current.filter((k) => k !== key) : [...current, key] });
  };

  /** How many lines each option would pull from one source (unchecked lines don't count). */
  const countFor = (source: ComponentPackage, cat: ExtractionTarget): number => {
    if (cat === 'structure') return 1;
    if (cat === 'behavior') return source.js && source.js.trim() ? 1 : 0;
    const excluded = pullFor(source.id).excludedItems;
    return inventories[source.id][cat].filter((i) => i.transferable && !excluded.includes(i.key)).length;
  };

  const summaryFor = (source: ComponentPackage): string => {
    const pull = pullFor(source.id);
    const lines = STYLE_CATEGORIES.filter((c) => pull.categories.includes(c)).reduce((n, c) => n + countFor(source, c), 0);
    const bits = [`${lines} style line${lines === 1 ? '' : 's'}`];
    if (pull.categories.includes('structure')) bits.push('markup');
    if (pull.categories.includes('behavior') && countFor(source, 'behavior')) bits.push('script');
    return `${bits.join(' + ')} \u2192 ${pull.target === 'auto' ? 'matching parts' : PULL_TARGET_LABELS[pull.target].toLowerCase()}`;
  };

  // Plain-language list of what is taken from what, and where it goes
  const trace = useMemo(() => {
    if (!destination || stagedComponents.length < 2) return [];
    return buildMixTrace(
      resolveMix({
        sourceComponents: stagedComponents,
        destinationId: destination.id,
        pulls: sources.map((s) => pulls[s.id] ?? defaultPull(s.id)),
      })
    );
  }, [stagedComponents, destination, sources, pulls]);

  if (stagedComponents.length === 0 && !isMixing) {
    return null;
  }

  const subtle = isFrost ? 'text-slate-500' : 'text-neutral-400';
  const faint = isFrost ? 'text-slate-400' : 'text-neutral-500';
  const field = isFrost ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-neutral-950 border-white/10 text-white';

  return (
    <div className="fixed bottom-6 right-6 z-40 w-full max-w-md transition-all duration-300">
      <div
        className={`rounded-3xl border shadow-2xl backdrop-blur-2xl overflow-hidden ${
          isFrost
            ? 'bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-400/30'
            : 'bg-[#080808]/95 border-white/[0.12] text-neutral-100 shadow-[0_16px_48px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.15)]'
        }`}
      >
        {/* Tray Header Bar */}
        <div
          className={`px-5 py-3 flex items-center justify-between border-b ${
            isFrost ? 'border-slate-100 bg-slate-50/70' : 'border-white/[0.06] bg-black/40'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-tight block">Code Mixer Tray</span>
              <span className={`text-[10px] ${subtle}`}>
                {stagedComponents.length} component{stagedComponents.length === 1 ? '' : 's'} queued
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-1.5 rounded-lg border transition-colors ${
                isFrost ? 'hover:bg-slate-200 border-slate-200 text-slate-600' : 'hover:bg-white/10 border-white/10 text-neutral-400'
              }`}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={onClearTray}
              className={`p-1.5 rounded-lg border transition-colors hover:text-red-400 ${
                isFrost ? 'hover:bg-slate-200 border-slate-200 text-slate-500' : 'hover:bg-white/10 border-white/10 text-neutral-400'
              }`}
              title="Clear all from tray"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tray Body */}
        {isExpanded && destination && (
          <div className="p-4 flex flex-col gap-3.5 max-h-[72vh] overflow-y-auto">
            {/* Destination: what receives the pulled traits */}
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 ${subtle}`}>Put onto</span>
              <select
                value={destination.id}
                disabled={isMixing}
                onChange={(e) => setDestinationId(e.target.value)}
                className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs border focus:outline-none ${field}`}
              >
                {stagedComponents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sources: click one to choose what to pull from it and where it goes */}
            <div className="flex flex-col gap-1.5">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${subtle}`}>Pull from</span>
              {sources.length === 0 && (
                <p className={`text-[11px] ${faint}`}>
                  Add another component to pull from. Click Mix on a second card.
                </p>
              )}
              {sources.map((source) => {
                const pull = pullFor(source.id);
                const open = openId === source.id;
                const targets = availableTargets(destination.html);
                return (
                  <div
                    key={source.id}
                    className={`rounded-xl border ${isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-900/70 border-white/10'}`}
                  >
                    <div className="flex items-center gap-1 pr-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : source.id)}
                        className="flex-1 min-w-0 px-3 py-2 flex items-center gap-2 text-left"
                      >
                        {open ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                        <span className="text-xs font-medium truncate">{source.name}</span>
                        <span className={`ml-auto text-[10px] truncate ${faint}`}>{summaryFor(source)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveFromTray(source.id)}
                        className="text-neutral-500 hover:text-red-400"
                        title="Remove from tray"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {open && (
                      <div className="px-3 pb-3 flex flex-col gap-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {EXTRACTION_OPTIONS.map((opt) => {
                            const on = pull.categories.includes(opt.id);
                            const count = countFor(source, opt.id);
                            const empty = count === 0;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={isMixing || empty}
                                title={empty ? `No ${opt.label.toLowerCase()} code in ${source.name}` : opt.hint}
                                onClick={() => toggleCategory(source.id, opt.id)}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors flex items-center gap-1.5 disabled:opacity-35 ${
                                  on && !empty
                                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                                    : isFrost
                                    ? 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                                    : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                                }`}
                              >
                                <span>{opt.label}</span>
                                {opt.id !== 'structure' && opt.id !== 'behavior' && (
                                  <span className={`text-[9px] font-mono px-1 rounded ${on && !empty ? 'bg-sky-500/25' : 'bg-white/10'}`}>
                                    {count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 ${subtle}`}>Onto</span>
                          <select
                            value={pull.target}
                            disabled={isMixing}
                            onChange={(e) => updatePull(source.id, { target: e.target.value as PullTarget })}
                            className={`flex-1 min-w-0 px-2 py-1 rounded-lg text-[11px] border focus:outline-none ${field}`}
                          >
                            {targets.map((t) => (
                              <option key={t} value={t}>
                                {PULL_TARGET_LABELS[t]}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* The actual code behind each selected option, with where it lands */}
                        <div className={`max-h-40 overflow-y-auto rounded-lg border p-2 flex flex-col gap-0.5 ${field}`}>
                          {STYLE_CATEGORIES.filter((c) => pull.categories.includes(c)).length === 0 && (
                            <span className={`text-[10px] ${faint}`}>Turn on an option to see the code it would pull.</span>
                          )}
                          {STYLE_CATEGORIES.filter((c) => pull.categories.includes(c)).map((cat) => (
                            <div key={cat} className="mb-1">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-sky-400 mb-0.5">{cat}</div>
                              {inventories[source.id][cat].map((item) => {
                                const checked = item.transferable && !pull.excludedItems.includes(item.key);
                                const isColorValue = /^(#|rgb|hsl)/i.test(item.value);
                                const lands =
                                  pull.target === 'auto' ? item.target : PULL_TARGET_LABELS[pull.target].replace(/ \(.*\)$/, '').toLowerCase();
                                return (
                                  <label
                                    key={item.key}
                                    title={
                                      item.transferable
                                        ? `${item.selector} in ${source.name}`
                                        : `${item.selector} has no matching element in ${destination.name}, so it can't be applied`
                                    }
                                    className={`flex items-center gap-2 py-0.5 text-[10px] font-mono ${
                                      item.transferable ? 'cursor-pointer' : 'opacity-40'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={!item.transferable || isMixing}
                                      onChange={() => toggleItem(source.id, item.key)}
                                      className="accent-sky-500"
                                    />
                                    {isColorValue && (
                                      <span className="w-2.5 h-2.5 rounded-sm border border-white/20 shrink-0" style={{ background: item.value }} />
                                    )}
                                    <span className="truncate">
                                      {item.prop}: <span className={faint}>{item.value}</span>
                                    </span>
                                    <span className={`ml-auto shrink-0 truncate max-w-[110px] ${faint}`}>
                                      {item.transferable && lands ? `\u2192 ${lands}` : 'no match'}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mix plan: what is taken from what, and where it goes */}
            {trace.length > 0 && (
              <div className={`rounded-xl border p-2.5 ${isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-white/10'}`}>
                <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${subtle}`}>Mix plan</div>
                <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                  {trace.map((t, i) => (
                    <div key={i} className="text-[10px] leading-snug flex items-start gap-1.5">
                      <ArrowRight className="w-3 h-3 mt-px shrink-0 text-sky-400" />
                      <span>
                        <span className="font-semibold">{t.from}</span>
                        <span className={faint}> {t.what.toLowerCase()} </span>
                        {t.detail && <span className="font-mono text-[9px]">({t.detail}) </span>}
                        <span className={faint}>onto </span>
                        <span className="font-semibold">{t.to}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Direction: type it or dictate it */}
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Direct the mix (e.g. give the card the dial's glow)..."
                  disabled={isMixing}
                  className={`flex-1 min-w-0 px-3 py-2 rounded-xl text-xs border focus:outline-none ${field}`}
                />
                <button
                  type="button"
                  onClick={dictation.state === 'recording' ? dictation.stop : dictation.start}
                  disabled={isMixing || dictation.state === 'transcribing' || !desktopAi || (provider === 'gemini' && !ai?.hasKey)}
                  title={
                    !desktopAi
                      ? 'Dictation works in the desktop app'
                      : dictation.state === 'recording'
                      ? 'Stop and transcribe'
                      : provider === 'gemini' && ai?.hasKey
                      ? 'Dictate your direction (transcribed by Gemini)'
                      : 'Dictate your direction (transcribed on this Mac)'
                  }
                  className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center transition-colors disabled:opacity-40 ${
                    dictation.state === 'recording'
                      ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse'
                      : isFrost
                      ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
                  }`}
                >
                  {dictation.state === 'transcribing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
              {dictation.state === 'recording' && <p className="text-[10px] text-red-400 mt-1">Listening... click the mic again to finish.</p>}
              {dictation.state === 'transcribing' && dictation.status && (
                <p className={`text-[10px] mt-1 ${faint}`}>{dictation.status}</p>
              )}
              {dictation.error && <p className="text-[10px] text-red-400 mt-1">{dictation.error}</p>}
            </div>

            {/* How to mix: instant built-in blend, local AI on this Mac, or Gemini in the cloud */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'builtin', label: 'Quick', hint: 'Instant rule-based blend, no AI' },
                    { id: 'local', label: 'Local AI', hint: 'Qwen runs on this Mac. Free and private, but slow.' },
                    { id: 'gemini', label: ai?.hasKey ? 'Gemini' : 'Connect Gemini', hint: 'Best quality, uses Google\u2019s cloud' },
                  ] as { id: MixProvider; label: string; hint: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.hint}
                    disabled={isMixing || (opt.id !== 'builtin' && !desktopAi)}
                    onClick={() => {
                      if (opt.id === 'gemini' && !ai?.hasKey) {
                        setProvider('gemini');
                        startConnect();
                      } else {
                        setProvider(opt.id);
                        setConnecting(false);
                      }
                    }}
                    className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors disabled:opacity-40 ${
                      provider === opt.id
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                        : isFrost
                        ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {!desktopAi && <p className={`text-[10px] ${faint}`}>AI mixing and dictation work in the desktop app.</p>}

              {/* Local AI: install Ollama, then download the model */}
              {provider === 'local' && desktopAi && (
                <div className={`rounded-xl border p-2.5 flex flex-col gap-2 ${isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-white/10'}`}>
                  {!ai?.local.running ? (
                    <>
                      <p className={`text-[11px] leading-snug ${subtle}`}>
                        Local AI runs through Ollama, a free app that runs models on your Mac. Install it, open it once, then come back here.
                      </p>
                      <button
                        type="button"
                        onClick={() => openOllamaDownloadPage().catch(() => undefined)}
                        className="self-start px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black text-[11px] font-bold"
                      >
                        Get Ollama
                      </button>
                    </>
                  ) : !ai.local.hasModel ? (
                    <>
                      <p className={`text-[11px] leading-snug ${subtle}`}>
                        Ollama is running. Download the mixing model ({ai.local.model}, about 2 GB). This happens once.
                      </p>
                      {pullState ? (
                        <div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-sky-500 transition-all"
                              style={{ width: `${pullState.total ? Math.round((pullState.completed / pullState.total) * 100) : 5}%` }}
                            />
                          </div>
                          <p className={`text-[10px] mt-1 ${faint}`}>
                            {pullState.status}
                            {pullState.total ? ` ${Math.round((pullState.completed / pullState.total) * 100)}%` : ''}
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDownloadModel}
                          className="self-start px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black text-[11px] font-bold"
                        >
                          Download model
                        </button>
                      )}
                      {localError && <p className="text-[10px] text-red-400">{localError}</p>}
                    </>
                  ) : (
                    <p className="text-[11px] text-emerald-400">Ready: {ai.local.model} runs on this Mac. Expect a few minutes per mix.</p>
                  )}
                </div>
              )}

              {/* Connect Gemini: opens Google's key page, then picks the key up from the clipboard */}
              {provider === 'gemini' && desktopAi && !ai?.hasKey && connecting && (
                <div className={`rounded-xl border p-2.5 flex flex-col gap-2 ${isFrost ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-white/10'}`}>
                  <p className={`text-[11px] leading-snug ${subtle}`}>
                    Google's page just opened in your browser. Sign in, click <b>Create API key</b>, then click the copy icon. I'll notice the
                    key as soon as it's copied.
                  </p>
                  {copiedKey ? (
                    <button
                      type="button"
                      onClick={() => connectWithKey(copiedKey)}
                      disabled={keyBusy}
                      className="self-start px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold flex items-center gap-1.5"
                    >
                      <KeyRound className="w-3 h-3" />
                      {keyBusy ? 'Connecting...' : 'Key copied. Connect Gemini'}
                    </button>
                  ) : (
                    <p className={`text-[10px] flex items-center gap-1.5 ${faint}`}>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Waiting for you to copy the key...
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={keyDraft}
                      onChange={(e) => setKeyDraft(e.target.value)}
                      placeholder="or paste it here"
                      autoComplete="off"
                      className={`flex-1 min-w-0 px-3 py-1.5 rounded-lg text-[11px] border focus:outline-none ${field}`}
                    />
                    <button
                      type="button"
                      onClick={() => connectWithKey(keyDraft)}
                      disabled={keyBusy || keyDraft.trim().length < 20}
                      className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black text-[11px] font-bold disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                  {keyError && <p className="text-[10px] text-red-400">{keyError}</p>}
                  <p className={`text-[10px] leading-snug ${faint}`}>
                    The key is stored encrypted in your Mac's keychain. When you mix or dictate with Gemini, your direction, the selected
                    code and your voice audio are sent to Google.
                  </p>
                </div>
              )}

              {provider === 'gemini' && ai?.hasKey && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-emerald-400">Gemini connected</span>
                  <button type="button" onClick={handleRemoveKey} className={`text-[10px] hover:text-red-400 ${faint}`}>
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            {/* Creative Freedom Slider */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${subtle}`}>Strict (0.1)</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={freedom}
                onChange={(e) => setFreedom(parseFloat(e.target.value))}
                disabled={isMixing}
                className="flex-1 accent-sky-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${subtle}`}>Wild (1.0)</span>
            </div>

            {/* Supervisor Status HUD if mixing */}
            {isMixing && (
              <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex flex-col gap-1.5 animate-pulse">
                <div className="flex items-center justify-between text-xs font-semibold text-sky-400">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 animate-spin" />
                    <span>Supervisor: {supervisorStep.toUpperCase()}</span>
                  </span>
                  <span className="text-[10px] font-mono">3 Variations</span>
                </div>
                <p className="text-[11px] text-sky-300/80 truncate">{supervisorMessage}</p>
              </div>
            )}

            {notice && !isMixing && (
              <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">{notice}</p>
            )}

            {/* Action Buttons */}
            <div className="pt-1 flex items-center justify-between">
              <span className={`text-[10px] font-mono ${faint}`}>Generates: Refined, Reimagined, Exp</span>
              <button
                type="button"
                onClick={() =>
                  onStartMix({
                    prompt,
                    freedom,
                    destinationId: destination.id,
                    pulls: sources.map((s) => pullFor(s.id)),
                    provider,
                  })
                }
                disabled={isMixing || stagedComponents.length === 0}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-black text-xs font-bold transition-all shadow-lg shadow-sky-500/25 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isMixing
                    ? 'Mixing Variations...'
                    : provider === 'gemini'
                    ? 'Mix 3 with Gemini'
                    : provider === 'local'
                    ? 'Mix 3 with Local AI'
                    : 'Mix 3 Variations'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
