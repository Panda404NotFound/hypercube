use wasm_bindgen::prelude::*;
use glam::{Vec3, Quat};
use rand::{Rng, rngs::StdRng};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use std::any::Any;
use web_sys::console;

use crate::space_core::SpaceDefinition;
use crate::space_objects::{
    SpaceObject, SpaceObjectData, SpaceObjectType,
    random_position_on_far_plane, random_trajectory_through_viewport,
    SPACE_OBJECT_SYSTEMS
};

// Константы для неоновых комет
const MIN_COMET_SIZE_PERCENT: f32 = 3.0;   // Минимальный размер кометы (% от пространства)
const MAX_COMET_SIZE_PERCENT: f32 = 27.0;  // Максимальный размер кометы (% от пространства)
const COMET_LIFETIME_AFTER_PASS: f32 = 10.0; // Время жизни после прохождения через наблюдателя (в %)
const MAX_COMET_LIFETIME: f32 = 60.0;      // Максимальное время жизни в секундах

/// Структура данных неоновой кометы
#[derive(Clone, Debug)]
pub struct NeonComet {
    // Основные данные объекта
    data: SpaceObjectData,
    
    // Длина хвоста кометы (в процентах от размера кометы)
    tail_length: f32,
    
    // Цвет кометы (RGB, каждый компонент от 0.0 до 1.0)
    color: [f32; 3],
    
    // Яркость свечения кометы
    glow_intensity: f32,
    
    // Флаг, указывающий, что комета прошла через наблюдателя
    passed_through: bool,
}

impl NeonComet {
    pub fn new(id: usize) -> Self {
        // Создаем базовые данные
        let data = SpaceObjectData {
            id,
            object_type: SpaceObjectType::NeonComet,
            position: Vec3::ZERO,
            size: 0.0,  // Начальный размер 0
            scale: 0.0,
            opacity: 0.0,
            rotation: Quat::IDENTITY,
            velocity: Vec3::ZERO,
            lifetime: 0.0,
            max_lifetime: MAX_COMET_LIFETIME,
            active: true,
        };
        
        Self {
            data,
            tail_length: 0.0,
            color: [0.0, 0.0, 0.0],
            glow_intensity: 0.0,
            passed_through: false,
        }
    }
    
    // Получить цвет кометы
    pub fn get_color(&self) -> Vec<f32> {
        self.color.to_vec()
    }
    
    // Получить длину хвоста
    pub fn get_tail_length(&self) -> f32 {
        self.tail_length
    }
    
    // Получить интенсивность свечения
    pub fn get_glow_intensity(&self) -> f32 {
        self.glow_intensity
    }
}

impl SpaceObject for NeonComet {
    fn get_data(&self) -> &SpaceObjectData {
        &self.data
    }
    
    fn get_data_mut(&mut self) -> &mut SpaceObjectData {
        &mut self.data
    }
    
    fn initialize_random(&mut self, rng: &mut StdRng, space: &SpaceDefinition) {
        // Генерируем случайную позицию на дальней плоскости
        let position = random_position_on_far_plane(rng, space);
        
        // Устанавливаем начальную позицию
        self.data.position = position;
        
        // Генерируем случайный размер от MIN до MAX
        let size = rng.gen_range(MIN_COMET_SIZE_PERCENT..MAX_COMET_SIZE_PERCENT);
        self.data.size = size;
        
        // Начальный масштаб очень маленький (комета "зарождается")
        // Ensure scale is not too small to be visible
        self.data.scale = 0.05;
        
        // Начальная прозрачность - делаем выше, чтобы было видно при появлении
        self.data.opacity = 0.5;
        
        // Генерируем случайное вращение
        let rot_x = rng.gen_range(0.0..std::f32::consts::PI * 2.0);
        let rot_y = rng.gen_range(0.0..std::f32::consts::PI * 2.0);
        let rot_z = rng.gen_range(0.0..std::f32::consts::PI * 2.0);
        self.data.rotation = Quat::from_euler(
            glam::EulerRot::XYZ,
            rot_x, rot_y, rot_z
        );
        
        // Генерируем траекторию движения через видовой экран
        // Make sure speed is sufficient to be noticeable
        let trajectory = random_trajectory_through_viewport(rng, position, space);
        self.data.velocity = trajectory * 1.5; // Increase the velocity by 50%
        
        // Устанавливаем время жизни
        self.data.lifetime = 0.0;
        self.data.max_lifetime = MAX_COMET_LIFETIME;
        
        // Генерируем случайную длину хвоста
        self.tail_length = rng.gen_range(1.5..4.0); // Коэффициент относительно размера кометы
        
        // Генерируем случайный цвет из палитры неоновых цветов
        let neon_colors = [
            [0.0, 0.8, 1.0],   // Голубой неон
            [1.0, 0.0, 0.8],   // Розовый неон
            [0.5, 1.0, 0.0],   // Лаймовый неон
            [0.9, 0.4, 1.0],   // Фиолетовый неон
            [1.0, 0.8, 0.0],   // Золотой неон
        ];
        
        self.color = neon_colors[rng.gen_range(0..neon_colors.len())];
        
        // Устанавливаем яркость свечения - делаем выше для лучшей видимости
        self.glow_intensity = rng.gen_range(1.0..1.8);
        
        // Активируем объект
        self.data.active = true;
        self.passed_through = false;
    }
    
