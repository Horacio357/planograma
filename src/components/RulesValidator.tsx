import React from 'react';
import { usePlanogramStore } from '../store/planogramStore';
import { ShieldCheck, ShieldAlert, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

export const RulesValidator: React.FC = () => {
  const { ruleViolations, selectItem, selectShelf } = usePlanogramStore();

  const errors = ruleViolations.filter(v => v.severity === 'error');
  const warnings = ruleViolations.filter(v => v.severity === 'warning');

  const handleViolationClick = (shelfId?: string, productId?: string) => {
    const store = usePlanogramStore.getState();
    if (productId) {
      // Intentar encontrar el item en la góndola que corresponde a este producto
      const item = store.items.find(i => i.productId === productId);
      if (item) {
        selectItem(item.id);
      } else {
        // Si no está colocado, seleccionar el producto en el catálogo
        store.selectProduct(productId);
      }
    } else if (shelfId) {
      selectShelf(shelfId);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-full overflow-hidden">
      {/* Cabecera */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          {ruleViolations.length === 0 ? (
            <ShieldCheck size={16} className="text-green-400" />
          ) : (
            <ShieldAlert size={16} className="text-amber-500" />
          )}
          <span>Motor de Reglas y Restricciones</span>
        </h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          errors.length > 0 
            ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
            : warnings.length > 0 
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'bg-green-500/10 text-green-400 border border-green-500/20'
        }`}>
          {ruleViolations.length === 0 
            ? 'Estable' 
            : `${ruleViolations.length} Alertas (${errors.length} Críticos)`}
        </span>
      </div>

      {/* Lista de alertas */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
        {ruleViolations.length > 0 ? (
          ruleViolations.map(violation => {
            const isError = violation.severity === 'error';
            return (
              <div
                key={violation.id}
                onClick={() => handleViolationClick(violation.shelfId, violation.productId)}
                className={`group flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all hover:bg-slate-850 ${
                  isError 
                    ? 'border-red-950/70 bg-red-950/10 hover:border-red-800' 
                    : 'border-amber-950/60 bg-amber-950/10 hover:border-amber-800'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {isError ? (
                    <XCircle size={14} className="text-red-400" />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-400" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold tracking-wider uppercase ${
                      isError ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {violation.type === 'physical' ? 'Física' : violation.type === 'category' ? 'Categoría' : 'Comercial'}
                    </span>
                    <span className="text-[8px] text-slate-500 font-mono">{violation.id.substring(0, 15)}</span>
                  </div>
                  <p className="text-slate-300 leading-normal text-[11px] mt-0.5 group-hover:text-slate-200">
                    {violation.message}
                  </p>
                </div>

                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition self-center">
                  <ArrowRight size={12} className="text-slate-400" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <ShieldCheck size={32} className="text-green-500 opacity-80" />
            <div>
              <p className="font-semibold text-slate-200 text-xs">¡Cumplimiento del 100%!</p>
              <p className="text-[10px] text-slate-500 mt-0.5">No se detectaron conflictos físicos o comerciales.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
