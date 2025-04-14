use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use web_sys::console;
use crate::space_objects::{SpaceObject, SpaceObjectType};
use crate::objective_main::{get_viewing_plane_id, Intersection, IntersectionType};
use rand::Rng;
use std::sync::Mutex;
use once_cell::sync::Lazy;

// Хранилище эффектов взаимодействия комет с просмотровой плоскостью
pub static COMET_EFFECTS: Lazy<Mutex<Vec<CometEffect>>> = 
    Lazy::new(|| Mutex::new(Vec::new()));

// Эффекты при прохождении кометы через плоскость
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CometEffect {
    pub position: [f32; 3],        // Позиция эффекта
    pub color: [f32; 4],           // Цвет эффекта
    pub radius: f32,               // Радиус эффекта
    pub lifetime: f32,             // Продолжительность эффекта
    pub current_age: f32,          // Текущий возраст эффекта
    pub intensity: f32,            // Интенсивность эффекта
    pub effect_type: CometEffectType, // Тип эффекта
}

// Типы эффектов комет
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum CometEffectType {
    Ripple,     // Волновой эффект
    Explosion,  // Взрывной эффект
    Glow,       // Свечение
    Distortion, // Искажение пространства
}

// Структура для хранения данных о неоновой комете
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NeonCometData {
    pub id: usize,
    pub position: [f32; 3],
    pub velocity: [f32; 3],
    pub size: f32,
    pub color: [f32; 4],
    pub tail_particles: Vec<[f32; 3]>,
    pub particle_sizes: Vec<f32>,
    pub particle_colors: Vec<[f32; 4]>,
    pub distance_to_plane: f32,    // Расстояние до просмотровой плоскости
    pub has_crossed_plane: bool,   // Пересекла ли комета плоскость на этом шаге
}

// Структура для батчевой передачи данных комет в JavaScript
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NeonCometDataBatch {
    pub core_positions: Vec<f32>,
    pub core_rotations: Vec<f32>,
    pub core_scales: Vec<f32>,
    pub core_colors: Vec<f32>,
    pub particle_positions: Vec<f32>,
    pub particle_sizes: Vec<f32>,
    pub particle_lifetimes: Vec<f32>,
    pub particle_max_lifetimes: Vec<f32>,
    pub particle_randomness: Vec<f32>,
    pub particle_colors: Vec<f32>,
    pub particle_fade_factors: Vec<f32>,
    pub particle_count_per_comet: Vec<u32>,
}

// Функция для логирования в консоль
fn log(message: &str) {
    console::log_1(&JsValue::from_str(message));
}

