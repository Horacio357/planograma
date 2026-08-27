import type { GondolaConfig, PlanogramItem, Product, ConstraintConfig, RuleViolation } from '../types/planogram';

export function validatePlanogram(
  gondolaConfig: GondolaConfig,
  items: PlanogramItem[],
  products: Product[],
  constraints: ConstraintConfig,
  restockingInterval: number = 12
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const productMap = new Map(products.map(p => [p.id, p]));
  const shelfMap = new Map(gondolaConfig.shelves.map(s => [s.id, s]));

  // --- 1. RESTRICCIONES FÍSICAS ---

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

  // Validaciones por estante
  gondolaConfig.shelves.forEach(shelf => {
    const shelfItems = itemsByShelf[shelf.id];
    // Ordenar de izquierda a derecha por posición horizontal
    shelfItems.sort((a, b) => a.positionX - b.positionX);

    let lastRightEdge = 0;
    let totalShelfWeight = 0;

    shelfItems.forEach((item, index) => {
      const prod = productMap.get(item.productId);
      if (!prod) return;

      const effectiveWidth = item.isLyingDown ? prod.height : prod.width;
      const totalWidth = effectiveWidth * item.facings;
      const leftEdge = item.positionX;
      const rightEdge = leftEdge + totalWidth;

      // Calcular peso acumulado (considerando facings, stack y capacidad de profundidad)
      const depthCapacity = Math.max(1, Math.floor(shelf.depth / prod.depth));
      const totalUnits = item.facings * (item.stack || 1) * depthCapacity;
      totalShelfWeight += prod.weight * totalUnits;

      // A. Superposición física
      if (leftEdge < lastRightEdge - 0.01) { // Pequeña tolerancia para errores de redondeo de punto flotante
        const prevItem = shelfItems[index - 1];
        const prevProd = prevItem ? productMap.get(prevItem.productId) : null;
        violations.push({
          id: `phys-overlap-${item.id}`,
          type: 'physical',
          severity: 'error',
          message: `Superposición en estante ${shelf.index + 1}: "${prod.name}" se superpone con "${prevProd?.name || 'producto anterior'}"`,
          shelfId: shelf.id,
          productId: item.productId,
        });
      }

      // B. Excede el ancho del estante
      if (rightEdge > gondolaConfig.width + 0.01) {
        violations.push({
          id: `phys-width-${item.id}`,
          type: 'physical',
          severity: 'error',
          message: `Estante ${shelf.index + 1}: "${prod.name}" excede el límite del estante por ${(rightEdge - gondolaConfig.width).toFixed(1)} cm`,
          shelfId: shelf.id,
          productId: item.productId,
        });
      }

      // C. Excede el alto disponible del estante
      const itemStack = item.stack || 1;
      const effectiveHeight = item.isLyingDown ? prod.width : prod.height;
      const totalHeight = effectiveHeight * itemStack;
      if (totalHeight > shelf.height) {
        violations.push({
          id: `phys-height-${item.id}`,
          type: 'physical',
          severity: 'error',
          message: `Estante ${shelf.index + 1}: El producto "${prod.name}" ${itemStack > 1 ? `apilado x${itemStack} (total ${totalHeight.toFixed(1)} cm)` : `mide ${effectiveHeight.toFixed(1)} cm`} de alto, pero el estante ofrece solo ${shelf.height} cm de espacio vertical`,
          shelfId: shelf.id,
          productId: item.productId,
        });
      }

      // D. Excede profundidad del estante
      if (prod.depth > shelf.depth) {
        violations.push({
          id: `phys-depth-${item.id}`,
          type: 'physical',
          severity: 'warning',
          message: `Estante ${shelf.index + 1}: La profundidad de "${prod.name}" (${prod.depth} cm) supera la profundidad del estante (${shelf.depth} cm)`,
          shelfId: shelf.id,
          productId: item.productId,
        });
      }

      // E. Regla de seguridad comercial: productos pesados (> 1.5kg) en estantes altos (index > 1)
      if (prod.weight > 1.5 && shelf.index > 1) {
        violations.push({
          id: `comm-safety-heavy-${item.id}`,
          type: 'commercial',
          severity: 'warning',
          message: `Riesgo de seguridad: El producto pesado "${prod.name}" (${prod.weight.toFixed(2)} kg) se encuentra en el estante alto ${shelf.index + 1}. Se recomienda ubicarlo en niveles inferiores por seguridad.`,
          shelfId: shelf.id,
          productId: item.productId,
        });
      }

      lastRightEdge = rightEdge;
    });

    // F. Regla física: sobrecarga de peso en el estante
    const maxWeight = shelf.maxWeight || 45; // default 45kg
    if (totalShelfWeight > maxWeight) {
      violations.push({
        id: `phys-weight-overload-${shelf.id}`,
        type: 'physical',
        severity: 'error',
        message: `Sobrecarga en Estante ${shelf.index + 1}: el peso total de productos (${totalShelfWeight.toFixed(1)} kg) supera la capacidad física permitida de ${maxWeight} kg`,
        shelfId: shelf.id,
      });
    }
  });

  // --- 2. RESTRICCIONES DE CATEGORÍA ---
  items.forEach(item => {
    const prod = productMap.get(item.productId);
    if (!prod) return;

    const shelf = shelfMap.get(item.shelfId);
    if (!shelf) return;

    // Comprobar si hay restricción de categoría para esta categoría de producto
    const allowedShelves = constraints.categoryShelves[prod.category];
    if (allowedShelves && allowedShelves.length > 0) {
      if (!allowedShelves.includes(shelf.index)) {
        const estantesStr = allowedShelves.map(idx => idx + 1).join(', ');
        violations.push({
          id: `cat-shelf-${item.id}`,
          type: 'category',
          severity: 'warning',
          message: `Ubicación incorrecta: La categoría "${prod.category.toUpperCase()}" de "${prod.name}" debería estar en los estantes [${estantesStr}], pero se encuentra en el estante ${shelf.index + 1}`,
          shelfId: shelf.id,
          productId: item.productId,
        });
      }
    }
  });

  // --- 3. RESTRICCIONES COMERCIALES ---

  // A. Mínimos y máximos de facings
  items.forEach(item => {
    const prod = productMap.get(item.productId);
    if (!prod) return;

    const min = constraints.minFacings[prod.id] || 1;
    const max = constraints.maxFacings[prod.id] || 6;

    if (item.facings < min) {
      violations.push({
        id: `comm-min-facing-${item.id}`,
        type: 'commercial',
        severity: 'warning',
        message: `Facings insuficientes: "${prod.name}" tiene ${item.facings} facings, el mínimo sugerido es de ${min}`,
        shelfId: item.shelfId,
        productId: item.productId,
      });
    }

    if (item.facings > max) {
      violations.push({
        id: `comm-max-facing-${item.id}`,
        type: 'commercial',
        severity: 'warning',
        message: `Exceso de facings: "${prod.name}" tiene ${item.facings} facings, superando el máximo recomendado de ${max}`,
        shelfId: item.shelfId,
        productId: item.productId,
      });
    }
  });

  // B. Productos obligatorios ausentes
  constraints.requiredProducts.forEach(prodId => {
    const isPresent = items.some(item => item.productId === prodId);
    if (!isPresent) {
      const prod = productMap.get(prodId);
      violations.push({
        id: `comm-required-${prodId}`,
        type: 'commercial',
        severity: 'warning',
        message: `Producto obligatorio ausente: "${prod?.name || prodId}" no está colocado en ningún estante`,
      });
    }
  });

  // C. Adyacencia de marca (ej. Marcas en constraints.brandAdjacency deben agruparse si están en el mismo estante)
  // Evaluamos si marcas definidas en brandAdjacency están separadas por otras marcas en un mismo estante
  gondolaConfig.shelves.forEach(shelf => {
    const shelfItems = itemsByShelf[shelf.id];
    if (shelfItems.length < 3) return; // Se necesitan al menos 3 items para que haya una separación inadecuada

    // Filtrar items que pertenecen a las marcas que requieren adyacencia
    const brandsSet = new Set(constraints.brandAdjacency);
    
    // Buscar si hay items de la misma marca que están separados por una marca diferente
    // Ej: Coca-Cola -> Lay's -> Coca-Cola en el mismo estante
    for (let i = 0; i < shelfItems.length; i++) {
      const itemA = shelfItems[i];
      const prodA = productMap.get(itemA.productId);
      if (!prodA || !brandsSet.has(prodA.brand)) continue;

      for (let j = i + 2; j < shelfItems.length; j++) {
        const itemB = shelfItems[j];
        const prodB = productMap.get(itemB.productId);
        if (!prodB || prodB.brand !== prodA.brand) continue;

        // Comprobar si los productos intermedios son de otra marca
        let foundInterveningDifferentBrand = false;
        for (let k = i + 1; k < j; k++) {
          const itemMid = shelfItems[k];
          const prodMid = productMap.get(itemMid.productId);
          if (prodMid && prodMid.brand !== prodA.brand) {
            foundInterveningDifferentBrand = true;
            break;
          }
        }

        if (foundInterveningDifferentBrand) {
          violations.push({
            id: `comm-adjacency-${shelf.id}-${prodA.brand}`,
            type: 'commercial',
            severity: 'warning',
            message: `Falta de adyacencia: Los productos de la marca "${prodA.brand}" en el estante ${shelf.index + 1} no están agrupados de forma continua`,
            shelfId: shelf.id,
          });
          break; // Registrar una sola alerta por marca por estante
        }
      }
    }
  });

  // --- 4. ALERTAS DE QUIEBRE DE STOCK (STOCKOUT ALERTS) ---
  items.forEach(item => {
    const prod = productMap.get(item.productId);
    const shelf = shelfMap.get(item.shelfId);
    if (!prod || !shelf) return;

    const depthCapacity = Math.max(1, Math.floor(shelf.depth / prod.depth));
    const capacity = item.facings * (item.stack || 1) * depthCapacity;
    
    // Autonomía = (capacidad / ventas_semanales) * 84 horas comerciales semanales
    const hoursToStockout = prod.sales > 0 ? (capacity * 84) / prod.sales : 999;

    if (hoursToStockout < restockingInterval / 2) {
      violations.push({
        id: `comm-stockout-critical-${item.id}`,
        type: 'commercial',
        severity: 'error',
        message: `Quiebre Crítico: "${prod.name}" en estante ${shelf.index + 1} tiene solo ${hoursToStockout.toFixed(1)} hs de autonomía (${capacity} u. de stock), no cubre la mitad del ciclo de reposición de ${restockingInterval} hs.`,
        shelfId: shelf.id,
        productId: item.productId
      });
    } else if (hoursToStockout < restockingInterval) {
      violations.push({
        id: `comm-stockout-warning-${item.id}`,
        type: 'commercial',
        severity: 'warning',
        message: `Riesgo de Stockout: "${prod.name}" en estante ${shelf.index + 1} se agotará en ${hoursToStockout.toFixed(1)} hs comerciales (${capacity} u. de stock). No llegará al siguiente ciclo de reposición (${restockingInterval} hs).`,
        shelfId: shelf.id,
        productId: item.productId
      });
    }
  });

  return violations;
}
