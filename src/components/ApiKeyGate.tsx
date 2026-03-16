import { useState, useEffect } from 'react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  const [hasKey, setHasKey] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Fallback if not in AI Studio environment
        setHasKey(true);
      }
      setChecking(false);
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true); // Assume success to mitigate race condition
    }
  };

  if (checking) return null;
  if (hasKey) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center h-screen p-4 text-center bg-[#0a050f] text-violet-100">
      <div className="max-w-md p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
        <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300">
          API Key Required
        </h2>
        <p className="mb-6 text-violet-200/70 text-sm leading-relaxed">
          To use the advanced features you requested (like high-quality Image Generation with Nano Banana 2), you must select your own Google Cloud API key. 
          <br/><br/>
          Please ensure your project has billing enabled.
        </p>
        <button 
          onClick={handleSelectKey} 
          className="px-8 py-3 bg-violet-600 hover:bg-violet-500 transition-colors rounded-full text-white font-medium shadow-lg shadow-violet-500/20"
        >
          Select API Key
        </button>
      </div>
    </div>
  );
}
