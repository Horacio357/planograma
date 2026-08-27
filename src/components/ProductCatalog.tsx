import React, { useState } from 'react';
import { usePlanogramStore } from '../store/planogramStore';
import type { Product } from '../types/planogram';
import { Search, Filter, SlidersHorizontal, ArrowUpDown, Upload, RotateCcw, FileSpreadsheet } from 'lucide-react';
import { mockCategories } from '../data/mockProducts';

export const ProductCatalog: React.FC = () => {
  const { products, selectProduct, selectedProductId, importProducts, resetProductsCatalog } = usePlanogramStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'sales' | 'margin' | 'priority'>('sales');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const hasImportedProducts = products.some(p => p.id.startsWith('imported-'));

  const parseCSV = (text: string): Product[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase());
    const imported: Product[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(/[;,]/).map(v => v.replace(/^["']|["']$/g, '').trim());
      if (values.length < headers.length) continue;

      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });

      const name = row.nombre || row.name || '';
      const brand = row.marca || row.brand || '';
      const sku = row.sku || '';
      const category = row.categoria || row.category || 'almacen';
      const width = parseFloat(row.ancho_cm || row.width || '10');
      const height = parseFloat(row.alto_cm || row.height || '15');
      const depth = parseFloat(row.profundidad_cm || row.depth || '8');
      const weight = parseFloat(row.peso_kg || row.weight || '0.5');
      const price = parseFloat(row.precio || row.price || '1.00');
      const margin = parseFloat(row.margen_pct || row.margin || '0.3');
      const sales = parseInt(row.ventas_semanales || row.sales || '50', 10);
      const stock = parseInt(row.stock || row.inventario || '100', 10);
      const marketShare = parseFloat(row.share || row.market_share || row.marketshare || '0.15');
      const priority = (row.prioridad || row.priority || 'medium').toLowerCase() as 'low' | 'medium' | 'high';

      if (!name || !brand || !sku) continue;

      imported.push({
        id: `imported-${sku}-${i}`,
        name,
        brand,
        sku,
        category,
        width: Math.max(2, width),
        height: Math.max(2, height),
        depth: Math.max(2, depth),
        weight: Math.max(0.01, weight),
        price: Math.max(0.1, price),
        margin: Math.max(0.01, Math.min(1, margin)),
        sales: Math.max(0, sales),
        stock: Math.max(0, stock),
        marketShare: Math.max(0, Math.min(1, marketShare)),
        priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
        imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&q=80'
      });
    }

    return imported;
  };

  const handleImportCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        alert("No se pudieron importar productos. Asegúrate de usar los nombres de columnas correctos (Nombre, Marca, SKU) y usar comas o punto y coma como separadores.");
        return;
      }
      importProducts(parsed);
      alert(`¡Catálogo importado con éxito! Se cargaron ${parsed.length} productos. Se limpió la góndola para evitar inconsistencias.`);
    };
    reader.readAsText(file);
  };

  const downloadCSVSample = () => {
    const csvContent = "Nombre;Marca;SKU;Categoria;Ancho_cm;Alto_cm;Profundidad_cm;Peso_kg;Precio;Margen_pct;Ventas_semanales;Prioridad\n" +
                       "Fideos Tallarín;Lucchetti;SKU-PASTA1;almacen;20;12;6.5;0.5;1.80;0.35;150;medium\n" +
                       "Azúcar Ledesma;Ledesma;SKU-SUGAR1;almacen;18;14;8;1;2.10;0.25;200;high\n" +
                       "Papas Fritas;Lay's;SKU-CHIPS1;snacks;16;22;5;0.15;2.50;0.40;300;high\n" +
                       "Gaseosa Cola 1.5L;Coca-Cola;SKU-COCA1.5;bebidas;9.5;32;9.5;1.5;3.20;0.20;500;high";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `plantilla_catalogo_planograma.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrado y Búsqueda
  const filteredProducts = products.filter(prod => {
    const matchesSearch = 
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.sku.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || prod.category === selectedCategory;
    const matchesPriority = selectedPriority === 'all' || prod.priority === selectedPriority;

    return matchesSearch && matchesCategory && matchesPriority;
  });

  // Ordenamiento
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortBy === 'sales') {
      comparison = a.sales - b.sales;
    } else if (sortBy === 'margin') {
      comparison = a.margin - b.margin;
    } else if (sortBy === 'priority') {
      const priorityVal = { low: 1, medium: 2, high: 3 };
      comparison = priorityVal[a.priority] - priorityVal[b.priority];
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleDragStart = (e: React.DragEvent, productId: string) => {
    e.dataTransfer.setData('text/plain', productId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const getPriorityBadgeClass = (priority: Product['priority']) => {
    switch (priority) {
      case 'high': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'low': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default: return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 w-full overflow-hidden">
      {/* Cabecera y Barra de Búsqueda */}
      <div className="p-4 border-b border-slate-800 flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>Catálogo de Productos</span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-normal">
              {products.length} ítems
            </span>
          </h2>
        </div>

        {/* Panel de Importación */}
        <div className="flex gap-2">
          <label className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-[10px] font-bold text-slate-200 rounded-lg cursor-pointer transition select-none active:scale-95">
            <Upload size={12} />
            <span>Importar CSV</span>
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleImportCSVFile}
            />
          </label>

          {hasImportedProducts && (
            <button
              onClick={resetProductsCatalog}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-red-950/45 hover:bg-red-900/60 border border-red-900/60 text-[10px] font-bold text-red-400 rounded-lg transition cursor-pointer active:scale-95"
              title="Restaurar catálogo original"
            >
              <RotateCcw size={12} />
              <span>Restaurar</span>
            </button>
          )}

          <button
            onClick={downloadCSVSample}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-slate-350 rounded-lg transition cursor-pointer active:scale-95"
            title="Descargar plantilla CSV de ejemplo"
          >
            <FileSpreadsheet size={12} />
            <span>Plantilla</span>
          </button>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por SKU, Nombre o Marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
          />
        </div>

        {/* Filtros rápidos */}
        <div className="flex gap-2">
          {/* Categorías */}
          <div className="relative flex-1">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none"
            >
              <option value="all">Categorías (Todas)</option>
              {mockCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <Filter className="absolute right-2.5 top-2.5 h-3 w-3 text-slate-500 pointer-events-none" />
          </div>

          {/* Prioridad */}
          <div className="relative flex-1">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none"
            >
              <option value="all">Prioridad (Todas)</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
            <SlidersHorizontal className="absolute right-2.5 top-2.5 h-3 w-3 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Ordenamiento */}
        <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-850">
          <div className="flex items-center gap-1">
            <span>Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border-none text-slate-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="sales">Ventas</option>
              <option value="margin">Margen</option>
              <option value="priority">Prioridad</option>
              <option value="name">Nombre</option>
            </select>
          </div>
          <button
            onClick={toggleSortOrder}
            className="flex items-center gap-1 hover:text-slate-200 transition bg-slate-850 px-2 py-1 rounded"
          >
            <span>{sortOrder === 'desc' ? 'Descendente' : 'Ascendente'}</span>
            <ArrowUpDown size={12} />
          </button>
        </div>
      </div>

      {/* Lista Scrolleable de Productos */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sortedProducts.length > 0 ? (
          sortedProducts.map(prod => {
            const isSelected = selectedProductId === prod.id;
            return (
              <div
                key={prod.id}
                draggable
                onDragStart={(e) => handleDragStart(e, prod.id)}
                onClick={() => selectProduct(isSelected ? null : prod.id)}
                className={`group relative flex gap-3 p-3 bg-slate-800/40 border rounded-xl cursor-grab active:cursor-grabbing hover:bg-slate-800/80 transition-all ${
                  isSelected 
                    ? 'border-indigo-500 bg-indigo-950/20 ring-1 ring-indigo-500/50' 
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Imagen del Producto (Placeholder Estilizado con Unsplash) */}
                <div className="relative w-14 h-14 rounded-lg bg-slate-950 overflow-hidden border border-slate-800/85 shrink-0 flex items-center justify-center">
                  <img
                    src={prod.imageUrl}
                    alt={prod.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                    onError={(e) => {
                      // Fallback si no carga la imagen
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {/* Categoría Badge de color en la esquina */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1.5"
                    style={{
                      backgroundColor: mockCategories.find(c => c.id === prod.category)?.color || '#64748b'
                    }}
                  />
                </div>

                {/* Detalles */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[10px] font-bold text-indigo-400 tracking-wide uppercase truncate">
                        {prod.brand}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${getPriorityBadgeClass(prod.priority)}`}>
                        {prod.priority === 'high' ? 'Alta' : prod.priority === 'medium' ? 'Media' : 'Baja'}
                      </span>
                    </div>
                    <h3 className="text-xs font-semibold text-slate-200 group-hover:text-slate-100 truncate mt-0.5" title={prod.name}>
                      {prod.name}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400 border-t border-slate-800/50 pt-1.5">
                    <div>
                      <span>Medidas: </span>
                      <span className="font-medium text-slate-300">
                        {prod.width}x{prod.height}x{prod.depth} cm
                      </span>
                    </div>
                    <div>
                      <span>SKU: </span>
                      <span className="font-mono text-slate-300">{prod.sku}</span>
                    </div>
                  </div>
                </div>

                {/* Info Comercial Hover/Fondo */}
                <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition flex gap-1 pointer-events-none">
                  <span className="bg-slate-900 border border-slate-700 text-slate-300 text-[8px] font-semibold px-1.5 py-0.5 rounded">
                    Ventas: {prod.sales}
                  </span>
                  <span className="bg-slate-900 border border-slate-700 text-slate-300 text-[8px] font-semibold px-1.5 py-0.5 rounded">
                    Margen: {(prod.margin * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No se encontraron productos
          </div>
        )}
      </div>
    </div>
  );
};