    fn update(&mut self, dt: f32, space: &SpaceDefinition) -> bool {
        // Обновляем время жизни
        self.data.lifetime += dt;
        
        // Проверяем, не превышено ли максимальное время жизни
        if self.data.lifetime > self.data.max_lifetime {
            return false; // Объект деактивируется
        }
        
        // Обновляем позицию на основе скорости
        self.data.position += self.data.velocity * dt;
        
        // Медленное вращение кометы
        let rot_speed = 0.1 * dt;
        let rotation_delta = Quat::from_euler(
            glam::EulerRot::XYZ,
            rot_speed, rot_speed * 0.7, rot_speed * 0.3
        );
        self.data.rotation = self.data.rotation * rotation_delta;
        
        // Обновляем масштаб на основе расстояния до наблюдателя
        let scale_factor = space.get_scale_factor(&self.data.position);
        // Экспоненциальный рост размера по мере приближения
        self.data.scale = scale_factor.powf(1.5) * (self.data.size / 100.0);
        
        // Ensure minimum scale is visible
        if self.data.scale < 0.05 {
            self.data.scale = 0.05;
        }
        
        // Обновляем прозрачность на основе расстояния до наблюдателя
        self.data.opacity = space.get_transparency_factor(&self.data.position);
        
        // Ensure minimum opacity for visibility
        if self.data.opacity < 0.3 {
            self.data.opacity = 0.3;
        }
        
        // Проверяем, прошла ли комета через плоскость наблюдателя
        if self.data.position.z < 0.0 && !self.passed_through {
            self.passed_through = true;
            
            // Рассчитываем оставшееся время жизни
            let remaining_percent = COMET_LIFETIME_AFTER_PASS / 100.0;
            let remaining_distance = space.min_z.abs() * remaining_percent;
            
            // Расчет времени до прохождения оставшегося расстояния
            let speed_z = self.data.velocity.z.abs();
            if speed_z > 0.0 {
                // Установим максимальное время жизни так, чтобы комета исчезла
                // после прохождения указанного процента пути
                let time_to_disappear = remaining_distance / speed_z;
                self.data.max_lifetime = self.data.lifetime + time_to_disappear;
            }
        }
        
        // Яркость свечения пульсирует со временем
        let pulse_factor = (self.data.lifetime * 2.0).sin() * 0.2 + 0.8;
        self.glow_intensity = self.glow_intensity * pulse_factor;
        
        // Объект остается активным
        true
    }
    
    fn as_any(&self) -> &dyn Any {
        self
    }
    
    fn as_any_mut(&mut self) -> &mut dyn Any {
        self
    }
}

// Хранилище для отложенного создания комет
static PENDING_COMETS: Lazy<Mutex<Vec<(usize, f32)>>> = Lazy::new(|| Mutex::new(Vec::new()));

#[wasm_bindgen]
pub fn spawn_neon_comets(system_id: usize, count: usize) -> bool {
    let mut systems = SPACE_OBJECT_SYSTEMS.lock().unwrap();
    
    if let Some(system) = systems.get_mut(&system_id) {
        // Создаем случайное время задержки для каждой кометы
        let mut pending = PENDING_COMETS.lock().unwrap();
        
        for _ in 0..count {
            let delay = system.get_rng_mut().gen_range(0.0..5.0); // Случайная задержка до 5 секунд
            pending.push((system_id, delay));
        }
        
        true
    } else {
        false
    }
}

#[wasm_bindgen]
pub fn process_neon_comet_spawns(dt: f32) -> usize {
    let mut spawned = 0;
    let mut pending = PENDING_COMETS.lock().unwrap();
    
    // Process the delays and gather system IDs that need new comets
    let mut systems_to_spawn: Vec<usize> = Vec::new();
    
    pending.retain_mut(|(system_id, delay)| {
        *delay -= dt;
        
        if *delay <= 0.0 {
            systems_to_spawn.push(*system_id);
            false // Remove from pending list
        } else {
            true // Keep in pending list
        }
    });
    
    // Now create comets for each system
    for system_id in systems_to_spawn {
        if let Ok(mut systems) = SPACE_OBJECT_SYSTEMS.lock() {
            if let Some(system) = systems.get_mut(&system_id) {
                // Get the next ID
                let comet_id = system.next_id;
                system.next_id += 1;
                
                // Clone the space definition to avoid borrowing conflicts
                let space_definition = system.space.clone();
                
                // Create a new comet
                let mut comet = NeonComet::new(comet_id);
                
                // Initialize the comet with random properties
                comet.initialize_random(system.get_rng_mut(), &space_definition);
                
                // Add the comet to the system
                system.get_objects_mut()
                      .entry(SpaceObjectType::NeonComet)
                      .or_insert_with(Vec::new)
                      .push(Box::new(comet));
                
                spawned += 1;
                
                // Print debug information
                console::log_1(&format!("Created comet with ID: {} at far plane", comet_id).into());
            }
        }
    }
    
    spawned
}

