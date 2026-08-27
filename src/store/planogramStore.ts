import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  Product, 
  GondolaConfig, 
  PlanogramItem, 
  PlanogramVersion, 
  PlanogramMetrics, 
  ConstraintConfig, 
  OptimizationWeights, 
  RuleViolation 
} from '../types/planogram';
import { mockProducts } from '../data/mockProducts';
import { validatePlanogram } from '../services/ruleEngine';
import { optimizePlanogram } from '../services/optimizer';

function resolveShelfOverlaps(
  shelfId: string,
  allItems: PlanogramItem[],
  products: Product[],
  gondolaWidth: number,
  movedItemId: string | null = null
): PlanogramItem[] {
  // Clonar los items para evitar mutar propiedades de solo lectura en el estado congelado
  const clonedItems: PlanogramItem[] = allItems.map(item => ({ ...item }));

  const shelfItems = clonedItems.filter(item => item.shelfId === shelfId);
  if (shelfItems.length <= 1) return clonedItems;

  const productMap = new Map(products.map(p => [p.id, p]));

  const getItemWidth = (item: PlanogramItem) => {
    const p = productMap.get(item.productId);
    if (!p) return 10;
    return (item.isLyingDown ? p.height : p.width) * item.facings;
  };

  const anchor = shelfItems.find(item => item.id === movedItemId);
  if (!anchor) return clonedItems;

  const anchorWidth = getItemWidth(anchor);
  
  let anchorLeft = anchor.positionX;
  if (anchorLeft < 0) anchorLeft = 0;
  if (anchorLeft + anchorWidth > gondolaWidth) anchorLeft = Math.max(0, gondolaWidth - anchorWidth);
  anchor.positionX = anchorLeft;

  const anchorRight = anchorLeft + anchorWidth;
  const anchorCenter = anchorLeft + anchorWidth / 2;

  const otherItems = shelfItems.filter(item => item.id !== anchor.id);
  const leftGroup: { item: PlanogramItem; width: number; center: number }[] = [];
  const rightGroup: { item: PlanogramItem; width: number; center: number }[] = [];

  otherItems.forEach(item => {
    const w = getItemWidth(item);
    const c = item.positionX + w / 2;
    if (c < anchorCenter) {
      leftGroup.push({ item, width: w, center: c });
    } else {
      rightGroup.push({ item, width: w, center: c });
    }
  });

  leftGroup.sort((a, b) => b.item.positionX - a.item.positionX);
  rightGroup.sort((a, b) => a.item.positionX - b.item.positionX);

  let prevRight = anchorRight;
  rightGroup.forEach(g => {
    if (g.item.positionX < prevRight) {
      g.item.positionX = prevRight;
    }
    prevRight = g.item.positionX + g.width;
  });

  let prevLeft = anchorLeft;
  leftGroup.forEach(g => {
    const itemRight = g.item.positionX + g.width;
    if (itemRight > prevLeft) {
      g.item.positionX = prevLeft - g.width;
    }
    prevLeft = g.item.positionX;
  });

  const totalWidth = shelfItems.reduce((sum, item) => {
    return sum + getItemWidth(item);
  }, 0);

  if (totalWidth <= gondolaWidth) {
    let minX = Math.min(...shelfItems.map(i => i.positionX));
    if (minX < 0) {
      const offset = -minX;
      shelfItems.forEach(i => {
        i.positionX += offset;
      });
    }

    let maxX = Math.max(...shelfItems.map(i => {
      return i.positionX + getItemWidth(i);
    }));

    if (maxX > gondolaWidth) {
      const offset = maxX - gondolaWidth;
      shelfItems.forEach(i => {
        i.positionX = Math.max(0, i.positionX - offset);
      });
    }

    shelfItems.sort((a, b) => a.positionX - b.positionX);
    let curRight = 0;
    shelfItems.forEach(item => {
      if (item.positionX < curRight) {
        item.positionX = curRight;
      }
      curRight = item.positionX + getItemWidth(item);
    });
  }

  shelfItems.forEach(i => {
    i.positionX = Math.round(i.positionX * 10) / 10;
  });

  const shelfItemIds = new Set(shelfItems.map(i => i.id));
  const otherShelfItems = clonedItems.filter(item => !shelfItemIds.has(item.id));
  return [...otherShelfItems, ...shelfItems];
}

