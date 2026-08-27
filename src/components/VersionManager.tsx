import React, { useState } from 'react';
import { usePlanogramStore } from '../store/planogramStore';
import { Save, Calendar, User, ArrowUpRight, Trash2 } from 'lucide-react';

export const VersionManager: React.FC = () => {
  const { versions, saveVersion, loadVersion, deleteVersion } = usePlanogramStore();
  const [versionName, setVersionName] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionName.trim()) return;
    saveVersion(versionName.trim());
    setVersionName('');
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-full overflow-hidden">
      {/* Cabecera */}
      <div className="border-b border-slate-800 pb-3 mb-3 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Save size={16} className="text-emerald-400" />
          <span>Control de Versiones</span>
        </h3>
      </div>

      {/* Formulario de Guardado */}
      <form onSubmit={handleSave} className="flex gap-2 mb-4 shrink-0">
        <input
          type="text"
          placeholder="Nombre de versión (Ej: Navidad)..."
          value={versionName}
          onChange={(e) => setVersionName(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
        />
        <button
          type="submit"
          disabled={!versionName.trim()}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-650 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shrink-0"
        >
          <Save size={12} />
          <span>Guardar</span>
        </button>
      </form>

      {/* Lista de Versiones */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {versions.length > 0 ? (
          versions.map(ver => (
            <div
              key={ver.id}
              className="flex justify-between items-center p-2.5 bg-slate-950/40 border border-slate-850 rounded-lg hover:border-slate-800 transition text-xs"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-250 truncate" title={ver.name}>{ver.name}</span>
                  {ver.isOptimized && (
                    <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 rounded">
                      Optimizado
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                  <span className="flex items-center gap-0.5">
                    <Calendar size={10} />
                    {formatDate(ver.createdAt)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <User size={10} />
                    {ver.user}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-3">
                {/* Score badge */}
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-950 border border-slate-800 text-indigo-400 font-mono rounded">
                  {ver.score} pts
                </span>

                {/* Cargar */}
                <button
                  onClick={() => loadVersion(ver.id)}
                  className="p-1 hover:bg-indigo-950/40 border border-transparent hover:border-indigo-800 rounded text-indigo-400 hover:text-indigo-200 transition"
                  title="Restaurar Versión"
                >
                  <ArrowUpRight size={14} />
                </button>

                {/* Borrar */}
                <button
                  onClick={() => deleteVersion(ver.id)}
                  className="p-1 hover:bg-red-950/40 border border-transparent hover:border-red-800 rounded text-red-500 hover:text-red-300 transition"
                  title="Eliminar Versión"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-[11px] text-slate-500 border border-dashed border-slate-850 rounded-lg">
            No hay versiones guardadas
          </div>
        )}
      </div>
    </div>
  );
};
