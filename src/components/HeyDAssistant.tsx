import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, Square, Send, Keyboard, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import Markdown from 'react-markdown';

type Message = {
  role: 'user' | 'model';
  text: string;
};

type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

export function HeyDAssistant() {
  const [status, setStatus] = useState<Status>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  const startListening = async () => {
    setErrorMsg(null);
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          const base64String = base64data.split(',')[1];
          processInput(base64String, 'audio/webm', null);
        };
      };

      mediaRecorder.start();
      setStatus('listening');
    } catch (err: any) {
      console.error("Microphone error:", err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setErrorMsg("Microphone access denied. Please allow microphone permissions or use the keyboard to type.");
      } else {
        setErrorMsg("Could not access microphone. " + err.message);
      }
      setStatus('idle');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && status === 'listening') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setStatus('thinking');
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || status !== 'idle') return;
    
    const text = inputText.trim();
    setInputText('');
    processInput(null, null, text);
  };

  const processInput = async (audioBase64: string | null, mimeType: string | null, textInput: string | null) => {
    setStatus('thinking');
    setErrorMsg(null);

    const newUserMessage: Message = { 
      role: 'user', 
      text: textInput || "(Voice Message)" 
    };
    
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key not found");
      
      const ai = new GoogleGenAI({ apiKey });

      // Format history for Gemini API
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      // 1. Get Text Response from Gemini 3.1 Pro (with Search)
      const userParts: any[] = [];
      if (audioBase64 && mimeType) {
        userParts.push({ inlineData: { data: audioBase64, mimeType: mimeType } });
        userParts.push({ text: "Please respond to this audio." });
      } else if (textInput) {
        userParts.push({ text: textInput });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...history,
          { role: 'user', parts: userParts }
        ],
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: "You are 'Hey D', a helpful, concise, and friendly AI assistant. Keep your answers brief and conversational, as they will often be spoken out loud. You cannot control the user's device operating system or other apps, but you can answer questions, search the web for real-time info, and help with tasks within this chat interface."
        }
      });

      const replyText = response.text || "I'm not sure how to respond.";
      
      // Update UI with text response immediately
      setMessages(prev => [...prev, { role: 'model', text: replyText }]);

      // 2. Generate Speech (TTS) if enabled
      if (audioEnabled) {
        try {
          const ttsResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: replyText }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Zephyr' }, // Zephyr is a good assistant voice
                },
              },
            },
          });

          const base64AudioOut = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          
          if (base64AudioOut) {
            const audio = new Audio(`data:audio/mp3;base64,${base64AudioOut}`);
            currentAudioRef.current = audio;
            
            audio.onended = () => setStatus('idle');
            audio.onerror = () => setStatus('idle');
            
            setStatus('speaking');
            await audio.play();
          } else {
            setStatus('idle');
          }
        } catch (ttsErr) {
          console.error("TTS Error:", ttsErr);
          // Fallback to idle if TTS fails
          setStatus('idle');
        }
      } else {
        setStatus('idle');
      }

    } catch (err: any) {
      console.error("Processing error:", err);
      setStatus('idle');
      
      if (err.message?.includes('403') || err.message?.includes('PERMISSION_DENIED')) {
        setErrorMsg("Permission Denied (403). Please ensure your Google Cloud Project has billing enabled and the Gemini API is active for the selected models.");
      } else {
        setErrorMsg("An error occurred: " + (err.message || "Unknown error"));
      }
    }
  };

  const getOrbStyles = () => {
    switch(status) {
      case 'listening': 
        return 'from-red-400 via-red-500 to-red-900 shadow-[0_0_60px_rgba(239,68,68,0.8)] scale-110 animate-pulse';
      case 'thinking': 
        return 'from-blue-400 via-blue-500 to-blue-900 shadow-[0_0_50px_rgba(59,130,246,0.7)] animate-spin';
      case 'speaking': 
        return 'from-emerald-400 via-emerald-500 to-emerald-900 shadow-[0_0_50px_rgba(16,185,129,0.7)] scale-105';
      default: 
        return 'from-violet-400 via-violet-500 to-violet-900 shadow-[0_0_40px_rgba(139,92,246,0.5)]';
    }
  };

  const getStatusText = () => {
    switch(status) {
      case 'listening': return 'Listening... (Tap to stop)';
      case 'thinking': return 'Thinking...';
      case 'speaking': return 'Speaking...';
      default: return 'Tap to speak to Hey D';
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4 relative z-10">
      
      {/* Header */}
      <header className="flex items-center justify-between py-4 border-b border-white/10">
        <h1 className="text-2xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300">
          Hey D
        </h1>
        <div className="flex gap-3">
          <button 
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-2 rounded-full hover:bg-white/5 text-violet-300 transition-colors"
            title={audioEnabled ? "Mute Hey D" : "Unmute Hey D"}
          >
            {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 flex items-start gap-3 text-red-200 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Main Interaction Area (The Orb) */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
        <button
          onClick={status === 'listening' ? stopListening : (status === 'idle' ? startListening : undefined)}
          disabled={status === 'thinking' || status === 'speaking'}
          className="relative group focus:outline-none"
        >
          {/* Outer glow ring */}
          <div className={`absolute inset-0 rounded-full blur-xl opacity-50 transition-all duration-500 bg-gradient-to-br ${getOrbStyles()}`}></div>
          
          {/* The Orb */}
          <div className={`relative w-40 h-40 rounded-full bg-gradient-to-br flex items-center justify-center transition-all duration-500 border border-white/20 ${getOrbStyles()}`}>
            {status === 'listening' ? (
              <Square size={40} className="text-white drop-shadow-lg" fill="currentColor" />
            ) : status === 'idle' ? (
              <Mic size={48} className="text-white drop-shadow-lg opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
            ) : (
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            )}
          </div>
        </button>
        <p className="mt-8 text-violet-200/70 font-medium tracking-wide animate-pulse">
          {getStatusText()}
        </p>
      </div>

      {/* Chat History & Input */}
      <div className={`transition-all duration-500 ease-in-out flex flex-col ${messages.length > 0 ? 'h-[40vh]' : 'h-auto'} opacity-100`}>
        
        {/* Messages */}
        {messages.length > 0 && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 glass-panel mb-4 rounded-2xl">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-violet-600/40 text-violet-50 rounded-tr-sm' 
                    : 'bg-black/40 text-violet-200/90 rounded-tl-sm border border-violet-500/20'
                }`}>
                  {msg.role === 'model' ? (
                    <div className="prose prose-invert prose-sm max-w-none prose-p:m-0 prose-p:leading-relaxed">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Text Input */}
        <form onSubmit={handleTextSubmit} className="relative flex items-center mt-auto pb-4">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask Gemini or search..."
            className="w-full bg-black/40 border border-violet-500/30 rounded-full pl-6 pr-14 py-4 text-sm text-violet-100 placeholder-violet-400/50 focus:outline-none focus:border-violet-400/60 transition-colors shadow-lg backdrop-blur-md"
            disabled={status !== 'idle'}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || status !== 'idle'}
            className="absolute right-2 p-3 bg-violet-600 hover:bg-violet-500 text-white rounded-full disabled:opacity-50 disabled:hover:bg-violet-600 transition-colors shadow-md"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