interface PlanogramState {
  // Datos
  products: Product[];
  gondolaConfig: GondolaConfig;
  items: PlanogramItem[];
  constraints: ConstraintConfig;
  weights: OptimizationWeights;
  
  // Selección e UI
  selectedItemId: string | null;
  selectedShelfId: string | null;
  selectedProductId: string | null;
  heatmapMode: 'none' | 'sales' | 'margin' | 'priority' | 'hotzone';
  viewMode: '3D' | '2D' | 'split';
  showDimensions: boolean;
  showGrid: boolean;
  darkMode: boolean;
  
  // Historial y Comparación
  versions: PlanogramVersion[];
  optimizedVersion: PlanogramVersion | null;
  comparisonMode: boolean;
  isOptimizing: boolean;
  restockingInterval: number; // frecuencia de reposición en horas comerciales

  // Violaciones de reglas
  ruleViolations: RuleViolation[];

  // Acciones - Configuración Mueble
  setGondolaConfig: (config: GondolaConfig) => void;
  updateGondolaDimensions: (width: number, height: number, depth: number) => void;
  updateShelvesCount: (count: number) => void;
  updateShelfHeight: (shelfId: string, height: number) => void;
  setRestockingInterval: (interval: number) => void;

  // Acciones - Editor de Planograma
  addItem: (productId: string, shelfId: string, positionX?: number) => void;
  updateItem: (itemId: string, updates: Partial<PlanogramItem>) => void;
  removeItem: (itemId: string) => void;
  clearPlanogram: () => void;
  
  // Acciones - Selección
  selectItem: (itemId: string | null) => void;
  selectShelf: (shelfId: string | null) => void;
  selectProduct: (productId: string | null) => void;
  
  // Acciones - UI
  setHeatmapMode: (mode: 'none' | 'sales' | 'margin' | 'priority' | 'hotzone') => void;
  setViewMode: (mode: '3D' | '2D' | 'split') => void;
  toggleDimensions: () => void;
  toggleGrid: () => void;
  toggleDarkMode: () => void;
  
  // Acciones - Pesos de Optimización
  setWeights: (weights: OptimizationWeights) => void;
  
  // Acciones - Versiones e Historial
  saveVersion: (name: string) => void;
  loadVersion: (versionId: string) => void;
  deleteVersion: (versionId: string) => void;

  // Acciones - Flujo de Optimización
  startOptimization: () => Promise<void>;
  acceptOptimization: () => void;
  discardOptimization: () => void;
  setOptimizedVersion: (optVersion: PlanogramVersion | null) => void;
}

// Inicialización de la Góndola por Defecto
const defaultShelves = [
  { id: 'shelf-1', index: 0, yPosition: 15, height: 45, depth: 45, maxWeight: 60 },
  { id: 'shelf-2', index: 1, yPosition: 60, height: 35, depth: 40, maxWeight: 50 },
  { id: 'shelf-3', index: 2, yPosition: 95, height: 30, depth: 40, maxWeight: 40 }, // Altura de los ojos (Hot zone)
  { id: 'shelf-4', index: 3, yPosition: 125, height: 25, depth: 35, maxWeight: 30 },
  { id: 'shelf-5', index: 4, yPosition: 150, height: 30, depth: 35, maxWeight: 30 }
];

const defaultGondola: GondolaConfig = {
  width: 120, // en cm
  height: 180, // en cm
  depth: 45, // en cm
  shelves: defaultShelves
};

