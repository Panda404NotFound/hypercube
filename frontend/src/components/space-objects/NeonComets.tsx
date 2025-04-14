/**
 * NeonComets.tsx
 * 
 * Неоновые кометы - светящиеся метеориты с длинными хвостами из частиц,
 * оставляющие за собой след из неонового света. Компонент отвечает только
 * за визуализацию, вся логика движения и физики реализована в WASM модуле.
 */

import { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Instances, Instance, Trail, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';

// WASM imports - import default initialization function and specific exports
import wasmInit, { 
  create_space_object_system,
  update_space_object_system,
  spawn_neon_comets,
  process_neon_comet_spawns,
  get_visible_neon_comets
} from '@wasm/hypercube_wasm';

interface NeonCometsProps {
  count?: number;
  initialDelay?: number;
  speed?: number;
  colorPrimary?: string;
  colorSecondary?: string;
}

// For better TypeScript compatibility, define an interface for the CometData
interface CometData {
  // WASM binding pointer
  __wbg_ptr?: number;
}

const NeonComets = ({ count = 15, initialDelay = 0, speed = 1.0, colorPrimary = "#88ccff", colorSecondary = "#ff88cc" }: NeonCometsProps) => {
  // Создаем ссылку для хранения ID системы космических объектов
  const systemIdRef = useRef<number | null>(null);
  const wasmInitializedRef = useRef<boolean>(false);
  const spawningInProgressRef = useRef<boolean>(false);
  const cometsSpawnedRef = useRef<boolean>(false);
  
  // Инициализация WASM модуля и системы объектов
  useEffect(() => {
    let isMounted = true;
    
    // Инициализируем WASM модуль
    wasmInit()
      .then(() => {
        if (!isMounted) return;
        
        wasmInitializedRef.current = true;
        console.log('WASM module initialized successfully!');
        
        // Если система еще не создана, создаем ее
        if (systemIdRef.current === null) {
          // Создаем систему объектов с параметрами: viewport_size_percent = 25.0, fov_degrees = 60.0
          systemIdRef.current = create_space_object_system(25.0, 60.0);
          console.log('Created space object system with ID:', systemIdRef.current);
          
          // Устанавливаем таймаут для начального создания комет
          spawningInProgressRef.current = true;
          setTimeout(() => {
            if (!isMounted || systemIdRef.current === null) return;
            
            try {
              // Try to spawn comets
              const spawnResult = spawn_neon_comets(systemIdRef.current, count);
              console.log(`Spawned ${count} comets, result:`, spawnResult);
              
              cometsSpawnedRef.current = true;
            } catch (error) {
              console.error('Error spawning comets:', error);
            } finally {
              spawningInProgressRef.current = false;
            }
          }, initialDelay);
        }
      })
      .catch((error: Error) => {
        console.error("Failed to initialize WASM module:", error);
      });
    
    return () => {
      isMounted = false;
      // При размонтировании компонента можно было бы удалить систему,
      // но это не требуется, так как она удалится вместе с WASM модулем
      systemIdRef.current = null;
    };
  }, [count, initialDelay]);
  
  // Создаем группы для размещения комет
  const group = useRef<THREE.Group>(null);
  
  // Создаем геометрию для комет
  const cometGeometry = useMemo(() => {
    return new THREE.IcosahedronGeometry(1, 1);
  }, []);
  
  // Создаем материал для комет
  const cometMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      metalness: 0.1,
      roughness: 0.2,
      emissive: new THREE.Color(colorPrimary),
      emissiveIntensity: 2.0,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, [colorPrimary]);
  
  // Создаем геометрию для хвоста кометы
  const trailMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorSecondary),
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colorSecondary]);
  
  // Обновление и рендеринг комет
  useFrame((state, delta) => {
    if (systemIdRef.current !== null && wasmInitializedRef.current) {
      // Apply speed factor to delta time
      const adjustedDelta = delta * speed;
      
      try {
        // Обрабатываем отложенные создания комет
        if (cometsSpawnedRef.current || spawningInProgressRef.current) {
          process_neon_comet_spawns(adjustedDelta);
        }
        
        // Обновляем состояние всех комет
        update_space_object_system(systemIdRef.current, adjustedDelta);
        
        // Получаем данные о видимых кометах
        const cometDataObject = get_visible_neon_comets(systemIdRef.current);
        
        // Check if cometsData exists
        if (cometDataObject && group.current) {
          // Extract arrays using direct method calls
          let idsArray: Uint32Array | number[] = [];
          let positionsArray: Float32Array | number[] = [];
          let scalesArray: Float32Array | number[] = [];
          let rotationsArray: Float32Array | number[] = [];
          let opacitiesArray: Float32Array | number[] = [];
          let colorsArray: Float32Array | number[] = [];
          let tailLengthsArray: Float32Array | number[] = [];
          let glowIntensitiesArray: Float32Array | number[] = [];
          
          try {
            // Access each property as a getter
            const comet = cometDataObject as any;
            idsArray = comet.ids;
            positionsArray = comet.positions;
            scalesArray = comet.scales;
            rotationsArray = comet.rotations;
            opacitiesArray = comet.opacities;
            colorsArray = comet.colors;
            tailLengthsArray = comet.tail_lengths;
            glowIntensitiesArray = comet.glow_intensities;

            // Only proceed if we have valid IDs
            if (idsArray && idsArray.length > 0) {
              // Обновляем положение и параметры комет
              const children = group.current.children;
              
              // Для каждой видимой кометы обновляем её визуальное представление
              // или создаем новую, если её ещё нет
              for (let i = 0; i < idsArray.length; i++) {
                const id = idsArray[i];
                const px = positionsArray[i * 3];
                const py = positionsArray[i * 3 + 1];
                const pz = positionsArray[i * 3 + 2];
                
                const scale = scalesArray[i];
                
                const rx = rotationsArray[i * 4];
                const ry = rotationsArray[i * 4 + 1];
                const rz = rotationsArray[i * 4 + 2];
                const rw = rotationsArray[i * 4 + 3];
                
                const opacity = opacitiesArray[i];
                
                const r = colorsArray[i * 3];
                const g = colorsArray[i * 3 + 1];
                const b = colorsArray[i * 3 + 2];
                
                const tailLength = tailLengthsArray[i];
                const glowIntensity = glowIntensitiesArray[i];
                
                // Находим или создаём объект кометы
                let cometObj = children.find(child => child.userData.id === id) as THREE.Group;
                
                if (!cometObj) {
                  // Создаем новую комету
                  cometObj = new THREE.Group();
                  cometObj.userData.id = id;
                  
                  // Создаем основное тело кометы
                  const body = new THREE.Mesh(cometGeometry, cometMaterial.clone());
                  body.name = 'body';
                  cometObj.add(body);
                  
                  // Добавляем свечение
                  const glow = new THREE.PointLight(0x88ccff, 2.0, 10);
                  glow.name = 'glow';
                  cometObj.add(glow);
                  
                  // Добавляем комету в группу
                  group.current.add(cometObj);
                }
                
                // Обновляем положение и параметры
                cometObj.position.set(px, py, pz);
                cometObj.scale.set(scale, scale, scale);
                cometObj.quaternion.set(rx, ry, rz, rw);
                
                // Обновляем материал тела кометы
                const body = cometObj.children.find(child => child.name === 'body') as THREE.Mesh;
                if (body) {
                  const material = body.material as THREE.MeshStandardMaterial;
                  material.opacity = opacity;
                  material.emissive.setRGB(r, g, b);
                  material.color.setRGB(r, g, b);
                  material.emissiveIntensity = glowIntensity;
                }
                
                // Обновляем свечение
                const glow = cometObj.children.find(child => child.name === 'glow') as THREE.PointLight;
                if (glow) {
                  glow.color.setRGB(r, g, b);
                  glow.intensity = glowIntensity * 2;
                  glow.distance = scale * 10 * tailLength;
                }
              }
              
              // Удаляем кометы, которых нет в данных
              const visibleIds = new Set(idsArray);
              for (let i = children.length - 1; i >= 0; i--) {
                const child = children[i];
                if (!visibleIds.has(child.userData.id)) {
                  group.current.remove(child);
                }
              }
            }
          } catch (error) {
            console.error('Error accessing comet data:', error);
          }
        }
      } catch (error) {
        console.error("Error in WASM operation:", error);
      }
    }
  });
  
  return (
    <group ref={group} />
  );
};

export default NeonComets;