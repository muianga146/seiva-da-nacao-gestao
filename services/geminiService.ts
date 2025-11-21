import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { ImageSize } from "../types";

// Initialize GenAI client inside functions to ensure latest API key is used
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateImage = async (prompt: string, size: ImageSize): Promise<string | null> => {
  try {
    const ai = getAiClient();
    // Using gemini-3-pro-image-preview as requested for high quality
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          imageSize: size, // '1K', '2K', or '4K'
          aspectRatio: "1:1",
        },
      },
    });

    // Iterate to find image part
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};

export const chatWithAI = async (message: string, history: { role: string; parts: { text: string }[] }[]) => {
  try {
    const ai = getAiClient();
    // Using gemini-3-pro-preview for complex tasks/chat
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      history: history,
      config: {
        systemInstruction: "Você é um assistente financeiro e escolar inteligente para o sistema 'Seiva da Nação'. Responda de forma concisa, profissional e amigável em Português."
      }
    });

    const result: GenerateContentResponse = await chat.sendMessage({ message });
    return result.text;
  } catch (error) {
    console.error("Error in chat:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<AudioBuffer | null> => {
  try {
    const ai = getAiClient();
    // Using gemini-2.5-flash-preview-tts
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) return null;

      // Decode logic
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      
      // Simple decoding wrapper
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
      return audioBuffer;

  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
}