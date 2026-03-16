import { useState } from 'react';
import { Mic, MessageSquare, Image as ImageIcon } from 'lucide-react';
import { LiveVoiceMode } from './LiveVoiceMode';
import { SmartChat } from './SmartChat';
import { ImageStudio } from './ImageStudio';

export function HeyDAssistant() {
  const [activeTab, setActiveTab] = useState<'voice' | 'chat' | 'image'>('voice');

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto relative z-10">
      
      {/* Header */}
      <header className="flex items-center justify-between py-4 px-6 border-b border-white/10">
        <h1 className="text-2xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300">
          Hey D
        </h1>
        
        {/* Navigation Tabs */}
        <div className="flex bg-black/40 rounded-full p-1 border border-white/5">
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'voice' ? 'bg-violet-600 text-white shadow-md' : 'text-violet-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mic size={16} /> <span className="hidden sm:inline">Live Voice</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'chat' ? 'bg-violet-600 text-white shadow-md' : 'text-violet-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare size={16} /> <span className="hidden sm:inline">Smart Chat</span>
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'image' ? 'bg-violet-600 text-white shadow-md' : 'text-violet-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <ImageIcon size={16} /> <span className="hidden sm:inline">Image Studio</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'voice' && <LiveVoiceMode />}
        {activeTab === 'chat' && <SmartChat />}
        {activeTab === 'image' && <ImageStudio />}
      </main>
    </div>
  );
}
