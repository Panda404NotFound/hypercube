use wasm_bindgen::prelude::*;
use glam::{Vec3, Quat};
use rand::{Rng, rngs::StdRng, SeedableRng, thread_rng};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use std::any::Any;
use web_sys::console;

use crate::space_core::SpaceDefinition;
use crate::space_objects::{
    SpaceObject, SpaceObjectData, SpaceObjectType,
    random_position_on_far_plane,
    SPACE_OBJECT_SYSTEMS
};

// Константы для неоновых комет
const MIN_COMET_SIZE_PERCENT: f32 = 17.0;   // Минимальный размер кометы (% от пространства)
const MAX_COMET_SIZE_PERCENT: f32 = 67.0;  // Максимальный размер кометы (% от пространства)
const COMET_LIFETIME_AFTER_PASS: f32 = 30.0; // Время жизни после прохождения через наблюдателя (в %)
const MAX_COMET_LIFETIME: f32 = 60.0;      // Максимальное время жизни в секундах
const MIN_SPAWN_DELAY: f32 = 1.0;          // Минимальная задержка респауна (в секундах)
const MAX_SPAWN_DELAY: f32 = 5.0;          // Максимальная задержка респауна (в секундах)
const MAX_SIMULTANEOUS_SPAWNS: usize = 3;  // Максимальное количество одновременных появлений
const MIN_ACCELERATION: f32 = 0.05;        // Минимальное ускорение
const MAX_ACCELERATION: f32 = 0.3;         // Максимальное ускорение
const MAX_LATERAL_SPEED: f32 = 40.0;       // Уменьшаем максимальную боковую скорость с 60.0 до 40.0
const MIN_VISIBILITY_TIME: f32 = 0.5;      // Минимальное время, в течение которого комета должна быть видна (сек)

/// Структура данных неоновой кометы
#[derive(Clone, Debug)]
pub struct NeonComet {
    // Основные данные объекта
    pub data: SpaceObjectData,
    
    // Длина хвоста кометы (в процентах от размера кометы)
    pub tail_length: f32,
    
    // Цвет кометы (RGB, каждый компонент от 0.0 до 1.0)
    pub color: [f32; 3],
    
    // Яркость свечения кометы
    pub glow_intensity: f32,
    
    // Флаг, указывающий, что комета прошла через наблюдателя
    pub passed_through: bool,
    
    // Время до респауна (в секундах)
    pub respawn_delay: f32,
    
    // Флаг, что комета ожидает респауна
    pub waiting_for_respawn: bool,
    
    // Ускорение кометы (изменение скорости в секунду)
    pub acceleration: f32,
    
    // Максимальная скорость кометы
    pub max_speed: f32,
    
    // Начальный размер кометы (используется при росте)
    pub initial_size: f32,
    
    // Целевой размер кометы (используется при росте)
    pub target_size: f32,
    
    // Скорость роста кометы (изменение размера в секунду)
    pub growth_rate: f32,

    // Счетчик респаунов (для большей случайности)
    pub respawn_count: u32,
    
    // Случайный сдвиг для обеспечения уникальности траекторий
    pub random_offset: f32,
    
    // Максимальная длина хвоста кометы
    pub max_trail_length: f32,
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
            respawn_delay: 0.0,
            waiting_for_respawn: false,
            acceleration: 0.0,
            max_speed: 0.0,
            initial_size: 0.0,
            target_size: 0.0,
            growth_rate: 0.0,
            respawn_count: 0,
            random_offset: 0.0,
            max_trail_length: 0.0,
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
        // Добавляем случайное смещение для большего разнообразия
        let random_offset = if self.respawn_count > 0 {
            // Используем respawn_count для создания разных смещений при каждом респауне
            let offset_factor = (self.respawn_count as f32 * 0.1).sin() * 0.5 + 0.5; // 0.0 - 1.0
            Vec3::new(
                (rng.gen::<f32>() - 0.5) * 10.0 * offset_factor,
                (rng.gen::<f32>() - 0.5) * 10.0 * offset_factor,
                (rng.gen::<f32>() - 0.5) * 5.0 * offset_factor
            )
        } else {
            Vec3::default()
        };
        
