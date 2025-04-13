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
varying float vHoverState;

// Импортируем функции шума
#pragma glslify: noise = require(glsl-noise/simplex/3d)

void main() {
    // Базовые цвета
    vec3 baseColor = uColorPrimary;
    vec3 accentColor = uColorSecondary;
    
    // Получаем направление взгляда (используем нормаль как аппроксимацию)
    vec3 viewDirection = normalize(-vPosition);
    float fresnel = pow(1.0 - dot(viewDirection, vNormal), 3.0);
    
    // Пульсирующий эффект
    float pulse = (sin(uTime) * 0.5 + 0.5);
    
    // Шум для создания неоднородностей
    float noiseValue = noise(vPosition * 2.0 + uTime * 0.2) * 0.2 + 0.8;
    
    // Смешиваем основной и акцентный цвета на основе шума и френеля
    vec3 color = mix(baseColor, accentColor, fresnel * noiseValue);
    
    // Увеличиваем яркость при наведении
    float hoverBrightness = 1.0 + vHoverState * 0.5;
    color *= hoverBrightness;
    
    // Добавляем пульсирующее свечение края
    float edgeGlow = fresnel * (pulse * 0.5 + 0.5) * uGlowStrength;
    color += edgeGlow * accentColor;
    
    // Вычисляем прозрачность - полупрозрачный эффект с более непрозрачными краями
    float alpha = 0.4 + fresnel * 0.6;
    alpha += vHoverState * 0.2; // Увеличиваем непрозрачность при наведении
    
    // Добавляем флуктуации в прозрачность
    alpha *= mix(0.8, 1.0, sin(vPosition.x * 10.0 + uTime) * 0.5 + 0.5);
    
    // Выходной цвет с прозрачностью
    gl_FragColor = vec4(color, alpha);
} 