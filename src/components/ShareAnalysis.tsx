import React, { useState } from 'react';
import { usePlanogramStore } from '../store/planogramStore';
import { mockCategories } from '../data/mockProducts';
import { BarChart3, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

export const ShareAnalysis: React.FC = () => {
  const { items, products } = usePlanogramStore();
  const [selectedCat, setSelectedCat] = useState<string>('bebidas');

  const productMap = new Map(products.map(p => [p.id, p]));

  // 1. Filtrar productos colocados en la categoría seleccionada
  const categoryItems = items.filter(item => {
    const prod = productMap.get(item.productId);
    return prod && (selectedCat === 'all' || prod.category === selectedCat);
  });

  // 2. Agrupar espacio y métricas financieras por Marca
  const brandData: Record<string, {
    brandName: string;
    widthCm: number;
    salesCount: number;
    profitWeekly: number;
    marketShareSum: number; // MS de los productos en góndola
    productCount: number;
  }> = {};

  let totalWidthCm = 0;
  let totalProfitWeekly = 0;

  // Primero calculamos lo colocado
  categoryItems.forEach(item => {
    const prod = productMap.get(item.productId);
    if (!prod) return;

    const width = prod.width * item.facings;
    const profit = item.facings * prod.sales * prod.price * prod.margin;
    
    totalWidthCm += width;
    totalProfitWeekly += profit;

    if (!brandData[prod.brand]) {
      brandData[prod.brand] = {
        brandName: prod.brand,
        widthCm: 0,
        salesCount: 0,
        profitWeekly: 0,
        marketShareSum: 0,
        productCount: 0
      };
    }

    brandData[prod.brand].widthCm += width;
    brandData[prod.brand].salesCount += item.facings * prod.sales;
    brandData[prod.brand].profitWeekly += profit;
  });

  // Calcular las cuotas de mercado (Market Share) totales de CADA MARCA en el catálogo para esta categoría
  // De esta manera, aunque un producto no esté colocado, sabemos cuál es la cuota de mercado del catálogo.
  // Pero para comparar SoS vs MS, evaluamos las marcas que tienen productos en esta categoría.
  const categoryProducts = products.filter(p => selectedCat === 'all' || p.category === selectedCat);
  
  // Agrupar Market Shares por marca en el catálogo de esta categoría
  const brandMarketShares: Record<string, number> = {};
  categoryProducts.forEach(p => {
    if (!brandMarketShares[p.brand]) {
      brandMarketShares[p.brand] = 0;
    }
    brandMarketShares[p.brand] += p.marketShare;
  });

  // Agregar marcas del catálogo a brandData si no tienen productos colocados (SoS = 0)
  Object.keys(brandMarketShares).forEach(brand => {
    if (!brandData[brand] && brandMarketShares[brand] > 0) {
      brandData[brand] = {
        brandName: brand,
        widthCm: 0,
        salesCount: 0,
        profitWeekly: 0,
        marketShareSum: 0,
        productCount: 0
      };
    }
  });

  // Formatear filas de datos
  const rows = Object.keys(brandData).map(brand => {
    const data = brandData[brand];
    const ms = brandMarketShares[brand] || 0;
    const sos = totalWidthCm > 0 ? data.widthCm / totalWidthCm : 0;
    const sop = totalProfitWeekly > 0 ? data.profitWeekly / totalProfitWeekly : 0;
    const gap = sos - ms;

    return {
      brand,
      widthCm: data.widthCm,
      salesCount: data.salesCount,
      profitWeekly: data.profitWeekly,
      sos, // Share of Shelf
      ms,  // Market Share
      sop, // Share of Profit
      gap
    };
  });

  // Ordenar por Share of Shelf descendente
  rows.sort((a, b) => b.sos - a.sos);

  const getGapBadge = (gap: number) => {
    const gapPct = gap * 100;
    if (gapPct < -4.0) {
      return (
        <span className="flex items-center gap-1 text-red-400 font-bold bg-red-950/20 px-2 py-0.5 rounded border border-red-900/35">
          <AlertTriangle size={10} />
          <span>Sub-representado ({gapPct.toFixed(1)}%)</span>
        </span>
      );
    } else if (gapPct > 4.0) {
      return (
        <span className="flex items-center gap-1 text-sky-400 font-bold bg-sky-950/20 px-2 py-0.5 rounded border border-sky-900/35">
          <TrendingUp size={10} />
          <span>Sobre-representado (+{gapPct.toFixed(1)}%)</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-green-400 font-bold bg-green-950/20 px-2 py-0.5 rounded border border-green-900/35">
        <CheckCircle size={10} />
        <span>Equilibrado ({gapPct >= 0 ? '+' : ''}{gapPct.toFixed(1)}%)</span>
      </span>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-full overflow-hidden">
      {/* Cabecera y Selector de Categoría */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sans">
          <BarChart3 size={16} className="text-indigo-400" />
          <span>Cuota de Góndola (Share of Shelf) vs. Market Share</span>
        </h3>
        
        {/* Selector de Categoría */}
        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-[11px] text-slate-300 rounded-lg p-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="all">Todas las Categorías</option>
          {mockCategories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Tabla de Share */}
      <div className="flex-1 overflow-y-auto pr-1">
        {categoryItems.length > 0 ? (
          <table className="w-full text-[11px] text-slate-300 text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/40 border-b border-slate-850 text-[9px] text-slate-500 uppercase tracking-wider font-mono">
                <th className="px-3 py-2 font-bold">Marca</th>
                <th className="px-3 py-2 font-bold">Lineal Ocupado</th>
                <th className="px-3 py-2 font-bold">Share of Shelf (SoS)</th>
                <th className="px-3 py-2 font-bold">Market Share (MS)</th>
                <th className="px-3 py-2 font-bold">Desviación (Gap)</th>
                <th className="px-3 py-2 font-bold text-right">Share of Profit (SoP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {rows.map(row => (
                <tr key={row.brand} className="hover:bg-slate-850/50 transition">
                  <td className="px-3 py-2.5 font-bold text-slate-200">{row.brand}</td>
                  <td className="px-3 py-2.5 font-mono">{row.widthCm.toFixed(0)} cm</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-200 w-8">{(row.sos * 100).toFixed(0)}%</span>
                      {/* Mini visual bar */}
                      <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${row.sos * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-400">{(row.ms * 100).toFixed(0)}%</td>
                  <td className="px-3 py-2.5">{getGapBadge(row.gap)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-emerald-400">{(row.sop * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-850 rounded-xl">
            No hay productos colocados en esta categoría para analizar.
          </div>
        )}
      </div>

      {/* Nota técnica */}
      <div className="mt-3 text-[9px] text-slate-500 border-t border-slate-850 pt-2 leading-relaxed">
        <b>SoS (Share of Shelf):</b> % de espacio físico lineal. <b>MS (Market Share):</b> % de mercado objetivo. <b>SoP (Share of Profit):</b> % de rentabilidad bruta de la góndola. Lo ideal es mantener una brecha cercana a 0% para optimizar el rendimiento del espacio.
      </div>
    </div>
  );
};
