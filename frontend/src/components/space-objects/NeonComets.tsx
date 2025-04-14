/**
 * NeonComets.tsx
 * 
 * Неоновые кометы - светящиеся метеориты с длинными хвостами из частиц,
 * оставляющие за собой след из неонового света. Компонент отвечает только
 * за визуализацию, вся логика движения, физики и параметров реализована в WASM модуле.
 */

import { useEffect, useRef, useMemo, createElement } from 'react';
import { useFrame, extend, Object3DNode } from '@react-three/fiber';
import { useGLTF, Trail, PointMaterial, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { ReactThreeFiber } from '@react-three/fiber';

// WASM imports - import default initialization function and specific exports
import wasmInit, { 
  create_space_object_system,
  update_space_object_system,
  spawn_neon_comets,
  process_neon_comet_spawns,
  get_visible_neon_comets
} from '@wasm/hypercube_wasm';

// Создаем кастомный материал для свечения комет
const CometCoreMaterialObj = shaderMaterial(
  {
    time: 0,
    color: new THREE.Color(0.5, 0.8, 1.0),
    secondaryColor: new THREE.Color(0.2, 0.5, 1.0),
    tertiaryColor: new THREE.Color(1.0, 0.2, 0.8),
    glowIntensity: 1.0,
    noiseScale: 2.5,
    pulseSpeed: 3.0,
    flowSpeed: 1.5,
    resolution: new THREE.Vector2(1024, 1024),
    turbulence: 0.8
  },
  // Vertex shader
  `
    uniform float time;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vDisplacement;
    varying vec3 vViewPosition;
    
    // Improved 3D noise function
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      
      // First corner
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      
      // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      
      // Permutations
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
              
      // Gradients: 7x7 points over a square, mapped onto an octahedron
      float n_ = 0.142857142857; // 1.0/7.0
      vec3 ns = n_ * D.wyz - D.xzx;
      
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      
      // Normalise gradients
      vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      
      // Mix final noise value
      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }
    
    // FBM - Fractal Brownian Motion
    float fbm(vec3 x) {
      float v = 0.0;
      float a = 0.5;
      vec3 shift = vec3(100);
      for (int i = 0; i < 5; ++i) {
        v += a * snoise(x);
        x = x * 2.0 + shift;
        a *= 0.5;
      }
      return v;
    }
    
    void main() {
      vPosition = position;
      vNormal = normal;
      vUv = uv;
      
      // Create a complex, layered displacement effect
      float noise1 = snoise(position * noiseScale + vec3(time * 0.2, time * 0.1, time * 0.3));
      float noise2 = snoise(position * noiseScale * 2.0 + vec3(time * -0.1, time * 0.3, time * 0.2) + noise1);
      float noise3 = fbm(position * noiseScale * 0.5 + time * 0.2);
      
      float displacement = noise1 * 0.1 + noise2 * 0.05 + noise3 * 0.1;
      vDisplacement = displacement;
      
      // Apply displacement along normal 
      vec3 newPosition = position + normal * displacement * 0.2;
      
      // Create volcanic cracks effect
      float crackNoise = snoise(position * 10.0 + time * 0.5);
      float crackIntensity = smoothstep(0.6, 0.7, crackNoise) * 0.1;
      newPosition += normal * crackIntensity;
      
      vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
      vViewPosition = -mvPosition.xyz; // View direction for rim lighting
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment shader
  `
    uniform float time;
    uniform vec3 color;
    uniform vec3 secondaryColor;
    uniform vec3 tertiaryColor;
    uniform float glowIntensity;
    uniform float noiseScale;
    uniform float pulseSpeed;
    uniform float flowSpeed;
    
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vDisplacement;
    varying vec3 vViewPosition;
    
    // Cellular noise function - creates Voronoi cell patterns
    vec2 cellular(vec3 P) {
      const float K = 0.142857142857; // 1/7
      const float Ko = 0.428571428571; // 1/2-K/2
      const float K2 = 0.020408163265306; // 1/(7*7)
      const float Kz = 0.166666666667; // 1/6
      const float Kzo = 0.416666666667; // 1/2-1/6*2
      
      vec3 Pi = mod(floor(P), 289.0);
      vec3 Pf = fract(P) - 0.5;
      
      vec3 Pfx = Pf.x + vec3(1.0, 0.0, -1.0);
      vec3 Pfy = Pf.y + vec3(1.0, 0.0, -1.0);
      vec3 Pfz = Pf.z + vec3(1.0, 0.0, -1.0);
      
      vec3 p = vec3(Pi.x + Pi.y*K + Pi.z*Ko);
      vec3 p1 = vec3(p + Pi.y*Kz + Pi.z*Kzo);
      vec3 p2 = vec3(p + Pi.y*Kzo + Pi.z*Kz);
      vec3 p3 = vec3(p + Pi.y*K + Pi.z*K2);
      
      vec3 px = fract(p * K) - Ko;
      vec3 p1x = fract(p1 * K) - Ko;
      vec3 p2x = fract(p2 * K) - Ko;
      vec3 p3x = fract(p3 * K) - Ko;
      
      vec3 py = fract(p * K2) - K2 * 2.0;
      vec3 p1y = fract(p1 * K2) - K2 * 2.0;
      vec3 p2y = fract(p2 * K2) - K2 * 2.0;
      vec3 p3y = fract(p3 * K2) - K2 * 2.0;
      
      vec3 pz = fract(p * K) - Ko;
      vec3 p1z = fract(p1 * K) - Ko;
      vec3 p2z = fract(p2 * K) - Ko;
      vec3 p3z = fract(p3 * K) - Ko;
      
      vec3 ox = floor(p * K) * K + K/2.0;
      vec3 ox1 = floor(p1 * K) * K + K/2.0;
      vec3 ox2 = floor(p2 * K) * K + K/2.0;
      vec3 ox3 = floor(p3 * K) * K + K/2.0;
      
      vec3 oy = floor(p * K2) * K2 + K2/2.0;
      vec3 oy1 = floor(p1 * K2) * K2 + K2/2.0;
      vec3 oy2 = floor(p2 * K2) * K2 + K2/2.0;
      vec3 oy3 = floor(p3 * K2) * K2 + K2/2.0;
      
      vec3 oz = floor(p * K) * K + K/2.0;
      vec3 oz1 = floor(p1 * K) * K + K/2.0;
      vec3 oz2 = floor(p2 * K) * K + K/2.0;
      vec3 oz3 = floor(p3 * K) * K + K/2.0;
      
      vec3 dx = Pfx + ox;
      vec3 dx1 = Pfx + ox1;
      vec3 dx2 = Pfx + ox2;
      vec3 dx3 = Pfx + ox3;
      
      vec3 dy = Pfy + oy;
      vec3 dy1 = Pfy + oy1;
      vec3 dy2 = Pfy + oy2;
      vec3 dy3 = Pfy + oy3;
      
      vec3 dz = Pfz + oz;
      vec3 dz1 = Pfz + oz1;
      vec3 dz2 = Pfz + oz2;
      vec3 dz3 = Pfz + oz3;
      
      vec3 d = dx * dx + dy * dy + dz * dz;
      vec3 d1 = dx1 * dx1 + dy1 * dy1 + dz1 * dz1;
      vec3 d2 = dx2 * dx2 + dy2 * dy2 + dz2 * dz2;
      vec3 d3 = dx3 * dx3 + dy3 * dy3 + dz3 * dz3;
      
      vec3 d1a = min(d, d1);
      d = min(d1a, d2);
      d1 = min(d1a, d2);
      d2 = min(min(d2, d1), d3);
      d = min(d, d2);
      
      d.xy = (d.x < d.y) ? d.xy : d.yx;
      d.xz = (d.x < d.z) ? d.xz : d.zx;
      d = min(d, vec3(d.y));
      d.y = min(d.y, d.z);
      
      return sqrt(d.xy);
    }
    
    // Wave function for flowing lava/plasma effect
    float waves(vec3 p, float frequency, float speed) {
      return sin(p.x * frequency + time * speed) * sin(p.y * frequency + time * speed) * sin(p.z * frequency + time * speed * 0.5);
    }
    
    void main() {
      // Calculate rim lighting for a glowing edge
      vec3 viewDirection = normalize(vViewPosition);
      float rimFactor = 1.0 - max(0.0, dot(normalize(vNormal), viewDirection));
      rimFactor = pow(rimFactor, 3.0) * glowIntensity;
      
      // Dynamic pulsation with multiple frequencies
      float pulse1 = 0.5 + 0.5 * sin(time * pulseSpeed);
      float pulse2 = 0.5 + 0.5 * sin(time * pulseSpeed * 0.7 + 1.3);
      float pulseComplex = mix(pulse1, pulse2, 0.5 + 0.5 * sin(time * 0.5));
      
      // Cellular noise for a more interesting pattern
      vec2 cellNoise = cellular(vPosition * noiseScale + time * flowSpeed * 0.1);
      float cellPattern = smoothstep(0.0, 0.8, 0.8 - cellNoise.x);
      
      // Lava flow effect with waves
      float lavaFlow = waves(vPosition, 4.0, flowSpeed * 0.2) * 0.5 + 0.5;
      lavaFlow = pow(lavaFlow, 2.0) * 0.8;
      
      // Dynamic color shifts with 3 colors
      vec3 baseColor = mix(color, secondaryColor, vDisplacement * 2.0 + 0.5);
      baseColor = mix(baseColor, tertiaryColor, lavaFlow);
      
      // Mix in the cell pattern with a pulsing glow
      vec3 cellColor = mix(tertiaryColor * 1.2, color * 1.5, cellPattern);
      baseColor = mix(baseColor, cellColor, cellPattern * pulseComplex * 0.7);
      
      // Create "cracks" in the core that glow brighter
      float crackPattern = smoothstep(0.5, 0.55, cellNoise.y) * smoothstep(0.65, 0.6, cellNoise.y);
      vec3 crackColor = tertiaryColor * 2.0;
      baseColor = mix(baseColor, crackColor, crackPattern * pulse2);
      
      // Apply rim glow and pulse
      vec3 finalColor = mix(baseColor, color * 2.0, rimFactor) * (0.8 + pulseComplex * 0.4);
      
      // Add volcanic hotspots and embers
      float hotspots = smoothstep(0.75, 0.8, cellNoise.y) * pulseComplex;
      finalColor += vec3(1.0, 0.7, 0.5) * hotspots * 2.0;
      
      // Add sparkles for a starry effect
      float sparkle = step(0.98, fract(sin(dot(vUv + time * 0.1, vec2(12.9898, 78.233))) * 43758.5453));
      finalColor += vec3(1.0) * sparkle * pulseComplex * 3.0;
      
      // Final intensity adjustment based on turbulence
      finalColor *= 1.0 + turbulence * vDisplacement;
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

// Type augmentation for shader material
type CometCoreMaterialType = {
  time: number;
  color: THREE.Color;
  glowIntensity: number;
  noiseScale: number;
  pulseSpeed: number;
  flowSpeed: number;
};

// Get shader source from the material object with type assertion
const CometCoreMaterial = {
  defaultValues: {
    time: 0,
    color: new THREE.Color(0.5, 0.8, 1.0),
    glowIntensity: 1.0,
    noiseScale: 2.5,
    pulseSpeed: 3.0,
    flowSpeed: 1.5
  },
  shader: {
    // Use type assertion to access the shader source
    vertexShader: (CometCoreMaterialObj as any).vertexShader,
    fragmentShader: (CometCoreMaterialObj as any).fragmentShader
  }
};

// Register the custom shader material
extend({ CometCoreMaterial: CometCoreMaterialObj });

/**
 * Новый материал для частиц хвоста кометы с продвинутыми эффектами
 */
const CometTrailMaterial = shaderMaterial(
  {
    time: 0,
    color: new THREE.Color(0.5, 0.8, 1.0),
    secondaryColor: new THREE.Color(0.2, 0.5, 1.0),
    size: 0.1,
    opacity: 1.0,
    length: 1.0,
    speed: 1.0,
    resolution: new THREE.Vector2(1024, 1024),
    turbulence: 0.8
  },
  // Vertex shader
  `
    uniform float time;
    uniform float size;
    uniform float length;
    uniform float speed;
    uniform float turbulence;
    
    attribute float aSize;
    attribute float aProgress;
    attribute vec3 aColor;
    
    varying vec3 vColor;
    varying float vProgress;
    
    // Basic noise function
    float hash(vec3 p) {
      p = fract(p * vec3(443.897, 441.423, 437.195));
      p += dot(p, p.yxz + 19.19);
      return fract((p.x + p.y) * p.z);
    }
    
    // Improved turbulence function
    float turbulence3D(vec3 p, float frequency, float lacunarity, float gain, int octaves) {
      float sum = 0.0;
      float amplitude = 1.0;
      float scale = frequency;
      
      for(int i = 0; i < octaves; i++) {
        float noise = hash(p * scale);
        sum += (noise - 0.5) * 2.0 * amplitude;
        amplitude *= gain;
        scale *= lacunarity;
      }
      
      return sum;
    }
    
    void main() {
      vColor = aColor;
      vProgress = aProgress;
      
      // Calculate position with turbulence
      vec3 pos = position;
      
      // Add spiral movement based on progress
      float angle = aProgress * 10.0 + time * speed;
      float radius = (1.0 - aProgress) * turbulence * 0.3;
      float spiralX = cos(angle) * radius;
      float spiralY = sin(angle) * radius;
      
      // Apply turbulence to make more chaotic trails
      float turb = turbulence3D(pos * 5.0 + time * 0.1, 1.0, 2.0, 0.5, 3) * (1.0 - aProgress);
      
      // Position particles along the trail with proper falloff
      pos.x += spiralX + turb * 0.3;
      pos.y += spiralY + turb * 0.3;
      pos.z -= aProgress * length; // Trail extends backward
      
      // Gradually make particles smaller toward the end of the trail
      float particleSize = size * aSize * (1.0 - aProgress * 0.7);
      
      // Project the point
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Set the point size
      gl_PointSize = particleSize * (300.0 / -mvPosition.z);
    }
  `,
  // Fragment shader
  `
    uniform float time;
    uniform vec3 color;
    uniform vec3 secondaryColor;
    uniform float opacity;
    
    varying vec3 vColor;
    varying float vProgress;
    
    void main() {
      // Calculate a softer, more organic particle shape
      vec2 uv = gl_PointCoord * 2.0 - 1.0;
      float distSq = dot(uv, uv);
      float falloff = smoothstep(1.0, 0.2, distSq);
      
      // Add a soft glow and pulsation
      float glow = exp(-distSq * 2.0) * 0.5 + 0.5;
      float pulse = 0.9 + 0.1 * sin(time * 5.0 + vProgress * 20.0);
      glow *= pulse;
      
      // Calculate different falloff rates based on distance
      float innerGlow = exp(-distSq * 4.0);
      
      // Mix colors for trail effect - brighter at the beginning, fainter at end
      vec3 trailColor = mix(mix(vColor, color, 0.5), secondaryColor, vProgress);
      trailColor = mix(trailColor, color * 2.0, innerGlow);
      
      // Fade out toward the end of the trail
      float finalOpacity = opacity * falloff * (1.0 - pow(vProgress, 0.5));
      
      // Add fading out
      if (distSq > 1.0) {
        discard;
      }
      
      gl_FragColor = vec4(trailColor, finalOpacity);
    }
  `
);

// Register custom materials
extend({ CometTrailMaterial });

/**
 * Generates randomized comet geometries with unique shapes
 * @param seed A seed value to ensure consistent randomization for the same comet ID
 * @returns Object containing different geometries for comet parts
 */
const generateCometGeometries = (seed: number = Math.random()) => {
  // Use the seed to generate consistent random values
  const random = (min: number, max: number) => min + (max - min) * ((Math.sin(seed * 10000 + 1000) * 0.5 + 0.5) % 1);
  const random2 = (min: number, max: number) => min + (max - min) * ((Math.cos(seed * 5000 + 2000) * 0.5 + 0.5) % 1);
  
  // ================ ЯДРО КОМЕТЫ ================
  // Создаем основу для ядра с одной из нескольких возможных форм
  let core;
  const coreType = Math.floor(random(0, 5));
  
  switch(coreType) {
    case 0:
      // Сложная кристаллическая форма (икосаэдр высокой детализации)
      core = new THREE.IcosahedronGeometry(0.5, Math.floor(random(2, 5)));
      break;
    case 1:
      // Агрегат додекаэдров для каменистой структуры
      core = new THREE.DodecahedronGeometry(0.5, Math.floor(random(1, 3)));
      break;
    case 2:
      // Октаэдр для угловатой кристаллической структуры
      core = new THREE.OctahedronGeometry(0.5, Math.floor(random(1, 3)));
      break;
    case 3:
      // Тетраэдр для очень резкой формы
      core = new THREE.TetrahedronGeometry(0.6, Math.floor(random(1, 3)));
      break;
    default:
      // Сфера с искажениями для органической формы
      core = new THREE.SphereGeometry(0.5, 32, 32);
  }
  
  // Применяем уникальные деформации к вершинам
  const corePositions = core.attributes.position;
  for (let i = 0; i < corePositions.count; i++) {
    const x = corePositions.getX(i);
    const y = corePositions.getY(i);
    const z = corePositions.getZ(i);
    
    // Получаем базовое направление вершины
    const length = Math.sqrt(x*x + y*y + z*z);
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;
    
    // Создаем уникальные деформации для этой кометы
    // Используем несколько слоев шума на разных частотах
    const noise1 = Math.sin(nx * 5 + seed) * Math.cos(ny * 7 + seed * 2) * Math.sin(nz * 3 + seed * 3) * 0.2;
    const noise2 = Math.cos(nx * 13 + seed * 4) * Math.sin(ny * 9 + seed * 5) * Math.cos(nz * 11 + seed * 6) * 0.1;
    const noise3 = Math.sin(nx * 23 + seed * 7) * Math.sin(ny * 29 + seed * 8) * Math.sin(nz * 31 + seed * 9) * 0.05;
    
    const totalNoise = (noise1 + noise2 + noise3);
    
    // Усиливаем деформации в зависимости от типа кометы
    const distortionFactor = random(0.3, 1.2);
    
    // Добавляем некоторые шипы или кристаллические выступы
    const spikiness = random(0, 0.8);
    const spikeThreshold = 0.85;
    const spike = (Math.abs(noise1) > spikeThreshold) ? 
      Math.pow(Math.abs(noise1), 3) * spikiness : 0;
    
    // Применяем все деформации
    const finalDisplacement = totalNoise * distortionFactor + spike;
    
    corePositions.setXYZ(
      i,
      x * (1.0 + finalDisplacement),
      y * (1.0 + finalDisplacement),
      z * (1.0 + finalDisplacement)
    );
  }
  
  // Вычисляем правильные нормали для освещения
  core.computeVertexNormals();
  
  // ================ КОМА (ОБЛАКО ВОКРУГ ЯДРА) ================
  // Добавляем атмосферу вокруг ядра с уникальной формой
  const comaRadius = random(0.7, 1.3);
  const comaDetail = Math.floor(random(32, 64)); // Более высокая детализация для гладкости
  const coma = new THREE.SphereGeometry(comaRadius, comaDetail, comaDetail);
  
  // Делаем форму комы уникальной, но близкой к ядру кометы
  const comaPositions = coma.attributes.position;
  for (let i = 0; i < comaPositions.count; i++) {
    const x = comaPositions.getX(i);
    const y = comaPositions.getY(i);
    const z = comaPositions.getZ(i);
    
    // Получаем базовое направление вершины
    const length = Math.sqrt(x*x + y*y + z*z);
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;
    
    // Деформации более мягкие, чем у ядра
    const noise1 = Math.sin(nx * 4 + seed) * Math.cos(ny * 5 + seed * 2) * Math.sin(nz * 3 + seed * 3) * 0.15;
    const noise2 = Math.cos(nx * 8 + seed * 4) * Math.sin(ny * 7 + seed * 5) * Math.cos(nz * 9 + seed * 6) * 0.07;
    
    // Применяем более мягкие деформации
    const totalNoise = (noise1 + noise2) * 0.7;
    
    // Удлиняем кому в направлении движения (противоположном хвосту)
    const stretchFactor = random(0.1, 0.4);
    const stretchZ = nz > 0 ? nz * stretchFactor : 0;
    
    comaPositions.setXYZ(
      i,
      x * (1.0 + totalNoise),
      y * (1.0 + totalNoise),
      z * (1.0 + totalNoise + stretchZ)
    );
  }
  
  coma.computeVertexNormals();
  
  // ================ ХВОСТ КОМЕТЫ ================
  // Создаем более сложную геометрию хвоста
  const tailLength = random(2.5, 4.0);
  const tailWidth = random(0.5, 0.8);
  const tailSegmentsRadial = Math.floor(random(12, 24));
  const tailSegmentsLength = Math.floor(random(8, 16));
  
  // Кривизна хвоста
  const curvature = random(-0.3, 0.3);
  
  // Создаем хвост как конус с искривлением
  const tailGeometry = new THREE.BufferGeometry();
  const tailVertices = [];
  const tailUVs = [];
  const tailIndices = [];
  
  // Создаем вершины для криволинейного конуса
  for (let i = 0; i <= tailSegmentsLength; i++) {
    const z = -(i / tailSegmentsLength) * tailLength;
    // Радиус уменьшается нелинейно к концу хвоста
    const segmentRadius = tailWidth * Math.pow(1 - i / tailSegmentsLength, 0.7);
    
    // Искривление хвоста (квадратичная функция)
    const bendX = curvature * z * z;
    
    for (let j = 0; j <= tailSegmentsRadial; j++) {
      const theta = (j / tailSegmentsRadial) * Math.PI * 2;
      const x = segmentRadius * Math.cos(theta) + bendX;
      const y = segmentRadius * Math.sin(theta);
      
      // Добавляем вариации к форме хвоста
      const distortion = 1.0 + 0.1 * Math.sin(theta * 5 + i) * random2(0.8, 1.2);
      
      tailVertices.push(x * distortion, y * distortion, z);
      tailUVs.push(j / tailSegmentsRadial, i / tailSegmentsLength);
    }
  }
  
  // Создаем индексы треугольников
  for (let i = 0; i < tailSegmentsLength; i++) {
    const baseIndex = i * (tailSegmentsRadial + 1);
    for (let j = 0; j < tailSegmentsRadial; j++) {
      const a = baseIndex + j;
      const b = baseIndex + j + 1;
      const c = baseIndex + j + tailSegmentsRadial + 1;
      const d = baseIndex + j + tailSegmentsRadial + 2;
      
      tailIndices.push(a, b, c);
      tailIndices.push(c, b, d);
    }
  }
  
  // Задаем буферы для геометрии
  tailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tailVertices, 3));
  tailGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(tailUVs, 2));
  tailGeometry.setIndex(tailIndices);
  tailGeometry.computeVertexNormals();
  
  // ================ ЧАСТИЦЫ ХВОСТА ================
  // Создаем систему частиц для хвоста кометы
  const particles = new THREE.BufferGeometry();
  const particleCount = Math.floor(random(1500, 3000)); // Увеличиваем количество частиц
  
  // Буферы для частиц
  const positions = new Float32Array(particleCount * 3);
  const particleSizes = new Float32Array(particleCount);
  const particleColors = new Float32Array(particleCount * 3);
  const particleProgress = new Float32Array(particleCount);
  
  // Генерируем цветовую схему для частиц
  const baseHue = random(0, 1); // Выбираем базовый цвет в HSL
  const colorVariation = random(0.05, 0.2); // Вариации цвета
  
  // Вспомогательная функция HSL -> RGB
  const hslToRgb = (h: number, s: number, l: number) => {
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return [r, g, b];
  };
  
  for (let i = 0; i < particleCount; i++) {
    // Расположение частиц в конической форме хвоста
    const progress = Math.pow(random(0, 1), 0.5); // Для большей плотности частиц ближе к ядру
    const angle = random(0, Math.PI * 2);
    const radiusFactor = Math.pow(random(0, 1), 0.6); // Концентрация по центру
    
    // Базовый радиус уменьшается к концу хвоста
    const radius = tailWidth * (1 - progress * 0.7) * radiusFactor;
    
    // Добавляем спиральность структуры хвоста
    const spiralFactor = progress * 5.0 * random(0.8, 1.2);
    const spiralX = Math.cos(angle + spiralFactor) * radius;
    const spiralY = Math.sin(angle + spiralFactor) * radius;
    
    // Добавляем искривление хвоста
    const tailCurvature = curvature * Math.pow(progress, 2) * tailLength;
    
    // Финальное положение частицы
    positions[i * 3] = spiralX + tailCurvature;
    positions[i * 3 + 1] = spiralY;
    positions[i * 3 + 2] = -progress * tailLength; // Хвост направлен назад
    
    // Размер частиц зависит от их места в хвосте
    particleSizes[i] = random(0.05, 0.25) * (1 - progress * 0.7);
    
    // Сохраняем прогресс для использования в шейдере
    particleProgress[i] = progress;
    
    // Генерируем цвета с небольшими вариациями, основанными на базовом цвете
    // Частицы ближе к ядру более яркие, к концу хвоста - приглушенные
    const saturation = 0.8 - progress * 0.3; // Насыщенность уменьшается к концу хвоста
    const lightness = 0.6 - progress * 0.3;  // Яркость уменьшается к концу хвоста
    const hueVariation = (random(-colorVariation, colorVariation) + baseHue) % 1.0;
    
    const [r, g, b] = hslToRgb(hueVariation, saturation, lightness);
    
    particleColors[i * 3] = r;
    particleColors[i * 3 + 1] = g;
    particleColors[i * 3 + 2] = b;
  }
  
  // Устанавливаем атрибуты в буферную геометрию
  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particles.setAttribute('aSize', new THREE.BufferAttribute(particleSizes, 1));
  particles.setAttribute('aProgress', new THREE.BufferAttribute(particleProgress, 1));
  particles.setAttribute('aColor', new THREE.BufferAttribute(particleColors, 3));
  
  return { core, coma, tail: tailGeometry, particles };
};

