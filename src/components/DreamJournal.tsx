import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, Square, Loader2, Image as ImageIcon, MessageSquare, Send, Settings, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';

type Message = {
  role: 'user' | 'model';
  text: string;
};

export function DreamJournal() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const startRecording = async () => {
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
          processDream(base64String, 'audio/webm');
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const processDream = async (base64Audio: string, mimeType: string) => {
    setIsProcessing(true);
    setTranscription('');
    setInterpretation('');
    setImageUrl('');
    setChatHistory([]);

    try {
      // Ensure we use the selected API key if available, fallback to default
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key not found");
      
      const ai = new GoogleGenAI({ apiKey });

      // 1. Transcribe
      const transcriptionResponse = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType
            }
          },
          {
            text: "Transcribe this dream recording accurately. Do not add any extra commentary, just the transcription."
          }
        ]
      });
      
      const transcribedText = transcriptionResponse.text || "Transcription failed.";
      setTranscription(transcribedText);

      // 2. Generate Image & Interpretation in parallel
      const imagePromise = ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [
            { text: `A surrealist painting representing the core emotional theme of this dream: ${transcribedText}` }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: imageSize
          }
        }
      });

      const interpretationPromise = ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Analyze this dream using Jungian archetypes and psychological symbolism. Provide a structured interpretation focusing on the core emotional themes and symbols: \n\nDream: ${transcribedText}`
      });

      const [imageRes, interpRes] = await Promise.all([imagePromise, interpretationPromise]);

      // Extract image
      let generatedImageUrl = '';
      if (imageRes.candidates && imageRes.candidates[0].content.parts) {
        for (const part of imageRes.candidates[0].content.parts) {
          if (part.inlineData) {
            generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }
      setImageUrl(generatedImageUrl);
      setInterpretation(interpRes.text || "Interpretation failed.");

      // Initialize chat history
      setChatHistory([
        { role: 'model', text: "Hello! I'm Hey D, your personal dream assistant. I've analyzed your dream and generated a surrealist representation. What specific symbols or feelings would you like to explore further?" }
      ]);

    } catch (err) {
      console.error("Error processing dream:", err);
      alert("An error occurred while processing your dream. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userText = chatInput.trim();
    setChatInput('');
    setIsChatting(true);

    const newHistory: Message[] = [...chatHistory, { role: 'user', text: userText }];
    setChatHistory(newHistory);
    
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      const contents = newHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: contents,
        config: {
          systemInstruction: `You are 'Hey D', an AI dream assistant. You help the user interpret their dreams, focusing on Jungian archetypes and symbolism. You can also respond to general commands playfully, acknowledging you are a dream assistant on their device. The user's recent dream was: "${transcription}". The initial interpretation was: "${interpretation}". Keep your responses insightful, empathetic, and concise.`
        }
      });

      setChatHistory([...newHistory, { role: 'model', text: response.text || "I'm not sure how to respond to that." }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatHistory([...newHistory, { role: 'model', text: "Sorry, I encountered an error processing your message." }]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 relative z-10">
      <header className="text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-violet-200 to-fuchsia-200 mb-4 tracking-tight">
          Nocturne
        </h1>
        <p className="text-violet-300/70 text-lg md:text-xl font-light tracking-wide">Your Multi-Modal Dream Journal</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Recording & Image */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Recording Section */}
          <div className="glass-panel p-8 relative overflow-hidden group">
            <div className="absolute top-4 right-4 flex items-center gap-2 text-xs text-violet-400/60">
              <Settings size={14} />
              <select 
                value={imageSize} 
                onChange={(e) => setImageSize(e.target.value as '1K' | '2K' | '4K')}
                className="bg-transparent border-none outline-none cursor-pointer hover:text-violet-300"
                disabled={isProcessing || isRecording}
              >
                <option value="1K" className="bg-[#1a1025]">1K Image</option>
                <option value="2K" className="bg-[#1a1025]">2K Image</option>
                <option value="4K" className="bg-[#1a1025]">4K Image</option>
              </select>
            </div>

            <div className="flex flex-col items-center justify-center py-8">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
                  isRecording 
                    ? 'bg-red-500/20 text-red-400 shadow-[0_0_40px_rgba(239,68,68,0.4)] scale-110' 
                    : 'bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 hover:scale-105 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isRecording ? <Square size={32} fill="currentColor" /> : <Mic size={36} />}
              </button>
              
              <p className="mt-6 text-violet-200/80 font-medium h-6">
                {isRecording ? 'Recording your dream...' : 
                 isProcessing ? 'Analyzing dreamscape...' : 
                 'Tap to record your dream'}
              </p>
              
              {isRecording && (
                <div className="flex gap-1 mt-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div 
                      key={i} 
                      className="w-1 bg-red-400 rounded-full animate-pulse" 
                      style={{ height: `${Math.random() * 16 + 8}px`, animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Image Generation Result */}
          {imageUrl && (
            <div className="glass-panel overflow-hidden relative group animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-xs text-violet-200 border border-white/10">
                <ImageIcon size={14} />
                <span>Surrealist Representation</span>
              </div>
              <img 
                src={imageUrl} 
                alt="Dream representation" 
                className="w-full h-auto object-cover aspect-video transition-transform duration-700 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </div>

        {/* Right Column: Analysis & Chat */}
        <div className="lg:col-span-5 space-y-8 flex flex-col">
          
          {/* Transcription & Interpretation */}
          {(transcription || isProcessing) && (
            <div className="glass-panel p-6 flex-1 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center h-full text-violet-400/60 space-y-4 py-12">
                  <Loader2 className="animate-spin" size={32} />
                  <p className="font-serif italic">Consulting the collective unconscious...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-violet-400/60 mb-2 font-semibold">The Dream</h3>
                    <p className="text-violet-100/90 leading-relaxed font-serif italic border-l-2 border-violet-500/30 pl-4">
                      "{transcription}"
                    </p>
                  </div>
                  
                  <div className="pt-4 border-t border-violet-500/20">
                    <h3 className="text-xs uppercase tracking-widest text-violet-400/60 mb-4 font-semibold flex items-center gap-2">
                      <Sparkles size={14} />
                      Psychological Interpretation
                    </h3>
                    <div className="prose prose-invert prose-violet max-w-none prose-p:leading-relaxed prose-p:text-violet-200/80 prose-headings:text-violet-100 prose-strong:text-violet-200 text-sm">
                      <Markdown>{interpretation}</Markdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hey D Chatbot */}
          {chatHistory.length > 0 && (
            <div className="glass-panel flex flex-col h-[400px] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
              <div className="p-4 border-b border-violet-500/20 bg-violet-900/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_10px_rgba(139,92,246,0.5)]">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-violet-100">Hey D</h3>
                  <p className="text-[10px] text-violet-400/70 uppercase tracking-wider">AI Dream Assistant</p>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-violet-600/40 text-violet-50 rounded-tr-sm' 
                        : 'bg-black/40 text-violet-200/90 rounded-tl-sm border border-violet-500/10'
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
                {isChatting && (
                  <div className="flex justify-start">
                    <div className="bg-black/40 rounded-2xl rounded-tl-sm px-4 py-3 border border-violet-500/10">
                      <Loader2 className="animate-spin text-violet-400" size={16} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-3 border-t border-violet-500/20 bg-black/20">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Hey D about your dream..."
                    className="w-full bg-violet-950/30 border border-violet-500/30 rounded-full pl-4 pr-12 py-3 text-sm text-violet-100 placeholder-violet-400/50 focus:outline-none focus:border-violet-400/60 transition-colors"
                    disabled={isChatting}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatting}
                    className="absolute right-2 p-2 text-violet-400 hover:text-violet-200 disabled:opacity-50 disabled:hover:text-violet-400 transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
