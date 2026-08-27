import React from 'react';
import { usePlanogramStore } from '../store/planogramStore';
import { Trash2, Plus, Minus, Settings, BarChart2, Folder, Layers, Info } from 'lucide-react';


export const PropertyInspector: React.FC = () => {
  const {
    gondolaConfig,
    items,
    products,
    selectedItemId,
    selectedShelfId,
    weights,
    updateItem,
    removeItem,
    updateGondolaDimensions,
    updateShelvesCount,
    updateShelfHeight,
    setWeights,
    clearPlanogram,
    restockingInterval,
    setRestockingInterval
  } = usePlanogramStore();

  const productMap = new Map(products.map(p => [p.id, p]));
  const shelfMap = new Map(gondolaConfig.shelves.map(s => [s.id, s]));

  // 1. OBTENER ELEMENTO SELECCIONADO (ÍTEM DEL PLANOGRAMA)
  const selectedItem = items.find(i => i.id === selectedItemId);
  const selectedItemProduct = selectedItem ? productMap.get(selectedItem.productId) : null;
  const selectedItemShelf = selectedItem ? shelfMap.get(selectedItem.shelfId) : null;

  // 2. OBTENER ESTANTE SELECCIONADO
  const selectedShelf = selectedShelfId ? shelfMap.get(selectedShelfId) : null;
  const selectedShelfItems = selectedShelf ? items.filter(i => i.shelfId === selectedShelf.id) : [];

  // Calcular espacio y peso del estante seleccionado
  const shelfUsedWidth = selectedShelfItems.reduce((sum, item) => {
    const prod = productMap.get(item.productId);
    return sum + (prod ? prod.width * item.facings : 0);
  }, 0);
  const shelfAvailableWidth = selectedShelf ? Math.max(0, gondolaConfig.width - shelfUsedWidth) : 0;

  const shelfUsedWeight = selectedShelfItems.reduce((sum, item) => {
    const prod = productMap.get(item.productId);
    if (!prod || !selectedShelf) return sum;
    const depthCapacity = Math.max(1, Math.floor(selectedShelf.depth / prod.depth));
    const totalUnits = item.facings * (item.stack || 1) * depthCapacity;
    return sum + prod.weight * totalUnits;
  }, 0);
  const maxWeight = selectedShelf ? selectedShelf.maxWeight || 45 : 45;

  // Cambiar facings de ítem
  const handleFacingsChange = (delta: number) => {
    if (!selectedItem) return;
    const newFacings = Math.max(1, selectedItem.facings + delta);
    updateItem(selectedItem.id, { facings: newFacings });
  };

  // Cambiar apilamiento (stack) de ítem
  const handleStackChange = (delta: number) => {
    if (!selectedItem) return;
    const newStack = Math.max(1, (selectedItem.stack || 1) + delta);
    updateItem(selectedItem.id, { stack: newStack });
  };

  // Cambiar posición horizontal de ítem
  const handlePositionXChange = (val: number) => {
    if (!selectedItem) return;
    const maxVal = gondolaConfig.width;
    const finalVal = Math.max(0, Math.min(val, maxVal));
    updateItem(selectedItem.id, { positionX: Math.round(finalVal * 10) / 10 });
  };

  // Mover ítem a otro estante
  const handleShelfChange = (newShelfId: string) => {
    if (!selectedItem) return;
    updateItem(selectedItem.id, { shelfId: newShelfId });
  };

  // Exportar planograma a CSV
  const handleExportCSV = () => {
    let csvContent = "Estante,SKU,Marca,Producto,Facings,Apilamiento (Stack),Posicion X (cm),Ancho Ocupado (cm)\n";
    const itemsByShelf: Record<string, typeof items> = {};
    gondolaConfig.shelves.forEach(s => { itemsByShelf[s.id] = []; });
    items.forEach(item => {
      if (itemsByShelf[item.shelfId]) itemsByShelf[item.shelfId].push(item);
    });

    gondolaConfig.shelves.forEach(shelf => {
      const shelfItems = itemsByShelf[shelf.id] || [];
      shelfItems.sort((a, b) => a.positionX - b.positionX);
      shelfItems.forEach(item => {
        const prod = productMap.get(item.productId);
        if (!prod) return;
        const brand = prod.brand.replace(/"/g, '""');
        const name = prod.name.replace(/"/g, '""');
        csvContent += `${shelf.index + 1},"${prod.sku}","${brand}","${name}",${item.facings},${item.stack || 1},${item.positionX},${prod.width * item.facings}\n`;
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `planograma_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Descargar Guía de Montaje a TXT
  const handleExportGuide = () => {
    let text = "==================================================\n";
    text += "       GUÍA DE MONTAJE Y REPOSICIÓN DE GÓNDOLA      \n";
    text += `       Generado: ${new Date().toLocaleDateString()}                      \n`;
    text += "==================================================\n\n";
    
    text += `Dimensiones de Góndola: ${gondolaConfig.width} cm ancho x ${gondolaConfig.height} cm alto x ${gondolaConfig.depth} cm prof.\n`;
    text += `Cantidad de niveles: ${gondolaConfig.shelves.length}\n`;
    text += `Frecuencia de reposición planificada: cada ${restockingInterval} hs comerciales\n\n`;

    const itemsByShelf: Record<string, typeof items> = {};
    gondolaConfig.shelves.forEach(s => { itemsByShelf[s.id] = []; });
    items.forEach(item => {
      if (itemsByShelf[item.shelfId]) itemsByShelf[item.shelfId].push(item);
    });

    const sortedShelves = [...gondolaConfig.shelves].sort((a, b) => a.index - b.index);
    sortedShelves.forEach(shelf => {
      text += `--------------------------------------------------\n`;
      text += `ESTANTE ${shelf.index + 1} (Altura: ${shelf.yPosition} cm, Alto Libre: ${shelf.height} cm, Carga Máx: ${shelf.maxWeight || 45} kg)\n`;
      text += `--------------------------------------------------\n`;

      const shelfItems = itemsByShelf[shelf.id] || [];
      shelfItems.sort((a, b) => a.positionX - b.positionX);

      if (shelfItems.length === 0) {
        text += "   [Estante vacío]\n\n";
        return;
      }

      shelfItems.forEach((item, idx) => {
        const prod = productMap.get(item.productId);
        if (!prod) return;
        const stack = item.stack || 1;
        const totalWidth = prod.width * item.facings;
        const depthCapacity = Math.max(1, Math.floor(shelf.depth / prod.depth));
        const totalUnits = item.facings * stack * depthCapacity;

        text += `${idx + 1}. [Pos: ${item.positionX} cm] - ${prod.brand.toUpperCase()} - ${prod.name}\n`;
        text += `   - SKU: ${prod.sku}\n`;
        text += `   - Colocación: ${item.facings} facings (frentes) x ${stack} altura (apilado)\n`;
        text += `   - Profundidad: ${depthCapacity} unidades de fondo\n`;
        text += `   - Total unidades en estante: ${totalUnits} unidades\n`;
        text += `   - Espacio lineal ocupado: de ${item.positionX} cm a ${item.positionX + totalWidth} cm (Ancho: ${totalWidth} cm)\n`;
        text += `   - Peso total estimado: ${(prod.weight * totalUnits).toFixed(2)} kg\n\n`;
      });
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `guia_montaje_gondola_${Date.now()}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- VISTA 1: PROPIEDADES DE UN ÍTEM PRODUCTO ---
  if (selectedItem && selectedItemProduct) {
    const totalWidth = selectedItemProduct.width * selectedItem.facings;
    return (
      <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-full overflow-y-auto p-4 space-y-5">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
            <Info size={16} className="text-indigo-400" />
            <span>Propiedades del Producto</span>
          </h2>
          <button
            onClick={() => removeItem(selectedItem.id)}
            className="p-1.5 bg-red-950/80 hover:bg-red-900 border border-red-800 rounded text-red-400 hover:text-red-200 transition"
            title="Quitar de Góndola"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Ficha General */}
        <div className="flex gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-800">
          <img
            src={selectedItemProduct.imageUrl}
            alt={selectedItemProduct.name}
            className="w-16 h-16 object-cover rounded border border-slate-800"
          />
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{selectedItemProduct.brand}</span>
            <h3 className="text-xs font-bold text-slate-200 leading-snug line-clamp-2">{selectedItemProduct.name}</h3>
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">SKU: {selectedItemProduct.sku}</span>
          </div>
        </div>

        {/* Controles del Editor */}
        <div className="space-y-4 pt-1">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1">
            <Settings size={12} />
            <span>Editar en Estante</span>
          </h3>

          {/* Cantidad de Facings */}
          <div className="flex items-center justify-between p-3 bg-slate-950/20 rounded-lg border border-slate-800/80">
            <div>
              <div className="text-xs font-semibold text-slate-300">Cantidad (Facings)</div>
              <div className="text-[10px] text-slate-500">Número de caras frontales</div>
            </div>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
              <button
                onClick={() => handleFacingsChange(-1)}
                className="px-3 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <Minus size={12} />
              </button>
              <span className="px-3 font-semibold text-slate-200 text-sm w-8 text-center">{selectedItem.facings}</span>
              <button
                onClick={() => handleFacingsChange(1)}
                className="px-3 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Apilamiento Vertical (Stacking) */}
          <div className="flex items-center justify-between p-3 bg-slate-950/20 rounded-lg border border-slate-800/80">
            <div>
              <div className="text-xs font-semibold text-slate-300">Apilamiento (Stack)</div>
              <div className="text-[10px] text-slate-500">Unidades apiladas verticalmente</div>
            </div>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
              <button
                onClick={() => handleStackChange(-1)}
                className="px-3 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <Minus size={12} />
              </button>
              <span className="px-3 font-semibold text-slate-200 text-sm w-8 text-center">{selectedItem.stack || 1}</span>
              <button
                onClick={() => handleStackChange(1)}
                className="px-3 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Posición Horizontal (cm) */}
          <div className="p-3 bg-slate-950/20 rounded-lg border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-300">Posición Horizontal</span>
              <span className="text-xs font-bold font-mono text-indigo-400">{selectedItem.positionX} cm</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, gondolaConfig.width - selectedItemProduct.width * selectedItem.facings)}
              step={0.5}
              value={selectedItem.positionX}
              onChange={(e) => handlePositionXChange(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[8px] text-slate-500 font-mono">
              <span>0 cm</span>
              <span>Ancho Ocupado: {totalWidth.toFixed(1)} cm</span>
              <span>Mueble: {gondolaConfig.width} cm</span>
            </div>
          </div>

          {/* Cambiar de Estante */}
          <div className="p-3 bg-slate-950/20 rounded-lg border border-slate-800/80 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Estante Asignado</label>
            <select
              value={selectedItem.shelfId}
              onChange={(e) => handleShelfChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg p-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {gondolaConfig.shelves.map(s => (
                <option key={s.id} value={s.id}>
                  Estante {s.index + 1} (Altura: {s.yPosition} cm)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Métricas Comerciales */}
        <div className="space-y-3 pt-1 border-t border-slate-800/80">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1">
            <BarChart2 size={12} />
            <span>Métricas Comerciales</span>
          </h3>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-950/30 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Ventas Est.</span>
              <span className="font-semibold text-slate-200">{selectedItemProduct.sales} u/semana</span>
            </div>
            <div className="bg-slate-950/30 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Margen</span>
              <span className="font-semibold text-emerald-400">{(selectedItemProduct.margin * 100).toFixed(0)}%</span>
            </div>
            <div className="bg-slate-950/30 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Precio Venta</span>
              <span className="font-semibold text-slate-200">${selectedItemProduct.price.toFixed(2)}</span>
            </div>
            <div className="bg-slate-950/30 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Stock Disponible</span>
              <span className="font-semibold text-slate-200">{selectedItemProduct.stock} u</span>
            </div>
          </div>
        </div>

        {/* Capacidad y Rotación en Góndola */}
        <div className="space-y-3 pt-1 border-t border-slate-800/80">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1">
            <Layers size={12} className="text-indigo-400" />
            <span>Capacidad y Rotación</span>
          </h3>

          <div className="p-3 bg-slate-950/30 rounded-lg border border-slate-800 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Capacidad en fondo:</span>
              <span className="font-semibold text-slate-200">
                {selectedItemShelf ? Math.max(1, Math.floor(selectedItemShelf.depth / selectedItemProduct.depth)) : 1} unidades
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Capacidad total en estante:</span>
              <span className="font-semibold text-slate-200">
                {selectedItem.facings * (selectedItem.stack || 1) * (selectedItemShelf ? Math.max(1, Math.floor(selectedItemShelf.depth / selectedItemProduct.depth)) : 1)} unidades
              </span>
            </div>
            
            <div className="border-t border-slate-850 pt-2 flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Autonomía de Góndola:</span>
                <span className={`font-bold ${
                  (() => {
                    const depthCap = selectedItemShelf ? Math.max(1, Math.floor(selectedItemShelf.depth / selectedItemProduct.depth)) : 1;
                    const cap = selectedItem.facings * (selectedItem.stack || 1) * depthCap;
                    const sales = selectedItemProduct.sales || 0;
                    const hours = sales > 0 ? (cap * 84) / sales : 999;
                    return hours < 6.0 ? 'text-red-400' : hours < 12.0 ? 'text-amber-400' : 'text-green-400';
                  })()
                }`}>
                  {(() => {
                    const depthCap = selectedItemShelf ? Math.max(1, Math.floor(selectedItemShelf.depth / selectedItemProduct.depth)) : 1;
                    const cap = selectedItem.facings * (selectedItem.stack || 1) * depthCap;
                    const sales = selectedItemProduct.sales || 0;
                    return sales > 0 ? ((cap * 84) / sales).toFixed(1) : '999';
                  })()} horas
                </span>
              </div>
              
              <div className="text-[10px] mt-0.5 leading-relaxed">
                {(() => {
                  const depthCap = selectedItemShelf ? Math.max(1, Math.floor(selectedItemShelf.depth / selectedItemProduct.depth)) : 1;
                  const cap = selectedItem.facings * (selectedItem.stack || 1) * depthCap;
                  const sales = selectedItemProduct.sales || 0;
                  const hours = sales > 0 ? (cap * 84) / sales : 999;
                  if (hours < 6.0) {
                    return <span className="text-red-400 font-medium">⚠️ Quiebre Crítico: requiere reposición constante o aumentar facings/apilamiento.</span>;
                  } else if (hours < 12.0) {
                    return <span className="text-amber-400 font-medium">⚠️ Rotación Alta: requiere reponer en el día comercial.</span>;
                  } else {
                    return <span className="text-green-400 font-medium">✓ Estable: autonomía superior a un día comercial.</span>;
                  }
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Información Física */}
        <div className="space-y-3 border-t border-slate-800/80 pt-4 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Estante Actual:</span>
            <span className="text-slate-200 font-medium">Estante {selectedItemShelf ? selectedItemShelf.index + 1 : 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span>Ancho Unitario:</span>
            <span className="text-slate-200 font-medium">{selectedItemProduct.width} cm</span>
          </div>
          <div className="flex justify-between">
            <span>Alto Unitario:</span>
            <span className="text-slate-200 font-medium">{selectedItemProduct.height} cm</span>
          </div>
          <div className="flex justify-between">
            <span>Profundidad:</span>
            <span className="text-slate-200 font-medium">{selectedItemProduct.depth} cm</span>
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA 2: PROPIEDADES DE UN ESTANTE SELECCIONADO ---
  if (selectedShelf) {
    const spaceUsedPct = Math.round((shelfUsedWidth / gondolaConfig.width) * 100);

    return (
      <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-full overflow-y-auto p-4 space-y-5">
        <div className="pb-3 border-b border-slate-800">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
            <Layers size={16} className="text-amber-400" />
            <span>Propiedades del Estante {selectedShelf.index + 1}</span>
          </h2>
        </div>

        {/* Datos Físicos del Estante */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-500 text-[10px] block mb-0.5">Ancho</span>
            <span className="font-semibold text-slate-200">{gondolaConfig.width} cm</span>
          </div>
          <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-500 text-[10px] block mb-0.5">Alto Libre</span>
            <span className="font-semibold text-slate-200">{selectedShelf.height} cm</span>
          </div>
          <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-500 text-[10px] block mb-0.5">Profundidad</span>
            <span className="font-semibold text-slate-200">{selectedShelf.depth} cm</span>
          </div>
        </div>

        {/* Ajustar Altura Libre del Estante */}
        <div className="p-3 bg-slate-950/20 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Ajustar Altura Libre</span>
            <span className="font-bold font-mono text-indigo-400">{selectedShelf.height} cm</span>
          </div>
          <input
            type="range"
            min={15}
            max={80}
            step={1}
            value={selectedShelf.height}
            onChange={(e) => updateShelfHeight(selectedShelf.id, parseInt(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[8px] text-slate-500 font-mono">
            <span>Mín: 15 cm</span>
            <span>Máx: 80 cm</span>
          </div>
        </div>

        {/* Ocupación y Espacio */}
        <div className="space-y-2 p-3 bg-slate-950/20 rounded-lg border border-slate-800">
          <div className="flex justify-between items-center text-xs">
            <span className="font-medium text-slate-300">Ocupación Lineal</span>
            <span className={`font-bold ${spaceUsedPct > 100 ? 'text-red-400' : 'text-indigo-400'}`}>{spaceUsedPct}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${spaceUsedPct > 100 ? 'bg-red-500' : 'bg-indigo-500'}`}
              style={{ width: `${Math.min(100, spaceUsedPct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>Usado: {shelfUsedWidth.toFixed(1)} cm</span>
            <span>Libre: {shelfAvailableWidth.toFixed(1)} cm</span>
          </div>
        </div>

        {/* Carga de Peso */}
        <div className="space-y-2 p-3 bg-slate-950/20 rounded-lg border border-slate-800">
          <div className="flex justify-between items-center text-xs">
            <span className="font-medium text-slate-300">Carga de Peso</span>
            <span className={`font-bold ${shelfUsedWeight > maxWeight ? 'text-red-400' : 'text-emerald-450'}`}>{Math.round((shelfUsedWeight / maxWeight) * 100)}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${shelfUsedWeight > maxWeight ? 'bg-red-500' : 'bg-emerald-550'}`}
              style={{ width: `${Math.min(100, (shelfUsedWeight / maxWeight) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>Cargado: {shelfUsedWeight.toFixed(1)} kg</span>
            <span>Límite: {maxWeight} kg</span>
          </div>
        </div>

        {/* Lista de productos colocados en este estante */}
        <div className="space-y-3 pt-1">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <Folder size={12} className="text-slate-400" />
            <span>Productos Colocados ({selectedShelfItems.length})</span>
          </h3>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {selectedShelfItems.length > 0 ? (
              selectedShelfItems.map(item => {
                const prod = productMap.get(item.productId);
                if (!prod) return null;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      const { selectItem } = usePlanogramStore.getState();
                      selectItem(item.id);
                    }}
                    className="flex justify-between items-center p-2 bg-slate-950/40 border border-slate-800 rounded-lg hover:border-slate-700 cursor-pointer text-xs"
                  >
                    <div className="min-w-0">
                      <span className="text-[9px] text-slate-400 font-bold block truncate uppercase">{prod.brand}</span>
                      <span className="text-slate-200 font-medium truncate block">{prod.name}</span>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="font-bold text-slate-300 font-mono">{item.facings} f</span>
                      <span className="text-[10px] text-slate-500 block">{(prod.width * item.facings).toFixed(0)}cm</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-[11px] text-slate-500 border border-dashed border-slate-850 rounded-lg">
                Estante vacío
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA 3: CONFIGURACIÓN GENERAL DE GÓNDOLA Y PESOS DEL OPTIMIZADOR ---
  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-full overflow-y-auto p-4 space-y-6">
      <div className="pb-3 border-b border-slate-800">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
          <Settings size={16} className="text-slate-400" />
          <span>Configurar Góndola</span>
        </h2>
      </div>

      {/* Parámetros Dimensionales */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Dimensiones Totales</h3>

        {/* Ancho */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Ancho de Góndola</span>
            <span className="font-bold text-indigo-400 font-mono">{gondolaConfig.width} cm</span>
          </div>
          <input
            type="range"
            min={90}
            max={180}
            step={10}
            value={gondolaConfig.width}
            onChange={(e) => updateGondolaDimensions(parseInt(e.target.value), gondolaConfig.height, gondolaConfig.depth)}
            className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Alto */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Altura de Góndola</span>
            <span className="font-bold text-indigo-400 font-mono">{gondolaConfig.height} cm</span>
          </div>
          <input
            type="range"
            min={140}
            max={220}
            step={10}
            value={gondolaConfig.height}
            onChange={(e) => updateGondolaDimensions(gondolaConfig.width, parseInt(e.target.value), gondolaConfig.depth)}
            className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Estantes */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Cantidad de Estantes</span>
            <span className="font-bold text-indigo-400 font-mono">{gondolaConfig.shelves.length} niveles</span>
          </div>
          <input
            type="range"
            min={3}
            max={7}
            step={1}
            value={gondolaConfig.shelves.length}
            onChange={(e) => updateShelvesCount(parseInt(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Frecuencia de Reposición */}
        <div className="space-y-2 pt-2">
          <label className="block text-xs font-semibold text-slate-300">Frecuencia de Reposición</label>
          <select
            value={restockingInterval}
            onChange={(e) => setRestockingInterval(parseInt(e.target.value))}
            className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value={12}>Cada 12 horas comerciales (Diario)</option>
            <option value={24}>Cada 24 horas comerciales (2 días)</option>
            <option value={36}>Cada 36 horas comerciales (3 días)</option>
            <option value={84}>Cada 84 horas comerciales (1 semana)</option>
          </select>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Las alertas de stockout se adaptan a esta frecuencia para asegurar la cobertura hasta la próxima reposición.
          </p>
        </div>
      </div>

      {/* Pesos del Optimizador */}
      <div className="space-y-4 border-t border-slate-800/80 pt-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Prioridades de Optimización</h3>
        
        {/* Ventas */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Maximizar Ventas</span>
            <span className="font-bold text-indigo-400 font-mono">{(weights.sales * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={weights.sales}
            onChange={(e) => {
              const sales = parseFloat(e.target.value);
              // Ajustar proporcionalmente para que sumen 1
              const remaining = 1 - sales;
              const ratio = weights.margin + weights.space > 0 ? weights.margin / (weights.margin + weights.space) : 0.5;
              setWeights({
                sales,
                margin: Math.round(remaining * ratio * 10) / 10,
                space: Math.round(remaining * (1 - ratio) * 10) / 10
              });
            }}
            className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Margen */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Maximizar Ganancia (Margen)</span>
            <span className="font-bold text-indigo-400 font-mono">{(weights.margin * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={weights.margin}
            onChange={(e) => {
              const margin = parseFloat(e.target.value);
              const remaining = 1 - margin;
              const ratio = weights.sales + weights.space > 0 ? weights.sales / (weights.sales + weights.space) : 0.5;
              setWeights({
                sales: Math.round(remaining * ratio * 10) / 10,
                margin,
                space: Math.round(remaining * (1 - ratio) * 10) / 10
              });
            }}
            className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Espacio */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Eficiencia de Espacio</span>
            <span className="font-bold text-indigo-400 font-mono">{(weights.space * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={weights.space}
            onChange={(e) => {
              const space = parseFloat(e.target.value);
              const remaining = 1 - space;
              const ratio = weights.sales + weights.margin > 0 ? weights.sales / (weights.sales + weights.margin) : 0.5;
              setWeights({
                sales: Math.round(remaining * ratio * 10) / 10,
                margin: Math.round(remaining * (1 - ratio) * 10) / 10,
                space
              });
            }}
            className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      </div>

      {/* Acciones Globales */}
      <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-2">
        <button
          onClick={handleExportCSV}
          className="w-full py-2 bg-slate-950/45 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
        >
          Exportar Planograma (CSV)
        </button>
        <button
          onClick={handleExportGuide}
          className="w-full py-2 bg-indigo-950/20 hover:bg-indigo-900/60 border border-indigo-900/80 hover:border-indigo-750 text-indigo-300 text-xs font-semibold rounded-lg transition"
        >
          Descargar Guía de Montaje (TXT)
        </button>
        <button
          onClick={clearPlanogram}
          className="w-full py-2 bg-red-950/20 hover:bg-red-950/65 border border-red-900 text-red-400 hover:text-red-200 text-xs font-semibold rounded-lg transition"
        >
          Limpiar Todo el Planograma
        </button>
      </div>
    </div>
  );
};
