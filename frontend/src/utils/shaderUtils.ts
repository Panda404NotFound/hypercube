/**
 * shaderUtils.ts
 * 
 * Утилиты для работы с шейдерами в Next.js
 */

// Типы шейдеров - используются только для идентификации
export enum ShaderType {
  COSMIC_BACKGROUND_FRAG = 'cosmicBackgroundFrag',
  HYPERCUBE_FRAG = 'hypercubeFrag',
  HYPERCUBE_VERT = 'hypercubeVert',
  NEON_COMET_FRAG = 'neonCometFrag',
  NEON_COMET_VERT = 'neonCometVert',
  DISTORTION_EFFECT_FRAG = 'distortionEffectFrag',
}

// Для Next.js обычно требуется особая настройка для импорта шейдеров
// Здесь мы используем встроенные строки для шейдеров

// Временное решение - возвращаем встроенные шейдеры
export const getNeonCometVertexShader = (): string => {
  return `
  uniform float uTime;
  uniform float uSpeed;
  
  attribute float size;
  attribute float randomness;
  attribute float particleIndex;
  
  varying vec3 vPosition;
  varying float vParticleIndex;
  varying float vRandomness;
  
  void main() {
      vPosition = position;
      vParticleIndex = particleIndex;
      vRandomness = randomness;
      
      vec3 animated = position;
      
      // Для частиц хвоста добавляем колебания
      if (particleIndex > 0.0) {
          float wave = sin(uTime * (1.0 + randomness) * uSpeed + particleIndex * 5.0) * 0.05;
          animated.x += wave;
          animated.y += wave * 0.8;
      }
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(animated, 1.0);
      gl_PointSize = size * (1.0 - particleIndex * 0.8);
  }
`;
};

export const getNeonCometFragmentShader = (): string => {
  return `
  uniform float uTime;
  uniform vec3 uColorPrimary;
  uniform vec3 uColorSecondary;
  uniform float uGlowStrength;
  
  varying vec3 vPosition;
  varying float vParticleIndex;
  varying float vRandomness;
  
  void main() {
      vec3 baseColor = mix(uColorPrimary, uColorSecondary, vParticleIndex * 0.8);
      
      float dist = length(gl_PointCoord - vec2(0.5));
      float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
      
      // Для ядра и хвоста разная обработка
      if (vParticleIndex < 0.1) {
          // Добавляем пульсацию яркости ядру
          float pulse = (sin(uTime * 2.0) * 0.2 + 0.8) * uGlowStrength;
          baseColor *= 1.5 * pulse;
          
          // Добавляем градиент к ядру
          alpha *= 0.9 + sin(uTime * 3.0) * 0.1;
      } else {
          // Затухание частиц хвоста
          alpha *= 1.0 - vParticleIndex * 0.9;
          
          // Мерцание частиц хвоста
          float flicker = sin(uTime * (10.0 + vRandomness * 5.0)) * 0.5 + 0.5;
          alpha *= 0.5 + flicker * 0.5;
      }
      
      gl_FragColor = vec4(baseColor, alpha);
  }
`;
};

export const getDistortionEffectFragmentShader = (): string => {
  return `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uIntersectionPoint;
  uniform float uIntersectionRadius;
  uniform float uIntersectionStrength;
  uniform vec3 uDistortionColor;
  
  varying vec2 vUv;
  
  void main() {
      vec2 uv = vUv;
      
      // Вычисляем расстояние от текущего пикселя до точки пересечения
      vec2 st = gl_FragCoord.xy / uResolution.xy;
      float distance = length(st - uIntersectionPoint);
      
      // Сила волнового эффекта зависит от расстояния и времени
      float distortionFactor = 0.0;
      if (distance < uIntersectionRadius) {
          // Создаем волны, расходящиеся от центра
          float wave = sin(distance * 40.0 - uTime * 5.0) * 0.5 + 0.5;
          
          // Усиливаем эффект в центре и ослабляем на периферии
          distortionFactor = wave * uIntersectionStrength * (1.0 - distance / uIntersectionRadius);
      }
      
      // Применяем искажение к координатам текстуры
      vec2 distortedUv = uv;
      if (distortionFactor > 0.0) {
          // Волновое искажение от центра
          float angle = atan(st.y - uIntersectionPoint.y, st.x - uIntersectionPoint.x);
          distortedUv.x += cos(angle) * distortionFactor * 0.05;
          distortedUv.y += sin(angle) * distortionFactor * 0.05;
      }
      
      // Получаем цвет из исходной текстуры с искаженными координатами
      vec4 texColor = texture2D(uTexture, distortedUv);
      
      // Добавляем цветовой оттенок в месте искажения
      if (distortionFactor > 0.0) {
          texColor.rgb = mix(texColor.rgb, uDistortionColor, distortionFactor * 0.5);
          
          // Добавляем свечение в центре
          texColor.rgb += uDistortionColor * pow(distortionFactor, 2.0) * 0.5;
      }
      
      gl_FragColor = texColor;
  }
`;
}; 