// Items por Defecto en la Góndola
const defaultItems: PlanogramItem[] = [
  // Estante 1 (Limpieza y Almacén Pesado)
  { id: 'item-1', productId: 'prod-14', shelfId: 'shelf-1', positionX: 5, facings: 2 },  // Detergente UltraBrillo (8.5cm * 2 = 17cm)
  { id: 'item-2', productId: 'prod-15', shelfId: 'shelf-1', positionX: 30, facings: 1 }, // Limpiador Multiuso (9.5cm * 1 = 9.5cm)
  { id: 'item-3', productId: 'prod-20', shelfId: 'shelf-1', positionX: 50, facings: 2 }, // Aceite NaturaSol (8cm * 2 = 16cm)
  { id: 'item-4', productId: 'prod-18', shelfId: 'shelf-1', positionX: 80, facings: 2 }, // Arroz GranoOro (13cm * 2 = 26cm)

  // Estante 2 (Bebidas)
  { id: 'item-5', productId: 'prod-1', shelfId: 'shelf-2', positionX: 10, facings: 4 },  // Coca-Cola (6.5cm * 4 = 26cm)
  { id: 'item-6', productId: 'prod-2', shelfId: 'shelf-2', positionX: 45, facings: 3 },  // Pepsi (6.5cm * 3 = 19.5cm)
  { id: 'item-7', productId: 'prod-4', shelfId: 'shelf-2', positionX: 75, facings: 3 },  // Cerveza Heineken (6.6cm * 3 = 19.8cm)

  // Estante 3 (Snacks - Altura Ojos / Hot Zone)
  { id: 'item-8', productId: 'prod-5', shelfId: 'shelf-3', positionX: 15, facings: 2 },  // Papas Lays (18cm * 2 = 36cm)
  { id: 'item-9', productId: 'prod-6', shelfId: 'shelf-3', positionX: 60, facings: 2 },  // Doritos (18cm * 2 = 36cm)
  { id: 'item-10', productId: 'prod-7', shelfId: 'shelf-3', positionX: 100, facings: 1 }, // Maní Crisp (10cm * 1 = 10cm)

  // Estante 4 (Galletas)
  { id: 'item-11', productId: 'prod-8', shelfId: 'shelf-4', positionX: 10, facings: 3 },  // Oreo (15cm * 3 = 45cm)
  { id: 'item-12', productId: 'prod-10', shelfId: 'shelf-4', positionX: 65, facings: 2 }, // Cookies Chips (12cm * 2 = 24cm)

  // Estante 5 (Lácteos - ¡Genera advertencia por estar fuera del estante 1-2!)
  { id: 'item-13', productId: 'prod-11', shelfId: 'shelf-5', positionX: 10, facings: 4 },  // Leche Purísima UHT (7cm * 4 = 28cm)
  { id: 'item-14', productId: 'prod-12', shelfId: 'shelf-5', positionX: 50, facings: 3 },  // Yogur YogoVida (7.5cm * 3 = 22.5cm)
];

// Restricciones por Defecto
const defaultConstraints: ConstraintConfig = {
  minFacings: {
    'prod-1': 2, // Coca Cola mín 2 facings
    'prod-5': 2, // Papas Lays mín 2 facings
    'prod-11': 2, // Leche mín 2 facings
  },
  maxFacings: {
    'prod-1': 6,
    'prod-8': 4,
    'prod-14': 4,
  },
  categoryShelves: {
    'bebidas': [0, 1, 2],
    'snacks': [1, 2, 3],
    'lácteos': [0, 1], // Restringido a estantes inferiores (lácteos refrigerados)
    'limpieza': [0, 1], // Productos químicos abajo por seguridad
  },
  brandAdjacency: ['Coca-Cola', 'Pepsi'],
  requiredProducts: ['prod-1', 'prod-5', 'prod-11', 'prod-14'] // Productos clave
};

