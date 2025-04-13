#ifdef GL_ES
precision highp float;
#endif

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColorPrimary;
uniform vec3 uColorSecondary;
uniform float uNoiseScale;
uniform float uNoiseStrength;

// Импортируем функции шума
#pragma glslify: noise = require(glsl-noise/simplex/3d)
#pragma glslify: fbm = require(glsl-fractal-brownian-motion)

// Функция для создания звезд
float stars(vec2 uv, float threshold) {
    float n = noise(vec3(uv * 500.0, uTime * 0.01));
    return pow(max(0.0, n), 20.0) * step(threshold, n);
}

// Функция для создания северного сияния
vec3 aurora(vec2 uv) {
    // Параметры для FBM
    float fbm_scale = uNoiseScale;
    float fbm_time = uTime * 0.05;
    int octaves = 5;
    float lacunarity = 2.0;
    float gain = 0.5;
    
    // Смещаем координаты по времени для создания эффекта движения
    uv.x += fbm_time * 0.1;
    
    // Используем FBM для создания базовой структуры
    float f = fbm(vec3(uv * fbm_scale, fbm_time), octaves, lacunarity, gain);
    
    // Создаем эффект волн
    float wave = sin(uv.y * 10.0 + uTime * 0.2) * 0.1;
    f += wave;
    
    // Нормализуем значение и применяем силу шума
    f = smoothstep(0.0, 1.0, f * uNoiseStrength);
    
    // Нелинейное смешивание цветов для создания плавных переходов
    vec3 color = mix(uColorSecondary, uColorPrimary, pow(f, 2.0));
    
    // Добавляем яркость в верхней части экрана
    color *= smoothstep(0.0, 0.5, uv.y);
    
    return color;
}

void main() {
    // Нормализованные координаты пикселя
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    uv = uv * 2.0 - 1.0; // Преобразуем диапазон от -1 до 1
    uv.x *= uResolution.x / uResolution.y; // Исправляем соотношение сторон
    
    // Инициализируем цвет
    vec3 finalColor = vec3(0.0);
    
    // Добавляем северное сияние
    finalColor += aurora(uv * 0.5);
    
    // Добавляем звезды
    float starIntensity = stars(uv, 0.97);
    finalColor += starIntensity;
    
    // Добавляем свечение от центра
    float centerGlow = 1.0 - length(uv) * 0.5;
    centerGlow = max(0.0, centerGlow);
    centerGlow = pow(centerGlow, 3.0);
    finalColor += centerGlow * 0.1 * uColorPrimary;
    
    // Ограничиваем значения цвета для предотвращения выхода за пределы
    finalColor = clamp(finalColor, 0.0, 1.0);
    
    // Выходной цвет
    gl_FragColor = vec4(finalColor, 1.0);
} 