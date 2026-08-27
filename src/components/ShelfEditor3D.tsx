import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { usePlanogramStore } from '../store/planogramStore';
import type { Product } from '../types/planogram';

export const ShelfEditor3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  const {
    gondolaConfig,
    items,
    products,
    selectedItemId,
    heatmapMode,
    showDimensions,
    showGrid,
    selectItem,
    selectShelf,
    darkMode
  } = usePlanogramStore();

  const [isFpsMode, setIsFpsMode] = React.useState(false);
  const isFpsModeRef = useRef(false);

  React.useEffect(() => {
    isFpsModeRef.current = isFpsMode;
  }, [isFpsMode]);

  // Guardar referencias para poder actualizar la escena en cambios de props sin destruir el renderizador
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const gondolaGroupRef = useRef<THREE.Group | null>(null);
  const itemsGroupRef = useRef<THREE.Group | null>(null);
  const texturesCacheRef = useRef<Map<string, THREE.Texture>>(new Map());

  // Generador de texturas dinámicas mediante HTML5 Canvas
  const getProductTexture = (prod: Product, isSelected: boolean, hMode: typeof heatmapMode): THREE.Texture => {
    const cacheKey = `${prod.id}-${isSelected}-${hMode}`;
    if (texturesCacheRef.current.has(cacheKey)) {
      return texturesCacheRef.current.get(cacheKey)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // 1. Color de Fondo según Modo
    let bgColor = '#f8fafc';
    let textColor = '#0f172a';
    let labelText = '';

    if (hMode === 'none') {
      // Color por categoría por defecto
      switch (prod.category) {
        case 'bebidas': bgColor = '#3b82f6'; textColor = '#ffffff'; break;
        case 'snacks': bgColor = '#f59e0b'; textColor = '#ffffff'; break;
        case 'galletas': bgColor = '#ec4899'; textColor = '#ffffff'; break;
        case 'lácteos': bgColor = '#10b981'; textColor = '#ffffff'; break;
        case 'limpieza': bgColor = '#8b5cf6'; textColor = '#ffffff'; break;
        case 'almacén': bgColor = '#6b7280'; textColor = '#ffffff'; break;
        default: bgColor = '#e2e8f0'; textColor = '#0f172a';
      }
    } else if (hMode === 'sales') {
      // Mapa de calor por Ventas (ventas > 120 es Verde, > 80 es Amarillo, menor Rojo)
      if (prod.sales > 120) {
        bgColor = '#22c55e'; textColor = '#ffffff'; labelText = `Ventas: ${prod.sales} u/sem`;
      } else if (prod.sales > 80) {
        bgColor = '#eab308'; textColor = '#0f172a'; labelText = `Ventas: ${prod.sales} u/sem`;
      } else {
        bgColor = '#ef4444'; textColor = '#ffffff'; labelText = `Ventas: ${prod.sales} u/sem`;
      }
    } else if (hMode === 'margin') {
      // Mapa de calor por Margen (margen > 0.30 Verde, > 0.22 Amarillo, menor Rojo)
      if (prod.margin > 0.30) {
        bgColor = '#22c55e'; textColor = '#ffffff'; labelText = `Margen: ${(prod.margin * 100).toFixed(0)}%`;
      } else if (prod.margin > 0.20) {
        bgColor = '#eab308'; textColor = '#0f172a'; labelText = `Margen: ${(prod.margin * 100).toFixed(0)}%`;
      } else {
        bgColor = '#ef4444'; textColor = '#ffffff'; labelText = `Margen: ${(prod.margin * 100).toFixed(0)}%`;
      }
    } else if (hMode === 'priority') {
      // Mapa de calor por Prioridad Comercial
      if (prod.priority === 'high') {
        bgColor = '#22c55e'; textColor = '#ffffff'; labelText = 'Prioridad: Alta';
      } else if (prod.priority === 'medium') {
        bgColor = '#eab308'; textColor = '#0f172a'; labelText = 'Prioridad: Media';
      } else {
        bgColor = '#ef4444'; textColor = '#ffffff'; labelText = 'Prioridad: Baja';
      }
    } else if (hMode === 'hotzone') {
      // Si el heatmap es por zonas calientes, coloreamos de forma neutra
      bgColor = '#475569'; textColor = '#ffffff'; labelText = 'Modo Zona Caliente';
    }

    // Dibujar fondo
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 256, 256);

    // Borde de selección
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, 242, 242);
      
      ctx.strokeStyle = '#aa3bff';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, 236, 236);
    } else {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, 252, 252);
    }

    // Dibujar textos del Producto
    ctx.fillStyle = textColor;
    
    // Marca
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(prod.brand.toUpperCase(), 128, 45);

    // Separador
    ctx.fillStyle = isSelected ? '#aa3bff' : 'rgba(0,0,0,0.15)';
    ctx.fillRect(40, 58, 176, 3);
    ctx.fillStyle = textColor;

    // Nombre (multilínea)
    ctx.font = 'bold 24px sans-serif';
    const words = prod.name.split(' ');
    let line = '';
    let y = 95;
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      if (metrics.width > 220 && n > 0) {
        ctx.fillText(line, 128, y);
        line = words[n] + ' ';
        y += 28;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 128, y);

    // SKU / Precio
    ctx.font = 'normal 18px sans-serif';
    ctx.fillText(prod.sku, 128, 200);
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`$${prod.price.toFixed(2)}`, 128, 235);

    // Overlay del heatmap
    if (labelText) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(0, 216, 256, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(labelText, 128, 240);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texturesCacheRef.current.set(cacheKey, texture);
    return texture;
  };

  // Inicializar la escena 3D una sola vez
  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Configuración de Escena y Renderizador
    const scene = new THREE.Scene();
    const isDarkInit = usePlanogramStore.getState().darkMode;
    scene.background = new THREE.Color(isDarkInit ? '#0f172a' : '#f8fafc');
    sceneRef.current = scene;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 90, 240);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    
    // Limpiar el contenedor antes de inyectar canvas
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Controles de Cámara (OrbitControls)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // No bajar del suelo
    controls.minDistance = 40;
    controls.maxDistance = 450;
    // Enfocar el centro aproximado de la góndola
    controls.target.set(0, 90, 0);
    controlsRef.current = controls;

    // 3. Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(80, 150, 150);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    dirLight1.shadow.camera.near = 0.5;
    dirLight1.shadow.camera.far = 500;
    const d = 120;
    dirLight1.shadow.camera.left = -d;
    dirLight1.shadow.camera.right = d;
    dirLight1.shadow.camera.top = d;
    dirLight1.shadow.camera.bottom = -d;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa5b4fc, 0.3); // Luz azulada de relleno
    dirLight2.position.set(-80, 50, -50);
    scene.add(dirLight2);

    // 4. Crear Suelo
    const floorGeo = new THREE.PlaneGeometry(500, 500);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: isDarkInit ? 0x1e293b : 0xe2e8f0, 
      roughness: 0.8 
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid del suelo
    const gridHelper = new THREE.GridHelper(300, 30, isDarkInit ? 0x475569 : 0xcbd5e1, isDarkInit ? 0x334155 : 0x94a3b8);
    gridHelper.position.y = 0.05;
    gridHelper.visible = usePlanogramStore.getState().showGrid;
    scene.add(gridHelper);

    // 5. Grupos de Góndola y Productos
    const gondolaGroup = new THREE.Group();
    scene.add(gondolaGroup);
    gondolaGroupRef.current = gondolaGroup;

    const itemsGroup = new THREE.Group();
    scene.add(itemsGroup);
    itemsGroupRef.current = itemsGroup;

    // 6. Configuración de Raycasting para Selección
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (event: MouseEvent) => {
      if (!rendererRef.current || !cameraRef.current) return;
      
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      
      // Buscar intersecciones en ítems del planograma
      const intersects = raycaster.intersectObjects(itemsGroup.children, true);
      
      if (intersects.length > 0) {
        // Encontró producto
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && !obj.userData.itemId) {
          obj = obj.parent;
        }
        if (obj && obj.userData.itemId) {
          selectItem(obj.userData.itemId);
          return;
        }
      }

      // Buscar si hizo click en un estante
      const intersectsShelves = raycaster.intersectObjects(gondolaGroup.children, true);
      if (intersectsShelves.length > 0) {
        let obj: THREE.Object3D | null = intersectsShelves[0].object;
        while (obj && !obj.userData.shelfId) {
          obj = obj.parent;
        }
        if (obj && obj.userData.shelfId) {
          selectShelf(obj.userData.shelfId);
          return;
        }
      }

      // Click en el vacío
      selectItem(null);
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);

    // 7. Render Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (controlsRef.current) {
        if (isFpsModeRef.current) {
          controlsRef.current.target.y = 120;
          controlsRef.current.minPolarAngle = Math.PI / 2 - 0.15;
          controlsRef.current.maxPolarAngle = Math.PI / 2 + 0.05;
          controlsRef.current.minDistance = 60;
          controlsRef.current.maxDistance = 160;
        } else {
          controlsRef.current.minPolarAngle = 0;
          controlsRef.current.maxPolarAngle = Math.PI / 2 + 0.1;
          controlsRef.current.minDistance = 40;
          controlsRef.current.maxDistance = 450;
        }
        controlsRef.current.update();
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Limpieza
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.removeEventListener('click', handleCanvasClick);
      }
    };
  }, []);

  // Actualizar fondo de escena, suelo y grilla dinámicamente cuando cambian darkMode o showGrid
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    
    // Cambiar color de fondo
    scene.background = new THREE.Color(darkMode ? '#0f172a' : '#f8fafc');
    
    // Cambiar color del suelo y visibilidad de grilla
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry instanceof THREE.PlaneGeometry && (child.geometry as THREE.PlaneGeometry).parameters.width === 500) {
          (child.material as THREE.MeshStandardMaterial).color.setHex(darkMode ? 0x1e293b : 0xe2e8f0);
        }
      }
      if (child instanceof THREE.GridHelper) {
        child.visible = showGrid;
      }
    });
  }, [darkMode, showGrid]);

  // Escuchar cambios de cámara fijos globales (ej. botones Frontal, Superior, etc.)
  const setFixedCameraView = (view: 'front' | 'top' | 'side' | 'isometric') => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    setIsFpsMode(false); // salir de FPS si cambiamos a vistas fijas
    controls.reset();
    
    // Altura media de la góndola
    const midY = gondolaConfig.height / 2;
    controls.target.set(0, midY, 0);

    if (view === 'front') {
      camera.position.set(0, midY, 200);
    } else if (view === 'top') {
      camera.position.set(0, gondolaConfig.height + 100, 0.1);
    } else if (view === 'side') {
      camera.position.set(gondolaConfig.width + 100, midY, 0);
    } else if (view === 'isometric') {
      camera.position.set(gondolaConfig.width, gondolaConfig.height + 30, 200);
    }
    
    controls.update();
  };

  const toggleFpsMode = () => {
    const nextFps = !isFpsMode;
    setIsFpsMode(nextFps);
    
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    controls.reset();
    
    if (nextFps) {
      // Posicionar al usuario a la altura de los ojos (160 cm) frente a la góndola
      controls.target.set(0, 120, 0);
      camera.position.set(0, 160, 120);
    } else {
      // Regresar a vista isométrica normal
      const midY = gondolaConfig.height / 2;
      controls.target.set(0, midY, 0);
      camera.position.set(gondolaConfig.width, gondolaConfig.height + 30, 200);
    }
    controls.update();
  };

  // Re-dibujar la Góndola 3D cuando cambia su configuración (ancho, alto, estantes)
  useEffect(() => {
    const scene = sceneRef.current;
    const group = gondolaGroupRef.current;
    if (!scene || !group) return;

    // Limpiar mueble anterior
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
    }

    const { width, height, depth, shelves } = gondolaConfig;

    // Materiales del mueble
    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569, // Gris metálico oscuro
      metalness: 0.8,
      roughness: 0.3
    });

    const postMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
      roughness: 0.2
    });

    // 1. Parantes Laterales (Verticales)
    const postWidth = 3;
    const postGeo = new THREE.BoxGeometry(postWidth, height, postWidth);
    
    const leftPost = new THREE.Mesh(postGeo, postMaterial);
    leftPost.position.set(-width / 2 - postWidth / 2, height / 2, -depth / 2);
    leftPost.castShadow = true;
    leftPost.receiveShadow = true;
    group.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, postMaterial);
    rightPost.position.set(width / 2 + postWidth / 2, height / 2, -depth / 2);
    rightPost.castShadow = true;
    rightPost.receiveShadow = true;
    group.add(rightPost);

    // Parantes traseros
    const leftPostBack = leftPost.clone();
    leftPostBack.position.z = -depth / 2 - 2;
    group.add(leftPostBack);

    const rightPostBack = rightPost.clone();
    rightPostBack.position.z = -depth / 2 - 2;
    group.add(rightPostBack);

    // 2. Tablero Trasero (Fondo)
    const backGeo = new THREE.BoxGeometry(width, height, 1);
    const backMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Gris muy oscuro pizarra
      roughness: 0.9,
      metalness: 0.1
    });
    const backboard = new THREE.Mesh(backGeo, backMaterial);
    backboard.position.set(0, height / 2, -depth / 2 - 0.5);
    backboard.receiveShadow = true;
    group.add(backboard);

    // Grid del tablero trasero (líneas de perforaciones pegboard)
    if (showGrid) {
      const backGrid = new THREE.GridHelper(width, Math.round(width / 10), 0x475569, 0x334155);
      backGrid.rotation.x = Math.PI / 2;
      backGrid.position.set(0, height / 2, -depth / 2 + 0.1);
      group.add(backGrid);
    }

    // 3. Renderizar Estantes
    shelves.forEach(shelf => {
      const shelfThickness = 2.0;
      const shelfGeo = new THREE.BoxGeometry(width, shelfThickness, shelf.depth);
      
      // Coloreo de zonas calientes para el estante si corresponde
      let sMaterial = metalMaterial;
      if (heatmapMode === 'hotzone') {
        let colorHex = 0xe2e8f0; // neutro
        if (shelf.index === 2) {
          colorHex = 0x22c55e; // Ojos = Verde (Caliente)
        } else if (shelf.index === 1 || shelf.index === 3) {
          colorHex = 0xeab308; // Alcanzable = Amarillo (Medio)
        } else {
          colorHex = 0xef4444; // Suelo / Techo = Rojo (Frío)
        }
        sMaterial = new THREE.MeshStandardMaterial({
          color: colorHex,
          metalness: 0.3,
          roughness: 0.5,
          transparent: true,
          opacity: 0.8
        });
      }

      const shelfMesh = new THREE.Mesh(shelfGeo, sMaterial);
      shelfMesh.position.set(0, shelf.yPosition - shelfThickness / 2, -depth / 2 + shelf.depth / 2);
      shelfMesh.receiveShadow = true;
      shelfMesh.castShadow = true;
      
      // Guardar ID del estante para raycasting
      shelfMesh.userData = { shelfId: shelf.id };
      group.add(shelfMesh);

      // Dibujar etiqueta del estante (Cotas de altura)
      if (showDimensions) {
        // Marcador del estante en el lateral
        const labelGeo = new THREE.BoxGeometry(1, 4, 1);
        const labelMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
        const labelMesh = new THREE.Mesh(labelGeo, labelMat);
        labelMesh.position.set(-width / 2 - 4, shelf.yPosition, -depth / 2 + 2);
        group.add(labelMesh);
      }
    });

  }, [gondolaConfig, heatmapMode, showGrid, showDimensions]);

  // Re-dibujar los productos cuando cambian sus facings, posiciones o el heatmap
  useEffect(() => {
    const scene = sceneRef.current;
    const group = itemsGroupRef.current;
    if (!scene || !group) return;

    // Limpiar productos anteriores
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
    }

    const productMap = new Map(products.map(p => [p.id, p]));
    const shelfMap = new Map(gondolaConfig.shelves.map(s => [s.id, s]));

    items.forEach(item => {
      const prod = productMap.get(item.productId);
      const shelf = shelfMap.get(item.shelfId);
      if (!prod || !shelf) return;

      const isSelected = item.id === selectedItemId;

      // Crear grupo del ítem comercial (puede tener múltiples facings en 3D)
      const itemGroup3D = new THREE.Group();
      itemGroup3D.userData = { itemId: item.id };
      group.add(itemGroup3D);

      // Crear texturas del frente
      const frontTex = getProductTexture(prod, isSelected, heatmapMode);
      
      // Materiales del Producto
      const frontMaterial = new THREE.MeshStandardMaterial({
        map: frontTex,
        roughness: 0.4,
        metalness: 0.1
      });

      // Material de cuerpo del producto (cardboard/plástico genérico gris claro)
      const bodyColor = isSelected ? 0xddd6fe : 0xf1f5f9;
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.6,
        metalness: 0.05
      });

      // Array de materiales para las 6 caras del cubo:
      // [Derecha, Izquierda, Arriba, Abajo, Frente, Atrás]
      const materials = [
        bodyMaterial, // Derecha
        bodyMaterial, // Izquierda
        bodyMaterial, // Arriba
        bodyMaterial, // Abajo
        frontMaterial, // Frente (Textura dinámica)
        bodyMaterial  // Atrás
      ];

      // Geometría del producto individual (caja)
      const boxGeo = new THREE.BoxGeometry(prod.width, prod.height, prod.depth);

      // Dibujar cada facing individualmente alineado a la izquierda
      const startX = -gondolaConfig.width / 2 + item.positionX;
      const productY = shelf.yPosition + prod.height / 2;
      
      // Alinear los productos al frente del estante (profundidad)
      const productZ = -gondolaConfig.depth / 2 + shelf.depth - prod.depth / 2;

      const itemStack = item.stack || 1;

      for (let f = 0; f < item.facings; f++) {
        for (let s = 0; s < itemStack; s++) {
          const mesh = new THREE.Mesh(boxGeo, materials);
          
          // Centrar cada facing horizontalmente
          const facingX = startX + (f + 0.5) * prod.width;
          // Ajustar la altura en base al nivel del apilamiento
          const facingY = productY + s * prod.height;
          mesh.position.set(facingX, facingY, productZ);
          
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          
          itemGroup3D.add(mesh);
        }
      }

      // Dibujar línea de cota o texto de dimensión flotante del producto seleccionado
      if (showDimensions && isSelected) {
        // Línea roja indicando espacio total ocupado
        const totalWidth = prod.width * item.facings;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(startX, productY - prod.height / 2 - 0.5, productZ + prod.depth / 2 + 1),
          new THREE.Vector3(startX + totalWidth, productY - prod.height / 2 - 0.5, productZ + prod.depth / 2 + 1)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xaa3bff, linewidth: 2 });
        const line = new THREE.Line(lineGeo, lineMat);
        itemGroup3D.add(line);
      }
    });

  }, [items, products, gondolaConfig, selectedItemId, heatmapMode, showDimensions]);

  return (
    <div className="relative w-full h-full min-h-[450px] bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden shadow-inner flex flex-col">
      {/* Contenedor WebGL de Mount */}
      <div ref={mountRef} className="w-full flex-1" />

      {/* Controles Flotantes 3D */}
      <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
        <button
          onClick={() => setFixedCameraView('front')}
          className="px-3 py-1.5 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg text-xs font-medium hover:bg-slate-700 transition"
        >
          Vista Frontal
        </button>
        <button
          onClick={() => setFixedCameraView('top')}
          className="px-3 py-1.5 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg text-xs font-medium hover:bg-slate-700 transition"
        >
          Vista Superior
        </button>
        <button
          onClick={() => setFixedCameraView('side')}
          className="px-3 py-1.5 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg text-xs font-medium hover:bg-slate-700 transition"
        >
          Vista Lateral
        </button>
        <button
          onClick={() => setFixedCameraView('isometric')}
          className="px-3 py-1.5 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg text-xs font-medium hover:bg-slate-700 transition"
        >
          Vista 3D
        </button>
        <button
          onClick={toggleFpsMode}
          className={`px-3 py-1.5 backdrop-blur border rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            isFpsMode 
              ? 'bg-indigo-600 border-indigo-400 text-white font-semibold' 
              : 'bg-slate-800/90 border-slate-700 text-slate-350 hover:bg-slate-700'
          }`}
        >
          👁️ {isFpsMode ? 'Salir Modo FPS' : 'Modo Consumidor (FPS)'}
        </button>
      </div>

      <div className="absolute bottom-4 right-4 bg-slate-900/95 border border-slate-700 px-3 py-2 rounded-lg backdrop-blur text-[10px] text-slate-400 flex flex-col gap-1 z-10 pointer-events-none select-none shadow-lg">
        <div className="font-semibold text-slate-300 mb-0.5">
          {isFpsMode ? 'Controles Consumidor (FPS):' : 'Navegación 3D:'}
        </div>
        {isFpsMode ? (
          <>
            <div>🖱️ Clic Izquierdo + Arrastrar: Desplazarse horizontalmente</div>
            <div>🎛️ Rueda del Ratón: Acercarse / Alejarse</div>
            <div>👁️ Altura de ojos bloqueada a 160 cm de la góndola</div>
          </>
        ) : (
          <>
            <div>🖱️ Clic Izquierdo + Arrastrar: Rotar Cámara</div>
            <div>🖱️ Clic Derecho + Arrastrar: Desplazar (Pan)</div>
            <div>🎛️ Rueda del Ratón: Zoom</div>
            <div>🖱️ Clic en Ítem: Seleccionar Producto / Estante</div>
          </>
        )}
      </div>
    </div>
  );
};
