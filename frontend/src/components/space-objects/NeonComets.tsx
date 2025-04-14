/**
 * NeonComets.tsx
 * 
 * Неоновые кометы - светящиеся метеориты с длинными хвостами из частиц,
 * оставляющие за собой след из неонового света. Компонент отвечает только
 * за визуализацию, вся логика движения, физики и параметров реализована в WASM модуле.
 */

import { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Trail, PointMaterial, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';

// WASM imports - import default initialization function and specific exports
import wasmInit, { 
  create_space_object_system,
  update_space_object_system,
  spawn_neon_comets,
  process_neon_comet_spawns,
  get_visible_neon_comets
} from '@wasm/hypercube_wasm';

// Создаем кастомный материал для свечения комет
const CometCoreMaterial = shaderMaterial(
  {
    time: 0,
    color: new THREE.Color(0.5, 0.8, 1.0),
    glowIntensity: 1.0
  },
  // Vertex shader
  `
    uniform float time;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    void main() {
      vPosition = position;
      vNormal = normal;
      vUv = uv;
      
      // Slight vertex displacement for a more organic look
      vec3 newPosition = position + normal * sin(time * 2.0 + position.x * 10.0) * 0.02;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  // Fragment shader
  `
    uniform float time;
    uniform vec3 color;
    uniform float glowIntensity;
    
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    void main() {
      // Calculate rim lighting effect for a glowing edge
      vec3 viewDirection = normalize(cameraPosition - vPosition);
      float rimFactor = 1.0 - max(0.0, dot(viewDirection, vNormal));
      rimFactor = pow(rimFactor, 2.0) * glowIntensity;
      
      // Pulse effect
      float pulse = sin(time * 3.0) * 0.1 + 0.9;
      
      // Mix core color with edge glow
      vec3 coreColor = color;
      vec3 edgeColor = color * 1.5;
      vec3 finalColor = mix(coreColor, edgeColor, rimFactor) * pulse;
      
      // Add some noise
      float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
      finalColor += noise * 0.05;
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

// Register the custom shader material
extend({ CometCoreMaterial });

const NeonComets = () => {
  // Создаем ссылку для хранения ID системы космических объектов
  const systemIdRef = useRef<number | null>(null);
  const wasmInitializedRef = useRef<boolean>(false);
  
  // Настройка для автоматического отслеживания времени для шейдера
  const timeRef = useRef(0);
  
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
          
          // Создаем начальное количество комет (все дальнейшие появления будут управляться WASM)
          const initialCount = 20; // Начальное количество комет для создания
          spawn_neon_comets(systemIdRef.current, initialCount);
          console.log(`Scheduled spawning of ${initialCount} initial comets`);
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
  }, []);
  
  // Создаем группы для размещения комет
  const group = useRef<THREE.Group>(null);
  
  // Создаем геометрии для комет
  const cometGeometries = useMemo(() => {
    // Основное тело кометы - ядро
    const core = new THREE.IcosahedronGeometry(0.5, 3);
    
    // Облако вокруг ядра (кома)
    const coma = new THREE.SphereGeometry(0.8, 16, 16);
    
    // Хвост кометы - конус
    const tail = new THREE.ConeGeometry(0.4, 1.5, 16);
    
    // Частицы для хвоста
    const particles = new THREE.BufferGeometry();
    const particleCount = 500;
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      // Позиции частиц в хвосте, распределенные конусообразно
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.4;
      const length = Math.random() * 3.0 + 0.5;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = -length; // Хвост направлен назад
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    return { core, coma, tail, particles };
  }, []);
  
  // Обновление и рендеринг комет
  useFrame((state, delta) => {
    // Обновляем время для шейдеров
    timeRef.current += delta;
    
    if (systemIdRef.current !== null && wasmInitializedRef.current) {
      try {
        // Обрабатываем отложенные создания комет и обновляем физику
        process_neon_comet_spawns(delta);
        update_space_object_system(systemIdRef.current, delta);
        
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
                  
                  // Создаем ядро кометы с кастомным материалом
                  const core = new THREE.Mesh(
                    cometGeometries.core,
                    new THREE.MeshStandardMaterial({
                      emissive: new THREE.Color(r, g, b),
                      emissiveIntensity: 1.0,
                      roughness: 0.2,
                      metalness: 0.8,
                      transparent: true,       // Добавляем transparent флаг
                      depthWrite: false,       // Отключаем запись в буфер глубины
                      blending: THREE.AdditiveBlending  // Используем аддитивное смешивание
                    })
                  );
                  core.name = 'core';
                  core.renderOrder = 1;       // Устанавливаем порядок рендеринга
                  cometObj.add(core);
                  
                  // Создаем кому (облако вокруг ядра)
                  const coma = new THREE.Mesh(
                    cometGeometries.coma,
                    new THREE.MeshPhongMaterial({
                      color: new THREE.Color(r, g, b),
                      transparent: true,
                      opacity: 0.5,
                      emissive: new THREE.Color(r, g, b),
                      emissiveIntensity: 0.5,
                      shininess: 50,
                      blending: THREE.AdditiveBlending,
                      depthWrite: false        // Отключаем запись в буфер глубины
                    })
                  );
                  coma.name = 'coma';
                  coma.renderOrder = 2;        // Устанавливаем порядок рендеринга
                  cometObj.add(coma);
                  
                  // Добавляем хвост
                  const tail = new THREE.Mesh(
                    cometGeometries.tail,
                    new THREE.MeshBasicMaterial({
                      color: new THREE.Color(r, g, b),
                      transparent: true,
                      opacity: 0.3,
                      blending: THREE.AdditiveBlending,
                      side: THREE.DoubleSide,
                      depthWrite: false        // Отключаем запись в буфер глубины
                    })
                  );
                  tail.name = 'tail';
                  tail.renderOrder = 3;        // Устанавливаем порядок рендеринга
                  tail.rotation.x = Math.PI; // Направляем хвост назад
                  tail.position.z = -0.8;
                  cometObj.add(tail);
                  
                  // Добавляем частицы для хвоста
                  const particles = new THREE.Points(
                    cometGeometries.particles,
                    new THREE.PointsMaterial({
                      color: new THREE.Color(r, g, b),
                      size: 0.05,
                      transparent: true,
                      opacity: 0.6,
                      blending: THREE.AdditiveBlending,
                      sizeAttenuation: true,
                      depthWrite: false        // Отключаем запись в буфер глубины
                    })
                  );
                  particles.name = 'particles';
                  particles.renderOrder = 4;    // Устанавливаем порядок рендеринга
                  cometObj.add(particles);
                  
                  // Добавляем свечение
                  const glow = new THREE.PointLight(new THREE.Color(r, g, b), 2.0, 10);
                  glow.name = 'glow';
                  cometObj.add(glow);
                  
                  // Добавляем комету в группу
                  group.current.add(cometObj);
                }
                
                // Обновляем положение и параметры
                cometObj.position.set(px, py, pz);
                cometObj.scale.set(scale, scale, scale);
                cometObj.quaternion.set(rx, ry, rz, rw);
                
                // Обновляем материалы и параметры всех частей кометы
                
                // Ядро
                const core = cometObj.children.find(child => child.name === 'core') as THREE.Mesh;
                if (core) {
                  const material = core.material as THREE.MeshStandardMaterial;
                  material.opacity = opacity;
                  material.emissive.setRGB(r, g, b);
                  material.emissiveIntensity = glowIntensity * 0.8;
                }
                
                // Кома (облако)
                const coma = cometObj.children.find(child => child.name === 'coma') as THREE.Mesh;
                if (coma) {
                  const material = coma.material as THREE.MeshPhongMaterial;
                  material.opacity = opacity * 0.7;
                  material.color.setRGB(r, g, b);
                  material.emissive.setRGB(r, g, b);
                  material.emissiveIntensity = glowIntensity * 0.5;
                }
                
                // Хвост
                const tail = cometObj.children.find(child => child.name === 'tail') as THREE.Mesh;
                if (tail) {
                  const material = tail.material as THREE.MeshBasicMaterial;
                  material.opacity = opacity * 0.5;
                  material.color.setRGB(r, g, b);
                  
                  // Изменяем размер хвоста в зависимости от параметра tailLength
                  tail.scale.set(1.0, 1.0, tailLength);
                  tail.position.z = -0.8 - tailLength * 0.5;
                }
                
                // Частицы хвоста
                const particles = cometObj.children.find(child => child.name === 'particles') as THREE.Points;
                if (particles) {
                  const material = particles.material as THREE.PointsMaterial;
                  material.opacity = opacity * 0.4;
                  material.color.setRGB(r, g, b);
                  material.size = 0.05 + glowIntensity * 0.05;
                  
                  // Масштабируем частицы по длине хвоста
                  particles.scale.set(1.0, 1.0, tailLength);
                }
                
                // Обновляем свечение
                const glow = cometObj.children.find(child => child.name === 'glow') as THREE.PointLight;
                if (glow) {
                  glow.color.setRGB(r, g, b);
                  glow.intensity = glowIntensity * 2.0;
                  glow.distance = scale * 10 * tailLength;
                }
              }
              
              // Сортируем объекты по расстоянию от камеры для правильного рендеринга
              // Это обеспечит корректное отображение прозрачных объектов
              children.sort((a, b) => {
                // Сортировка от дальних к ближним объектам
                const distA = a.position.distanceTo(state.camera.position);
                const distB = b.position.distanceTo(state.camera.position);
                return distB - distA;
              });
              
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