import type { GondolaConfig, PlanogramItem, Product, ConstraintConfig, OptimizationWeights } from '../types/planogram';
import { calculateMetrics } from '../store/planogramStore';
import { validatePlanogram } from './ruleEngine';

export function optimizePlanogram(
  gondolaConfig: GondolaConfig,
  products: Product[],
  constraints: ConstraintConfig,
  weights: OptimizationWeights,
  restockingInterval: number = 12
): { items: PlanogramItem[]; score: number } {
  const productMap = new Map(products.map(p => [p.id, p]));
  const shelves = gondolaConfig.shelves;
  
  // 1. Clasificar productos por rendimiento (Score Comercial por centímetro lineal)
  // commercialValue = (ventas * precio * margen) / ancho_producto
  const scoredProducts = products.map(prod => {
    const minFac = constraints.minFacings[prod.id] || 1;
    const maxFac = constraints.maxFacings[prod.id] || 6;
    const yieldPerCm = (prod.sales * prod.price * prod.margin) / prod.width;
    
    return {
      product: prod,
      commercialValue: yieldPerCm,
      minFacings: minFac,
      maxFacings: maxFac
    };
  });

  // Ordenar productos de mayor a menor rendimiento por cm lineal
  scoredProducts.sort((a, b) => b.commercialValue - a.commercialValue);

  // 2. Determinar en qué estantes está permitido cada producto
  const getAppropiateShelvesForProduct = (prod: Product) => {
    const allowedIndexes = constraints.categoryShelves[prod.category];
    if (allowedIndexes && allowedIndexes.length > 0) {
      return shelves.filter(s => allowedIndexes.includes(s.index));
    }
    return shelves; // Si no hay restricción, puede ir a cualquiera
  };

  // 3. Crear una asignación inicial limpia
  // Inicializamos un arreglo de productos asignados por estante (incluyendo facings y stack)
  const shelfAssignments: Record<string, { productId: string; facings: number; stack: number }[]> = {};
  shelves.forEach(s => {
    shelfAssignments[s.id] = [];
  });

  // A. Intentar colocar todos los productos OBLIGATORIOS primero
  const requiredProductIds = new Set(constraints.requiredProducts);
  const placedProductIds = new Set<string>();

  scoredProducts.forEach(sp => {
    if (!requiredProductIds.has(sp.product.id)) return;

    const allowedShelves = getAppropiateShelvesForProduct(sp.product);
    // Intentar meterlo en el primer estante que tenga espacio de ancho y peso
    for (const shelf of allowedShelves) {
      if (shelf.height < sp.product.height) continue; // físico no entra parado

      const currentUsedWidth = shelfAssignments[shelf.id].reduce((sum, item) => {
        const p = productMap.get(item.productId);
        return sum + (p ? p.width * item.facings : 0);
      }, 0);

      const requiredWidth = sp.product.width * sp.minFacings;

      // Calcular peso estimado de este estante
      const maxWeight = shelf.maxWeight || 45;
      const currentWeight = shelfAssignments[shelf.id].reduce((sum, item) => {
        const p = productMap.get(item.productId);
        if (!p) return sum;
        const depthCap = Math.max(1, Math.floor(shelf.depth / p.depth));
        return sum + p.weight * item.facings * item.stack * depthCap;
      }, 0);
      const depthCapNew = Math.max(1, Math.floor(shelf.depth / sp.product.depth));
      const newWeightEst = sp.product.weight * sp.minFacings * 1 * depthCapNew;

      // Evitar colocar productos pesados en estantes altos en la asignación inicial (seguridad)
      if (sp.product.weight > 1.5 && shelf.index > 1) continue;

      if (
        currentUsedWidth + requiredWidth <= gondolaConfig.width &&
        currentWeight + newWeightEst <= maxWeight
      ) {
        shelfAssignments[shelf.id].push({
          productId: sp.product.id,
          facings: sp.minFacings,
          stack: 1
        });
        placedProductIds.add(sp.product.id);
        break;
      }
    }
  });

  // B. Colocar otros productos de alto rendimiento hasta llenar el mueble
  scoredProducts.forEach(sp => {
    if (placedProductIds.has(sp.product.id)) return; // Ya colocado en el paso A

    const allowedShelves = getAppropiateShelvesForProduct(sp.product);
    
    for (const shelf of allowedShelves) {
      if (shelf.height < sp.product.height) continue;
      
      // Evitar productos pesados arriba en la inicial
      if (sp.product.weight > 1.5 && shelf.index > 1) continue;

      const currentUsedWidth = shelfAssignments[shelf.id].reduce((sum, item) => {
        const p = productMap.get(item.productId);
        return sum + (p ? p.width * item.facings : 0);
      }, 0);

      const requiredWidth = sp.product.width * sp.minFacings;

      const maxWeight = shelf.maxWeight || 45;
      const currentWeight = shelfAssignments[shelf.id].reduce((sum, item) => {
        const p = productMap.get(item.productId);
        if (!p) return sum;
        const depthCap = Math.max(1, Math.floor(shelf.depth / p.depth));
        return sum + p.weight * item.facings * item.stack * depthCap;
      }, 0);
      const depthCapNew = Math.max(1, Math.floor(shelf.depth / sp.product.depth));
      const newWeightEst = sp.product.weight * sp.minFacings * 1 * depthCapNew;

      // Dejar al menos un margen libre para no saturar de inmediato de ancho
      if (
        currentUsedWidth + requiredWidth <= gondolaConfig.width * 0.9 &&
        currentWeight + newWeightEst <= maxWeight
      ) {
        shelfAssignments[shelf.id].push({
          productId: sp.product.id,
          facings: sp.minFacings,
          stack: 1
        });
        placedProductIds.add(sp.product.id);
        break;
      }
    }
  });

  // Función auxiliar para compactar productos en un estante de izquierda a derecha
  // y agruparlos por marca para satisfacer las adyacencias
  const packShelf = (shelfId: string, assignments: { productId: string; facings: number; stack: number }[]): PlanogramItem[] => {
    // Agrupar y ordenar por marca
    const sortedAssignments = [...assignments].sort((a, b) => {
      const prodA = productMap.get(a.productId);
      const prodB = productMap.get(b.productId);
      if (!prodA || !prodB) return 0;
      
      // Ordenar por marca (para que queden continuos)
      if (prodA.brand !== prodB.brand) {
        return prodA.brand.localeCompare(prodB.brand);
      }
      // Dentro de la misma marca, ordenar por valor comercial descendiente
      return (prodB.sales * prodB.margin) - (prodA.sales * prodA.margin);
    });

    let currentX = 5; // Margen inicial
    return sortedAssignments.map((as, index) => {
      const prod = productMap.get(as.productId)!;
      const item: PlanogramItem = {
        id: `opt-item-${shelfId}-${index}-${Math.random().toString(36).substr(2, 4)}`,
        productId: as.productId,
        shelfId,
        positionX: currentX,
        facings: as.facings,
        stack: as.stack || 1
      };
      currentX += prod.width * as.facings;
      return item;
    });
  };

  const getPlanogramItems = (assignmentsState: Record<string, { productId: string; facings: number; stack: number }[]>) => {
    const items: PlanogramItem[] = [];
    Object.keys(assignmentsState).forEach(shelfId => {
      items.push(...packShelf(shelfId, assignmentsState[shelfId]));
    });
    return items;
  };

  // 4. Búsqueda Local (Hill Climbing) para optimizar facings, apilamientos (stack) y distribución
  let bestAssignments = JSON.parse(JSON.stringify(shelfAssignments));
  let bestItems = getPlanogramItems(bestAssignments);
  let bestViolations = validatePlanogram(gondolaConfig, bestItems, products, constraints, restockingInterval);
  let bestMetrics = calculateMetrics(gondolaConfig, bestItems, products, bestViolations.length, weights);
  let bestScore = bestMetrics.financialScore;

  // Corremos la optimización iterativa
  const maxIterations = 600;
  for (let iter = 0; iter < maxIterations; iter++) {
    // Clonar asignaciones actuales
    const candidateAssignments: Record<string, { productId: string; facings: number; stack: number }[]> = JSON.parse(JSON.stringify(bestAssignments));
    
    // Elegir un tipo de movimiento al azar
    const moveType = Math.random();
    
    if (moveType < 0.25) {
      // MOVIMIENTO 1: Aumentar facings de un producto colocado que rinda bien
      const activeShelves = shelves.filter(s => candidateAssignments[s.id].length > 0);
      if (activeShelves.length > 0) {
        const randomShelf = activeShelves[Math.floor(Math.random() * activeShelves.length)];
        const shelfItems = candidateAssignments[randomShelf.id];
        const randomItemIdx = Math.floor(Math.random() * shelfItems.length);
        const item = shelfItems[randomItemIdx];
        
        const spInfo = scoredProducts.find(sp => sp.product.id === item.productId);
        if (spInfo && item.facings < spInfo.maxFacings) {
          // Comprobar si cabe en el estante horizontalmente
          const shelfWidthUsed = shelfItems.reduce((sum, i) => {
            const p = productMap.get(i.productId);
            return sum + (p ? p.width * i.facings : 0);
          }, 0);
          const p = productMap.get(item.productId)!;
          
          if (shelfWidthUsed + p.width <= gondolaConfig.width) {
            item.facings += 1;
          }
        }
      }
    } else if (moveType < 0.45) {
      // MOVIMIENTO 2: Disminuir facings de un producto de bajo rendimiento
      const activeShelves = shelves.filter(s => candidateAssignments[s.id].length > 0);
      if (activeShelves.length > 0) {
        const randomShelf = activeShelves[Math.floor(Math.random() * activeShelves.length)];
        const shelfItems = candidateAssignments[randomShelf.id];
        const randomItemIdx = Math.floor(Math.random() * shelfItems.length);
        const item = shelfItems[randomItemIdx];
        
        const spInfo = scoredProducts.find(sp => sp.product.id === item.productId);
        if (spInfo && item.facings > spInfo.minFacings) {
          item.facings -= 1;
        }
      }
    } else if (moveType < 0.65) {
      // MOVIMIENTO 3: Intentar agregar un producto no colocado a un estante válido
      const unplaced = scoredProducts.filter(sp => {
        return !Object.values(candidateAssignments).some(arr => arr.some(as => as.productId === sp.product.id));
      });

      if (unplaced.length > 0) {
        const candidateProd = unplaced[Math.floor(Math.random() * Math.min(5, unplaced.length))];
        const allowedShelves = getAppropiateShelvesForProduct(candidateProd.product);
        
        if (allowedShelves.length > 0) {
          const targetShelf = allowedShelves[Math.floor(Math.random() * allowedShelves.length)];
          const shelfItems = candidateAssignments[targetShelf.id];
          
          // Verificar si hay espacio horizontal
          const shelfWidthUsed = shelfItems.reduce((sum, i) => {
            const p = productMap.get(i.productId);
            return sum + (p ? p.width * i.facings : 0);
          }, 0);
          const requiredWidth = candidateProd.product.width * candidateProd.minFacings;

          if (shelfWidthUsed + requiredWidth <= gondolaConfig.width) {
            shelfItems.push({
              productId: candidateProd.product.id,
              facings: candidateProd.minFacings,
              stack: 1
            });
          }
        }
      }
    } else if (moveType < 0.75) {
      // MOVIMIENTO 4: Quitar un producto de bajo rendimiento del estante para desocupar espacio
      const activeShelves = shelves.filter(s => candidateAssignments[s.id].length > 0);
      if (activeShelves.length > 0) {
        const randomShelf = activeShelves[Math.floor(Math.random() * activeShelves.length)];
        const shelfItems = candidateAssignments[randomShelf.id];
        
        const nonRequiredIndices = shelfItems
          .map((item, idx) => ({ item, idx }))
          .filter(x => !requiredProductIds.has(x.item.productId));
          
        if (nonRequiredIndices.length > 0) {
          const toRemoveIdx = nonRequiredIndices[Math.floor(Math.random() * nonRequiredIndices.length)].idx;
          shelfItems.splice(toRemoveIdx, 1);
        }
      }
    } else {
      // MOVIMIENTO 5: Optimizar el apilamiento vertical (Stacking) de forma inteligente
      const activeShelves = shelves.filter(s => candidateAssignments[s.id].length > 0);
      if (activeShelves.length > 0) {
        const randomShelf = activeShelves[Math.floor(Math.random() * activeShelves.length)];
        const shelfItems = candidateAssignments[randomShelf.id];
        const randomItemIdx = Math.floor(Math.random() * shelfItems.length);
        const item = shelfItems[randomItemIdx];
        
        const p = productMap.get(item.productId)!;
        const currentStack = item.stack || 1;

        // Decidir si subimos o bajamos el stack
        // Si el producto tiene altas ventas o autonomía baja, intentamos subir el stack (si cabe en altura)
        const depthCapacity = Math.max(1, Math.floor(randomShelf.depth / p.depth));
        const capacity = item.facings * currentStack * depthCapacity;
        const hoursToStockout = p.sales > 0 ? (capacity * 84) / p.sales : 999;

        if (hoursToStockout < 12.0 && (currentStack + 1) * p.height <= randomShelf.height && currentStack < 4) {
          // Aumentar stack para evitar quiebre de stock si cabe físicamente
          item.stack = currentStack + 1;
        } else if (currentStack > 1) {
          // Reducir stack si está excedido o de forma aleatoria para explorar
          item.stack = currentStack - 1;
        }
      }
    }

    // Re-empacar y evaluar el score candidato
    const candidateItems = getPlanogramItems(candidateAssignments);
    const candidateViolations = validatePlanogram(gondolaConfig, candidateItems, products, constraints, restockingInterval);
    const candidateMetrics = calculateMetrics(gondolaConfig, candidateItems, products, candidateViolations.length, weights);
    
    // Evaluar violaciones físicas críticas introducidas
    const hasCriticalOverfill = candidateViolations.some(v => v.id.startsWith('phys-width'));
    const hasWeightOverload = candidateViolations.some(v => v.id.startsWith('phys-weight-overload'));
    const hasSafetyHeavyViolation = candidateViolations.some(v => v.id.startsWith('comm-safety-heavy'));
    
    // Penalizaciones en el score del optimizador:
    // Si tiene desborde de estante o sobrecarga de peso, penalizar fuertemente (-40)
    // Si tiene productos pesados en estantes altos, penalizar levemente (-15)
    let penaltyScore = 0;
    if (hasCriticalOverfill) penaltyScore += 40;
    if (hasWeightOverload) penaltyScore += 40;
    if (hasSafetyHeavyViolation) penaltyScore += 15;
    
    const candidateScore = candidateMetrics.financialScore - penaltyScore;

    // Si mejora el score, adoptamos el candidato
    if (candidateScore > bestScore) {
      bestAssignments = candidateAssignments;
      bestItems = candidateItems;
      bestViolations = candidateViolations;
      bestMetrics = candidateMetrics;
      bestScore = candidateScore;
    }
  }

  // Devolver la mejor configuración limpia de colisiones
  return {
    items: bestItems,
    score: bestScore
  };
}

