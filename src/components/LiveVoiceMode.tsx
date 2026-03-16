import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, Square, Loader2 } from 'lucide-react';

export function LiveVoiceMode() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Audio playback queue
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  const cleanupAudio = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
  };

  const disconnect = () => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    cleanupAudio();
    setIsConnected(false);
    setIsConnecting(false);
  };

  useEffect(() => {
    return () => disconnect();
  }, []);

  const playNextAudio = () => {
    if (playbackQueueRef.current.length === 0 || !audioContextRef.current) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }
    
    isPlayingRef.current = true;
    setIsSpeaking(true);
    const audioBuffer = playbackQueueRef.current.shift()!;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      playNextAudio();
    };
    source.start();
  };

  const connect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key not found");
      
      // Create fresh instance right before call to avoid stale keys
      const ai = new GoogleGenAI({ apiKey });

      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: () => {},
          onmessage: () => {},
          onclose: () => {},
          onerror: () => {}
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are Hey D, a helpful and conversational voice assistant. Keep answers brief.",
        },
      });

      sessionPromise.then((session) => {
        sessionRef.current = session;
        setIsConnected(true);
        setIsConnecting(false);

        // Setup microphone capture
        const source = audioContextRef.current!.createMediaStreamSource(stream);
        sourceRef.current = source;
        const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!sessionRef.current) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          const buffer = new ArrayBuffer(pcm16.length * 2);
          const view = new DataView(buffer);
          for (let i = 0; i < pcm16.length; i++) {
            view.setInt16(i * 2, pcm16[i], true);
          }
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
        };

        source.connect(processor);
        processor.connect(audioContextRef.current!.destination);
      }).catch(err => {
        throw err;
      });

      // Handle incoming messages
      const session = await sessionPromise;
      
      // @ts-ignore - overriding internal handler for demo purposes if callbacks aren't fully exposed in all SDK versions
      const originalOnMessage = session._onmessage || function(){};
      
      // We need to listen to the async iterable if it's exposed, or pass callbacks.
      // The SDK docs say: ai.live.connect({ callbacks: { onmessage: ... } })
      // Let's re-initialize properly with callbacks
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      disconnect();
    }
  };

  // Re-implementing connect with proper callbacks as per docs
  const connectProperly = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key not found");
      
      const ai = new GoogleGenAI({ apiKey });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            sourceRef.current = source;
            const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              const buffer = new ArrayBuffer(pcm16.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcm16.length; i++) {
                view.setInt16(i * 2, pcm16[i], true);
              }
              const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } }));
            };

            source.connect(processor);
            processor.connect(audioContextRef.current!.destination);
          },
          onmessage: (message: any) => {
            if (message.serverContent?.interrupted) {
              playbackQueueRef.current = [];
              isPlayingRef.current = false;
              setIsSpeaking(false);
            }
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const binaryString = atob(base64Audio);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const pcm16 = new Int16Array(bytes.buffer);
              const float32 = new Float32Array(pcm16.length);
              for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 0x7FFF;
              }
              const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
              audioBuffer.getChannelData(0).set(float32);
              
              playbackQueueRef.current.push(audioBuffer);
              if (!isPlayingRef.current) {
                playNextAudio();
              }
            }
          },
          onclose: () => disconnect(),
          onerror: (e) => { console.error(e); setError("Connection error"); disconnect(); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are Hey D, a helpful and conversational voice assistant. Keep answers brief.",
        },
      });

      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message);
      disconnect();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 h-full">
      <div className="text-center mb-12">
        <h2 className="text-2xl font-bold text-violet-100 mb-2">Live Conversational Mode</h2>
        <p className="text-violet-300/70 text-sm max-w-md">
          Have a real-time, low-latency voice conversation with Hey D using the Gemini Live API.
        </p>
      </div>

      <button
        onClick={isConnected ? disconnect : connectProperly}
        disabled={isConnecting}
        className="relative group focus:outline-none"
      >
        <div className={`absolute inset-0 rounded-full blur-xl opacity-50 transition-all duration-500 bg-gradient-to-br ${
          isConnected 
            ? isSpeaking 
              ? 'from-emerald-400 via-emerald-500 to-emerald-900 scale-110 animate-pulse' 
              : 'from-blue-400 via-blue-500 to-blue-900 scale-105'
            : 'from-violet-400 via-violet-500 to-violet-900'
        }`}></div>
        
        <div className={`relative w-48 h-48 rounded-full bg-gradient-to-br flex items-center justify-center transition-all duration-500 border border-white/20 ${
          isConnected 
            ? isSpeaking 
              ? 'from-emerald-400 via-emerald-500 to-emerald-900' 
              : 'from-blue-400 via-blue-500 to-blue-900'
            : 'from-violet-400 via-violet-500 to-violet-900'
        }`}>
          {isConnecting ? (
            <Loader2 size={48} className="text-white animate-spin" />
          ) : isConnected ? (
            <Square size={48} className="text-white drop-shadow-lg" fill="currentColor" />
          ) : (
            <Mic size={56} className="text-white drop-shadow-lg opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          )}
        </div>
      </button>

      <p className="mt-8 text-violet-200/70 font-medium tracking-wide">
        {isConnecting ? 'Connecting...' : isConnected ? (isSpeaking ? 'Hey D is speaking...' : 'Listening... (Tap to end)') : 'Tap to start live conversation'}
      </p>

      {error && (
        <div className="mt-6 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm max-w-md text-center">
          {error}
        </div>
      )}
    </div>
  );
}
