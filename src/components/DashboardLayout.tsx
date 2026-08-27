import React, { useState } from 'react';
import { usePlanogramStore, calculateMetrics } from '../store/planogramStore';
import { ProductCatalog } from './ProductCatalog';
import { ShelfEditor3D } from './ShelfEditor3D';
import { ShelfEditor2D } from './ShelfEditor2D';
import { PropertyInspector } from './PropertyInspector';
import { RulesValidator } from './RulesValidator';
import { VersionManager } from './VersionManager';
import { ApiSandbox } from './ApiSandbox';
import { ComparisonModal } from './ComparisonModal';
import { ShareAnalysis } from './ShareAnalysis';
import { 
  Sparkles, 
  Layout, 
  Flame, 
  Grid3X3, 
  Ruler, 
  RotateCw,
  FolderOpen,
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronUp,
  X,
  Maximize,
  BarChart3,
  Sun,
  Moon
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const {
    gondolaConfig,
    items,
    products,
    weights,
    ruleViolations,
    heatmapMode,
    viewMode,
    showDimensions,
    showGrid,
    isOptimizing,
    darkMode,
    setHeatmapMode,
    setViewMode,
    toggleDimensions,
    toggleGrid,
    toggleDarkMode,
    startOptimization
  } = usePlanogramStore();

  const [bottomTab, setBottomTab] = useState<'versions' | 'api' | 'share'>('versions');
  const [showBottomPanels, setShowBottomPanels] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullScreen(false);
    }
  };

  // Calcular métricas actuales
  const metrics = calculateMetrics(gondolaConfig, items, products, ruleViolations.length, weights);

  const getHeatmapButtonClass = (mode: typeof heatmapMode) => {
    return `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
      heatmapMode === mode 
        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' 
        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
    }`;
  };

  const getViewModeButtonClass = (mode: typeof viewMode) => {
    return `px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
      viewMode === mode 
        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' 
        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
    }`;
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans transition-colors duration-200 ${darkMode ? 'bg-slate-950 text-slate-100' : 'light-mode bg-slate-50 text-slate-900'}`}>
      {/* NAVBAR PRINCIPAL */}
      {!isFullScreen && (
        <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 flex justify-between items-center shrink-0">
          {/* Logo / Título */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Layout className="text-white" size={18} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-slate-100 uppercase">
                RetailSpace 3D
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                Optimizador de Planogramas
              </p>
            </div>
          </div>

          {/* Tarjetas de Métricas de Cabecera */}
          <div className="hidden xl:flex items-center gap-4 text-xs">
            {/* Ventas */}
            <div className="bg-slate-950/40 border border-slate-850 px-3 py-1.5 rounded-lg flex flex-col items-center min-w-[100px]">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Ventas Est.</span>
              <span className="font-bold text-slate-200">{metrics.totalSales} u/sem</span>
            </div>

            {/* Margen */}
            <div className="bg-slate-950/40 border border-slate-850 px-3 py-1.5 rounded-lg flex flex-col items-center min-w-[100px]">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Ganancia Est.</span>
              <span className="font-bold text-emerald-400">${metrics.totalMargin.toFixed(0)} USD</span>
            </div>

            {/* Espacio lineal */}
            <div className="bg-slate-950/40 border border-slate-850 px-3 py-1.5 rounded-lg flex flex-col items-center min-w-[100px]">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Lineal Usado</span>
              <span className="font-bold text-slate-200">{metrics.spaceUsedPct}%</span>
            </div>

            {/* Alertas */}
            <div className="bg-slate-950/40 border border-slate-850 px-3 py-1.5 rounded-lg flex flex-col items-center min-w-[100px]">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Conflictos</span>
              <span className={`font-bold ${metrics.violatedRulesCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {metrics.violatedRulesCount} Alertas
              </span>
            </div>

            {/* SCORE */}
            <div className="bg-indigo-950/20 border border-indigo-800/40 px-3.5 py-1.5 rounded-lg flex flex-col items-center min-w-[80px]">
              <span className="text-[9px] text-indigo-400 uppercase font-bold">Score</span>
              <span className="font-extrabold text-indigo-300 text-sm font-mono">{metrics.financialScore}</span>
            </div>
          </div>

          {/* Acciones de Cabecera: Botón Optimizar */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              className="p-2.5 bg-slate-800 hover:bg-slate-705 border border-slate-700 hover:border-slate-600 rounded-xl text-slate-300 hover:text-slate-100 transition shadow-md active:scale-95"
              title={darkMode ? "Activar Modo Claro" : "Activar Modo Oscuro"}
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={startOptimization}
              disabled={isOptimizing}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-650 to-indigo-500 hover:from-indigo-600 hover:to-indigo-450 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/15 hover:shadow-indigo-500/25 transition active:scale-[0.98]"
            >
              {isOptimizing ? (
                <>
                  <RotateCw size={14} className="animate-spin text-slate-400" />
                  <span>Optimizando...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-indigo-200" />
                  <span>Optimizar Planograma</span>
                </>
              )}
            </button>
          </div>
        </header>
      )}

      {/* BARRA DE HERRAMIENTAS Y VISTAS */}
      <section className="h-12 bg-slate-900 border-b border-slate-800 px-6 flex justify-between items-center shrink-0">
        {/* Selector de Modo de Visualización (3D / 2D / Split) */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase font-bold mr-1">VISERA:</span>
          <div className="flex p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
            <button onClick={() => setViewMode('2D')} className={getViewModeButtonClass('2D')}>Plano 2D</button>
            <button onClick={() => setViewMode('3D')} className={getViewModeButtonClass('3D')}>Góndola 3D</button>
            <button onClick={() => setViewMode('split')} className={getViewModeButtonClass('split')}>División (2D/3D)</button>
          </div>
          <button
            onClick={toggleFullScreen}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition ${
              isFullScreen 
                ? 'bg-red-650 border-red-600 text-white font-bold' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
            }`}
            title="Pantalla Completa"
          >
            <Maximize size={12} />
            <span>Pantalla Completa</span>
          </button>
        </div>

        {/* Filtros de Mapa de Calor */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase font-bold mr-1 flex items-center gap-1">
            <Flame size={10} className="text-orange-400" />
            <span>Mapa de Calor:</span>
          </span>
          <div className="flex gap-1 bg-slate-950 p-0.5 border border-slate-800 rounded-lg">
            <button onClick={() => setHeatmapMode('none')} className={getHeatmapButtonClass('none')}>Desactivar</button>
            <button onClick={() => setHeatmapMode('sales')} className={getHeatmapButtonClass('sales')}>Ventas</button>
            <button onClick={() => setHeatmapMode('margin')} className={getHeatmapButtonClass('margin')}>Margen</button>
            <button onClick={() => setHeatmapMode('priority')} className={getHeatmapButtonClass('priority')}>Prioridad</button>
            <button onClick={() => setHeatmapMode('hotzone')} className={getHeatmapButtonClass('hotzone')}>Zonas Calientes</button>
          </div>
        </div>

        {/* Toggles de Cotas y Rejillas */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showDimensions}
              onChange={toggleDimensions}
              className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500/50"
            />
            <span className="flex items-center gap-1">
              <Ruler size={12} />
              Cotas
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={toggleGrid}
              className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500/50"
            />
            <span className="flex items-center gap-1">
              <Grid3X3 size={12} />
              Rejilla
            </span>
          </label>
          <div className="w-[1px] h-4 bg-slate-800 self-center mx-1" />
          <button
            onClick={() => setShowBottomPanels(!showBottomPanels)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
              showBottomPanels 
                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200' 
                : 'bg-indigo-650/95 border-indigo-600 text-white shadow-sm'
            }`}
            title={showBottomPanels ? "Ocultar panel inferior" : "Mostrar panel inferior"}
          >
            {showBottomPanels ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            <span>{showBottomPanels ? "Colapsar" : "Consola de Reglas"}</span>
          </button>
        </div>
      </section>

      {/* DASHBOARD WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANEL IZQUIERDO: Catálogo */}
        {!isFullScreen && (
          <aside className="w-[300px] shrink-0 h-full flex flex-col">
            <ProductCatalog />
          </aside>
        )}

        {/* ÁREA CENTRAL: Editores y Consola Inferior */}
        <main className="flex-1 h-full flex flex-col overflow-hidden bg-slate-950">
          
          {/* El lienzo principal (2D, 3D o Split) */}
          <div className="flex-1 p-4 overflow-hidden relative flex flex-col">
            <div className="flex-1 min-h-0 relative">
              {viewMode === '2D' && (
                <div className="w-full h-full">
                  <ShelfEditor2D />
                </div>
              )}

              {viewMode === '3D' && (
                <div className="w-full h-full">
                  <ShelfEditor3D />
                </div>
              )}

              {viewMode === 'split' && (
                <div className="w-full h-full grid grid-cols-2 gap-4">
                  <ShelfEditor2D />
                  <ShelfEditor3D />
                </div>
              )}
            </div>

            {/* Botón flotante 'X' para salir de pantalla completa */}
            {isFullScreen && (
              <button
                onClick={toggleFullScreen}
                className="absolute top-4 right-4 z-40 p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg shadow-red-600/30 transition hover:scale-105 active:scale-95 flex items-center justify-center border border-red-500 cursor-pointer"
                title="Salir de Pantalla Completa (Esc)"
              >
                <X size={20} />
              </button>
            )}

            {/* Botón flotante para restaurar las herramientas inferiores si están ocultas */}
            {!showBottomPanels && !isFullScreen && (
              <button
                onClick={() => setShowBottomPanels(true)}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-full text-xs font-bold text-slate-200 hover:text-white shadow-lg shadow-black/40 backdrop-blur z-30 transition hover:scale-105 active:scale-95"
              >
                <ChevronUp size={14} className="animate-bounce" />
                <span>Mostrar Consola e Historial</span>
              </button>
            )}
          </div>

          {/* ÁREA INFERIOR: Reglas y Gestión de Datos */}
          {!isFullScreen && (
            <div className={`transition-all duration-300 ease-in-out shrink-0 overflow-hidden bg-slate-900 border-slate-800 grid grid-cols-2 gap-4 ${
              showBottomPanels 
                ? 'h-[220px] border-t px-4 py-3 opacity-100' 
                : 'h-0 border-t-0 p-0 opacity-0'
            }`}>
              
              {/* Caja de validación de reglas (Izquierda) */}
              <div className="h-full overflow-hidden">
                <RulesValidator />
              </div>

              {/* Caja tabulada: Versiones o API Sandbox (Derecha) */}
              <div className="h-full overflow-hidden flex flex-col bg-slate-900 border border-slate-800 rounded-xl">
                {/* Barra de Tabs */}
                <div className="flex bg-slate-950/80 border-b border-slate-850 p-1 rounded-t-xl shrink-0 text-xs">
                  <button
                    onClick={() => setBottomTab('versions')}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md font-semibold transition ${
                      bottomTab === 'versions' 
                        ? 'bg-slate-900 text-slate-100 border border-slate-800' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FolderOpen size={12} />
                    <span>Historial de Versiones</span>
                  </button>
                  <button
                    onClick={() => setBottomTab('share')}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md font-semibold transition ${
                      bottomTab === 'share' 
                        ? 'bg-slate-900 text-slate-100 border border-slate-800' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <BarChart3 size={12} />
                    <span>Share de Góndola (SoS)</span>
                  </button>
                  <button
                    onClick={() => setBottomTab('api')}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md font-semibold transition ${
                      bottomTab === 'api' 
                        ? 'bg-slate-900 text-slate-100 border border-slate-800' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <TerminalIcon size={12} />
                    <span>API Sandbox / JSON</span>
                  </button>
                </div>

                {/* Contenido de Tab */}
                <div className="flex-1 overflow-hidden p-1 bg-slate-900">
                  {bottomTab === 'versions' && <VersionManager />}
                  {bottomTab === 'api' && <ApiSandbox />}
                  {bottomTab === 'share' && <ShareAnalysis />}
                </div>
              </div>

            </div>
          )}
        </main>

        {/* PANEL DERECHO: Inspector de Propiedades */}
        {!isFullScreen && (
          <aside className="w-[310px] shrink-0 h-full flex flex-col">
            <PropertyInspector />
          </aside>
        )}
      </div>

      {/* COMPARADOR ANTES / DESPUÉS (Modal Superpuesto) */}
      <ComparisonModal />
    </div>
  );
};
