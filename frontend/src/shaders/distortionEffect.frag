/**
 * distortionEffect.frag - Шейдер эффекта искажения
 * 
 * Применяется при прохождении космических объектов сквозь другие элементы интерфейса.
 * Создает волновые искажения и цветовые переходы в месте контакта.
 */

#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D uTexture; // Текстура, которую будем искажать
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uIntersectionPoint; // Точка пересечения объектов
uniform float uIntersectionRadius; // Радиус эффекта
uniform float uIntersectionStrength; // Сила эффекта
uniform vec3 uDistortionColor; // Цвет искажения

varying vec2 vUv;

// Импортируем функции шума
#pragma glslify: noise = require(glsl-noise/simplex/3d)

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
        
        // Добавляем небольшой шум для органичности
        distortionFactor += noise(vec3(st * 10.0, uTime)) * 0.1;
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