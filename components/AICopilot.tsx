import React, { useState } from 'react';
import { Bot, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { LogEntry, Vehicle } from '../types';
import { analyzeFleetStatus } from '../services/geminiService';

interface AICopilotProps {
  vehicles: Vehicle[];
  logs: LogEntry[];
}

export const AICopilot: React.FC<AICopilotProps> = ({ vehicles, logs }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const result = await analyzeFleetStatus(vehicles, logs);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-indigo-400">
          <Bot size={20} />
          <h3 className="font-semibold text-slate-100">Mission Copilot</h3>
        </div>
        <button 
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="p-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 rounded-lg transition-colors disabled:opacity-50"
          title="Run AI Analysis"
        >
          {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-sm text-slate-300 leading-relaxed">
        {analysis ? (
            <div className="prose prose-invert prose-sm max-w-none">
                <p className="whitespace-pre-wrap">{analysis}</p>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2 opacity-70">
                <Bot size={32} />
                <p className="text-center text-xs">Ready to analyze telemetry and logs.<br/>Click the sparkle icon.</p>
            </div>
        )}
      </div>
      
      <div className="mt-3 text-[10px] text-slate-600 text-center">
        Powered by Gemini 2.5 Flash • Operational Oversight AI
      </div>
    </div>
  );
};