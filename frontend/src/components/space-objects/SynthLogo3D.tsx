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
    glowIntensity: { value: 0.5 }, // Интенсивность свечения
    penetrationEffect: { value: 0.0 }, // Новый параметр для эффекта проникновения
    penetrationPoint: { value: new THREE.Vector2(0.5, 0.5) }, // Точка проникновения кометы
    hasTexture: { value: 1.0 }, // Флаг для определения, является ли фрагмент частью текстуры или фоном
    neuroFactor: { value: 0.0 }, // Фактор нейросинтетического эффекта
    rippleIntensity: { value: 1.0 }, // Интенсивность эффекта рябь
    secondaryRippleFactor: { value: 0.0 }, // Фактор вторичной ряби
    pulseFrequency: { value: 1.0 }, // Частота пульсации эффектов
    colorShift: { value: 0.0 } // Параметр для смещения цвета
  },
  vertexShader: `
    uniform float time;
    uniform float distortionIntensity;
    uniform vec2 distortionPoint;
    uniform float penetrationEffect;
    uniform vec2 penetrationPoint;
    uniform float hasTexture;
    uniform float neuroFactor;
    uniform float rippleIntensity;
    uniform float secondaryRippleFactor;
    uniform float pulseFrequency;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    varying float vDistortion;
    varying float vPenetration;
    varying float vHasTexture;
    varying float vNeuroEffect;
    
    // Функция для создания органических волновых паттернов
    float neuroPattern(vec2 uv, float t) {
      // Создаем несколько слоев волн с разными частотами
      float pattern = 0.0;
      pattern += sin(uv.x * 10.0 + t * 0.5) * 0.5 + 0.5;
      pattern *= sin(uv.y * 8.0 - t * 0.4) * 0.5 + 0.5;
      pattern += sin(uv.x * 5.0 + uv.y * 6.0 + t * 0.7) * 0.5 + 0.5;
      return pattern / 3.0; // Нормализуем к диапазону 0-1
    }
    
    void main() {
      vUv = uv;
      vPosition = position;
      vHasTexture = hasTexture;
      
      // Расчет дистанции от вершины до точки искажения
      float dist = distance(uv, distortionPoint);
      
      // Волновой эффект, затухающий с расстоянием
      float waveFactor = (1.0 - smoothstep(0.0, 0.3, dist)) * distortionIntensity;
      
      // Эффект проникновения - более локализованное и сильное искажение
      float penetrationDist = distance(uv, penetrationPoint);
      float penetrationFactor = (1.0 - smoothstep(0.0, 0.15, penetrationDist)) * penetrationEffect;
      
      // Нейросинтетический эффект - органическая рябь по всей поверхности
      float neuroWave = neuroPattern(uv, time) * neuroFactor;
      
      // Высокочастотная рябь с несколькими точками источниками
      float ripplePhase1 = sin(dist * 40.0 - time * 6.0 * pulseFrequency) * 0.5 + 0.5;
      float ripplePhase2 = sin(dist * 30.0 - time * 4.0 * pulseFrequency) * 0.5 + 0.5;
      float ripplePhase3 = sin(penetrationDist * 50.0 - time * 7.0 * pulseFrequency) * 0.5 + 0.5;
      
      // Комбинируем все фазы рябь для создания более сложного паттерна
      float combinedRipple = mix(ripplePhase1, ripplePhase2, 0.5) * 0.7 + ripplePhase3 * 0.3;
      combinedRipple *= rippleIntensity;
      
      // Вторичные ряби с большей частотой для эффекта "живой" поверхности
      float secondaryRipples = sin(uv.x * 40.0 + uv.y * 30.0 + time * 2.0) * 0.5 + 0.5;
      secondaryRipples *= sin(dist * 60.0 - time * 3.0) * 0.5 + 0.5;
      secondaryRipples *= secondaryRippleFactor;
      
      // Передаем значения в фрагментный шейдер
      vDistortion = waveFactor;
      vPenetration = penetrationFactor;
      vNeuroEffect = neuroWave + combinedRipple * 0.2;
      
      // Применяем искажение к вершинам
      vec3 newPosition = position;
      
      if (hasTexture > 0.5) {
        // Базовые искажения от точки волны
        if (waveFactor > 0.0) {
          // Направление искажения от точки
          vec2 direction = normalize(vec2(uv - distortionPoint));
          
          // Волновое искажение в пространстве с увеличенной амплитудой
          float waveAmount = sin(dist * 30.0 - time * 5.0) * 0.15 * waveFactor * rippleIntensity;
          
          // Применяем искажение в направлении нормали
          newPosition.z += waveAmount;
        }
        
        // Добавляем эффект проникновения с более выраженной физической деформацией
        if (penetrationFactor > 0.0) {
          // Создаем эффект "прокола" с более глубоким отверстием
          float centerDepth = -1.2 * penetrationFactor * (1.0 - smoothstep(0.0, 0.04, penetrationDist)) * rippleIntensity;
          
          // Создаем кольцо выпуклости вокруг места проникновения
          float bulgeRing = smoothstep(0.04, 0.07, penetrationDist) * 
                           (1.0 - smoothstep(0.07, 0.2, penetrationDist)) * 
                           0.8 * penetrationFactor * rippleIntensity;
                           
          // Волнистый эффект распространения от точки проникновения
          float waveRipple = sin(penetrationDist * 60.0 - time * 6.0) * 
                             0.2 * penetrationFactor * rippleIntensity * 
                             smoothstep(0.1, 0.3, penetrationDist) * 
                             (1.0 - smoothstep(0.3, 0.7, penetrationDist));
          
          // Комбинированный эффект: глубокая вдавленность в центре, выпуклое кольцо вокруг, расходящиеся волны
          newPosition.z += centerDepth + bulgeRing + waveRipple;
          
          // Добавляем боковое смещение для эффекта расплавления/деформации
          vec2 displacement = normalize(uv - penetrationPoint) * penetrationFactor * 0.04 * 
                             (1.0 - smoothstep(0.0, 0.2, penetrationDist)) * rippleIntensity;
          newPosition.x += displacement.x;
          newPosition.y += displacement.y;
        }
        
        // Добавляем нейросинтетические волны по всей поверхности
        if (neuroFactor > 0.0) {
          // Более плавные органические волны
          float neuroWaveZ = neuroWave * 0.3 * neuroFactor;
          
          // Умножаем на функцию затухания к краям для более гармоничного вида
          float edgeFade = 1.0 - smoothstep(0.6, 0.9, length(uv - vec2(0.5, 0.5)));
          neuroWaveZ *= edgeFade;
          
          newPosition.z += neuroWaveZ;
          
          // Небольшое искажение по X/Y для эффекта органического движения
          newPosition.x += sin(uv.y * 20.0 + time) * 0.01 * neuroFactor;
          newPosition.y += cos(uv.x * 15.0 - time * 0.8) * 0.01 * neuroFactor;
        }
        
        // Добавляем вторичные высокочастотные ряби
        if (secondaryRippleFactor > 0.0) {
          newPosition.z += secondaryRipples * 0.04;
        }
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
    uniform float penetrationEffect;
    uniform vec2 penetrationPoint;
    uniform float hasTexture;
    uniform float neuroFactor;
    uniform float secondaryRippleFactor;
    uniform float pulseFrequency;
    uniform float colorShift;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    varying float vDistortion;
    varying float vPenetration;
    varying float vHasTexture;
    varying float vNeuroEffect;
    
    // Функция для создания динамических цветовых переходов
    vec3 neuroColor(vec3 baseColor, float factor, float t) {
      // Создаем переливающиеся цвета
      vec3 color1 = vec3(0.0, 1.0, 0.8); // Cyan
      vec3 color2 = vec3(0.8, 0.0, 1.0); // Purple
      vec3 color3 = vec3(1.0, 0.3, 0.0); // Orange
      
      // Плавно переходим между цветами
      vec3 shiftedColor = mix(
        mix(color1, color2, sin(t * 0.3) * 0.5 + 0.5),
        color3,
        sin(t * 0.2 + 1.5) * 0.5 + 0.5
      );
      
      // Смешиваем с базовым цветом
      return mix(baseColor, shiftedColor, factor);
    }
    
    void main() {
      // Для фоновой плоскости используем разные параметры
      if (vHasTexture < 0.5) {
        // Фоновая плоскость - полностью непрозрачная, но невидимая
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }
      
      // Расчет дистанции от фрагмента до точки искажения
      float dist = distance(vUv, distortionPoint);
      float penetrationDist = distance(vUv, penetrationPoint);
      
      // Искажаем текстурные координаты для основного эффекта
      vec2 distortedUv = vUv;
      if (vDistortion > 0.0) {
        // Направление от точки искажения
        vec2 direction = normalize(vUv - distortionPoint);
        
        // Волновое искажение текстуры (усилено)
        float waveAmount = sin(dist * 30.0 - time * 5.0) * 0.05 * vDistortion;
        distortedUv = vUv + direction * waveAmount;
      }
      
      // Дополнительное искажение при проникновении
      if (vPenetration > 0.0) {
        vec2 direction = normalize(vUv - penetrationPoint);
        float penetrationWave = sin(penetrationDist * 50.0 - time * 8.0) * 0.08 * vPenetration;
        distortedUv += direction * penetrationWave;
        
        // Добавляем вихревое искажение вокруг точки проникновения
        float angle = atan(direction.y, direction.x);
        float vortexAmount = 0.03 * vPenetration * (1.0 - smoothstep(0.0, 0.2, penetrationDist));
        float vortexAngle = angle + time * 3.0 * vPenetration;
        vec2 vortexOffset = vec2(cos(vortexAngle), sin(vortexAngle)) * vortexAmount;
        distortedUv += vortexOffset;
      }
      
      // Добавляем мелкие искажения от нейросинтетического эффекта
      if (vNeuroEffect > 0.0) {
        float neuroDistortion = vNeuroEffect * 0.03;
        float neuroAngle = time * 0.5 + vUv.x * 10.0 + vUv.y * 8.0;
        distortedUv.x += sin(neuroAngle) * neuroDistortion;
        distortedUv.y += cos(neuroAngle * 0.8) * neuroDistortion;
      }
      
      // Получаем цвет с текстуры
      vec4 texColor = texture2D(map, distortedUv);
      
      // Проверяем, содержит ли текстура что-то в этой точке
      if (texColor.a < 0.01) {
        // Полностью прозрачные части не рендерим
        discard;
      }
      
      // Добавляем свечение при воздействии
      vec3 finalColor = texColor.rgb;
      
      // Базовый эффект свечения
      if (vDistortion > 0.0) {
        // Пульсирующее свечение с более сложным паттерном
        float pulse = 0.5 + 0.3 * sin(time * 10.0 * pulseFrequency) + 0.2 * sin(time * 16.0 * pulseFrequency + 1.3);
        float glowAmount = vDistortion * pulse * glowIntensity * 1.3;
        finalColor += glowColor * glowAmount * texColor.a;
      }
      
      // Специальный эффект для проникновения - более яркое свечение и изменение цвета
      if (vPenetration > 0.0) {
        // Создаем эффект "прожигания" с более интенсивным свечением
        float penetrationPulse = 0.7 + 0.3 * sin(time * 15.0 * pulseFrequency) + 0.2 * sin(time * 25.0 * pulseFrequency);
        float penetrationGlow = vPenetration * penetrationPulse * 2.0;
        
        // Добавляем более яркий цвет вблизи проникновения
        vec3 heatColor = mix(glowColor, vec3(1.0, 1.0, 1.0), vPenetration * 0.6); 
        
        // Смешиваем с альфой для правильной прозрачности
        finalColor += heatColor * penetrationGlow * texColor.a;
        
        // Создаем эффект просвечивания и физического взаимодействия в точке пролета кометы
        if (penetrationDist < 0.05) {
          // В самом центре проникновения создаем "прожженную дыру"
          texColor.a *= max(0.1, 1.0 - vPenetration * 1.8);
          
          // Добавляем яркие края по контуру проникновения для эффекта расплавления
          float edgeIntensity = smoothstep(0.03, 0.05, penetrationDist) * vPenetration * 2.0;
          finalColor += vec3(1.0, 0.7, 0.3) * edgeIntensity * 3.5;
        } else if (penetrationDist < 0.15) {
          // Создаем видимые искажения и волны вокруг точки проникновения
          float distortionRing = sin(penetrationDist * 50.0 - time * 6.0 * pulseFrequency) * 0.5 + 0.5;
          float glowRing = smoothstep(0.05, 0.15, penetrationDist) * vPenetration;
          
          // Более выраженный цветовой эффект
          vec3 ringColor = mix(
            vec3(1.0, 0.5, 0.2), 
            mix(glowColor, vec3(0.2, 0.5, 1.0), sin(time * 2.0) * 0.5 + 0.5), 
            distortionRing
          );
          
          finalColor += ringColor * glowRing * 1.5;
        }
      }
      
      // Добавляем нейросинтетические эффекты цвета
      if (vNeuroEffect > 0.0) {
        // Создаем нейросинтетический эффект свечения
        float neuroPulse = 0.6 + 0.4 * sin(time * 3.0 * pulseFrequency);
        
        // Генерируем переливающийся цвет
        vec3 shiftedColor = neuroColor(glowColor, colorShift, time);
        
        // Применяем эффект к краям и деталям
        float edgeEffect = pow(vNeuroEffect, 1.5) * neuroPulse * 0.8;
        
        // Добавляем к финальному цвету с учетом альфа-канала
        finalColor = mix(finalColor, shiftedColor, edgeEffect * texColor.a);
        
        // Усиливаем свечение особенно по краям
        float edgeFactor = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 2.0) * pow(1.0 - abs(vUv.y - 0.5) * 2.0, 2.0);
        float edgeGlow = (1.0 - edgeFactor) * vNeuroEffect * neuroPulse * 0.3;
        finalColor += shiftedColor * edgeGlow * texColor.a;
      }
      
      // Базовое свечение вдоль краёв с более выраженной пульсацией
      float edgeGlow = 0.4 * sin(time * 0.8 * pulseFrequency) + 0.6;
      finalColor += glowColor * edgeGlow * 0.15 * texColor.a;
      
      // Непрозрачность для всех частей зависит от альфа-канала текстуры
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
  
  // Состояние для плавающей анимации
  const floatingAnimation = useRef({
    originalPosition: new THREE.Vector3(0, 0, 0),
    time: 0,
    speedFactor: Math.random() * 0.5 + 0.5 // Случайная скорость для более органичного движения
  });
  
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
  
  // Функция для проверки пролета кометы через логотип с улучшенным эффектом проникновения
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
    if (distanceToPlane < cometSize * 2.5) { // Увеличиваем радиус проверки для более раннего обнаружения
      // Проверяем, находится ли комета в пределах логотипа (по X и Y)
      const withinX = Math.abs(cometPosition.x - logoPosition.x) < logoHalfWidth * 1.3; // Увеличенный запас
      const withinY = Math.abs(cometPosition.y - logoPosition.y) < logoHalfHeight * 1.3; // Увеличенный запас
      
      if (withinX && withinY) {
        // Конвертируем мировые координаты в UVs (0-1)
        const uvX = ((cometPosition.x - (logoPosition.x - logoHalfWidth)) / dimensions.width);
        const uvY = ((cometPosition.y - (logoPosition.y - logoHalfHeight)) / dimensions.height);
        
        // Проверяем текстуру в этой точке, чтобы убедиться, что мы в пределах видимой части логотипа
        const texturePoint = new THREE.Vector2(uvX, uvY);
        
        // Ищем существующее искажение от этой кометы
        const existing = distortionState.current.cometDistortions.find(d => d.id === cometId);
        
        // Определяем интенсивность эффекта проникновения на основе близости к центру логотипа и скорости кометы
        const distFromCenter = Math.sqrt(
          Math.pow((uvX - 0.5), 2) + 
          Math.pow((uvY - 0.5), 2)
        );
        
        // Более интенсивный эффект для комет ближе к центру
        const centerBoost = 1.0 - Math.min(1.0, distFromCenter * 1.5);
        const penetrationIntensity = 1.2 + centerBoost * 0.5; // Базовое значение 1.2, до 1.7 в центре
        
        if (!existing) {
          const distortion = {
            id: cometId,
            point: new THREE.Vector2(uvX, uvY),
            intensity: penetrationIntensity, // Увеличенная интенсивность
            timestamp: Date.now()
          };
          
          distortionState.current.cometDistortions.push(distortion);
          
          // Активируем эффект проникновения в точке пролета кометы
          if (materialRef.current) {
            // Обновляем точку проникновения
            materialRef.current.uniforms.penetrationPoint.value.set(uvX, uvY);
            // Устанавливаем интенсивность эффекта проникновения
            materialRef.current.uniforms.penetrationEffect.value = penetrationIntensity;
            
            // Также активируем базовое искажение для дополнительного эффекта
            activateDistortion(distortion.point);
          }
          
          // Автоматически снижаем эффект проникновения через некоторое время
          setTimeout(() => {
            if (materialRef.current) {
              // Плавно снижаем эффект
              const startDecay = () => {
                if (materialRef.current) { // Дополнительная проверка materialRef.current внутри функции
                  const currentEffect = materialRef.current.uniforms.penetrationEffect.value;
                  if (currentEffect > 0.05) {
                    materialRef.current.uniforms.penetrationEffect.value = currentEffect * 0.9;
                    setTimeout(startDecay, 50);
                  } else {
                    materialRef.current.uniforms.penetrationEffect.value = 0;
                  }
                }
              };
              startDecay();
            }
          }, 300);
          
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
        materialRef.current.uniforms.hasTexture.value = 1.0; // Устанавливаем флаг для логотипа
      }
    }
    
    // Сохраняем начальную позицию для плавающей анимации
    if (meshRef.current) {
      floatingAnimation.current.originalPosition.copy(meshRef.current.position);
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
      
      // Добавляем плавающую анимацию логотипа
      if (meshRef.current) {
        floatingAnimation.current.time += delta * floatingAnimation.current.speedFactor;
        
        // Плавное волнообразное движение в разных направлениях
        const posX = floatingAnimation.current.originalPosition.x + Math.sin(floatingAnimation.current.time * 0.3) * 1.5;
        const posY = floatingAnimation.current.originalPosition.y + Math.cos(floatingAnimation.current.time * 0.4) * 1.2;
        const posZ = floatingAnimation.current.originalPosition.z + Math.sin(floatingAnimation.current.time * 0.2) * 0.8;
        
        // Плавное вращение для эффекта "живого" объекта
        meshRef.current.rotation.x = Math.sin(floatingAnimation.current.time * 0.15) * 0.04;
        meshRef.current.rotation.y = Math.cos(floatingAnimation.current.time * 0.2) * 0.05;
        
        // Применяем новую позицию
        meshRef.current.position.set(posX, posY, posZ);
      }
      
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
      
      // Обновляем нейросинтетические эффекты
      // Постоянные базовые нейросинтетические волны с переменной интенсивностью
      const baseNeuroFactor = 0.1; // Базовая интенсивность нейросинтетических эффектов
      const neuroTimeFactor = (Math.sin(state.clock.elapsedTime * 0.2) * 0.5 + 0.5) * 0.15; // Вариация по времени
      materialRef.current.uniforms.neuroFactor.value = baseNeuroFactor + neuroTimeFactor;
      
      // Пульсирующая интенсивность ряби
      const baseRipple = 1.0;
      const rippleVariation = Math.sin(state.clock.elapsedTime * 0.3) * 0.15 + 0.85; // 0.7-1.0 диапазон
      materialRef.current.uniforms.rippleIntensity.value = baseRipple * rippleVariation;
      
      // Вторичная рябь активируется периодически с эффектом затухания
      const secondaryRippleCycle = (Math.sin(state.clock.elapsedTime * 0.07) * 0.5 + 0.5) > 0.7;
      if (secondaryRippleCycle) {
        // Если цикл активен, увеличиваем значение
        materialRef.current.uniforms.secondaryRippleFactor.value = 
          Math.min(0.8, materialRef.current.uniforms.secondaryRippleFactor.value + delta * 0.8);
      } else {
        // Если цикл неактивен, уменьшаем значение
        materialRef.current.uniforms.secondaryRippleFactor.value = 
          Math.max(0.0, materialRef.current.uniforms.secondaryRippleFactor.value - delta * 0.4);
      }
      
      // Смещение цвета в нейросинтетическом эффекте
      materialRef.current.uniforms.colorShift.value = Math.sin(state.clock.elapsedTime * 0.1) * 0.3 + 0.5; // 0.2-0.8
      
      // Пульсация частоты эффектов
      materialRef.current.uniforms.pulseFrequency.value = 0.8 + Math.sin(state.clock.elapsedTime * 0.05) * 0.3; // 0.5-1.1
      
      // Пульсация свечения
      const glowBase = 0.5;
      const glowPulse = Math.sin(state.clock.elapsedTime * 0.5) * 0.2 + glowBase;
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
      
      // Усиливаем нейросинтетические эффекты при приближении комет
      let nearbyCometsCount = 0;
      const now = Date.now(); // Определяем now здесь для использования ниже
      
      for (const comet of visibleComets) {
        if (comet.visible && comet instanceof THREE.Mesh) {
          const cometPosition = new THREE.Vector3();
          comet.getWorldPosition(cometPosition);
          
          const cometSize = comet.scale.x * 2; // Примерный размер кометы
          const cometId = comet.uuid;
          
          // Проверяем столкновение для эффекта проникновения
          const collided = checkCometCollision(cometPosition, cometSize, cometId);
          
          // Проверяем близость кометы для нейросинтетических эффектов
          if (!collided && materialRef.current) {
            const logoPosition = new THREE.Vector3();
            meshRef.current.getWorldPosition(logoPosition);
            
            // Если комета находится в пределах увеличенного радиуса, активируем нейроэффект
            const distanceToLogo = cometPosition.distanceTo(logoPosition);
            const proximitySensing = cometSize * 20; // Большой радиус обнаружения
            
            if (distanceToLogo < proximitySensing) {
              // Увеличиваем счетчик ближайших комет
              nearbyCometsCount++;
              
              // Если комета очень близко, активируем небольшую рябь
              if (distanceToLogo < proximitySensing * 0.5 && Math.random() < 0.05) {
                // Создаем эффект "предчувствия" приближения кометы
                // Используем умеренную интенсивность, чтобы не конкурировать с эффектами прямого попадания
                distortionState.current.targetIntensity = Math.random() * 0.2 + 0.1;
                
                // Случайная точка на логотипе, с предпочтением к стороне, с которой приближается комета
                const direction = cometPosition.clone().sub(logoPosition).normalize();
                const side = new THREE.Vector2(
                  0.5 + direction.x * 0.3 + (Math.random() - 0.5) * 0.4,
                  0.5 + direction.y * 0.3 + (Math.random() - 0.5) * 0.4
                );
                distortionState.current.point.copy(side);
                distortionState.current.lastActivated = now;
                
                // Автоматическое выключение эффекта после короткой задержки
                setTimeout(() => {
                  distortionState.current.targetIntensity = 0.0;
                }, Math.random() * 300 + 100);
              }
            }
          }
        }
      }
      
      // Усиливаем нейросинтетические эффекты в зависимости от количества комет рядом
      if (materialRef.current && nearbyCometsCount > 0) {
        // Дополнительно усиливаем базовую нейросинтетическую активность
        const proximityBoost = Math.min(1.0, nearbyCometsCount * 0.15); // Максимум 1.0 при 7+ кометах
        const currentNeuroFactor = materialRef.current.uniforms.neuroFactor.value;
        const baseNeuroFactor = 0.1; // Повторно определяем базовую интенсивность
        
        // Плавно повышаем значение до нового уровня
        materialRef.current.uniforms.neuroFactor.value = 
          THREE.MathUtils.lerp(currentNeuroFactor, baseNeuroFactor + proximityBoost, delta * 2.0);
          
        // Также усиливаем вторичную рябь при приближении комет
        if (nearbyCometsCount >= 3) {
          materialRef.current.uniforms.secondaryRippleFactor.value =
            Math.min(0.8, materialRef.current.uniforms.secondaryRippleFactor.value + delta * 0.5);
        }
      }
    }
  });
  
  return (
    <group position={[0, 40, 100]}>
      {/* Добавляем фоновую плоскость для блокировки комет за логотипом */}
      <mesh 
        position={[0, 0, -0.1]} // Немного позади логотипа
        scale={[50, 50, 50]} // Достаточно большая, чтобы покрыть логотип
      >
        <planeGeometry args={[dimensions.width * 1.2, dimensions.height * 1.2]} />
        <meshBasicMaterial 
          color="#000000"
          transparent={false}
          opacity={1.0}
          depthWrite={true}
          depthTest={true}
          visible={false} // Невидима, но блокирует объекты
        />
      </mesh>
      
      {/* Логотип */}
      <mesh 
        ref={meshRef}
        castShadow={false}
        receiveShadow={false}
        scale={[-10, 10, 10]} 
        userData={{ isLogo: true }}
        renderOrder={1} // Рендеринг после фоновой плоскости
      >
        <planeGeometry args={[dimensions.width, dimensions.height, 32, 32]} />
        <shaderMaterial 
          ref={materialRef}
          args={[{
            uniforms: LogoShaderMaterial.uniforms,
            vertexShader: LogoShaderMaterial.vertexShader,
            fragmentShader: LogoShaderMaterial.fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: true,
            depthTest: true,
            alphaTest: 0.01, // Отбрасываем полностью прозрачные пиксели
            blending: THREE.NormalBlending,
            wireframe: false,
            fog: false,
            dithering: true
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