/**
 * Custom digital fire trail material for comet tails
 * Creates a flowing, digital-style fiery tail effect
 */
const DigitalFireTrailMaterial = shaderMaterial(
  {
    time: 0,
    color: new THREE.Color(0.5, 0.8, 1.0),
    length: 1.0,
    width: 0.5,
    opacity: 1.0,
    noiseScale: 3.0,
    flowSpeed: 2.0
  },
  // Vertex shader
  `
    uniform float time;
    uniform float length;
    uniform float width;
    
    attribute float position2;
    attribute float progress;
    
    varying vec2 vUv;
    varying float vProgress;
    
    void main() {
      vUv = uv;
      vProgress = progress;
      
      // Calculate the position for a point on the trail
      vec3 pos = position;
      
      // Add some oscillation to the path
      float oscFreq = 8.0;
      float oscAmp = width * 0.2 * (1.0 - progress); // Amplitude decreases along trail
      pos.x += sin(time * 3.0 + progress * oscFreq) * oscAmp;
      pos.y += cos(time * 2.5 + progress * oscFreq * 0.8) * oscAmp;
      
      // Add variation in the z-axis for more 3D feel
      pos.z -= progress * length; // Extend the trail backward
      
      // Make the trail narrow toward the end
      float scale = mix(1.0, 0.1, pow(progress, 0.7));
      pos.xy *= scale;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  // Fragment shader
  `
    uniform float time;
    uniform vec3 color;
    uniform float opacity;
    uniform float noiseScale;
    uniform float flowSpeed;
    
    varying vec2 vUv;
    varying float vProgress;
    
    // Hash function to create pseudo-random values
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    
    // Digital noise pattern
    float digitalNoise(vec2 uv) {
      vec2 grid = floor(uv * 20.0);
      float h = hash(grid);
      return h;
    }
    
    // Flow noise for the trail
    float flowNoise(vec2 uv, float speed) {
      float noise = 0.0;
      
      // Flow direction influenced by time
      vec2 flow = vec2(time * speed, time * speed * 0.5);
      
      // Layer different noise patterns
      for (int i = 0; i < 3; i++) {
        float scale = pow(2.0, float(i));
        vec2 gridUv = (uv + flow * (0.3 + 0.2 * float(i))) * scale * noiseScale;
        noise += digitalNoise(gridUv) * (1.0 / scale);
      }
      
      return noise;
    }
    
    void main() {
      // Create a base gradient for the trail that fades out
      float trail = 1.0 - pow(vProgress, 0.5);
      
      // Apply digital flame effect
      float noise = flowNoise(vec2(vUv.x, vUv.y + vProgress), flowSpeed);
      
      // Create pulsating fiery patterns
      float firePattern = smoothstep(0.3 + 0.1 * sin(time * 3.0), 0.7, noise);
      
      // Edge highlights
      float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
      edge *= smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
      
      // Northern lights ripple effect
      float ripple = sin(vUv.y * 15.0 + time * 5.0 + noise * 5.0) * 0.5 + 0.5;
      ripple = smoothstep(0.3, 0.7, ripple) * 0.5;
      
      // Digital scanlines
      float scanline = step(0.5, fract(vUv.y * 20.0 + time));
      
      // Mix colors to create a fiery digital flow
      vec3 trailColor = mix(color, vec3(1.0, 0.7, 0.5), vProgress * 0.7);
      vec3 fireColor = mix(trailColor, vec3(1.0), firePattern * 0.7);
      fireColor += vec3(0.1, 0.5, 1.0) * ripple; // Add northern lights blue/cyan highlights
      
      // Add digital grid pattern
      float grid = step(0.9, fract(vUv.x * 20.0)) + step(0.9, fract(vUv.y * 20.0));
      fireColor += vec3(0.5, 1.0, 0.8) * grid * (1.0 - vProgress);
      
      // Apply scanlines for digital effect
      fireColor *= mix(0.8, 1.0, scanline);
      
      // Calculate final opacity with edge fade
      float finalOpacity = trail * opacity * edge;
      
      // Cut off the trail at a certain point
      if (vProgress > 0.99) {
        finalOpacity = 0.0;
      }
      
      // Add flickering
      finalOpacity *= 0.9 + 0.1 * sin(time * 20.0 + vProgress * 10.0);
      
      gl_FragColor = vec4(fireColor, finalOpacity);
    }
  `
);

// Register custom materials
extend({ DigitalFireTrailMaterial });

/**
 * Renders a digital fire trail behind a comet
 */
type DigitalFireTrailProps = {
  width?: number;
  length?: number;
  color?: THREE.Color;
  segments?: number;
  opacity?: number;
  flowSpeed?: number;
  noiseScale?: number;
  target?: THREE.Object3D | THREE.Group | null;
}

type DigitalFireTrailMaterialImpl = {
  time: number;
  color: THREE.Color;
  length: number;
  width: number;
  opacity: number;
  noiseScale: number;
  flowSpeed: number;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      digitalFireTrailMaterial: Object3DNode<
        THREE.ShaderMaterial, 
        {
          ref?: React.RefObject<THREE.ShaderMaterial & DigitalFireTrailMaterialImpl>;
          transparent?: boolean;
          depthWrite?: boolean;
          blending?: THREE.Blending;
          color?: THREE.Color;
          length?: number;
          width?: number;
          opacity?: number;
          noiseScale?: number;
          flowSpeed?: number;
        }
      >;
      cometCoreMaterial: Object3DNode<
        THREE.ShaderMaterial,
        {
          ref?: React.RefObject<THREE.ShaderMaterial & CometCoreMaterialType>;
          transparent?: boolean;
          depthWrite?: boolean;
          blending?: THREE.Blending;
          color?: THREE.Color;
          glowIntensity?: number;
          noiseScale?: number;
          pulseSpeed?: number;
          flowSpeed?: number;
        }
      >;
    }
  }
}

const DigitalFireTrail = ({ 
  width = 0.5, 
  length = 3.0, 
  color = new THREE.Color(0.5, 0.8, 1.0),
  segments = 30, 
  opacity = 1.0,
  flowSpeed = 2.0,
  noiseScale = 3.0,
  target
}: DigitalFireTrailProps) => {
  const materialRef = useRef<THREE.ShaderMaterial & DigitalFireTrailMaterialImpl>(null);
  const trailLength = segments;
  
  const positions = useMemo(() => {
    const positions = [];
    for (let i = 0; i < trailLength; i++) {
      positions.push(0, 0, 0);
    }
    return new Float32Array(positions);
  }, [trailLength]);
  
  const progress = useMemo(() => {
    const values = [];
    for (let i = 0; i < trailLength; i++) {
      values.push(i / (trailLength - 1));
    }
    return new Float32Array(values);
  }, [trailLength]);
  
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.time = clock.getElapsedTime();
    }
  });
  
  return (
    <mesh>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={trailLength}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-progress"
          count={trailLength}
          array={progress}
          itemSize={1}
        />
      </bufferGeometry>
      <digitalFireTrailMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        {...{
          color,
          length,
          width,
          opacity,
          noiseScale,
          flowSpeed
        } as any}
      />
    </mesh>
  );
};

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
  
  // Store our randomly generated geometries by comet ID
  const geometryCache = useRef<Map<number, ReturnType<typeof generateCometGeometries>>>(new Map());
  
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
                  // Generate or retrieve unique geometries for this comet
                  if (!geometryCache.current.has(id)) {
                    // Create randomized geometries for this comet based on its ID
                    geometryCache.current.set(id, generateCometGeometries(id));
                  }
                  const cometGeometries = geometryCache.current.get(id)!;
                  
                  // Создаем новую комету
                  cometObj = new THREE.Group();
                  cometObj.userData.id = id;
                  
                  // Создаем ядро кометы с более красивым пульсирующим материалом
                  const core = new THREE.Mesh(
                    cometGeometries.core,
                    new THREE.MeshStandardMaterial({
                      emissive: new THREE.Color(r, g, b),
                      emissiveIntensity: 1.0,
                      roughness: 0.2,
                      metalness: 0.8,
                      transparent: true,
                      depthWrite: false,
                      blending: THREE.AdditiveBlending
                    })
                  );
                  core.name = 'core';
                  core.renderOrder = 1;
                  core.userData.isCometCore = true;
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
                      depthWrite: false
                    })
                  );
                  coma.name = 'coma';
                  coma.renderOrder = 2;
                  cometObj.add(coma);
                  
                  // Добавляем хвост с улучшенным эффектом
                  const tail = new THREE.Mesh(
                    cometGeometries.tail,
                    new THREE.MeshBasicMaterial({
                      color: new THREE.Color(r, g, b),
                      transparent: true,
                      opacity: 0.3,
                      blending: THREE.AdditiveBlending,
                      side: THREE.DoubleSide,
                      depthWrite: false
                    })
                  );
                  tail.name = 'tail';
                  tail.renderOrder = 3;
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
                      depthWrite: false,
                      vertexColors: true
                    })
                  );
                  particles.name = 'particles';
                  particles.renderOrder = 4;
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
                  material.opacity = opacity * 0.6;
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
                  // Also remove from geometry cache
                  if (geometryCache.current.has(child.userData.id)) {
                    geometryCache.current.delete(child.userData.id);
                  }
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