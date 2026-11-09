import React, { useEffect, useMemo, useRef } from 'react';
import { buildSandboxedDocument } from '../mixer/scopeEngine';

interface SandboxedPreviewProps {
  html: string;
  css: string;
  js: string;
  theme?: 'obsidian' | 'frost';
  scopeClass?: string;
  transparent?: boolean;
  interactive?: boolean;
  paused?: boolean;
  className?: string;
  onError?: (error: string) => void;
}

export const SandboxedPreview: React.FC<SandboxedPreviewProps> = ({
  html,
  css,
  js,
  theme = 'obsidian',
  scopeClass,
  transparent = false,
  interactive = true,
  paused = false,
  className = '',
  onError,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Built synchronously so the iframe never mounts empty and then fills in later
  const docContent = useMemo(
    () => (paused ? '' : buildSandboxedDocument(html, css, js, { theme, scopeClass, transparent })),
    [html, css, js, theme, scopeClass, transparent, paused]
  );

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && (e.data.type === 'SANDBOX_ERROR' || e.data.type === 'SANDBOX_RUNTIME_ERROR')) {
        const errMsg = e.data.error?.message || 'Unknown sandbox error';
        if (onError) onError(errMsg);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onError]);

  if (paused) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-neutral-900/40 text-neutral-500 text-xs ${className}`}>
        <span>Preview Paused (Distance LOD)</span>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <iframe
        ref={iframeRef}
        srcDoc={docContent}
        sandbox="allow-scripts"
        title="Sandboxed Component Preview"
        className="w-full h-full border-0 pointer-events-auto"
        tabIndex={interactive ? 0 : -1}
      />
      {!interactive && (
        <div 
          className="absolute inset-0 bg-transparent cursor-grab active:cursor-grabbing z-10" 
          title="Drag mode active. Double click or click Preview to interact."
        />
      )}
    </div>
  );
};
