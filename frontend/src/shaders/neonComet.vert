/**
 * neonComet.vert - Вертексный шейдер для неоновых комет
 * 
 * Управляет геометрией и анимацией комет, включая хвост
 * из частиц и эффекты движения.
 */

uniform float uTime;
uniform float uSpeed;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute float size;
attribute float randomness;
attribute float particleIndex; // 0 для ядра, >0 для частиц хвоста

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying float vParticleIndex;
varying float vRandomness;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vParticleIndex = particleIndex;
    vRandomness = randomness;
    
    // Позиция частицы с учетом времени и скорости
    vec3 animated = position;
    
    // Для частиц хвоста добавляем смещение и уменьшение
    if (particleIndex > 0.0) {
        // Здесь будет реализована анимация частиц хвоста
    }
    
    // Финальная позиция
    vec4 mvPosition = modelViewMatrix * vec4(animated, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Размер частицы зависит от particleIndex (ядро больше, хвост меньше)
    gl_PointSize = size * (1.0 - particleIndex * 0.8);
} 