// Helper para calcular métricas comerciales y de espacio
export function calculateMetrics(
  gondolaConfig: GondolaConfig,
  items: PlanogramItem[],
  products: Product[],
  violationsCount: number,
  weights: OptimizationWeights
): PlanogramMetrics {
  const productMap = new Map(products.map(p => [p.id, p]));

  let totalSales = 0;
  let totalMargin = 0;
  let totalProductWidth = 0;

  items.forEach(item => {
    const prod = productMap.get(item.productId);
    if (!prod) return;

    // Ventas totales estimadas (unidades de facings * ventas del producto)
    totalSales += item.facings * prod.sales;

    // Margen comercial estimado en USD (facings * ventas semanales * precio * porcentaje_margen)
    totalMargin += item.facings * prod.sales * prod.price * prod.margin;

    // Ancho lineal utilizado
    const itemWidth = item.isLyingDown ? prod.height : prod.width;
    totalProductWidth += itemWidth * item.facings;
  });

  // Espacio lineal total disponible en todos los estantes
  const totalAvailableWidth = gondolaConfig.width * gondolaConfig.shelves.length;
  const spaceUsedPct = totalAvailableWidth > 0 ? (totalProductWidth / totalAvailableWidth) * 100 : 0;

  // Puntuación financiera ponderada (0 a 100)
  // Para la normalización, asumimos un escenario hipotético de rendimiento
  const baseSalesMax = 1000;  // Referencia de ventas máximas razonables
  const baseMarginMax = 500;  // Referencia de margen máximo en USD razonable
  
  const normSales = Math.min(totalSales / baseSalesMax, 1);
  const normMargin = Math.min(totalMargin / baseMarginMax, 1);
  
  // Utilización de espacio óptima es alrededor del 85%
  // Penalizamos estantes vacíos y sobreocupación (más de 100% de ocupación en algún estante se penaliza en reglas)
  const spaceUtilFactor = spaceUsedPct > 100 ? Math.max(0, 2 - spaceUsedPct / 100) : spaceUsedPct / 100;
  
  // Penalizaciones por reglas rotas (5% de penalización por cada regla de advertencia, 15% por error crítico)
  const penalty = violationsCount * 0.05;

  const rawScore = (
    normSales * weights.sales +
    normMargin * weights.margin +
    spaceUtilFactor * weights.space
  ) - penalty;

  const financialScore = Math.max(0, Math.min(Math.round(rawScore * 100), 100));

  return {
    totalSales: Math.round(totalSales),
    totalMargin: Math.round(totalMargin * 100) / 100,
    spaceUsedPct: Math.round(spaceUsedPct * 10) / 10,
    itemCount: items.length,
    violatedRulesCount: violationsCount,
    financialScore
  };
}