#[wasm_bindgen]
pub fn get_active_neon_comets_count(system_id: usize) -> usize {
    let systems = SPACE_OBJECT_SYSTEMS.lock().unwrap();
    
    if let Some(system) = systems.get(&system_id) {
        let objects = system.get_objects();
        if let Some(comets) = objects.get(&SpaceObjectType::NeonComet) {
            return comets.len();
        }
    }
    
    0
}

// Структура для передачи данных о нескольких кометах в JavaScript
#[wasm_bindgen]
pub struct CometDataArray {
    ids: Vec<usize>,
    positions: Vec<f32>,
    scales: Vec<f32>,
    rotations: Vec<f32>,
    opacities: Vec<f32>,
    colors: Vec<f32>,
    tail_lengths: Vec<f32>,
    glow_intensities: Vec<f32>,
}

#[wasm_bindgen]
impl CometDataArray {
    // Provide both getter methods and direct access for maximum compatibility
    #[wasm_bindgen(getter)]
    pub fn ids(&self) -> Vec<usize> {
        self.ids.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn positions(&self) -> Vec<f32> {
        self.positions.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn scales(&self) -> Vec<f32> {
        self.scales.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn rotations(&self) -> Vec<f32> {
        self.rotations.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn opacities(&self) -> Vec<f32> {
        self.opacities.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn colors(&self) -> Vec<f32> {
        self.colors.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn tail_lengths(&self) -> Vec<f32> {
        self.tail_lengths.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn glow_intensities(&self) -> Vec<f32> {
        self.glow_intensities.clone()
    }
}

#[wasm_bindgen]
pub fn get_visible_neon_comets(system_id: usize) -> Option<CometDataArray> {
    let systems = SPACE_OBJECT_SYSTEMS.lock().unwrap();
    
    if let Some(system) = systems.get(&system_id) {
        let objects = system.get_objects();
        if let Some(comets) = objects.get(&SpaceObjectType::NeonComet) {
            let mut data = CometDataArray {
                ids: Vec::with_capacity(comets.len()),
                positions: Vec::with_capacity(comets.len() * 3),
                scales: Vec::with_capacity(comets.len()),
                rotations: Vec::with_capacity(comets.len() * 4),
                opacities: Vec::with_capacity(comets.len()),
                colors: Vec::with_capacity(comets.len() * 3),
                tail_lengths: Vec::with_capacity(comets.len()),
                glow_intensities: Vec::with_capacity(comets.len()),
            };
            
            let mut visible_count = 0;
            
            for comet in comets.iter() {
                // Always consider comets as visible during development for debugging
                #[cfg(debug_assertions)]
                let is_visible = true;
                
                // In release mode, use the normal visibility check
                #[cfg(not(debug_assertions))]
                let is_visible = comet.is_visible(&system.space);
                
                if is_visible {
                    let comet_data = comet.get_data();
                    visible_count += 1;
                    
                    // ID
                    data.ids.push(comet_data.id);
                    
                    // Позиция
                    data.positions.push(comet_data.position.x);
                    data.positions.push(comet_data.position.y);
                    data.positions.push(comet_data.position.z);
                    
                    // Масштаб
                    data.scales.push(comet_data.scale);
                    
                    // Поворот (как кватернион)
                    data.rotations.push(comet_data.rotation.x);
                    data.rotations.push(comet_data.rotation.y);
                    data.rotations.push(comet_data.rotation.z);
                    data.rotations.push(comet_data.rotation.w);
                    
                    // Прозрачность
                    data.opacities.push(comet_data.opacity);
                    
                    // Специфичные для комет данные
                    let comet = comet.as_any().downcast_ref::<NeonComet>().unwrap();
                    
                    // Цвет
                    data.colors.extend_from_slice(&comet.color);
                    
                    // Длина хвоста
                    data.tail_lengths.push(comet.tail_length);
                    
                    // Интенсивность свечения
                    data.glow_intensities.push(comet.glow_intensity);
                }
            }
            
            // Log the count of visible comets for debugging
            console::log_1(&format!("Found {} visible comets out of {} total", visible_count, comets.len()).into());
            
            // Even if there are no visible comets, still return the empty array structure
            // to avoid null pointer issues in JavaScript
            return Some(data);
        } else {
            console::log_1(&"No comet objects found in the system".into());
        }
    } else {
        console::log_1(&format!("System with ID {} not found", system_id).into());
    }
    
    None
}