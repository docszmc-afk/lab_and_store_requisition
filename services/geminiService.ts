import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini AI client
// In a real scenario, ensure process.env.API_KEY is set.
// For this demo, we assume the environment variable is present.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeRequisition = async (items: string, department: string): Promise<string> => {
  try {
    // Using gemini-2.5-flash for speed and efficiency on text tasks
    const model = 'gemini-2.5-flash';
    
    const prompt = `
      Act as a medical procurement expert for Zankli Medical Centre.
      Analyze the following requisition request from the ${department} department:
      
      Items: ${items}
      
      Provide a brief, professional assessment (max 50 words) covering:
      1. Urgency justification based on item nature.
      2. Any potential conflict or optimization (e.g., bulk order suggestion).
      
      Return ONLY the analysis text.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Analysis currently unavailable.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "AI Analysis unavailable. Please proceed with manual review.";
  }
};