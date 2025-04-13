uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uHoverState;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying float vHoverState;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vHoverState = uHoverState;
    
    // Слегка анимируем вершины для эффекта "пульсации"
    vec3 animated = position;
    
    // Добавляем "дыхание" к вершинам, зависящее от времени
    float breathingEffect = sin(uTime * 0.5) * 0.03;
    animated *= 1.0 + breathingEffect;
    
    // Увеличиваем размер при наведении
    animated *= 1.0 + uHoverState * 0.1;
    
    // Финальная позиция
    vec4 mvPosition = modelViewMatrix * vec4(animated, 1.0);
    gl_Position = projectionMatrix * mvPosition;
} 