        // Получаем случайную позицию на дальней плоскости
        let pos = random_position_on_far_plane(rng, space);
        
        // Применяем случайное смещение
        self.data.position = pos + random_offset;
        
        // Изменяем размер в зависимости от количества респаунов
        let size_variation = 1.0 + (self.respawn_count as f32 * 0.05).sin() * 0.3;
        self.target_size = rng.gen_range(MIN_COMET_SIZE_PERCENT..MAX_COMET_SIZE_PERCENT) * size_variation;
        self.data.size = 0.01; // Начинаем с малого размера и растем
        
        // Меняем скорость роста каждый раз
        self.growth_rate = rng.gen_range(2.0..4.0);
        
        // Начальная прозрачность низкая (комета только появляется)
        self.data.opacity = 0.1;
        
        // Генерируем случайное вращение
        let rot_x = rng.gen_range(0.0..std::f32::consts::PI * 2.0);
        let rot_y = rng.gen_range(0.0..std::f32::consts::PI * 2.0);
        let rot_z = rng.gen_range(0.0..std::f32::consts::PI * 2.0);
        self.data.rotation = Quat::from_euler(
            glam::EulerRot::XYZ,
            rot_x, rot_y, rot_z
        );
        
        // Варьируем базовую скорость и ускорение в зависимости от респаунов
        let speed_variation = 1.0 + (self.respawn_count as f32 * 0.08).cos() * 0.2;
        let base_speed = rng.gen_range(20.0..40.0) * speed_variation;
        
        // Вместо направления к центру сцены, создаем полностью случайное направление
        // с небольшим уклоном в сторону внутреннего пространства сцены
        let random_target = Vec3::new(
            rng.gen_range(-50.0..50.0),
            rng.gen_range(-50.0..50.0),
            rng.gen_range(-80.0..0.0)  // Направляем объекты преимущественно внутрь пространства, но не точно к камере
        );
        let mut direction = random_target - self.data.position;
        
        // Добавляем больше случайности в направление в зависимости от респаунов
        let dir_randomness = 0.4 + (self.respawn_count as f32 * 0.1).cos() * 0.2; // Увеличиваем рандомность до 0.4-0.6
        direction.x += (rng.gen::<f32>() - 0.5) * direction.length() * dir_randomness;
        direction.y += (rng.gen::<f32>() - 0.5) * direction.length() * dir_randomness;
        direction.z += (rng.gen::<f32>() - 0.5) * direction.length() * dir_randomness * 0.5; // Меньше по Z для сохранения движения внутрь
        
        direction = direction.normalize();
        self.data.velocity = direction * base_speed;
        
        // Меняем ускорение в зависимости от респаунов
        let acc_variation = 1.0 + (self.respawn_count as f32 * 0.15).sin() * 0.3;
        self.acceleration = rng.gen_range(MIN_ACCELERATION * 100.0..MAX_ACCELERATION * 100.0) * acc_variation;
        
        // Добавляем проверку на слишком быстрые боковые движения
        // Если объект движется преимущественно в боковом направлении
        let lateral_speed = (self.data.velocity.x * self.data.velocity.x + 
                            self.data.velocity.y * self.data.velocity.y).sqrt();
        let total_speed = self.data.velocity.length();
        
        // Если боковая скорость составляет более 75% от общей скорости и достаточно высока
        if lateral_speed > total_speed * 0.75 && lateral_speed > 30.0 {
            // Снижаем боковую скорость до приемлемого уровня
            let reduction_factor = 30.0 / lateral_speed;
            self.data.velocity.x *= reduction_factor;
            self.data.velocity.y *= reduction_factor;
            
            // Увеличиваем z-компонент для компенсации общей скорости
            self.data.velocity.z *= 1.2;
            
            console::log_1(&format!("Adjusted high lateral speed for comet {}: {:.2} -> {:.2}", 
                           self.data.id, lateral_speed, lateral_speed * reduction_factor).into());
        }
        
