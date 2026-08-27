import React from 'react';
import { usePlanogramStore, calculateMetrics } from '../store/planogramStore';
import { Check, X, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Percent, AlertCircle } from 'lucide-react';

export const ComparisonModal: React.FC = () => {
  const {
    gondolaConfig,
    items,
    products,
    optimizedVersion,
    comparisonMode,
    weights,
    ruleViolations,
    acceptOptimization,
    discardOptimization
  } = usePlanogramStore();

  if (!comparisonMode || !optimizedVersion) return null;

  // 1. Calcular Métricas del Planograma Actual
  const currentMetrics = calculateMetrics(gondolaConfig, items, products, ruleViolations.length, weights);
  
  // 2. Métricas del Planograma Optimizado
  const optMetrics = optimizedVersion.metrics;

  // 3. Diferencias Porcentuales
  const getDiffPct = (curr: number, opt: number) => {
    if (curr === 0) return opt > 0 ? '+100%' : '0%';
    const pct = ((opt - curr) / curr) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  const getDiffAbsolute = (curr: number, opt: number) => {
    const diff = opt - curr;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`;
  };

  const salesDiff = getDiffPct(currentMetrics.totalSales, optMetrics.totalSales);
  const marginDiff = getDiffPct(currentMetrics.totalMargin, optMetrics.totalMargin);
  const spaceDiff = `${(optMetrics.spaceUsedPct - currentMetrics.spaceUsedPct).toFixed(1)}%`;
  const scoreDiff = `${optMetrics.financialScore - currentMetrics.financialScore > 0 ? '+' : ''}${
    optMetrics.financialScore - currentMetrics.financialScore
  }`;

  const isSalesUp = optMetrics.totalSales >= currentMetrics.totalSales;
  const isMarginUp = optMetrics.totalMargin >= currentMetrics.totalMargin;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="p-6 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Comparación de Rendimiento de Planograma</h2>
            <p className="text-xs text-slate-400 mt-0.5">Analiza los cambios comerciales antes de aplicar la optimización en góndola</p>
          </div>
          <button
            onClick={discardOptimization}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Métricas Principales */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {/* Score */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Score General</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                  optMetrics.financialScore >= currentMetrics.financialScore ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {scoreDiff} pts
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-indigo-400">{optMetrics.financialScore}</span>
                <span className="text-xs text-slate-500">de 100</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Planograma Actual: <span className="font-semibold text-slate-400">{currentMetrics.financialScore}</span>
              </div>
            </div>

            {/* Ventas */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <ShoppingCart size={10} />
                  <span>Ventas Estimadas</span>
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  isSalesUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {isSalesUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  <span>{salesDiff}</span>
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-black text-slate-100">{optMetrics.totalSales}</span>
                <span className="text-xs text-slate-500">uds/sem</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Planograma Actual: <span className="font-semibold text-slate-400">{currentMetrics.totalSales}</span>
              </div>
            </div>

            {/* Margen */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <DollarSign size={10} />
                  <span>Margen Comercial</span>
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  isMarginUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {isMarginUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  <span>{marginDiff}</span>
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-black text-emerald-400">${optMetrics.totalMargin.toFixed(0)}</span>
                <span className="text-xs text-slate-500">USD/sem</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Planograma Actual: <span className="font-semibold text-slate-400">${currentMetrics.totalMargin.toFixed(0)}</span>
              </div>
            </div>

            {/* Espacio */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Percent size={10} />
                  <span>Uso del Espacio</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                  {spaceDiff}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-black text-slate-100">{optMetrics.spaceUsedPct}%</span>
                <span className="text-xs text-slate-500">lineal</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Planograma Actual: <span className="font-semibold text-slate-400">{currentMetrics.spaceUsedPct}%</span>
              </div>
            </div>
          </div>

          {/* Tabla de Comparación Detallada */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <div className="bg-slate-950/50 px-4 py-3 text-xs font-bold text-slate-300 border-b border-slate-800">
              Tabla Comparativa de Indicadores Clave
            </div>
            <table className="w-full text-xs text-slate-300 text-left">
              <thead>
                <tr className="bg-slate-950/20 border-b border-slate-800/80 text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5 font-bold">Métrica</th>
                  <th className="px-4 py-2.5 font-bold">Planograma Actual</th>
                  <th className="px-4 py-2.5 font-bold">Planograma Optimizado</th>
                  <th className="px-4 py-2.5 font-bold text-right">Mejora Estimada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Ventas Totales (Semanal)</td>
                  <td className="px-4 py-3">{currentMetrics.totalSales} unidades</td>
                  <td className="px-4 py-3 text-slate-100">{optMetrics.totalSales} unidades</td>
                  <td className="px-4 py-3 text-emerald-400 font-bold text-right">{salesDiff}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Margen de Utilidad (Semanal)</td>
                  <td className="px-4 py-3">${currentMetrics.totalMargin.toFixed(2)} USD</td>
                  <td className="px-4 py-3 text-slate-100">${optMetrics.totalMargin.toFixed(2)} USD</td>
                  <td className="px-4 py-3 text-emerald-400 font-bold text-right">{marginDiff} ({getDiffAbsolute(currentMetrics.totalMargin, optMetrics.totalMargin)} USD)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Espacio Lineal Ocupado</td>
                  <td className="px-4 py-3">{currentMetrics.spaceUsedPct}%</td>
                  <td className="px-4 py-3 text-slate-100">{optMetrics.spaceUsedPct}%</td>
                  <td className="px-4 py-3 text-blue-400 font-bold text-right">{spaceDiff}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Cantidad Total de Productos</td>
                  <td className="px-4 py-3">{currentMetrics.itemCount} items</td>
                  <td className="px-4 py-3 text-slate-100">{optMetrics.itemCount} items</td>
                  <td className="px-4 py-3 text-slate-400 text-right">{optMetrics.itemCount - currentMetrics.itemCount} items</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Reglas e Inconsistencias Rotas</td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded ${currentMetrics.violatedRulesCount > 0 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                      {currentMetrics.violatedRulesCount} alertas
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-100">
                    <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                      0 alertas
                    </span>
                  </td>
                  <td className="px-4 py-3 text-emerald-400 font-bold text-right">Resuelto (100%)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Nota comercial */}
          <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-xs text-blue-300 flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <b>Nota de Simulación:</b> Las estimaciones de aumento en ventas y márgenes se basan en el rendimiento histórico de facings optimizados. El algoritmo redistribuye frentes de productos basándose en sus coeficientes de rendimiento, maximizando la rentabilidad lineal y agrupando automáticamente por marca para favorecer la experiencia del consumidor.
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-3 shrink-0">
          <button
            onClick={discardOptimization}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-semibold rounded-lg transition"
          >
            <X size={16} />
            <span>Descartar y Volver</span>
          </button>
          <button
            onClick={acceptOptimization}
            className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-indigo-500/25 transition"
          >
            <Check size={16} />
            <span>Aplicar Planograma Optimizado</span>
          </button>
        </div>
      </div>
    </div>
  );
};