// Interfaz para la API simulada
export function simulateApiOptimization(
  gondolaConfig: GondolaConfig,
  products: Product[],
  constraints: ConstraintConfig,
  weights: OptimizationWeights,
  restockingInterval: number = 12
): any {
  // Simulando el POST a /api/planograms/optimize
  const requestPayload = {
    planogram: {
      gondola: {
        width: gondolaConfig.width,
        height: gondolaConfig.height,
        depth: gondolaConfig.depth,
        shelves: gondolaConfig.shelves.map(s => ({
          id: s.id,
          index: s.index,
          yPosition: s.yPosition,
          height: s.height,
          depth: s.depth,
          maxWeight: s.maxWeight
        }))
      }
    },
    products: products.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      width: p.width,
      height: p.height,
      depth: p.depth,
      weight: p.weight,
      sales: p.sales,
      margin: p.margin
    })),
    constraints: {
      minFacings: constraints.minFacings,
      maxFacings: constraints.maxFacings,
      categoryShelves: constraints.categoryShelves,
      brandAdjacency: constraints.brandAdjacency,
      requiredProducts: constraints.requiredProducts
    },
    objective: {
      sales: weights.sales,
      margin: weights.margin,
      space: weights.space
    },
    settings: {
      restockingInterval
    }
  };

  const optResult = optimizePlanogram(gondolaConfig, products, constraints, weights, restockingInterval);
  const metrics = calculateMetrics(gondolaConfig, optResult.items, products, 0, weights);

  const responsePayload = {
    status: "success",
    score: optResult.score / 100,
    placements: optResult.items.map(item => ({
      id: item.id,
      productId: item.productId,
      shelfId: item.shelfId,
      positionX: item.positionX,
      facings: item.facings,
      stack: item.stack || 1
    })),
    metrics: {
      totalSales: metrics.totalSales,
      totalMargin: metrics.totalMargin,
      spaceUsedPct: metrics.spaceUsedPct
    }
  };

  return {
    request: requestPayload,
    response: responsePayload,
    result: optResult
  };
}
