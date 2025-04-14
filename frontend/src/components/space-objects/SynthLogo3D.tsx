/**
 * SynthLogo3D.tsx
 * 
 * 3D представление логотипа Synth, через который могут проходить космические объекты.
 * Использует текстуру логотипа на плоскости с эффектами свечения и искажения.
 * При пролете кометы через логотип активируется эффект искажения.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
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
    penetrationEffect: { value: 0.0 }, // Параметр для эффекта проникновения
    penetrationPoint: { value: new THREE.Vector2(0.5, 0.5) }, // Точка проникновения кометы
    hasTexture: { value: 1.0 }, // Флаг для определения, является ли фрагмент частью текстуры или фоном
    neuroFactor: { value: 0.0 }, // Фактор нейросинтетического эффекта
    rippleIntensity: { value: 1.0 }, // Интенсивность эффекта рябь
    secondaryRippleFactor: { value: 0.0 }, // Фактор вторичной ряби
    pulseFrequency: { value: 1.0 }, // Частота пульсации эффектов
    colorShift: { value: 0.0 }, // Параметр для смещения цвета
    turbulenceFactor: { value: 0.0 }, // Новый параметр для турбулентности
    multilayerNeuroFactor: { value: 0.0 }, // Фактор многослойных нейросинтетических эффектов
    flowSpeed: { value: 1.0 }, // Скорость течения эффектов
    interactionImpulse: { value: 0.0 }, // Импульс от взаимодействия с объектами
    interactionPoint: { value: new THREE.Vector2(0.5, 0.5) }, // Точка взаимодействия
    fluidDirection: { value: new THREE.Vector2(0, 0) } // Направление потока жидкости
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
    uniform float turbulenceFactor;
    uniform float multilayerNeuroFactor;
    uniform float flowSpeed;
    uniform float interactionImpulse;
    uniform vec2 interactionPoint;
    uniform vec2 fluidDirection;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    varying float vDistortion;
    varying float vPenetration;
    varying float vHasTexture;
    varying float vNeuroEffect;
    varying float vTurbulence;
    varying float vFluidEffect;
    
    // Улучшенная функция для создания органических волновых паттернов
    float neuroPattern(vec2 uv, float t) {
      // Создаем несколько слоев волн с разными частотами и вращением
      float pattern = 0.0;
      
      // Базовые волны
      pattern += sin(uv.x * 10.0 + t * 0.5 * flowSpeed) * 0.5 + 0.5;
      pattern *= sin(uv.y * 8.0 - t * 0.4 * flowSpeed) * 0.5 + 0.5;
      
      // Диагональные волны с вращением
      float angle = t * 0.2;
      vec2 rotatedUV = vec2(
        uv.x * cos(angle) - uv.y * sin(angle),
        uv.x * sin(angle) + uv.y * cos(angle)
      );
      pattern += sin(rotatedUV.x * 12.0 + rotatedUV.y * 6.0 + t * 0.7 * flowSpeed) * 0.5 + 0.5;
      
      // Концентрические круги с пульсацией
      float dist = length(uv - vec2(0.5));
      pattern += sin(dist * 20.0 - t * pulseFrequency) * 0.5 + 0.5;
      
      return pattern / 4.0; // Нормализуем к диапазону 0-1
    }
    
    // Новая функция для многослойных нейросинтетических эффектов
    float multilayerNeuro(vec2 uv, float t) {
      float result = 0.0;
      float amplitude = 1.0;
      float frequency = 1.0;
      
      // Создаем 3 слоя с разными частотами и амплитудами
      for (int i = 0; i < 3; i++) {
        // Смещаем координаты для каждого слоя для создания эффекта течения
        vec2 offsetUV = uv + vec2(t * 0.1 * float(i) * flowSpeed, t * 0.15 * float(i) * flowSpeed);
        
        // Добавляем вихревое смещение
        float vortexAngle = t * 0.2 * flowSpeed + float(i) * 2.0;
        float vortexStrength = 0.05 * (1.0 - float(i) * 0.2);
        offsetUV += vec2(
          sin(vortexAngle) * vortexStrength,
          cos(vortexAngle) * vortexStrength
        ) * (1.0 - length(uv - vec2(0.5)));
        
        // Добавляем слой с уменьшающейся амплитудой и увеличивающейся частотой
        result += neuroPattern(offsetUV * frequency, t) * amplitude;
        
        // Увеличиваем частоту и уменьшаем амплитуду для следующего слоя
        frequency *= 2.0;
        amplitude *= 0.5;
      }
      
      return result;
    }
    
    // Турбулентная функция для создания хаотических движений жидкости
    float turbulence(vec2 uv, float t) {
      float result = 0.0;
      float amplitude = 1.0;
      vec2 shift = vec2(100.0);
      
      // Создаем сложную турбулентность, смешивая несколько слоев шума
      for (int i = 0; i < 4; i++) {
        // Смещаем координаты для эффекта течения
        vec2 p = uv * 5.0 * float(i + 1);
        p += vec2(t * flowSpeed * 0.3 * float(i), t * flowSpeed * 0.2 * float(i + 1));
        
        // Генерируем случайные потоки
        float sx = sin(p.x + t * float(i) * 0.1);
        float sy = sin(p.y + t * float(i + 1) * 0.1);
        float sz = sin(p.x + p.y + t * 0.2);
        
        // Комбинируем потоки для создания сложного паттерна движения
        result += (sx * sy * sz) * amplitude;
        
        // Уменьшаем амплитуду для следующего слоя
        amplitude *= 0.5;
        uv *= 2.0;
      }
      
      return result * 0.5 + 0.5; // Нормализуем к диапазону 0-1
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
      
      // Расчет дистанции от точки взаимодействия для импульсного эффекта
      float interactionDist = distance(uv, interactionPoint);
      float interactionFactor = (1.0 - smoothstep(0.0, 0.4, interactionDist)) * interactionImpulse;
      
      // Нейросинтетический эффект - многослойная органическая рябь по всей поверхности
      float neuroWave = multilayerNeuro(uv, time) * neuroFactor;
      
      // Расчет турбулентности
      float turbulenceWave = turbulence(uv, time) * turbulenceFactor;
      
      // Расчет дополнительных эффектов многослойной нейросинтетики 
      float additionalNeuro = 0.0;
      if (multilayerNeuroFactor > 0.0) {
        additionalNeuro = multilayerNeuro(uv + vec2(time * 0.1, time * -0.15), time * 1.3) * multilayerNeuroFactor;
      }
      
      // Высокочастотная рябь с несколькими точками источниками
      float ripplePhase1 = sin(dist * 40.0 - time * 6.0 * pulseFrequency) * 0.5 + 0.5;
      float ripplePhase2 = sin(dist * 30.0 - time * 4.0 * pulseFrequency) * 0.5 + 0.5;
      float ripplePhase3 = sin(penetrationDist * 50.0 - time * 7.0 * pulseFrequency) * 0.5 + 0.5;
      
      // Дополнительная рябь от точки взаимодействия для эффекта импульса
      float impulseRipple = 0.0;
      if (interactionFactor > 0.0) {
        impulseRipple = sin(interactionDist * 30.0 - time * 5.0 * pulseFrequency) * interactionFactor;
      }
      
      // Комбинируем все фазы рябь для создания более сложного паттерна
      float combinedRipple = mix(ripplePhase1, ripplePhase2, 0.5) * 0.7 + ripplePhase3 * 0.3 + impulseRipple;
      combinedRipple *= rippleIntensity;
      
      // Вторичные ряби с большей частотой для эффекта "живой" поверхности
      float secondaryRipples = sin(uv.x * 40.0 + uv.y * 30.0 + time * 2.0) * 0.5 + 0.5;
      secondaryRipples *= sin(dist * 60.0 - time * 3.0) * 0.5 + 0.5;
      secondaryRipples *= secondaryRippleFactor;
      
      // Передаем значения в фрагментный шейдер
      vDistortion = waveFactor;
      vPenetration = penetrationFactor;
      vNeuroEffect = neuroWave + combinedRipple * 0.2 + additionalNeuro;
      vTurbulence = turbulenceWave;
      vFluidEffect = interactionFactor;
      
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
        
        // Добавляем эффект импульсного физического взаимодействия
        if (interactionFactor > 0.0) {
          // Направление импульса от точки взаимодействия
          vec2 impulseDir = normalize(uv - interactionPoint);
          
          // Создаем эффект импульсной волны
          float impulseWave = sin(interactionDist * 40.0 - time * 8.0) * 
                            0.3 * interactionFactor * 
                            (1.0 - smoothstep(0.0, 0.4, interactionDist));
          
          // Применяем волнообразное движение перпендикулярно поверхности
          newPosition.z += impulseWave;
          
          // Добавляем латеральное смещение для эффекта волны
          vec2 lateralImpulse = impulseDir * interactionFactor * 0.06 * 
                                (1.0 - smoothstep(0.05, 0.4, interactionDist));
          newPosition.x += lateralImpulse.x;
          newPosition.y += lateralImpulse.y;
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
        
        // Добавляем эффекты многослойной нейросинтетики
        if (multilayerNeuroFactor > 0.0) {
          // Создаем дополнительные органические деформации
          float multiNeuroZ = additionalNeuro * 0.25;
          
          // Добавляем интерференцию между слоями для более сложного эффекта
          float interference = sin((uv.x * 15.0 + uv.y * 12.0) * time * 0.05) * 0.5 + 0.5;
          multiNeuroZ *= interference;
          
          newPosition.z += multiNeuroZ;
          
          // Добавляем органические деформации по X/Y с эффектом стекания
          vec2 flowDirection = vec2(
            sin(uv.y * 10.0 + time * 0.7) * 0.02,
            cos(uv.x * 8.0 + time * 0.5) * 0.02
          ) * multilayerNeuroFactor;
          
          newPosition.x += flowDirection.x;
          newPosition.y += flowDirection.y;
        }
        
        // Добавляем турбулентность для создания эффекта жидкой стекающей поверхности
        if (turbulenceFactor > 0.0) {
          // Применяем турбулентность как вертикальное искажение
          float turbZ = turbulenceWave * 0.2 * turbulenceFactor;
          
          // Эффект стекания - более сильное искажение в нижней части
          float drip = smoothstep(0.3, 0.7, uv.y) * turbulenceFactor * 0.15;
          
          // Применяем эффект течения жидкости
          newPosition.z += turbZ;
          
          // Эффект стекания по XY
          newPosition.x += sin(uv.x * 20.0 + time * 1.5) * 0.02 * turbulenceFactor;
          newPosition.y -= drip * (0.5 + 0.5 * sin(uv.x * 15.0 + time));
        }
        
        // Добавляем вторичные высокочастотные ряби
        if (secondaryRippleFactor > 0.0) {
          newPosition.z += secondaryRipples * 0.04;
          
          // Добавляем мелкие искажения по XY для эффекта ряби на поверхности
          float microDisplacement = secondaryRipples * 0.01 * secondaryRippleFactor;
          newPosition.x += sin(uv.y * 80.0 + time * 3.0) * microDisplacement;
          newPosition.y += cos(uv.x * 80.0 + time * 2.5) * microDisplacement;
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
    uniform float turbulenceFactor;
    uniform float multilayerNeuroFactor;
    uniform float flowSpeed;
    uniform float interactionImpulse;
    uniform vec2 interactionPoint;
    uniform vec2 fluidDirection;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    varying float vDistortion;
    varying float vPenetration;
    varying float vHasTexture;
    varying float vNeuroEffect;
    varying float vTurbulence;
    varying float vFluidEffect;
    
    // Улучшенная функция для создания динамических цветовых переходов
    vec3 neuroColor(vec3 baseColor, float factor, float t) {
      // Создаем переливающиеся цвета с большей насыщенностью
      vec3 color1 = vec3(0.0, 1.0, 0.9); // Cyan - более яркий
      vec3 color2 = vec3(0.8, 0.0, 1.0); // Purple
      vec3 color3 = vec3(1.0, 0.4, 0.0); // Orange - более яркий
      vec3 color4 = vec3(0.0, 0.8, 1.0); // Голубой
      
      // Плавно переходим между несколькими цветами для более сложного эффекта
      vec3 shiftedColor1 = mix(
        color1, 
        color2, 
        sin(t * 0.3 * flowSpeed) * 0.5 + 0.5
      );
      
      vec3 shiftedColor2 = mix(
        color3,
        color4,
        sin(t * 0.2 * flowSpeed + 2.0) * 0.5 + 0.5
      );
      
      // Комбинируем два перехода
      vec3 finalColor = mix(
        shiftedColor1,
        shiftedColor2,
        sin(t * 0.15 * flowSpeed + 1.0) * 0.5 + 0.5
      );
      
      // Добавляем периодические вспышки яркости
      float flash = pow(0.5 + 0.5 * sin(t * 0.4 * flowSpeed), 3.0) * 0.3;
      finalColor += vec3(flash);
      
      // Смешиваем с базовым цветом с учетом фактора интенсивности
      return mix(baseColor, finalColor, factor);
    }
    
    // Функция для создания эффекта стекающей жидкости
    vec3 fluidEffect(vec2 uv, vec3 color, float t, float factor) {
      // Направление стекания - преимущественно вниз с небольшими отклонениями по X
      vec2 flowDirection = vec2(
        sin(uv.x * 10.0 + t * 0.3) * 0.2, 
        -1.0 + sin(uv.x * 5.0) * 0.1
      );
      
      // Создаем эффект стекающих капель
      float droplets = 0.0;
      for (int i = 0; i < 3; i++) {
        // Смещаем координаты по направлению стекания
        vec2 dropUV = uv + flowDirection * 0.05 * float(i) * t * 0.1;
        
        // Создаем капли разных размеров
        float size = 0.02 * (1.0 + float(i) * 0.5);
        float noise = sin(dropUV.x * 30.0) * sin(dropUV.y * 20.0 + t);
        
        // Положение капли зависит от времени и позиции
        float dropY = mod(t * (0.1 + float(i) * 0.05) + noise * 0.2 + float(i) * 0.3, 1.0);
        float dropX = mod(dropUV.x * 5.0 + float(i), 1.0);
        
        // Расстояние до центра капли
        vec2 dropCenter = vec2(dropX, dropY);
        float dist = distance(dropUV, dropCenter);
        
        // Формируем каплю
        droplets += smoothstep(size, size * 0.5, dist) * (0.5 + 0.5 * sin(t * 2.0 + float(i)));
      }
      
      // Создаем переливающийся эффект для капель
      vec3 dropColor = neuroColor(color, 0.8, t);
      
      // Смешиваем с основным цветом
      return mix(color, dropColor, droplets * factor);
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
      float interactionDist = distance(vUv, interactionPoint);
      
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
      
      // Добавляем искажение от импульса взаимодействия
      if (vFluidEffect > 0.0) {
        vec2 direction = normalize(vUv - interactionPoint);
        
        // Волна распространяется от точки взаимодействия
        float waveIntensity = sin(interactionDist * 40.0 - time * 6.0) * vFluidEffect * 0.05;
        distortedUv += direction * waveIntensity;
        
        // Добавляем эффект ряби от импульса
        float rippleEffect = sin(interactionDist * 60.0 - time * 10.0) * vFluidEffect * 0.03;
        distortedUv += vec2(
          rippleEffect * sin(time * 2.0),
          rippleEffect * cos(time * 1.5)
        );
      }
      
      // Добавляем мелкие искажения от нейросинтетического эффекта
      if (vNeuroEffect > 0.0) {
        float neuroDistortion = vNeuroEffect * 0.03;
        float neuroAngle = time * 0.5 * flowSpeed + vUv.x * 10.0 + vUv.y * 8.0;
        distortedUv.x += sin(neuroAngle) * neuroDistortion;
        distortedUv.y += cos(neuroAngle * 0.8) * neuroDistortion;
        
        // Добавляем высокочастотные колебания для создания эффекта вибрации
        if (multilayerNeuroFactor > 0.0) {
          float highFreqNoise = sin(vUv.x * 80.0 + vUv.y * 70.0 + time * 20.0) * 0.5 + 0.5;
          distortedUv += vec2(
            sin(time * 15.0) * 0.002 * highFreqNoise * multilayerNeuroFactor,
            cos(time * 12.0) * 0.002 * highFreqNoise * multilayerNeuroFactor
          );
        }
      }
      
      // Добавляем эффект турбулентности для создания стекающих искажений
      if (vTurbulence > 0.0) {
        // Эффект стекания преимущественно вниз
        float flowStrength = vTurbulence * 0.02;
        
        // Искажение координат для создания эффекта стекания жидкости
        distortedUv.y -= flowStrength * (1.0 + sin(vUv.x * 20.0 + time * 2.0) * 0.3);
        distortedUv.x += sin(vUv.y * 15.0 + time) * flowStrength * 0.5;
        
        // Добавляем дополнительное искажение, усиливающееся к низу изображения
        float bottomEffect = smoothstep(0.3, 0.8, vUv.y) * vTurbulence * 0.01;
        distortedUv.x += sin(vUv.y * 30.0 + time * 3.0) * bottomEffect;
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
      
      // Добавляем эффект физического взаимодействия (импульса)
      if (vFluidEffect > 0.0) {
        // Пульсирующее свечение для эффекта импульса
        float impulsePulse = 0.6 + 0.4 * sin(time * 12.0 * pulseFrequency);
        float impulseGlow = vFluidEffect * impulsePulse * 1.5;
        
        // Создаем цвет для импульса - яркий, но отличный от цвета проникновения
        vec3 impulseColor = mix(
          glowColor * 1.2,
          vec3(0.2, 0.8, 1.0),
          sin(time * 3.0) * 0.5 + 0.5
        );
        
        // Добавляем свечение
        finalColor += impulseColor * impulseGlow * texColor.a;
        
        // Эффект волн от импульса
        if (interactionDist < 0.3) {
          float waveEffect = sin(interactionDist * 40.0 - time * 8.0) * 0.5 + 0.5;
          float waveIntensity = (1.0 - smoothstep(0.05, 0.3, interactionDist)) * vFluidEffect;
          finalColor += impulseColor * waveEffect * waveIntensity * texColor.a;
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
      
      // Добавляем эффекты турбулентности и стекания
      if (vTurbulence > 0.0) {
        // Применяем эффект стекающей жидкости
        finalColor = fluidEffect(vUv, finalColor, time, vTurbulence);
        
        // Усиливаем яркость для более заметного эффекта
        float turbPulse = 0.7 + 0.3 * sin(time * 2.0);
        float turbGlow = vTurbulence * turbPulse * 0.5;
        
        // Создаем переливающийся цвет турбулентности
        vec3 turbColor = neuroColor(glowColor, 0.7, time * 0.5);
        
        // Добавляем свечение с затуханием к верхней части
        float verticalFade = smoothstep(0.2, 0.8, vUv.y);
        finalColor += turbColor * turbGlow * verticalFade * texColor.a;
      }
      
      // Добавляем многослойные нейросинтетические эффекты
      if (multilayerNeuroFactor > 0.0) {
        // Создаем сложный переливающийся эффект
        float multiLayerPulse = 0.5 + 0.5 * sin(time * 1.5);
        float layeredEffect = multilayerNeuroFactor * multiLayerPulse;
        
        // Сдвиг цвета с несколькими слоями
        vec3 layer1 = neuroColor(finalColor, 0.6, time);
        vec3 layer2 = neuroColor(layer1, 0.4, time * 1.3);
        
        // Интенсивность эффекта зависит от положения и времени
        float patternIntensity = sin(vUv.x * 20.0 + vUv.y * 15.0 + time * 2.0) * 0.5 + 0.5;
        patternIntensity = pow(patternIntensity, 2.0) * layeredEffect;
        
        // Смешиваем с базовым цветом
        finalColor = mix(finalColor, layer2, patternIntensity * texColor.a);
        
        // Добавляем высокочастотные пульсации для некоторых пикселей
        float microPulse = sin(vUv.x * 100.0 + vUv.y * 120.0 + time * 20.0);
        if (microPulse > 0.8) {
          finalColor += layer2 * 0.2 * multilayerNeuroFactor;
        }
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
      position: THREE.Vector2;
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
  
  // Обработка пролета кометы через логотип
  const handleCometFly = useCallback((position: THREE.Vector3, cometId: string) => {
    if (!meshRef.current || !materialRef.current) return;
    
    // Преобразуем глобальную позицию кометы в локальное пространство логотипа
    const localCometPosition = meshRef.current.worldToLocal(position.clone());
    
    // Проверяем пересечение кометы с логотипом
    // Учитываем, что логотип представляет собой плоскость с малой толщиной в локальных координатах
    const logoBoundingBox = new THREE.Box3(
      new THREE.Vector3(-10, -5, -0.1),
      new THREE.Vector3(10, 5, 0.1)
    );
    
    if (logoBoundingBox.containsPoint(localCometPosition)) {
      // Нормализуем позицию относительно UV координат [0,1]
      const normalizedX = (localCometPosition.x + 10) / 20; // -10 -> 0, 10 -> 1
      const normalizedY = (localCometPosition.y + 5) / 10; // -5 -> 0, 5 -> 1
      
      // Проекция позиции кометы на текстуру логотипа для определения прозрачности в этой точке
      const pixelChecks = [
        { x: normalizedX, y: normalizedY },
        { x: normalizedX + 0.01, y: normalizedY },
        { x: normalizedX - 0.01, y: normalizedY },
        { x: normalizedX, y: normalizedY + 0.01 },
        { x: normalizedX, y: normalizedY - 0.01 }
      ];
      
      // Используем несколько точек для более точной проверки
      let hasCollidedWithLogo = false;
      
      // Для проверки пересечения с непрозрачной частью мы можем использовать шейдер-материал
      // и его текстуру для проверки альфа-канала в точке пересечения
      // Для упрощения мы используем определенные регионы логотипа как непрозрачные
      if (normalizedX > 0.2 && normalizedX < 0.8 && normalizedY > 0.2 && normalizedY < 0.8) {
        // Базовая проверка - есть ли непрозрачная часть в центральной области логотипа
        hasCollidedWithLogo = true;
      }
      
      if (hasCollidedWithLogo) {
        // Рассчитываем глубину проникновения (для localCometPosition.z в диапазоне [-0.1, 0.1])
        // Преобразуем в диапазон [0, 1], где 0 - начало проникновения, 1 - полное проникновение
        const penetrationDepth = Math.min(1.0, Math.max(0.0, 
          (0.1 - Math.abs(localCometPosition.z)) / 0.2
        ));
        
        // Устанавливаем точку искажения в UV координатах
        distortionState.current.point.set(normalizedX, normalizedY);
        
        // Устанавливаем эффект проникновения через униформ, если у нас есть доступ к материалу
        if (materialRef.current) {
            materialRef.current.uniforms.penetrationEffect.value = penetrationDepth;
            materialRef.current.uniforms.penetrationPoint.value.set(normalizedX, normalizedY);
        }
        
        // Усиливаем эффект искажения в зависимости от скорости кометы
        const speedFactor = 0.5; // Фиксированное значение без вектора скорости
        const distortionAmount = Math.min(1.0, 0.3 + speedFactor * 0.7); // От 0.3 до 1.0 в зависимости от скорости
        
        // Сохраняем искажение для этой кометы
        distortionState.current.cometDistortions.push({
          id: cometId,
          position: new THREE.Vector2(normalizedX, normalizedY),
          intensity: distortionAmount,
          timestamp: Date.now()
        });
        
        // Устанавливаем целевую интенсивность искажения
        distortionState.current.targetIntensity = Math.min(
          1.0, // Максимальная интенсивность
          distortionState.current.targetIntensity + distortionAmount * 0.6
        );
        
        // Направление импульса (без вектора скорости используем значение по умолчанию)
        const impactDirection = new THREE.Vector2(0, -1).normalize();
        
        // Обновляем направление потока жидкости в точке удара
        materialRef.current.uniforms.fluidDirection.value.set(
          impactDirection.x * speedFactor * 2.0,
          impactDirection.y * speedFactor * 2.0
        );
        
        // Устанавливаем импульс взаимодействия
        materialRef.current.uniforms.interactionImpulse.value = 
          Math.min(1.0, 0.4 + speedFactor * 0.6); // От 0.4 до 1.0 в зависимости от скорости
        
        // Устанавливаем точку взаимодействия
        materialRef.current.uniforms.interactionPoint.value.set(normalizedX, normalizedY);
        
        // Временно увеличиваем интенсивность нейросинтетического эффекта при столкновении
        materialRef.current.uniforms.neuroFactor.value += penetrationDepth * 0.3;
        
        // Увеличиваем турбулентность при столкновении для эффекта стекания жидкости
        materialRef.current.uniforms.turbulenceFactor.value = 
          Math.min(1.0, materialRef.current.uniforms.turbulenceFactor.value + penetrationDepth * 0.5);
        
        // Активируем вторичную рябь
        materialRef.current.uniforms.secondaryRippleFactor.value = 
          Math.min(1.0, materialRef.current.uniforms.secondaryRippleFactor.value + distortionAmount * 0.7);
      }
    }
  }, []);
  
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
      
      // Обновляем скорость потока эффектов
      const baseFlowSpeed = 1.0;
      const flowVariation = Math.sin(state.clock.elapsedTime * 0.2) * 0.3 + 0.7; // 0.4-1.0
      materialRef.current.uniforms.flowSpeed.value = baseFlowSpeed * flowVariation;
      
      // Обновляем нейросинтетические эффекты
      // Постоянные базовые нейросинтетические волны с переменной интенсивностью
      const baseNeuroFactor = 0.15; // Увеличиваем базовую интенсивность нейросинтетических эффектов
      const neuroTimeFactor = (Math.sin(state.clock.elapsedTime * 0.2) * 0.5 + 0.5) * 0.2; // Вариация по времени
      materialRef.current.uniforms.neuroFactor.value = baseNeuroFactor + neuroTimeFactor;
      
      // Многослойные нейро-эффекты
      const baseMultilayerFactor = 0.2; // Базовое значение для многослойных эффектов
      const multilayerPulse = Math.sin(state.clock.elapsedTime * 0.1) * 0.5 + 0.5;
      materialRef.current.uniforms.multilayerNeuroFactor.value = baseMultilayerFactor * multilayerPulse;
      
      // Обновляем турбулентность - периодические волны турбулентности
      const turbCycle = Math.sin(state.clock.elapsedTime * 0.07) * 0.5 + 0.5;
      if (turbCycle > 0.7) {
        // Если цикл активен, постепенно увеличиваем турбулентность для эффекта стекания
        materialRef.current.uniforms.turbulenceFactor.value = 
          Math.min(0.8, materialRef.current.uniforms.turbulenceFactor.value + delta * 0.3);
      } else {
        // Если цикл неактивен, постепенно уменьшаем турбулентность
        materialRef.current.uniforms.turbulenceFactor.value = 
          Math.max(0.0, materialRef.current.uniforms.turbulenceFactor.value - delta * 0.15);
      }
      
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
      
      // Плавно снижаем импульс взаимодействия
      if (materialRef.current.uniforms.interactionImpulse.value > 0.01) {
        materialRef.current.uniforms.interactionImpulse.value *= 0.95;
      } else {
        materialRef.current.uniforms.interactionImpulse.value = 0;
      }
      
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
          handleCometFly(cometPosition, cometId);
          
          // Проверяем близость кометы для нейросинтетических эффектов
          if (materialRef.current) {
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