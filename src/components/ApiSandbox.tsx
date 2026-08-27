import React, { useState } from 'react';
import { usePlanogramStore } from '../store/planogramStore';
import { simulateApiOptimization } from '../services/optimizer';
import { Terminal, Copy, Check, RefreshCw } from 'lucide-react';

export const ApiSandbox: React.FC = () => {
  const { gondolaConfig, products, constraints, weights } = usePlanogramStore();
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');
  const [copied, setCopied] = useState(false);

  // Generar payloads basados en el estado actual
  const apiSimulation = simulateApiOptimization(gondolaConfig, products, constraints, weights);
  
  const payloadToDisplay = activeTab === 'request' 
    ? apiSimulation.request 
    : apiSimulation.response;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(payloadToDisplay, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-full overflow-hidden">
      {/* Cabecera */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-350 flex items-center gap-1.5 font-mono">
          <Terminal size={14} className="text-indigo-400" />
          <span>API Sandbox (Próximo Backend)</span>
        </h3>
        <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono text-indigo-400">
          POST /api/planograms/optimize
        </span>
      </div>

      {/* Tabs */}
      <div className="flex justify-between items-center gap-2 mb-3 shrink-0 text-xs">
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850">
          <button
            onClick={() => setActiveTab('request')}
            className={`px-3 py-1 rounded-md font-semibold transition ${
              activeTab === 'request' 
                ? 'bg-slate-800 text-slate-100' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Request Body (Payload)
          </button>
          <button
            onClick={() => setActiveTab('response')}
            className={`px-3 py-1 rounded-md font-semibold transition ${
              activeTab === 'response' 
                ? 'bg-slate-800 text-slate-100' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Response JSON
          </button>
        </div>

        <button
          onClick={handleCopy}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-slate-200 rounded-lg flex items-center gap-1 transition"
          title="Copiar JSON"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span className="text-[10px] font-semibold">{copied ? 'Copiado!' : 'Copiar'}</span>
        </button>
      </div>

      {/* Visor de Código JSON */}
      <div className="flex-1 bg-slate-950 rounded-lg p-3 border border-slate-850 font-mono text-[10px] text-slate-300 overflow-auto whitespace-pre-wrap select-text relative scrollbar-thin">
        {JSON.stringify(payloadToDisplay, null, 2)}
      </div>

      {/* Descripción técnica */}
      <div className="mt-3 text-[10px] text-slate-500 leading-normal border-t border-slate-850 pt-2 flex items-start gap-1">
        <RefreshCw size={10} className="shrink-0 mt-0.5 animate-pulse text-indigo-400" />
        <p>
          Este sandbox simula la futura llamada de backend. Las especificaciones corresponden exactamente a las entidades DTO requeridas por solvers de OR-Tools o Gurobi.
        </p>
      </div>
    </div>
  );
};
