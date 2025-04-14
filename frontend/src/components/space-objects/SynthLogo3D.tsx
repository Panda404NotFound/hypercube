/**
 * SynthLogo3D.tsx
 * 
 * 3D представление логотипа Synth, через который могут проходить космические объекты.
 * Использует текстуру логотипа на плоскости с эффектами свечения и искажения.
 * При пролете кометы через логотип активируется эффект искажения.
 */

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// Создаем кастомный материал с эффектом искажения и свечения
const LogoShaderMaterial = new THREE.ShaderMaterial({
  uniforms: {
    map: { value: null },
    time: { value: 0.0 },
    distortionIntensity: { value: 0.0 },
    distortionPoint: { value: new THREE.Vector2(0.5, 0.5) },
    glowColor: { value: new THREE.Color(0x00ff83) }, // Цвет свечения
    glowIntensity: { value: 0.5 } // Интенсивность свечения
  },
  vertexShader: `
    uniform float time;
    uniform float distortionIntensity;
    uniform vec2 distortionPoint;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    
    void main() {
      vUv = uv;
      vPosition = position;
      
      // Расчет дистанции от вершины до точки искажения
      float dist = distance(uv, distortionPoint);
      
      // Волновой эффект, затухающий с расстоянием
      float waveFactor = (1.0 - smoothstep(0.0, 0.3, dist)) * distortionIntensity;
      
      // Применяем искажение к вершинам если активно
      vec3 newPosition = position;
      
      if (waveFactor > 0.0) {
        // Направление искажения от точки
        vec2 direction = normalize(vec2(uv - distortionPoint));
        
        // Волновое искажение в пространстве
        float waveAmount = sin(dist * 30.0 - time * 5.0) * 0.1 * waveFactor;
        
        // Применяем искажение в направлении нормали
        newPosition.z += waveAmount;
      }
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D map;
    uniform float time;
    uniform float distortionIntensity;
    uniform vec2 distortionPoint;
    uniform vec3 glowColor;
    uniform float glowIntensity;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    
    void main() {
      // Расчет дистанции от фрагмента до точки искажения
      float dist = distance(vUv, distortionPoint);
      
      // Волновой эффект, затухающий с расстоянием
      float waveFactor = (1.0 - smoothstep(0.0, 0.3, dist)) * distortionIntensity;
      
      // Искажаем текстурные координаты
      vec2 distortedUv = vUv;
      if (waveFactor > 0.0) {
        // Направление от точки искажения
        vec2 direction = normalize(vUv - distortionPoint);
        
        // Волновое искажение текстуры
        float waveAmount = sin(dist * 30.0 - time * 5.0) * 0.03 * waveFactor;
        distortedUv = vUv + direction * waveAmount;
      }
      
      // Получаем цвет с текстуры
      vec4 texColor = texture2D(map, distortedUv);
      
      // Добавляем свечение при воздействии
      vec3 finalColor = texColor.rgb;
      if (waveFactor > 0.0) {
        // Пульсирующее свечение
        float glowAmount = waveFactor * (0.5 + 0.5 * sin(time * 10.0)) * glowIntensity;
        finalColor += glowColor * glowAmount * texColor.a;
      }
      
      // Базовое свечение вдоль краёв
      float edgeGlow = 0.2 * sin(time * 0.5) + 0.8;
      finalColor += glowColor * edgeGlow * 0.1 * texColor.a;
      
      gl_FragColor = vec4(finalColor, texColor.a);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide
});

const SynthLogo3D = () => {
  // Загружаем текстуру логотипа
  const texture = useTexture('/images/synth_logo.png');
  
  // Состояние для размеров логотипа
  const [dimensions, setDimensions] = useState({ width: 10, height: 3 });
  
  // Ссылка на меш для управления им
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Ссылка на материал для обновления униформов
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Состояние эффекта искажения
  const distortionState = useRef({
    active: false,
    intensity: 0.0,
    targetIntensity: 0.0,
    point: new THREE.Vector2(0.5, 0.5),
    lastActivated: 0,
    // Храним список активных искажений от комет
    cometDistortions: [] as {
      id: string;
      point: THREE.Vector2;
      intensity: number;
      timestamp: number;
    }[]
  });
  
  // Создаем коллизионную плоскость для определения пролета комет через логотип
  const collisionPlaneRef = useRef<THREE.Plane>(new THREE.Plane(
    new THREE.Vector3(0, 0, 1), // Нормаль плоскости (направлена к камере)
    15 // Расстояние от начала координат
  ));
  
  // Функция для активации искажения в случайной точке логотипа
  const activateDistortion = (point?: THREE.Vector2) => {
    const now = Date.now();
    
    // Предотвращаем слишком частую активацию
    if (now - distortionState.current.lastActivated < 500) return;
    
    distortionState.current.active = true;
    distortionState.current.targetIntensity = Math.random() * 0.5 + 0.5; // Случайная интенсивность 0.5-1.0
    
    // Используем предоставленную точку или генерируем случайную
    if (point) {
      distortionState.current.point.copy(point);
    } else {
      distortionState.current.point.set(
        Math.random() * 0.8 + 0.1, // x: 0.1-0.9
        Math.random() * 0.8 + 0.1  // y: 0.1-0.9
      );
    }
    
    distortionState.current.lastActivated = now;
    
    // Автоматически деактивируем через случайное время
    setTimeout(() => {
      distortionState.current.targetIntensity = 0.0;
    }, Math.random() * 1000 + 500); // 500-1500ms
  };
  
  // Функция для проверки пролета кометы через логотип
  const checkCometCollision = (cometPosition: THREE.Vector3, cometSize: number, cometId: string) => {
    if (!meshRef.current) return false;
    
    // Получаем мировую позицию и размеры логотипа
    const logoPosition = new THREE.Vector3();
    meshRef.current.getWorldPosition(logoPosition);
    
    // Создаем bounding box для логотипа
    const logoHalfWidth = dimensions.width / 2;
    const logoHalfHeight = dimensions.height / 2;
    
    // Расстояние от кометы до плоскости логотипа
    const distanceToPlane = Math.abs(cometPosition.z - logoPosition.z);
    
    // Если комета достаточно близко к плоскости логотипа
    if (distanceToPlane < cometSize) {
      // Проверяем, находится ли комета в пределах логотипа (по X и Y)
      const withinX = Math.abs(cometPosition.x - logoPosition.x) < logoHalfWidth;
      const withinY = Math.abs(cometPosition.y - logoPosition.y) < logoHalfHeight;
      
      if (withinX && withinY) {
        // Конвертируем мировые координаты в UVs (0-1)
        const uvX = ((cometPosition.x - (logoPosition.x - logoHalfWidth)) / dimensions.width);
        const uvY = ((cometPosition.y - (logoPosition.y - logoHalfHeight)) / dimensions.height);
        
        // Регистрируем новое искажение от кометы
        const existing = distortionState.current.cometDistortions.find(d => d.id === cometId);
        
        if (!existing) {
          const distortion = {
            id: cometId,
            point: new THREE.Vector2(uvX, uvY),
            intensity: 0.8, // Начальная интенсивность
            timestamp: Date.now()
          };
          
          distortionState.current.cometDistortions.push(distortion);
          
          // Активируем эффект в точке пролета кометы
          activateDistortion(distortion.point);
          
          return true;
        }
      }
    }
    
    return false;
  };
  
  // Настройка текстуры и инициализация
  useEffect(() => {
    if (texture) {
      // Настраиваем параметры текстуры
      texture.needsUpdate = true;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      
      // Включаем прозрачность для png
      texture.premultiplyAlpha = true;
      
      // После загрузки вычисляем пропорции
      if (texture.image) {
        const aspectRatio = texture.image.width / texture.image.height;
        const logoWidth = 10; // Базовая ширина в units
        setDimensions({
          width: logoWidth,
          height: logoWidth / aspectRatio
        });
      }
      
      // Устанавливаем текстуру в шейдер
      if (materialRef.current) {
        materialRef.current.uniforms.map.value = texture;
      }
    }
    
    // Случайно активируем искажение каждые 2-5 секунд для демонстрации
    const intervalId = setInterval(() => {
      activateDistortion();
    }, Math.random() * 3000 + 2000);
    
    return () => clearInterval(intervalId);
  }, [texture]);
  
  // Обновляем эффект каждый кадр и проверяем пролет комет
  useFrame((state, delta) => {
    if (materialRef.current) {
      // Обновляем время для анимации
      materialRef.current.uniforms.time.value += delta;
      
      // Плавно изменяем интенсивность искажения
      const currentIntensity = materialRef.current.uniforms.distortionIntensity.value;
      const targetIntensity = distortionState.current.targetIntensity;
      
      if (Math.abs(currentIntensity - targetIntensity) > 0.01) {
        const newIntensity = THREE.MathUtils.lerp(
          currentIntensity,
          targetIntensity,
          delta * 3.0 // Скорость изменения
        );
        materialRef.current.uniforms.distortionIntensity.value = newIntensity;
      } else {
        materialRef.current.uniforms.distortionIntensity.value = targetIntensity;
      }
      
      // Обновляем точку искажения
      materialRef.current.uniforms.distortionPoint.value.copy(distortionState.current.point);
      
      // Пульсация свечения
      const glowBase = 0.5;
      const glowPulse = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 + glowBase;
      materialRef.current.uniforms.glowIntensity.value = glowPulse;
      
      // Очищаем устаревшие искажения от комет
      const now = Date.now();
      distortionState.current.cometDistortions = distortionState.current.cometDistortions.filter(
        distortion => (now - distortion.timestamp) < 1000
      );
    }
    
    // Поиск видимых комет в сцене и проверка коллизий
    if (meshRef.current) {
      const visibleComets = state.scene.children.filter(
        child => child.userData?.isCometCore || child.name === 'core'
      );
      
      for (const comet of visibleComets) {
        if (comet.visible && comet instanceof THREE.Mesh) {
          const cometPosition = new THREE.Vector3();
          comet.getWorldPosition(cometPosition);
          
          const cometSize = comet.scale.x * 2; // Примерный размер кометы
          const cometId = comet.uuid;
          
          checkCometCollision(cometPosition, cometSize, cometId);
        }
      }
    }
  });
  
  return (
    <group position={[0, 70, 150]}>
      <mesh 
        ref={meshRef}
        castShadow={false}
        receiveShadow={false}
        scale={[-10, 10, 10]} // Увеличенный масштаб, но не слишком большой
        userData={{ isLogo: true }} // Метка, чтобы находить логотип
      >
        <planeGeometry args={[dimensions.width, dimensions.height]} />
        <shaderMaterial 
          ref={materialRef}
          args={[{
            uniforms: LogoShaderMaterial.uniforms,
            vertexShader: LogoShaderMaterial.vertexShader,
            fragmentShader: LogoShaderMaterial.fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
          }]}
        />
      </mesh>
      
      {/* Добавляем свет для дополнительного эффекта свечения */}
      <pointLight 
        position={[0, 0, 5]} 
        color="#00ff83" 
        intensity={10} 
        distance={50} 
        decay={2}
      />
    </group>
  );
};

export default SynthLogo3D; 