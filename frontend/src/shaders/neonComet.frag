/**
 * neonComet.frag - Фрагментный шейдер для неоновых комет
 * 
 * Определяет внешний вид комет, включая свечение ядра
 * и постепенное затухание частиц хвоста.
 */

#ifdef GL_ES
precision highp float;
#endif

uniform float uTime;
uniform vec3 uColorPrimary;
uniform vec3 uColorSecondary;
uniform float uGlowStrength;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying float vParticleIndex;
varying float vRandomness;

// Импортируем функции шума
#pragma glslify: noise = require(glsl-noise/simplex/3d)

void main() {
    // Базовый цвет зависит от того, ядро это или частица хвоста
    vec3 baseColor = mix(uColorPrimary, uColorSecondary, vParticleIndex * 0.8);
    
    // Для частиц используем радиальную градиентную текстуру
    float dist = length(gl_PointCoord - vec2(0.5));
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    
    // Для ядра добавляем более сложную текстуру и свечение
    if (vParticleIndex < 0.1) {
        // Кристаллическая структура ядра через шум
        float noiseValue = noise(vPosition * 5.0 + uTime * 0.2) * 0.5 + 0.5;
        baseColor = mix(baseColor, uColorSecondary, noiseValue * 0.3);
        
        // Усиливаем яркость ядра
        baseColor *= 1.5;
        alpha *= 0.9 + noise(vec3(vPosition.xy, uTime * 0.1)) * 0.3;
    } else {
        // Для хвоста добавляем затухание в зависимости от индекса частицы
        alpha *= 1.0 - vParticleIndex * 0.9;
        
        // Добавляем мерцание частицам хвоста
        float flicker = sin(uTime * (10.0 + vRandomness * 5.0)) * 0.5 + 0.5;
        alpha *= 0.5 + flicker * 0.5;
    }
    
    // Выходной цвет с прозрачностью
    gl_FragColor = vec4(baseColor, alpha);
} 