export const usePlanogramStore = create<PlanogramState>()(
  persist(
    (set, get) => {
      // Función interna para recalcular violaciones y métricas
      const refreshMetricsAndRules = (
        gondola: GondolaConfig,
        items: PlanogramItem[],
        prods: Product[],
        constraints: ConstraintConfig,
        weights: OptimizationWeights
      ) => {
        const rInterval = get()?.restockingInterval || 12;
        const violations = validatePlanogram(gondola, items, prods, constraints, rInterval);
        const metrics = calculateMetrics(gondola, items, prods, violations.length, weights);
        return { ruleViolations: violations, metrics };
      };

      return {
        // Estado inicial
        products: mockProducts,
        gondolaConfig: defaultGondola,
        items: defaultItems,
        constraints: defaultConstraints,
        weights: { sales: 0.5, margin: 0.3, space: 0.2 },
        
        selectedItemId: null,
        selectedShelfId: null,
        selectedProductId: null,
        heatmapMode: 'none',
        viewMode: 'split',
        showDimensions: true,
        showGrid: true,
        darkMode: true,
        
        versions: [],
        optimizedVersion: null,
        comparisonMode: false,
        isOptimizing: false,
        restockingInterval: 12, // 1 día comercial (12 hs)
        
        // Inicializar violaciones por defecto
        ruleViolations: validatePlanogram(defaultGondola, defaultItems, mockProducts, defaultConstraints, 12),

        // Configuración de Góndola
        setGondolaConfig: (config) => {
          const { products, items, constraints, weights } = get();
          
          // Re-ubicar ítems en estantes si cambió la configuración de estantes
          const updatedItems = items.filter(item => config.shelves.some(s => s.id === item.shelfId));
          const { ruleViolations } = refreshMetricsAndRules(config, updatedItems, products, constraints, weights);
          
          set({
            gondolaConfig: config,
            items: updatedItems,
            ruleViolations,
            selectedItemId: null,
            selectedShelfId: null
          });
        },

        updateGondolaDimensions: (width, height, depth) => {
          const { gondolaConfig } = get();
          const scale = width / gondolaConfig.width;

          // Ajustar estantes proporcionalmente
          const updatedShelves = gondolaConfig.shelves.map(shelf => ({
            ...shelf,
            depth: Math.min(depth, shelf.depth) // profundidad no puede superar la total
          }));

          // Ajustar posición X de los productos proporcionalmente para que se adapten al nuevo ancho
          const { items, products, constraints, weights } = get();
          const updatedItems = items.map(item => ({
            ...item,
            positionX: Math.round(item.positionX * scale * 10) / 10
          }));

          const newGondola = {
            ...gondolaConfig,
            width,
            height,
            depth,
            shelves: updatedShelves
          };

          const { ruleViolations } = refreshMetricsAndRules(newGondola, updatedItems, products, constraints, weights);

          set({
            gondolaConfig: newGondola,
            items: updatedItems,
            ruleViolations
          });
        },

        setRestockingInterval: (interval) => {
          set({ restockingInterval: interval });
          const { gondolaConfig, items, products, constraints, weights } = get();
          const { ruleViolations } = refreshMetricsAndRules(gondolaConfig, items, products, constraints, weights);
          set({ ruleViolations });
        },

        updateShelvesCount: (count) => {
          const { gondolaConfig, items, products, constraints, weights } = get();
          const currentCount = gondolaConfig.shelves.length;

          if (count === currentCount || count < 2 || count > 8) return;

          let newShelves = [];
          if (count < currentCount) {
            // Eliminar estantes de arriba
            newShelves = gondolaConfig.shelves.slice(0, count);
          } else {
            // Agregar estantes repartiendo la altura de la góndola
            newShelves = [...gondolaConfig.shelves];
            const baseHeight = 15; // altura base desde el suelo
            const totalUsableHeight = gondolaConfig.height - baseHeight - 10;
            const step = totalUsableHeight / (count - 1);

            newShelves = Array.from({ length: count }, (_, idx) => {
              const yPos = Math.round(baseHeight + idx * step);
              const height = idx === count - 1 ? 30 : Math.round(step - 5);
              return {
                id: `shelf-${idx + 1}`,
                index: idx,
                yPosition: yPos,
                height: Math.max(20, height),
                depth: Math.round(gondolaConfig.depth - (idx * 2)), // los estantes más altos suelen ser ligeramente menos profundos
                maxWeight: Math.max(20, 60 - idx * 8)
              };
            });
          }

          // Filtrar items cuyos estantes ya no existen
          const shelfIds = new Set(newShelves.map(s => s.id));
          const updatedItems = items.filter(item => shelfIds.has(item.shelfId));

          const newGondola = {
            ...gondolaConfig,
            shelves: newShelves
          };

          const { ruleViolations } = refreshMetricsAndRules(newGondola, updatedItems, products, constraints, weights);

          set({
            gondolaConfig: newGondola,
            items: updatedItems,
            ruleViolations,
            selectedItemId: null,
            selectedShelfId: null
          });
        },

        updateShelfHeight: (shelfId, height) => {
          const { gondolaConfig, items, products, constraints, weights } = get();
          const shelfIndex = gondolaConfig.shelves.findIndex(s => s.id === shelfId);
          if (shelfIndex === -1) return;

          const updatedShelves = gondolaConfig.shelves.map(s => ({ ...s }));
          const validHeight = Math.max(15, Math.min(height, 100));
          updatedShelves[shelfIndex].height = validHeight;

          // Recalcular posiciones yPosition de todos los estantes superiores acumulativamente
          for (let i = shelfIndex + 1; i < updatedShelves.length; i++) {
            updatedShelves[i].yPosition = updatedShelves[i - 1].yPosition + updatedShelves[i - 1].height;
          }

          // Validar que la parte superior de todos los estantes no exceda la altura total de la góndola
          const topShelf = updatedShelves[updatedShelves.length - 1];
          const totalHeightNeeded = topShelf.yPosition + topShelf.height;

          if (totalHeightNeeded > gondolaConfig.height) {
            // Si el espacio necesario es mayor que la góndola, ajustamos la altura de la góndola
            // o cancelamos el cambio. Limitemos el cambio de altura al máximo permitido para que quepa en la góndola.
            const difference = totalHeightNeeded - gondolaConfig.height;
            const adjustedHeight = validHeight - difference;
            if (adjustedHeight < 15) return; // Si es muy chico, no hacemos nada
            updatedShelves[shelfIndex].height = Math.round(adjustedHeight);
            
            // Recalcular posiciones con la altura ajustada
            for (let i = shelfIndex + 1; i < updatedShelves.length; i++) {
              updatedShelves[i].yPosition = updatedShelves[i - 1].yPosition + updatedShelves[i - 1].height;
            }
          }

          const newGondola = {
            ...gondolaConfig,
            shelves: updatedShelves
          };

          const { ruleViolations } = refreshMetricsAndRules(newGondola, items, products, constraints, weights);

          set({
            gondolaConfig: newGondola,
            ruleViolations
          });
        },

        // Edición de ítems
        addItem: (productId, shelfId, positionX) => {
          const { gondolaConfig, items, products, constraints, weights } = get();
          const prod = products.find(p => p.id === productId);
          if (!prod) return;

          // Si no se define posición, colocarlo al final (derecha) del estante
          let finalX = positionX !== undefined ? positionX : 0;
          if (positionX === undefined) {
            const shelfItems = items.filter(i => i.shelfId === shelfId);
            if (shelfItems.length > 0) {
              const rightmostItem = shelfItems.reduce((max, item) => {
                const itemProd = products.find(p => p.id === item.productId);
                const width = itemProd ? itemProd.width * item.facings : 10;
                return (item.positionX + width) > max ? (item.positionX + width) : max;
              }, 0);
              finalX = rightmostItem + 2; // dejar 2 cm de holgura
            } else {
              finalX = 5; // margen izquierdo inicial
            }
          }

          // Asegurar que no exceda el límite del estante por defecto
          if (finalX + prod.width > gondolaConfig.width) {
            finalX = Math.max(0, gondolaConfig.width - prod.width - 2);
          }

          const newItem: PlanogramItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            productId,
            shelfId,
            positionX: Math.round(finalX * 10) / 10,
            facings: 1,
            stack: 1
          };

          const rawItems = [...items, newItem];
          const updatedItems = resolveShelfOverlaps(shelfId, rawItems, products, gondolaConfig.width, newItem.id);
          const { ruleViolations } = refreshMetricsAndRules(gondolaConfig, updatedItems, products, constraints, weights);

          set({
            items: updatedItems,
            ruleViolations,
            selectedItemId: newItem.id,
            selectedShelfId: shelfId,
            selectedProductId: null
          });
        },

        updateItem: (itemId, updates) => {
          const { gondolaConfig, items, products, constraints, weights } = get();
          const updatedItems = items.map(item => {
            if (item.id === itemId) {
              const updated = { ...item, ...updates };
              // Prevenir que posición X sea negativa
              if (updated.positionX !== undefined) {
                updated.positionX = Math.max(0, updated.positionX);
              }
              // Prevenir facings menores a 1
              if (updated.facings !== undefined) {
                updated.facings = Math.max(1, updated.facings);
              }
              // Prevenir stack menor a 1
              if (updated.stack !== undefined) {
                updated.stack = Math.max(1, updated.stack);
              }
              return updated;
            }
            return item;
          });

          let resolvedItems = updatedItems;
          if (updates.positionX !== undefined || updates.facings !== undefined || updates.shelfId !== undefined) {
            const originalItem = items.find(i => i.id === itemId);
            if (originalItem) {
              const shelfToResolve = updates.shelfId !== undefined ? updates.shelfId : originalItem.shelfId;
              resolvedItems = resolveShelfOverlaps(shelfToResolve, updatedItems, products, gondolaConfig.width, itemId);
            }
          }

          const { ruleViolations } = refreshMetricsAndRules(gondolaConfig, resolvedItems, products, constraints, weights);

          set({
            items: resolvedItems,
            ruleViolations
          });
        },

        removeItem: (itemId) => {
          const { gondolaConfig, items, products, constraints, weights } = get();
          const updatedItems = items.filter(item => item.id !== itemId);
          const { ruleViolations } = refreshMetricsAndRules(gondolaConfig, updatedItems, products, constraints, weights);

          set({
            items: updatedItems,
            ruleViolations,
            selectedItemId: null
          });
        },

        clearPlanogram: () => {
          const { gondolaConfig, products, constraints, weights } = get();
          const { ruleViolations } = refreshMetricsAndRules(gondolaConfig, [], products, constraints, weights);

          set({
            items: [],
            ruleViolations,
            selectedItemId: null,
            selectedShelfId: null
          });
        },

        // Selección
        selectItem: (itemId) => set({ 
          selectedItemId: itemId, 
          selectedShelfId: itemId ? get().items.find(i => i.id === itemId)?.shelfId || null : null,
          selectedProductId: null 
        }),
        selectShelf: (shelfId) => set({ 
          selectedShelfId: shelfId, 
          selectedItemId: null, 
          selectedProductId: null 
        }),
        selectProduct: (productId) => set({ 
          selectedProductId: productId, 
          selectedItemId: null, 
          selectedShelfId: null 
        }),

        // UI
        setHeatmapMode: (mode) => set({ heatmapMode: mode }),
        setViewMode: (mode) => set({ viewMode: mode }),
        toggleDimensions: () => set(state => ({ showDimensions: !state.showDimensions })),
        toggleGrid: () => set(state => ({ showGrid: !state.showGrid })),
        toggleDarkMode: () => set(state => ({ darkMode: !state.darkMode })),

        // Pesos de Optimización
        setWeights: (weights) => {
          set({ weights });
        },

        // Versiones
        saveVersion: (name) => {
          const { gondolaConfig, items, products, weights, ruleViolations } = get();
          const metrics = calculateMetrics(gondolaConfig, items, products, ruleViolations.length, weights);
          const score = metrics.financialScore;

          const newVersion: PlanogramVersion = {
            id: `ver-${Date.now()}`,
            name,
            items: JSON.parse(JSON.stringify(items)),
            gondolaConfig: JSON.parse(JSON.stringify(gondolaConfig)),
            score,
            metrics,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            user: 'Store Manager (Demo)',
            isOptimized: false
          };

          set(state => ({
            versions: [newVersion, ...state.versions]
          }));
        },

        loadVersion: (versionId) => {
          const { versions, products, constraints, weights } = get();
          const version = versions.find(v => v.id === versionId);
          if (!version) return;

          const newGondola = JSON.parse(JSON.stringify(version.gondolaConfig));
          const newItems = JSON.parse(JSON.stringify(version.items));

          const { ruleViolations } = refreshMetricsAndRules(newGondola, newItems, products, constraints, weights);

          set({
            gondolaConfig: newGondola,
            items: newItems,
            ruleViolations,
            selectedItemId: null,
            selectedShelfId: null,
            comparisonMode: false,
            optimizedVersion: null
          });
        },

        deleteVersion: (versionId) => {
          set(state => ({
            versions: state.versions.filter(v => v.id !== versionId)
          }));
        },

        // Optimización
        startOptimization: async () => {
          set({ isOptimizing: true });
          
          // Simular tiempo de carga asíncrono para mejor experiencia
          await new Promise(resolve => setTimeout(resolve, 1200));

          const { gondolaConfig, products, constraints, weights, restockingInterval } = get();
          const { items: optItems } = optimizePlanogram(
            gondolaConfig,
            products,
            constraints,
            weights,
            restockingInterval
          );

          // Calcular métricas para el planograma optimizado
          const optMetrics = refreshMetricsAndRules(gondolaConfig, optItems, products, constraints, weights).metrics;

          const optVersion: PlanogramVersion = {
            id: `opt-${Date.now()}`,
            name: 'Versión Optimizada',
            items: optItems,
            gondolaConfig: JSON.parse(JSON.stringify(gondolaConfig)),
            score: optMetrics.financialScore,
            metrics: optMetrics,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            user: 'Algoritmo Heurístico',
            isOptimized: true
          };

          set({
            optimizedVersion: optVersion,
            comparisonMode: true,
            isOptimizing: false
          });
        },

        acceptOptimization: () => {
          const { optimizedVersion, products, constraints, weights } = get();
          if (!optimizedVersion) return;

          const { ruleViolations } = refreshMetricsAndRules(
            optimizedVersion.gondolaConfig,
            optimizedVersion.items,
            products,
            constraints,
            weights
          );

          set({
            gondolaConfig: optimizedVersion.gondolaConfig,
            items: optimizedVersion.items,
            ruleViolations,
            comparisonMode: false,
            optimizedVersion: null,
            selectedItemId: null,
            selectedShelfId: null
          });
        },

        discardOptimization: () => {
          set({
            comparisonMode: false,
            optimizedVersion: null
          });
        },

        setOptimizedVersion: (optVersion) => set({ optimizedVersion: optVersion })
      };
    },
    {
      name: '3d-planogram-storage',
      partialize: (state) => ({
        gondolaConfig: state.gondolaConfig,
        items: state.items,
        constraints: state.constraints,
        weights: state.weights,
        versions: state.versions,
        restockingInterval: state.restockingInterval,
        darkMode: state.darkMode
      })
    }
  )
);