        // Ограничиваем максимальную скорость
        self.max_speed = base_speed * 2.5; // Снижаем ещё больше с 3.0 до 2.5
        
        // Варьируем длину следа
        self.max_trail_length = rng.gen_range(5.0..15.0);
        self.tail_length = 0.0; // Начинаем с нулевой длины следа и увеличиваем со временем
        
        // Изменяем выбор цвета в зависимости от ID и количества респаунов
        let color_seed = (self.data.id as u32).wrapping_add(self.respawn_count * 7);
        let color_choice = color_seed % 5;
        
        // Используем разные цвета для неоновых комет
        self.color = match color_choice {
            0 => [0.0, 1.0, 0.8], // Cyan
            1 => [1.0, 0.2, 0.8], // Pink
            2 => [0.2, 0.4, 1.0], // Blue
            3 => [1.0, 0.8, 0.0], // Yellow
            _ => [0.6, 0.0, 1.0], // Purple
        };
        
        // Устанавливаем яркость свечения
        self.glow_intensity = rng.gen_range(1.0..2.2);
        
        // Сбрасываем флаги состояния
        self.passed_through = false;
        self.waiting_for_respawn = false;
        self.respawn_delay = 0.0;
        
        // Активируем объект
        self.data.active = true;
    }
    
    fn update(&mut self, dt: f32, space: &SpaceDefinition) -> bool {
        // Если комета ожидает респауна
        if self.waiting_for_respawn {
            self.respawn_delay -= dt;
            
            // Проверяем, готова ли комета к респауну
            if self.respawn_delay <= 0.0 {
                // Готова к возрождению - инициализируем снова
                
                // Увеличиваем счетчик респаунов для уникальности
                self.respawn_count += 1;
                
                // Создаем по-настоящему случайный seed, используя id, счетчик респаунов, и текущее время
                let time_seed = (js_sys::Date::now() as u64) & 0xFFFFFFFF;
                let seed = (self.data.id as u64)
                    .wrapping_mul(42)
                    .wrapping_add(self.respawn_count as u64)
                    .wrapping_add(time_seed);
                let mut local_rng = StdRng::seed_from_u64(seed);
                
                // Генерируем новый случайный сдвиг для разнообразия
                self.random_offset = local_rng.gen_range(-50.0..50.0);
                
                self.initialize_random(&mut local_rng, space);
                // console::log_1(&format!("Comet {} respawned for the {} time with offset {}", 
                //     self.data.id, self.respawn_count, self.random_offset).into());
            }
            
            return true; // Объект остаётся активным, но не отображается
        }
        
        // Обновляем время жизни
        self.data.lifetime += dt;
        
        // Проверяем, не превышено ли максимальное время жизни
        if self.data.lifetime > self.data.max_lifetime {
            return false; // Объект деактивируется
        }
        
        // Применяем постепенное ускорение с ограничением максимальной скорости
        let current_speed = self.data.velocity.length();
        
        // Применяем адаптивное ускорение
        let mut acceleration_factor = 1.0;
        
        // Рассчитываем вектор от наблюдателя к объекту
        let to_object = self.data.position - space.observer_position;
        
        // Проверяем, движется ли объект в направлении наблюдателя (по Z)
        if to_object.z > 0.0 && self.data.velocity.z < 0.0 {
            // Рассчитываем расстояние до наблюдателя
            let distance = to_object.length();
            
            // Добавляем дополнительное ускорение по мере приближения
            if distance < 50.0 {
                // Усиление ускорения от 1.0 до 1.5 по мере приближения (снижено с 2.0)
                acceleration_factor = 1.0 + (1.0 - distance / 50.0) * 0.5;
            }
        }
        
        // Рассчитываем прирост скорости с учетом коэффициента ускорения
        let speed_increase = self.acceleration * dt * acceleration_factor;
        
        // Новая скорость с ограничением по максимуму
        let new_speed = (current_speed + speed_increase).min(self.max_speed);
        
        // Сохраняем направление, но меняем величину скорости
        if current_speed > 0.0001 {
            let direction = self.data.velocity / current_speed;
            self.data.velocity = direction * new_speed;
            
            // Строгое ограничение боковой скорости для предотвращения "мерцания" комет
            let lateral_speed = (self.data.velocity.x * self.data.velocity.x + 
                                self.data.velocity.y * self.data.velocity.y).sqrt();
            
            if lateral_speed > MAX_LATERAL_SPEED {
                let lateral_dir = Vec3::new(self.data.velocity.x, self.data.velocity.y, 0.0).normalize();
                
                // Уменьшаем только X и Y компоненты, сохраняя Z-компоненту скорости
                self.data.velocity.x = lateral_dir.x * MAX_LATERAL_SPEED;
                self.data.velocity.y = lateral_dir.y * MAX_LATERAL_SPEED;
            }
            
            // Проверяем, сколько времени потребуется комете, чтобы пересечь поле зрения
            // Если время слишком мало, снижаем скорость
            let viewport = space.get_viewport_dimensions();
            let screen_width = viewport.x * 2.0; // Удвоенная ширина, чтобы учесть весь экран
            
            if lateral_speed > 0.0 {
                let crossing_time = screen_width / lateral_speed;
                
                // Если время пересечения экрана меньше минимального, снижаем скорость
                if crossing_time < MIN_VISIBILITY_TIME {
                    let adjusted_speed = screen_width / MIN_VISIBILITY_TIME;
                    let speed_ratio = adjusted_speed / lateral_speed;
                    
                    self.data.velocity.x *= speed_ratio;
                    self.data.velocity.y *= speed_ratio;
                    
                    // Логируем информацию о замедлении слишком быстрых комет
                    console::log_1(&format!("Slowed down fast comet {}: crossing time {:.2}s -> {:.2}s", 
                                          self.data.id, crossing_time, MIN_VISIBILITY_TIME).into());
                }
            }
        }
        
        // Обновляем позицию на основе скорости
        self.data.position += self.data.velocity * dt;
        
        // Проверяем, вышла ли комета за пределы пространства
        let space_dims = space.get_dimensions();
        let pos = self.data.position;
        
        // Вектор от наблюдателя до кометы
        let to_comet = pos - space.observer_position;
        
        // Если комета вышла далеко за пределы пространства (позади наблюдателя)
        // Используем -30.0 вместо space.min_z, чтобы объект оставался видимым дольше после прохождения камеры
        if to_comet.z < -30.0 || pos.x.abs() > space_dims.x || pos.y.abs() > space_dims.y {
            // Устанавливаем в режим ожидания респауна
            self.waiting_for_respawn = true;
            self.respawn_delay = rand::thread_rng().gen_range(MIN_SPAWN_DELAY..MAX_SPAWN_DELAY);
            console::log_1(&format!("Comet {} went out of bounds, will respawn in {} seconds", 
                                   self.data.id, self.respawn_delay).into());
            return true; // Объект остаётся активным, но ждет респауна
        }
        
        // Медленное вращение кометы
        let rot_speed = 0.1 * dt;
        let rotation_delta = Quat::from_euler(
            glam::EulerRot::XYZ,
            rot_speed, rot_speed * 0.7, rot_speed * 0.3
        );
        self.data.rotation = self.data.rotation * rotation_delta;
        
        // Постепенно увеличиваем размер кометы от начального до целевого
        if self.data.size < self.target_size {
            let size_increase = self.growth_rate * dt;
            self.data.size = (self.data.size + size_increase).min(self.target_size);
        }
        
        // Обновляем масштаб на основе расстояния до наблюдателя и текущего размера
        let scale_factor = space.get_scale_factor(&self.data.position);
        
        // Просто используем масштаб без специальной обработки для объектов, летящих к камере
        self.data.scale = scale_factor.powf(1.5) * (self.data.size / 1.0);
        
        // Ensure minimum scale is visible but still small for distant comets
        if self.data.scale < 0.01 {
            self.data.scale = 0.01;
        }
        
        // Обновляем прозрачность: постепенное появление в начале жизни
        if self.data.lifetime < 1.0 {
            // First second - gradual appearance
            self.data.opacity = self.data.lifetime;
        } else {
            // Normal distance-based transparency, without special handling for camera proximity
            let base_opacity = space.get_transparency_factor(&self.data.position);
            self.data.opacity = base_opacity.max(0.3);
        }
        
        // Предотвращаем прямую зависимость от прохождения через наблюдателя/камеру
        // Вместо этого увеличиваем яркость на основе пройденного расстояния
        if !self.passed_through && self.data.lifetime > self.data.max_lifetime * 0.3 {
            self.passed_through = true;
            
            // Увеличиваем яркость для добавления визуального эффекта
            self.glow_intensity *= 1.5;
            
            // Добавляем небольшое увеличение времени жизни
            let time_percentage = COMET_LIFETIME_AFTER_PASS / 100.0;
            self.data.max_lifetime = self.data.lifetime + (self.data.max_lifetime * time_percentage);
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

#[allow(unused_variables)]
#[wasm_bindgen]
pub fn spawn_neon_comets(system_id: usize, count: usize) -> bool {
    // Проверяем наличие системы объектов, используя DashMap API
    if let Some(system_ref) = SPACE_OBJECT_SYSTEMS.get_mut(&system_id) {
        let mut rng = thread_rng();
        let mut pending = PENDING_COMETS.lock().unwrap();
        
        // Распределяем появление комет по группам (по 1-3 кометы)
        let mut remaining = count;
        let mut current_delay = 0.0;
        
        while remaining > 0 {
            // Определяем количество комет в текущей группе (1-3 или оставшиеся)
            let group_size = std::cmp::min(
                rng.gen_range(1..=MAX_SIMULTANEOUS_SPAWNS),
                remaining
            );
            
            // Создаем задержку для группы
            for _ in 0..group_size {
                pending.push((system_id, current_delay));
            }
            
            // Уменьшаем оставшееся количество
            remaining -= group_size;
            
            // Добавляем случайную задержку до следующей группы (0.5-3.0 секунды)
            if remaining > 0 {
                current_delay += rng.gen_range(0.5..3.0);
            }
        }
        
        console::log_1(&format!("Scheduled spawning of {} comets with staggered delays", count).into());
        true
    } else {
        false
    }
}

#[wasm_bindgen]
pub fn process_neon_comet_spawns(dt: f32) -> usize {
    let mut spawned = 0;
    let mut pending = PENDING_COMETS.lock().unwrap();
    
    // Обрабатываем задержки и собираем ID систем, нуждающихся в новых кометах
    let mut systems_to_spawn: Vec<usize> = Vec::new();
    
    pending.retain_mut(|(system_id, delay)| {
        *delay -= dt;
        
        if *delay <= 0.0 {
            systems_to_spawn.push(*system_id);
            false // Удаляем из списка ожидания
        } else {
            true // Оставляем в списке ожидания
        }
    });
    
    // Теперь создаем кометы для каждой системы
    for system_id in systems_to_spawn {
        // Получаем доступ к системе объектов через DashMap
        if let Some(mut system_ref) = SPACE_OBJECT_SYSTEMS.get_mut(&system_id) {
            // Получаем следующий ID
            let comet_id = system_ref.next_id;
            system_ref.next_id += 1;
            
            // Клонируем определение пространства, чтобы избежать конфликтов заимствования
            let space_definition = system_ref.space.clone();
            
            // Создаем новую комету
            let mut comet = NeonComet::new(comet_id);
            
            // Инициализируем комету со случайными свойствами
            comet.initialize_random(system_ref.get_rng_mut(), &space_definition);
            
            // Добавляем комету в систему
            system_ref.get_objects_mut()
                    .entry(SpaceObjectType::NeonComet)
                    .or_insert_with(Vec::new)
                    .push(Box::new(comet));
            
            spawned += 1;
            
            // Выводим отладочную информацию
            console::log_1(&format!("Created comet with ID: {} at far plane", comet_id).into());
        }
    }
    
    // Добавим случайное создание новых комет для "воскрешения" системы,
    // если в очереди мало комет и общее количество активных комет мало
    if pending.len() < 3 {
        // Проверяем количество активных комет во всех системах
        // let mut total_active_comets = 0;
        
        // Используем итератор DashMap для доступа к системам
        for system_ref in SPACE_OBJECT_SYSTEMS.iter() {
            let system_id = *system_ref.key();
            let system = system_ref.value();
            
            let objects = system.get_objects();
            if let Some(comets) = objects.get(&SpaceObjectType::NeonComet) {
                let active_comets = comets.iter()
                    .filter(|c| !c.as_any().downcast_ref::<NeonComet>().unwrap().waiting_for_respawn)
                    .count();
                
               // total_active_comets += active_comets;
                
                // Если в системе мало активных комет, добавляем новые
                if active_comets < 5 {
                    let mut rng = thread_rng();
                    let new_comets = rng.gen_range(1..=MAX_SIMULTANEOUS_SPAWNS);
                    let delay = rng.gen_range(0.5..2.0);
                    
                    // Добавляем в очередь появления
                    for _ in 0..new_comets {
                        pending.push((system_id, delay));
                    }
                    
                    // console::log_1(&format!("Auto-scheduling {} new comets for system {}", new_comets, system_id).into());
                }
            }
        }
        
        // console::log_1(&format!("Total active comets: {}", total_active_comets).into());
    }
    
    spawned
}

#[wasm_bindgen]
pub fn get_active_neon_comets_count(system_id: usize) -> usize {
    // Получаем доступ к системе через DashMap API
    if let Some(system_ref) = SPACE_OBJECT_SYSTEMS.get(&system_id) {
        let objects = system_ref.get_objects();
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
    // Получаем доступ к системе через DashMap API
    if let Some(system_ref) = SPACE_OBJECT_SYSTEMS.get(&system_id) {
        let objects = system_ref.get_objects();
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
            
            // let mut visible_count = 0;
            
            for comet in comets.iter() {
                // Получаем доступ к специфичным для кометы данным
                let neon_comet = comet.as_any().downcast_ref::<NeonComet>().unwrap();
                
                // Пропускаем кометы, ожидающие респауна
                if neon_comet.waiting_for_respawn {
                    continue;
                }
                
                // Проверяем видимость кометы
                #[cfg(debug_assertions)]
                let is_visible = true;
                
                // В релизной версии используем обычную проверку видимости
                #[cfg(not(debug_assertions))]
                let is_visible = comet.is_visible(&system_ref.space);
                
                if is_visible {
                    let comet_data = comet.get_data();
                    // visible_count += 1;
                    
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
                    
                    // Цвет
                    data.colors.extend_from_slice(&neon_comet.color);
                    
                    // Длина хвоста
                    data.tail_lengths.push(neon_comet.tail_length);
                    
                    // Интенсивность свечения
                    data.glow_intensities.push(neon_comet.glow_intensity);
                }
            }
            
            // Выводим количество видимых комет для отладки
            // console::log_1(&format!("Found {} visible comets out of {} total", visible_count, comets.len()).into());
            
            // Даже если нет видимых комет, все равно возвращаем пустую структуру массива,
            // чтобы избежать проблем с нулевыми указателями в JavaScript
            return Some(data);
        } else {
            console::log_1(&"No comet objects found in the system".into());
        }
    } else {
        console::log_1(&format!("System with ID {} not found", system_id).into());
    }
    
    None
}