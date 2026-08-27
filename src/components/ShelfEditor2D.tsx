import React, { useRef, useState } from 'react';
import { usePlanogramStore } from '../store/planogramStore';
import type { PlanogramItem, Product, ShelfConfig } from '../types/planogram';
import { Plus, Minus, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';

export const ShelfEditor2D: React.FC = () => {
  const {
    gondolaConfig,
    items,
    products,
    selectedItemId,
    heatmapMode,
    selectItem,
    selectShelf,
    updateItem,
    removeItem,
    addItem
  } = usePlanogramStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedOverShelfId, setDraggedOverShelfId] = useState<string | null>(null);

  // Escalar centímetros a píxeles.
  // Usamos una escala base: 1 cm = 5 px.
  // Así, un mueble de 120 cm de ancho tendrá 600 px de ancho.
  const CM_TO_PX = 5;

  const productMap = new Map(products.map(p => [p.id, p]));

  // Agrupar items por estante
  const itemsByShelf: Record<string, PlanogramItem[]> = {};
  gondolaConfig.shelves.forEach(s => {
    itemsByShelf[s.id] = [];
  });

  items.forEach(item => {
    if (itemsByShelf[item.shelfId]) {
      itemsByShelf[item.shelfId].push(item);
    }
  });

  // Ordenar de izquierda a derecha
  Object.keys(itemsByShelf).forEach(shelfId => {
    itemsByShelf[shelfId].sort((a, b) => a.positionX - b.positionX);
  });

  // Manejo de Drag and Drop del Catálogo (o entre estantes)
  const handleDragOver = (e: React.DragEvent, shelfId: string) => {
    e.preventDefault();
    setDraggedOverShelfId(shelfId);
  };

  const handleDragLeave = () => {
    setDraggedOverShelfId(null);
  };

  const handleDrop = (e: React.DragEvent, targetShelfId: string) => {
    e.preventDefault();
    setDraggedOverShelfId(null);

    const productId = e.dataTransfer.getData('text/plain');
    if (!productId) return;

    // Calcular posición X relativa al contenedor del estante
    const shelfRect = e.currentTarget.getBoundingClientRect();
    const dropX_px = e.clientX - shelfRect.left;
    const dropX_cm = dropX_px / CM_TO_PX;

    // Agregar el producto en el estante en esa posición
    addItem(productId, targetShelfId, dropX_cm);
  };

  // Mover producto horizontalmente con botones (nudging)
  const nudgeItem = (item: PlanogramItem, direction: 'left' | 'right') => {
    const prod = productMap.get(item.productId);
    if (!prod) return;

    const delta = 2.0; // mover 2 cm por click
    let newX = item.positionX;
    if (direction === 'left') {
      newX = Math.max(0, item.positionX - delta);
    } else {
      const itemWidth = prod.width * item.facings;
      newX = Math.min(gondolaConfig.width - itemWidth, item.positionX + delta);
    }

    updateItem(item.id, { positionX: Math.round(newX * 10) / 10 });
  };

  // Cambiar facings
  const adjustFacings = (item: PlanogramItem, delta: number) => {
    const newFacings = Math.max(1, item.facings + delta);
    updateItem(item.id, { facings: newFacings });
  };

  // Cambiar apilamiento (stack)
  const adjustStack = (item: PlanogramItem, delta: number) => {
    const newStack = Math.max(1, (item.stack || 1) + delta);
    updateItem(item.id, { stack: newStack });
  };

  // Obtener color según Heatmap o Categoría
  const getProductColor = (prod: Product, hMode: typeof heatmapMode) => {
    if (hMode === 'none') {
      switch (prod.category) {
        case 'bebidas': return 'bg-blue-600/90 border-blue-400';
        case 'snacks': return 'bg-amber-600/90 border-amber-400';
        case 'galletas': return 'bg-pink-600/90 border-pink-400';
        case 'lácteos': return 'bg-emerald-600/90 border-emerald-400';
        case 'limpieza': return 'bg-purple-600/90 border-purple-400';
        case 'almacén': return 'bg-slate-600/90 border-slate-400';
        default: return 'bg-slate-700 border-slate-500';
      }
    }

    // Colores de Heatmap
    let value = 0;
    if (hMode === 'sales') value = prod.sales > 120 ? 2 : prod.sales > 80 ? 1 : 0;
    else if (hMode === 'margin') value = prod.margin > 0.30 ? 2 : prod.margin > 0.20 ? 1 : 0;
    else if (hMode === 'priority') value = prod.priority === 'high' ? 2 : prod.priority === 'medium' ? 1 : 0;
    else if (hMode === 'hotzone') return 'bg-slate-700/80 border-slate-500'; // neutro en 2D

    if (value === 2) return 'bg-green-600/90 border-green-400 text-white';
    if (value === 1) return 'bg-yellow-500/90 border-yellow-300 text-slate-900';
    return 'bg-red-600/90 border-red-400 text-white';
  };

  // Dibujar el estante
  const renderShelf = (shelf: ShelfConfig) => {
    const shelfItems = itemsByShelf[shelf.id] || [];
    
    // Ancho total usado en cm
    const usedWidthCm = shelfItems.reduce((sum, item) => {
      const prod = productMap.get(item.productId);
      return sum + (prod ? prod.width * item.facings : 0);
    }, 0);

    const isOver = draggedOverShelfId === shelf.id;

    // Altura de escala
    const shelfHeightPx = shelf.height * CM_TO_PX;

    // Heatmap de estantes (Eye level index=2 es verde, 1/3 amarillo, 0/4 rojo)
    let shelfZoneClass = 'border-slate-700 bg-slate-800/40';
    if (heatmapMode === 'hotzone') {
      if (shelf.index === 2) shelfZoneClass = 'border-green-600/50 bg-green-950/20';
      else if (shelf.index === 1 || shelf.index === 3) shelfZoneClass = 'border-yellow-600/50 bg-yellow-950/25';
      else shelfZoneClass = 'border-red-600/50 bg-red-950/20';
    }

    return (
      <div
        key={shelf.id}
        onDragOver={(e) => handleDragOver(e, shelf.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, shelf.id)}
        onClick={(e) => {
          e.stopPropagation();
          selectItem(null);
          selectShelf(shelf.id);
        }}
        className={`relative border-t-2 border-b-8 transition-all ${shelfZoneClass} ${
          isOver ? 'bg-indigo-950/45 border-indigo-400 ring-2 ring-indigo-500/50' : ''
        }`}
        style={{
          height: `${shelfHeightPx}px`,
          width: `${gondolaConfig.width * CM_TO_PX}px`
        }}
      >
        {/* Marcador del Estante */}
        <div className="absolute left-2 top-2 bg-slate-900/80 px-2 py-0.5 rounded text-[10px] text-slate-400 border border-slate-700/50 select-none z-10 pointer-events-none">
          Estante {shelf.index + 1} ({shelf.height}cm alto) | Ocupado: {usedWidthCm.toFixed(0)}cm ({Math.round((usedWidthCm / gondolaConfig.width) * 100)}%)
        </div>

        {/* Productos dentro del estante */}
        {shelfItems.map(item => {
          const prod = productMap.get(item.productId);
          if (!prod) return null;

          const isSelected = item.id === selectedItemId;
          const itemWidthPx = prod.width * item.facings * CM_TO_PX;
          const itemStack = item.stack || 1;
          const itemHeightPx = prod.height * itemStack * CM_TO_PX;
          const itemLeftPx = item.positionX * CM_TO_PX;

          const colorClass = getProductColor(prod, heatmapMode);

          return (
            <div
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                selectItem(item.id);
              }}
              className={`absolute bottom-0 border border-solid rounded flex flex-col items-center justify-between text-center cursor-pointer transition p-1 overflow-hidden select-none ${colorClass} ${
                isSelected ? 'ring-4 ring-indigo-500 ring-offset-2 ring-offset-slate-900 z-20 scale-[1.01]' : 'hover:scale-[1.01] hover:brightness-110 z-10'
              }`}
              style={{
                left: `${itemLeftPx}px`,
                width: `${itemWidthPx}px`,
                height: `${itemHeightPx}px`
              }}
            >
              {/* Líneas discontinuas de apilamiento */}
              {itemStack > 1 && Array.from({ length: itemStack - 1 }).map((_, i) => (
                <div 
                  key={i} 
                  className="absolute left-0 right-0 border-t border-dashed border-white/20 pointer-events-none z-0"
                  style={{ bottom: `${(i + 1) * prod.height * CM_TO_PX}px` }}
                />
              ))}

              {/* Información Breve del Producto */}
              <div className="w-full flex flex-col justify-between h-full z-10 relative">
                {/* Cabecera / Marca */}
                <div className="text-[8px] font-bold tracking-wide uppercase opacity-75 truncate">
                  {prod.brand}
                </div>

                {/* Título */}
                <div className="text-[10px] font-semibold leading-tight line-clamp-2 px-0.5">
                  {prod.name.replace(prod.brand, '').trim()}
                </div>

                {/* Facings / Dim / Controles si seleccionado */}
                {isSelected ? (
                  <div key="card-controls" className="flex flex-col gap-1 w-full bg-slate-950/90 p-1 rounded border border-slate-700 z-30 pointer-events-auto shadow-xl">
                    <div className="flex flex-col text-[8px] text-slate-350 text-left px-0.5 gap-0.5 leading-none">
                      <div className="flex justify-between">
                        <span>Facings: <b>{item.facings}</b></span>
                        <span>Stack: <b>{itemStack}</b></span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pos: <b>{item.positionX}cm</b></span>
                      </div>
                    </div>
                    {/* Botones de acción rápido */}
                    <div className="flex justify-between gap-1 mt-0.5">
                      <div className="flex bg-slate-800 rounded" title="Facings">
                        <button
                          onClick={(e) => { e.stopPropagation(); adjustFacings(item, -1); }}
                          className="p-0.5 hover:bg-slate-700 rounded-l text-slate-300"
                        >
                          <Minus size={10} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); adjustFacings(item, 1); }}
                          className="p-0.5 hover:bg-slate-700 rounded-r text-slate-300 border-l border-slate-700"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <div className="flex bg-slate-800 rounded border border-amber-500/20" title="Apilamiento (Stack)">
                        <button
                          onClick={(e) => { e.stopPropagation(); adjustStack(item, -1); }}
                          className="p-0.5 hover:bg-slate-700 rounded-l text-amber-400"
                        >
                          <Minus size={10} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); adjustStack(item, 1); }}
                          className="p-0.5 hover:bg-slate-700 rounded-r text-amber-400 border-l border-slate-700"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <div className="flex bg-slate-800 rounded" title="Mover">
                        <button
                          onClick={(e) => { e.stopPropagation(); nudgeItem(item, 'left'); }}
                          className="p-0.5 hover:bg-slate-700 rounded-l text-slate-300"
                        >
                          <ArrowLeft size={10} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); nudgeItem(item, 'right'); }}
                          className="p-0.5 hover:bg-slate-700 rounded-r text-slate-300 border-l border-slate-700"
                        >
                          <ArrowRight size={10} />
                        </button>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                        className="p-0.5 bg-red-950/80 hover:bg-red-900 border border-red-800 rounded text-red-400 shrink-0"
                        title="Eliminar"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key="card-info" className="flex justify-between w-full text-[8px] opacity-90 font-medium px-0.5">
                    <span>{item.facings}F {itemStack > 1 ? `x${itemStack}` : ''}</span>
                    <span>${prod.price.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Línea metálica visual de la base del estante */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-500 border-t border-slate-400 opacity-90" />
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[450px] bg-slate-950 border border-slate-800 rounded-xl p-6 overflow-auto flex flex-col items-center shadow-inner"
      onClick={() => {
        selectItem(null);
        selectShelf(null);
      }}
    >
      <div className="flex justify-between w-full max-w-[620px] mb-4 text-xs text-slate-400 font-medium px-1">
        <span>Góndola Elevación Frontal (2D)</span>
        <span>Arrastra productos del catálogo aquí</span>
      </div>

      {/* Mueble Góndola */}
      <div
        className="relative bg-slate-900 border-4 border-slate-700 rounded shadow-2xl flex flex-col-reverse items-center pt-8 pb-4"
        style={{
          width: `${gondolaConfig.width * CM_TO_PX + 24}px`, // Agregar margen lateral
          minHeight: `${gondolaConfig.height * CM_TO_PX}px`
        }}
      >
        {/* Parante Metálico Izquierdo */}
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-slate-800 to-slate-600 border-r border-slate-900" />
        
        {/* Parante Metálico Derecho */}
        <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-l from-slate-800 to-slate-600 border-l border-slate-900" />

        {/* Renderizar los estantes en orden inverso (bottom-up) */}
        <div className="flex flex-col-reverse gap-4 w-full px-2">
          {gondolaConfig.shelves.map(shelf => renderShelf(shelf))}
        </div>
      </div>
    </div>
  );
};
