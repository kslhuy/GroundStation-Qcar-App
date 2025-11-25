import { GoogleGenAI } from "@google/genai";
import { LogEntry, Vehicle } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || 'demo-key' });

export const analyzeFleetStatus = async (
  vehicles: Vehicle[],
  recentLogs: LogEntry[]
): Promise<string> => {
  try {
    // Format data for the prompt
    const vehicleSummary = vehicles.map(v => 
      `ID: ${v.name}, Status: ${v.status}, Mode: ${v.mode}, Battery: ${v.telemetry.battery}%, Pos: (${v.telemetry.x.toFixed(1)}, ${v.telemetry.y.toFixed(1)})`
    ).join('\n');

    const logSummary = recentLogs.slice(-10).map(l => 
      `[${l.level}] ${l.message}`
    ).join('\n');

    const prompt = `
      You are the AI Mission Control Specialist for an autonomous vehicle fleet.
      
      Current Fleet Status:
      ${vehicleSummary}

      Recent System Logs:
      ${logSummary}

      Analyze the fleet's health and operational status. 
      1. Identify any critical issues (low battery, errors, disconnections).
      2. Suggest specific actions for the operator (e.g., "Recall QCar Gamma for charging").
      3. If a platoon formation is possible (vehicles are idle and healthy), suggest a leader.
      
      Keep the response concise, professional, and tactical (under 150 words).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Analysis unavailable.";
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return "AI Mission Analysis currently unavailable. Please check network connection or API Key.";
  }
};