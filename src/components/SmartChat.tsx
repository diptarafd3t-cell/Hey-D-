import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Send, Paperclip, X, Loader2, Zap, Brain, Volume2, VolumeX } from 'lucide-react';
import Markdown from 'react-markdown';

type Message = {
  role: 'user' | 'model';
  text: string;
  attachment?: { url: string; type: string };
};

export function SmartChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useFastModel, setUseFastModel] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [selectedFile, setSelectedFile] = useState<{ file: File, base64: string, mimeType: string } | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (currentAudioRef.current) currentAudioRef.current.pause();
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      setSelectedFile({
        file,
        base64: base64data.split(',')[1],
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || isLoading) return;

    const text = inputText.trim();
    setInputText('');
    const fileToProcess = selectedFile;
    setSelectedFile(null);
    
    setIsLoading(true);
    if (currentAudioRef.current) currentAudioRef.current.pause();

    const newUserMessage: Message = { 
      role: 'user', 
      text: text || (fileToProcess ? `Attached: ${fileToProcess.file.name}` : ''),
      attachment: fileToProcess ? { url: URL.createObjectURL(fileToProcess.file), type: fileToProcess.mimeType } : undefined
    };
    
    setMessages(prev => [...prev, newUserMessage]);

    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key not found");
      const ai = new GoogleGenAI({ apiKey });

      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const userParts: any[] = [];
      if (fileToProcess) {
        userParts.push({ inlineData: { data: fileToProcess.base64, mimeType: fileToProcess.mimeType } });
      }
      if (text) {
        userParts.push({ text });
      }

      // Select model based on toggle and file type
      // gemini-3.1-pro-preview for video understanding and complex reasoning
      // gemini-3.1-flash-lite-preview for fast responses
      // gemini-3-flash-preview for general audio transcription
      let model = useFastModel ? 'gemini-3.1-flash-lite-preview' : 'gemini-3.1-pro-preview';
      
      // If audio file, use 3-flash-preview for transcription as requested
      if (fileToProcess?.mimeType.startsWith('audio/')) {
        model = 'gemini-3-flash-preview';
      }

      const response = await ai.models.generateContent({
        model: model,
        contents: [
          ...history,
          { role: 'user', parts: userParts }
        ],
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: "You are Hey D, an advanced AI assistant. You can analyze videos, transcribe audio, and search the web."
        }
      });

      const replyText = response.text || "I couldn't generate a response.";
      setMessages(prev => [...prev, { role: 'model', text: replyText }]);

      // Generate TTS
      if (audioEnabled) {
        try {
          const ttsResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: replyText }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
            },
          });

          const base64AudioOut = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64AudioOut) {
            const audio = new Audio(`data:audio/mp3;base64,${base64AudioOut}`);
            currentAudioRef.current = audio;
            await audio.play();
          }
        } catch (ttsErr) {
          console.error("TTS Error:", ttsErr);
        }
      }

    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: `**Error:** ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full p-4">
      {/* Header Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex bg-black/30 rounded-full p-1 border border-white/10">
          <button
            onClick={() => setUseFastModel(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${useFastModel ? 'bg-violet-600 text-white' : 'text-violet-300 hover:text-white'}`}
          >
            <Zap size={16} /> Fast Mode
          </button>
          <button
            onClick={() => setUseFastModel(false)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${!useFastModel ? 'bg-blue-600 text-white' : 'text-violet-300 hover:text-white'}`}
          >
            <Brain size={16} /> Pro Mode
          </button>
        </div>
        <button 
          onClick={() => setAudioEnabled(!audioEnabled)}
          className={`p-2 rounded-full transition-colors ${audioEnabled ? 'bg-violet-600/30 text-violet-200' : 'bg-black/30 text-violet-400'}`}
          title={audioEnabled ? "Voice Output On" : "Voice Output Off"}
        >
          {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 glass-panel mb-4 rounded-2xl bg-black/20 border border-white/5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-violet-400/50 text-sm space-y-4">
            <Brain size={48} className="opacity-20" />
            <p>Upload a video for analysis, audio for transcription, or just chat!</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm ${
                msg.role === 'user' 
                  ? 'bg-violet-600/40 text-violet-50 rounded-tr-sm' 
                  : 'bg-black/40 text-violet-200/90 rounded-tl-sm border border-violet-500/20'
              }`}>
                {msg.attachment && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-white/10 bg-black/50">
                    {msg.attachment.type.startsWith('video/') ? (
                      <video src={msg.attachment.url} controls className="max-h-48 w-full object-contain" />
                    ) : msg.attachment.type.startsWith('audio/') ? (
                      <audio src={msg.attachment.url} controls className="w-full" />
                    ) : msg.attachment.type.startsWith('image/') ? (
                      <img src={msg.attachment.url} alt="upload" className="max-h-48 w-full object-contain" />
                    ) : (
                      <div className="p-3 text-xs text-violet-300">Attached file</div>
                    )}
                  </div>
                )}
                {msg.role === 'model' ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:m-0 prose-p:leading-relaxed">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-black/40 text-violet-200/90 rounded-2xl rounded-tl-sm border border-violet-500/20 px-5 py-4 flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-violet-400" />
              <span className="text-sm">Hey D is thinking...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative">
        {selectedFile && (
          <div className="absolute -top-12 left-4 bg-violet-900/80 backdrop-blur-md border border-violet-500/50 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs text-violet-100 shadow-lg">
            <span className="truncate max-w-[200px]">{selectedFile.file.name}</span>
            <button onClick={() => setSelectedFile(null)} className="hover:text-red-300"><X size={14} /></button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="video/*,audio/*,image/*"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-4 bg-black/40 border border-violet-500/30 rounded-full text-violet-300 hover:bg-white/5 hover:text-white transition-colors"
            disabled={isLoading}
          >
            <Paperclip size={20} />
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask anything, or upload a video/audio file..."
            className="flex-1 bg-black/40 border border-violet-500/30 rounded-full px-6 py-4 text-sm text-violet-100 placeholder-violet-400/50 focus:outline-none focus:border-violet-400/60 transition-colors shadow-lg backdrop-blur-md"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedFile) || isLoading}
            className="p-4 bg-violet-600 hover:bg-violet-500 text-white rounded-full disabled:opacity-50 disabled:hover:bg-violet-600 transition-colors shadow-md"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
