import { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Image as ImageIcon, Loader2, Download } from 'lucide-react';

export function ImageStudio() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const aspectRatios = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'];

  const generateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setImageUrl(null);

    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key not found");
      
      const ai = new GoogleGenAI({ apiKey });

      // Using gemini-3.1-flash-image-preview as requested for Nano Banana 2
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: "1K"
          }
        },
      });

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          setImageUrl(`data:image/png;base64,${base64EncodeString}`);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        throw new Error("No image was returned by the model.");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-violet-100 flex items-center gap-2">
          <ImageIcon className="text-violet-400" /> Image Studio
        </h2>
        <p className="text-violet-300/70 text-sm">Powered by Nano Banana 2 (gemini-3.1-flash-image-preview)</p>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6">
        {/* Controls */}
        <div className="w-full md:w-1/3 space-y-6">
          <form onSubmit={generateImage} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-violet-200 mb-2">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to create..."
                className="w-full h-32 bg-black/40 border border-violet-500/30 rounded-xl p-3 text-sm text-violet-100 placeholder-violet-400/50 focus:outline-none focus:border-violet-400/60 transition-colors resize-none"
                disabled={isGenerating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-violet-200 mb-2">Aspect Ratio</label>
              <div className="grid grid-cols-4 gap-2">
                {aspectRatios.map(ratio => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    disabled={isGenerating}
                    className={`py-2 text-xs rounded-lg border transition-colors ${
                      aspectRatio === ratio 
                        ? 'bg-violet-600 border-violet-500 text-white' 
                        : 'bg-black/20 border-violet-500/20 text-violet-300 hover:bg-white/5'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:hover:bg-violet-600 transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Generating...</> : 'Generate Image'}
            </button>
          </form>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Preview Area */}
        <div className="w-full md:w-2/3 bg-black/20 border border-white/5 rounded-2xl flex items-center justify-center overflow-hidden relative min-h-[300px]">
          {isGenerating ? (
            <div className="flex flex-col items-center text-violet-400/70">
              <Loader2 size={48} className="animate-spin mb-4" />
              <p>Creating your masterpiece...</p>
            </div>
          ) : imageUrl ? (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img 
                src={imageUrl} 
                alt={prompt} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                referrerPolicy="no-referrer"
              />
              <a 
                href={imageUrl} 
                download="heyd-image.png"
                className="absolute bottom-6 right-6 p-3 bg-black/50 hover:bg-black/70 backdrop-blur-md text-white rounded-full transition-colors"
                title="Download Image"
              >
                <Download size={20} />
              </a>
            </div>
          ) : (
            <div className="text-violet-400/30 flex flex-col items-center">
              <ImageIcon size={64} className="mb-4 opacity-50" />
              <p>Your generated image will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
