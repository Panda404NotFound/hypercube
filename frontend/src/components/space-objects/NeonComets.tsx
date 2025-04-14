/**
 * NeonComets.tsx
 * 
 * Неоновые кометы - светящиеся метеориты с длинными хвостами из частиц,
 * оставляющие за собой след из неонового света. Компонент отвечает только
 * за визуализацию, вся логика движения и физики реализована в WASM модуле.
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';
import dynamic from 'next/dynamic';

// Обратите внимание: в реальном проекте необходимо импортировать шейдеры
// Здесь указаны пути, но в Next.js нужно использовать правильные импорты
// import vertexShader from '../../shaders/neonComet.vert';
// import fragmentShader from '../../shaders/neonComet.frag';
// Пока используем встроенные строки для шейдеров
const vertexShader = `
  uniform float uTime;
  uniform float uSpeed;
  
  attribute float size;
  attribute float randomness;
  attribute float particleIndex;
  attribute vec3 color;
  attribute float fadeFactor;
  
  varying vec3 vPosition;
  varying float vParticleIndex;
  varying float vRandomness;
  varying vec3 vColor;
  varying float vFadeFactor;
  
  void main() {
      vPosition = position;
      vParticleIndex = particleIndex;
      vRandomness = randomness;
      vColor = color;
      vFadeFactor = fadeFactor;
      
      vec3 animated = position;
      
      // Добавим небольшую анимацию пульсации
      float pulseFactor = sin(uTime * (1.0 + randomness)) * 0.2 + 1.0;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(animated, 1.0);
      
      // Увеличиваем размер всех частиц и добавляем пульсацию
      float sizeMultiplier = particleIndex < 0.1 ? 2.0 : 1.0; // Ядро крупнее хвоста
      gl_PointSize = size * (1.0 - particleIndex * 0.5) * pulseFactor * sizeMultiplier;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColorPrimary;
  uniform vec3 uColorSecondary;
  uniform float uGlowStrength;
  
  varying vec3 vPosition;
  varying float vParticleIndex;
  varying float vRandomness;
  varying vec3 vColor;
  varying float vFadeFactor;
  
  void main() {
      // Используем переданные с Rust цвета вместо предустановленных
      vec3 baseColor = vColor;
      
      // Усиливаем насыщенность цветов
      baseColor *= 1.5;
      
      // Улучшаем свечение частиц
      float dist = length(gl_PointCoord - vec2(0.5));
      float glow = exp(-dist * 3.0) * uGlowStrength; // Экспоненциальное затухание для более яркого центра
      float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
      
      // Для ядра и хвоста разная обработка
      if (vParticleIndex < 0.1) {
          // Ядро ярче
          baseColor *= 1.5;
          alpha = min(1.0, alpha * 1.5);
      } else {
          // Хвост с мерцанием и затуханием на основе fadeFactor
          alpha *= vFadeFactor; // Используем переданный фактор затухания
          float flicker = sin(uTime * (5.0 + vRandomness * 10.0)) * 0.3 + 0.7; // Более естественное мерцание
          alpha *= flicker;
          
          // Добавляем дополнительную анимацию цвета для хвоста
          float colorShift = sin(uTime * 2.0 + vRandomness * 10.0) * 0.3 + 0.5;
          baseColor = mix(baseColor, vec3(1.0, 1.0, 1.0), colorShift * 0.2); // Периодические вспышки белого
      }
      
      // Добавляем свечение
      baseColor += glow * 0.7;
      
      gl_FragColor = vec4(baseColor, alpha);
  }
`;

// Упрощенный загрузчик WASM модуля
const useWasmModule = () => {
  const [wasmModule, setWasmModule] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    async function loadWasm() {
      try {
        // Динамический импорт WASM модуля
        const module = await import('../../../../wasm/pkg/hypercube_wasm');
        await module.default(); // Инициализация модуля
        
        if (isMounted) {
          // Проверяем наличие необходимых функций для работы с космическими объектами
          const requiredFunctions = [
            'create_space_object_system_with_fixed_particles',
            'update_space_object_system',
            'get_neon_comet_data'
          ];
          
          // Проверяем, что все необходимые функции существуют в модуле
          const missingFunctions: string[] = [];
          requiredFunctions.forEach(funcName => {
            if (typeof (module as any)[funcName] !== 'function') {
              missingFunctions.push(funcName);
            }
          });
          
          if (missingFunctions.length > 0) {
            throw new Error(`Отсутствуют необходимые функции: ${missingFunctions.join(', ')}`);
          }
          
          console.log('WASM модуль загружен успешно');
          setWasmModule(module);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Ошибка загрузки WASM модуля:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          // Создаем заглушку с необходимыми функциями
          setWasmModule({
            create_space_object_system_with_fixed_particles: (count: number, type: number, particlesPerObj: number) => {
              console.warn(`[ЗАГЛУШКА] Создана система ${count} объектов типа ${type} с ${particlesPerObj} частицами`);
              return 1;
            },
            update_space_object_system: (id: number, deltaTime: number) => {
              // console.log(`[ЗАГЛУШКА] Обновлена система объектов (ID=${id}) на ${deltaTime.toFixed(3)}с`);
              return true;
            },
            get_neon_comet_data: (id: number) => {
              // console.log(`[ЗАГЛУШКА] Запрошены данные о кометах для ID=${id}`);
              return createEmptyCometData();
            }
          });
          setIsLoading(false);
        }
      }
    }
    
    loadWasm();
    
    return () => {
      isMounted = false;
    };
  }, []);

  return { wasmModule, isLoading, error };
};

// Функция для создания пустых данных для заглушки
function createEmptyCometData(): NeonCometData {
  return {
    core_positions: new Float32Array(15),
    core_rotations: new Float32Array(15),
    core_scales: new Float32Array(5),
    core_colors: new Float32Array(15),
    particle_positions: new Float32Array(300),
    particle_sizes: new Float32Array(100),
    particle_lifetimes: new Float32Array(100),
    particle_max_lifetimes: new Float32Array(100),
    particle_randomness: new Float32Array(100),
    particle_colors: new Float32Array(300),
    particle_fade_factors: new Float32Array(100),
    particle_count_per_comet: new Uint32Array(5)
  };
}

// Тип для данных кометы из WASM
interface NeonCometData {
  core_positions: Float32Array;
  core_rotations: Float32Array;
  core_scales: Float32Array;
  core_colors: Float32Array;
  particle_positions: Float32Array;
  particle_sizes: Float32Array;
  particle_lifetimes: Float32Array;
  particle_max_lifetimes: Float32Array;
  particle_randomness: Float32Array;
  particle_colors: Float32Array;
  particle_fade_factors: Float32Array;
  particle_count_per_comet: Uint32Array;
}

// Свойства для компонента неоновых комет
interface NeonCometsProps {
  // Эти параметры будут напрямую использоваться только для передачи в WASM
  count?: number;         // Количество комет (будет передано в WASM)
  speed?: number;         // Множитель скорости времени (для анимации)
  // Цвета используются только для визуализации, но не влияют на логику
  colorPrimary?: string;  // Основной цвет свечения
  colorSecondary?: string; // Дополнительный цвет свечения
  // Флаг для отладки - показывать ли траектории движения
  showPaths?: boolean;
}

// Состояние, которое будет храниться в хуке useStore
interface CometState {
  systemId: number | null;
  initSystem: (wasm: any, count: number) => void;
  updateSystem: (wasm: any, deltaTime: number) => void;
  getCometsData: (wasm: any) => NeonCometData | null;
}

// Создаем store с помощью zustand для управления состоянием комет
const useCometsStore = create<CometState>((set, get) => ({
  systemId: null,
  
  initSystem: (wasm, count: number) => {
    if (!wasm) return;
    
    try {
      // Тип 0 соответствует NeonComet в enum SpaceObjectType в wasm/src/space_objects.rs
      const objectType = 0; // NeonComet
      
      // Создаем систему космических объектов с фиксированным количеством частиц
      // Это гарантирует, что все комета будет иметь одинаковое количество частиц
      const particlesPerComet = 100; // Определено в WASM модуле (wasm/src/neon_comets.rs)
      
      // Вызываем функцию WASM для создания системы комет
      const systemId = wasm.create_space_object_system_with_fixed_particles(count, objectType, particlesPerComet);
      
      console.log(`Создана система комет с ID=${systemId}, частиц на комету: ${particlesPerComet}`);
      set({ systemId });
    } catch (error) {
      console.error("Ошибка инициализации системы комет:", error);
    }
  },
  
  updateSystem: (wasm, deltaTime: number) => {
    if (!wasm) return;
    
    const { systemId } = get();
    if (systemId !== null) {
      try {
        // Вызываем функцию WASM для обновления системы комет с учетом прошедшего времени
        wasm.update_space_object_system(systemId, deltaTime);
      } catch (error) {
        console.error("Ошибка обновления системы комет:", error);
      }
    }
  },
  
  getCometsData: (wasm) => {
    if (!wasm) return null;
    
    const { systemId } = get();
    if (systemId !== null) {
      try {
        // Получаем данные о положении, размерах и цветах комет из WASM модуля
        return wasm.get_neon_comet_data(systemId) as NeonCometData;
      } catch (error) {
        console.error("Ошибка получения данных о кометах:", error);
      }
    }
    return null;
  }
}));

export function NeonComets({ 
  count = 5, 
  speed = 1, 
  colorPrimary = '#00ff83', 
  colorSecondary = '#0083ff',
  showPaths = false
}: NeonCometsProps) {
  // Загружаем WebAssembly модуль
  const { wasmModule, isLoading, error } = useWasmModule();
  
  // Ссылки на объекты Three.js
  const cometCoresRef = useRef<THREE.Points>(null);
  const cometTailsRef = useRef<THREE.Points>(null);
  
  // Создаем материалы для визуализации комет
  const coreMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uColorPrimary: { value: new THREE.Color(colorPrimary) },
        uColorSecondary: { value: new THREE.Color(colorSecondary) },
        uGlowStrength: { value: 3.0 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }, [colorPrimary, colorSecondary, speed]);
  
  const tailMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uColorPrimary: { value: new THREE.Color(colorSecondary) },
        uColorSecondary: { value: new THREE.Color(colorPrimary) },
        uGlowStrength: { value: 2.0 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }, [colorPrimary, colorSecondary, speed]);
  
  // Создаем пустые геометрии для ядер и хвостов комет
  // Эти буферы будут заполняться данными из WASM модуля
  const coreGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    // Создаем атрибуты с запасом для максимально возможного количества ядер
    const maxCores = count; // Одно ядро на комету
    
    // Позиции ядер комет (по 3 координаты на каждое ядро)
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxCores * 3), 3));
    
    // Размеры ядер комет
    geometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(maxCores), 1));
    
    // Цвета ядер комет (по 3 компонента цвета на каждое ядро)
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxCores * 3), 3));
    
    // Фактор затухания (для ядер всегда 1.0)
    geometry.setAttribute('fadeFactor', new THREE.BufferAttribute(new Float32Array(maxCores).fill(1.0), 1));
    
    // Индекс типа частицы (0 для ядер)
    geometry.setAttribute('particleIndex', new THREE.BufferAttribute(new Float32Array(maxCores).fill(0), 1));
    
    // Случайность для визуальных эффектов
    geometry.setAttribute('randomness', new THREE.BufferAttribute(new Float32Array(maxCores).fill(0.5), 1));
    
    return geometry;
  }, [count]);
  
  const tailGeometry = useMemo(() => {
    // Максимальное количество частиц для хвостов всех комет
    // Рассчитываем с запасом, чтобы точно хватило буфера
    const maxTailParticles = count * 200; // По 200 частиц на комету с запасом
    
    const geometry = new THREE.BufferGeometry();
    
    // Позиции частиц хвостов (по 3 координаты на каждую частицу)
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxTailParticles * 3), 3));
    
    // Размеры частиц хвостов
    geometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(maxTailParticles), 1));
    
    // Цвета частиц хвостов (по 3 компонента цвета на каждую частицу)
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxTailParticles * 3), 3));
    
    // Фактор затухания для постепенного исчезновения частиц хвоста
    geometry.setAttribute('fadeFactor', new THREE.BufferAttribute(new Float32Array(maxTailParticles).fill(1.0), 1));
    
    // Индекс типа частицы (1 для частиц хвоста)
    geometry.setAttribute('particleIndex', new THREE.BufferAttribute(new Float32Array(maxTailParticles).fill(1), 1));
    
    // Случайность для визуальных эффектов
    geometry.setAttribute('randomness', new THREE.BufferAttribute(new Float32Array(maxTailParticles), 1));
    
    return geometry;
  }, [count]);
  
  // Получаем доступ к состоянию комет через zustand
  const { initSystem, updateSystem, getCometsData } = useCometsStore();
  
  // Инициализация системы комет при загрузке WASM модуля
  useEffect(() => {
    if (wasmModule && !isLoading) {
      // Инициализируем систему комет в WASM-модуле
      // Все параметры управления будут находиться в WASM
      initSystem(wasmModule, count);
    }
  }, [count, initSystem, wasmModule, isLoading]);
  
  // Функция для безопасного обновления буферов визуализации
  const updateBufferSafely = (
    targetArray: Float32Array,
    sourceArray: Float32Array,
    attributeName: string,
    attribute: THREE.BufferAttribute
  ) => {
    if (targetArray.length >= sourceArray.length) {
      targetArray.set(sourceArray);
      attribute.needsUpdate = true;
      return true;
    } 
    
    // В случае несоответствия размеров буферов выводим предупреждение
    console.warn(`Несоответствие размера буфера: ${attributeName} имеет ${targetArray.length} элементов, источник имеет ${sourceArray.length}`);
    return false;
  };
  
  // Обновление визуализации комет на каждом кадре
  useFrame((state, delta) => {
    if (!wasmModule || isLoading) return;
    
    // Обновляем систему комет в WASM-модуле
    // Вся логика перемещения, создания новых комет и обработки столкновений
    // происходит внутри WASM-модуля
    updateSystem(wasmModule, delta * speed);
    
    // Получаем актуальные данные из WASM для визуализации
    const cometData = getCometsData(wasmModule);
    if (!cometData) return;
    
    // Обновляем время для шейдеров (для анимации свечения)
    if (coreMaterial.uniforms) {
      coreMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    }
    if (tailMaterial.uniforms) {
      tailMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    }
    
    // Обновляем визуализацию ядер комет
    if (cometCoresRef.current) {
      const posAttribute = cometCoresRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      const sizeAttribute = cometCoresRef.current.geometry.getAttribute('size') as THREE.BufferAttribute;
      const colorAttribute = cometCoresRef.current.geometry.getAttribute('color') as THREE.BufferAttribute;
      
      // Обновляем позиции ядер из WASM
      updateBufferSafely(
        posAttribute.array as Float32Array,
        cometData.core_positions,
        'позиции ядер',
        posAttribute
      );
      
      // Обновляем размеры ядер из WASM с небольшим увеличением для лучшей видимости
      const sizes = sizeAttribute.array as Float32Array;
      const scaleCount = Math.min(count, cometData.core_scales.length);
      for (let i = 0; i < scaleCount; i++) {
        sizes[i] = cometData.core_scales[i] * 5.0; // Увеличиваем размер для лучшей видимости
      }
      sizeAttribute.needsUpdate = true;
      
      // Обновляем цвета ядер из WASM
      updateBufferSafely(
        colorAttribute.array as Float32Array,
        cometData.core_colors,
        'цвета ядер',
        colorAttribute
      );
    }
    
    // Обновляем визуализацию хвостов комет
    if (cometTailsRef.current) {
      const posAttribute = cometTailsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      const sizeAttribute = cometTailsRef.current.geometry.getAttribute('size') as THREE.BufferAttribute;
      const randomnessAttribute = cometTailsRef.current.geometry.getAttribute('randomness') as THREE.BufferAttribute;
      const particleIndexAttribute = cometTailsRef.current.geometry.getAttribute('particleIndex') as THREE.BufferAttribute;
      const colorAttribute = cometTailsRef.current.geometry.getAttribute('color') as THREE.BufferAttribute;
      const fadeFactorAttribute = cometTailsRef.current.geometry.getAttribute('fadeFactor') as THREE.BufferAttribute;
      
      // Обновляем все атрибуты частиц хвоста из WASM
      updateBufferSafely(posAttribute.array as Float32Array, cometData.particle_positions, 'позиции частиц', posAttribute);
      updateBufferSafely(sizeAttribute.array as Float32Array, cometData.particle_sizes, 'размеры частиц', sizeAttribute);
      updateBufferSafely(randomnessAttribute.array as Float32Array, cometData.particle_randomness, 'случайность', randomnessAttribute);
      updateBufferSafely(colorAttribute.array as Float32Array, cometData.particle_colors, 'цвета частиц', colorAttribute);
      updateBufferSafely(fadeFactorAttribute.array as Float32Array, cometData.particle_fade_factors, 'затухание', fadeFactorAttribute);
      
      // Обновляем индекс частицы на основе времени жизни из WASM
      const indices = particleIndexAttribute.array as Float32Array;
      const maxLength = Math.min(indices.length, cometData.particle_lifetimes.length, cometData.particle_max_lifetimes.length);
      
      for (let i = 0; i < maxLength; i++) {
        // Устанавливаем значение от 0.1 до 1.0 в зависимости от времени жизни
        // Это влияет на визуализацию частиц в шейдере
        indices[i] = 0.1 + 0.9 * (1.0 - cometData.particle_lifetimes[i] / cometData.particle_max_lifetimes[i]);
      }
      particleIndexAttribute.needsUpdate = true;
    }
  });

  // Если произошла ошибка загрузки WASM-модуля, показываем сообщение об ошибке
  if (error) {
    console.error('Ошибка инициализации WASM модуля:', error);
    return (
      <group>
        <mesh>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color={colorPrimary} wireframe={true} />
        </mesh>
      </group>
    );
  }

  // Если WASM модуль всё ещё загружается, не показываем ничего
  if (isLoading) {
    return null;
  }

  return (
    <group>
      {/* Визуализация ядер комет */}
      <points ref={cometCoresRef} geometry={coreGeometry} material={coreMaterial} />
      
      {/* Визуализация хвостов комет */}
      <points ref={cometTailsRef} geometry={tailGeometry} material={tailMaterial} />
      
      {/* Опционально отображаем траектории движения для отладки */}
      {showPaths && (
        <group>
          <gridHelper args={[20, 20, '#444444', '#222222']} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <axesHelper args={[5]} />
        </group>
      )}
    </group>
  );
}

export default NeonComets; 