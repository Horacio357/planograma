export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string;
  width: number;       // en cm (e.g., 10 cm)
  height: number;      // en cm (e.g., 15 cm)
  depth: number;       // en cm (e.g., 8 cm)
  weight: number;      // peso del producto individual en kg (e.g., 0.35 para 350g)
  sales: number;       // ventas semanales promedio (unidades)
  margin: number;      // porcentaje de margen (e.g., 0.25 para 25%)
  stock: number;       // unidades disponibles en inventario
  priority: 'low' | 'medium' | 'high';
  price: number;       // precio de venta (e.g., 3.50)
  marketShare: number; // cuota de mercado en su categoría (e.g., 0.45 para 45%)
}

export interface ShelfConfig {
  id: string;
  index: number;       // 0 para estante inferior, subiendo
  yPosition: number;   // altura desde el suelo de la góndola en cm
  height: number;      // espacio útil vertical en cm (distancia al siguiente estante)
  depth: number;       // profundidad útil del estante en cm
  maxWeight?: number;  // capacidad máxima de carga del estante en kg
}

export interface GondolaConfig {
  width: number;       // ancho total en cm
  height: number;      // alto total en cm
  depth: number;       // profundidad total en cm
  shelves: ShelfConfig[];
}

export interface PlanogramItem {
  id: string;
  productId: string;
  shelfId: string;
  positionX: number;   // posición horizontal desde la izquierda en cm
  facings: number;     // cantidad de facings (caras frontales)
  stack?: number;      // cantidad de productos apilados verticalmente (por defecto 1)
  isLyingDown?: boolean; // indica si el producto está acostado (horizontal)
}

export interface PlanogramVersion {
  id: string;
  name: string;
  items: PlanogramItem[];
  gondolaConfig: GondolaConfig;
  score: number;
  metrics: PlanogramMetrics;
  createdAt: string;
  updatedAt: string;
  user: string;
  isOptimized: boolean;
}

export interface PlanogramMetrics {
  totalSales: number;
  totalMargin: number;
  spaceUsedPct: number;
  itemCount: number;
  violatedRulesCount: number;
  financialScore: number;
}

export interface ConstraintConfig {
  minFacings: Record<string, number>; // productId -> minFacings
  maxFacings: Record<string, number>; // productId -> maxFacings
  categoryShelves: Record<string, number[]>; // categoryName -> shelfIndexes[] (e.g., Lácteos -> [0, 1])
  brandAdjacency: string[]; // marcas que deben estar juntas (ej: Coca-Cola, Pepsi)
  requiredProducts: string[]; // productIds que DEBEN estar presentes
}

export interface OptimizationWeights {
  sales: number;  // peso de ventas (e.g., 0.5)
  margin: number; // peso de margen (e.g., 0.3)
  space: number;  // peso de espacio (e.g., 0.2)
}

export interface RuleViolation {
  id: string;
  type: 'physical' | 'commercial' | 'category';
  severity: 'warning' | 'error';
  message: string;
  shelfId?: string;
  productId?: string;
}