// Получить данные о неоновых кометах из массива объектов
pub fn get_neon_comet_data_from_objects(objects: &[SpaceObject]) -> NeonCometDataBatch {
    // Using underscore prefix for unused variables
    let _viewing_plane_id = get_viewing_plane_id();
    
    // Определяем максимальное количество частиц на одну комету для буферизации
    const MAX_PARTICLES_PER_COMET: usize = 200;
    
    // Счетчики для определения размеров буферов
    let mut active_comets = 0;
    let mut _total_particles = 0;
    
    // Сначала проходим по всем объектам для подсчета активных комет и частиц
    for object in objects {
        if !object.is_active || object.object_type != SpaceObjectType::NeonComet {
            continue;
        }
        
        // Учитываем объекты с отрицательным возрастом, но не обрабатываем их
        if object.age < 0.0 {
            // Подсчитываем как активные, но не добавляем частицы
            active_comets += 1;
            continue;
        }
        
        active_comets += 1;
        
        // Подсчитываем количество частиц хвоста
        if let Some(tail_particles) = &object.tail_particles {
            _total_particles += tail_particles.len();
        }
    }
    
    // Если нет активных комет, возвращаем пустые буферы с минимальным размером
    if active_comets == 0 {
        return NeonCometDataBatch {
            core_positions: Vec::new(),
            core_rotations: Vec::new(),
            core_scales: Vec::new(),
            core_colors: Vec::new(),
            particle_positions: Vec::new(),
            particle_sizes: Vec::new(),
            particle_lifetimes: Vec::new(),
            particle_max_lifetimes: Vec::new(),
            particle_randomness: Vec::new(),
            particle_colors: Vec::new(),
            particle_fade_factors: Vec::new(),
            particle_count_per_comet: Vec::new(),
        };
    }
    
    // Создаем буферы для ядер комет
    let mut core_positions: Vec<f32> = Vec::with_capacity(active_comets * 3); // xyz для каждого ядра
    let mut core_rotations: Vec<f32> = Vec::with_capacity(active_comets * 3); // xyz вращений
    let mut core_scales: Vec<f32> = Vec::with_capacity(active_comets);
    let mut core_colors: Vec<f32> = Vec::with_capacity(active_comets * 4); // rgba для каждого ядра
    
    // Создаем буферы для частиц хвостов
    let max_total_particles = active_comets * MAX_PARTICLES_PER_COMET;
    let mut particle_positions: Vec<f32> = Vec::with_capacity(max_total_particles * 3);
    let mut particle_sizes: Vec<f32> = Vec::with_capacity(max_total_particles);
    let mut particle_lifetimes: Vec<f32> = Vec::with_capacity(max_total_particles);
    let mut particle_max_lifetimes: Vec<f32> = Vec::with_capacity(max_total_particles);
    let mut particle_randomness: Vec<f32> = Vec::with_capacity(max_total_particles);
    let mut particle_colors: Vec<f32> = Vec::with_capacity(max_total_particles * 3); // rgb для каждой частицы
    let mut particle_fade_factors: Vec<f32> = Vec::with_capacity(max_total_particles);
    
    // Количество частиц для каждой кометы
    let mut particle_count_per_comet: Vec<u32> = Vec::with_capacity(active_comets);
    
    // Теперь проходим по всем объектам для заполнения буферов
    for object in objects {
        if !object.is_active || object.object_type != SpaceObjectType::NeonComet {
            continue;
        }
        
        // Пропускаем объекты, которые еще не "родились"
        if object.age < 0.0 {
            // Добавляем пустую запись для этой кометы
            core_positions.extend_from_slice(&[0.0, 0.0, -200.0]); // Далеко за пределами видимости
            core_rotations.extend_from_slice(&[0.0, 0.0, 0.0]);
            core_scales.push(0.0);
            core_colors.extend_from_slice(&[0.0, 0.0, 0.0, 0.0]); // Полностью прозрачный
            particle_count_per_comet.push(0);
            continue;
        }
        
        // Добавляем данные ядра в буферы
        core_positions.extend_from_slice(&object.position);
        core_rotations.extend_from_slice(&object.rotation);
        core_scales.push(object.size);
        core_colors.extend_from_slice(&object.color);
        
        // Подсчет частиц для этой кометы
        let mut particle_count = 0;
        
        // Добавляем данные о хвосте, если они есть
        if let Some(tail_particles) = &object.tail_particles {
            for particle in tail_particles {
                // Добавляем данные о позиции частицы
                particle_positions.extend_from_slice(&particle.position);
                
                // Добавляем размер частицы
                particle_sizes.push(particle.size);
                
                // Добавляем время жизни
                particle_lifetimes.push(particle.lifetime);
                particle_max_lifetimes.push(particle.max_lifetime);
                
                // Добавляем случайность
                particle_randomness.push(particle.randomness);
                
                // Добавляем цвет
                particle_colors.extend_from_slice(&particle.color);
                
                // Добавляем фактор затухания
                particle_fade_factors.push(particle.fade_factor);
                
                // Увеличиваем счетчик частиц
                particle_count += 1;
            }
        }
        
        // Записываем количество частиц для этой кометы
        particle_count_per_comet.push(particle_count as u32);
    }
    
    // Преобразуем векторы в Fixed32Array для передачи в JavaScript
    NeonCometDataBatch {
        core_positions: core_positions,
        core_rotations: core_rotations,
        core_scales: core_scales,
        core_colors: core_colors,
        particle_positions: particle_positions,
        particle_sizes: particle_sizes,
        particle_lifetimes: particle_lifetimes,
        particle_max_lifetimes: particle_max_lifetimes,
        particle_randomness: particle_randomness,
        particle_colors: particle_colors,
        particle_fade_factors: particle_fade_factors,
        particle_count_per_comet: particle_count_per_comet,
    }
}

// Создать эффект в точке пересечения кометы с плоскостью
pub fn create_comet_effect_at_intersection(intersection: &Intersection, object: &SpaceObject) {
    let mut rng = rand::thread_rng();
    
    // Определяем тип эффекта на основе типа пересечения
    let effect_type = match intersection.intersection_type {
        IntersectionType::Entry => CometEffectType::Ripple,
        IntersectionType::Exit => CometEffectType::Glow,
        _ => CometEffectType::Distortion,
    };
    
    // Создаем эффект
    let effect = CometEffect {
        position: intersection.position,
        color: object.color,
        radius: object.size * 2.0 + rng.gen_range(0.5..1.5),
        lifetime: rng.gen_range(0.5..1.5),
        current_age: 0.0,
        intensity: rng.gen_range(0.7..1.0),
        effect_type,
    };
    
    // Добавляем эффект в глобальное хранилище
    if let Ok(mut effects) = COMET_EFFECTS.lock() {
        effects.push(effect);
        
        // Ограничиваем количество эффектов
        if effects.len() > 20 {
            effects.remove(0);
        }
    }
    
    log(&format!("Comet {} crossed the viewing plane!", object.id));
}

// Обновить эффекты комет
#[wasm_bindgen]
pub fn update_comet_effects(delta_time: f32) -> JsValue {
    if let Ok(mut effects) = COMET_EFFECTS.lock() {
        // Обновляем возраст каждого эффекта
        let mut i = 0;
        while i < effects.len() {
            effects[i].current_age += delta_time;
            
            // Если эффект истек, удаляем его
            if effects[i].current_age >= effects[i].lifetime {
                effects.remove(i);
            } else {
                i += 1;
            }
        }
        
        // Возвращаем актуальный список эффектов
        return serde_wasm_bindgen::to_value(&*effects).unwrap_or(JsValue::NULL);
    }
    
    JsValue::NULL
}

// Получить активные эффекты комет
#[wasm_bindgen]
pub fn get_comet_effects() -> JsValue {
    if let Ok(effects) = COMET_EFFECTS.lock() {
        return serde_wasm_bindgen::to_value(&*effects).unwrap_or(JsValue::NULL);
    }
    
    JsValue::NULL
}