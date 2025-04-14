use wasm_bindgen::prelude::*;
use rand::{Rng, thread_rng};
use serde::{Serialize, Deserialize};
use web_sys::console;
use crate::objective_main::{get_viewing_plane_id, SPACE_CUBES, Intersection, IntersectionType, INTERSECTIONS};
use std::collections::HashSet;
use serde_wasm_bindgen::to_value;
use std::f32::consts::PI;
use glam::Vec3;
use std::sync::atomic::{AtomicUsize, Ordering};

// Глобальные константы для конфигурации пространства
pub const SPACE_FAR_Z: f32 = -100.0;     // Дальняя граница пространства (откуда появляются объекты)
pub const SPACE_NEAR_Z: f32 = 10.0;      // Ближняя граница пространства (предел видимости после прохождения)
pub const VIEWING_PLANE_Z: f32 = 0.0;    // Z-координата просмотровой плоскости
pub const CAMERA_POSITION_Z: f32 = 5.0;  // Позиция камеры по оси Z
pub const SCALING_DISTANCE_FACTOR: f32 = 50.0; // Фактор масштабирования для расчета размера объекта
pub const DEACTIVATION_DISTANCE: f32 = 15.0;  // Расстояние деактивации объекта после прохождения камеры

// Константы для относительных размеров
pub const VIEWING_PLANE_SIZE_RATIO: f32 = 0.25;  // Размер просмотровой плоскости (25% от всего пространства)
pub const MIN_OBJECT_SIZE_RATIO: f32 = 0.03;     // Минимальный размер объекта (3% от всего пространства)
pub const MAX_OBJECT_SIZE_RATIO: f32 = 0.27;     // Максимальный размер объекта (27% от всего пространства)
pub const OBJECT_LIFESPAN_AFTER_CROSSING: f32 = 0.1; // Продолжительность жизни после прохождения (10% от пути)

// Константы для зарождения объектов
pub const INITIAL_OBJECT_SIZE: f32 = 0.0;     // Начальный размер объектов при зарождении
pub const MAX_OBJECT_SPEED: f32 = 0.8;        // Максимальная базовая скорость объектов
pub const MIN_OBJECT_SPEED: f32 = 0.2;        // Минимальная базовая скорость объектов
pub const ACCELERATION_FACTOR: f32 = 1.05;    // Фактор ускорения при приближении

// Константы для распределения объектов во времени
pub const MIN_SPAWN_DELAY: f32 = 0.5;         // Минимальная задержка появления (секунды)
pub const MAX_SPAWN_DELAY: f32 = 5.0;         // Максимальная задержка появления (секунды)

// Define the log function directly in this file
fn log(message: &str) {
    console::log_1(&JsValue::from_str(message));
}

// Типы космических объектов
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
pub enum SpaceObjectType {
    NeonComet,
    PolygonalCrystal,
    EnergySphere,
}

// Структура для хранения параметров объекта в пространстве
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SpaceObject {
    pub id: usize,
    pub position: [f32; 3],      // Позиция объекта
    pub velocity: [f32; 3],      // Скорость объекта
    pub acceleration: [f32; 3],  // Ускорение объекта
    pub size: f32,               // Размер объекта
    pub color: [f32; 4],         // Цвет объекта (RGBA)
    pub is_active: bool,         // Активен ли объект
    pub lifespan: f32,           // Время жизни объекта (в секундах)
    pub age: f32,                // Текущий возраст объекта (в секундах)
    pub max_size: f32,           // Максимальный размер объекта
    pub grow_rate: f32,          // Скорость роста объекта
    pub object_type: SpaceObjectType, // Тип космического объекта
    pub tail_particles: Option<Vec<TailParticle>>, // Частицы хвоста (для комет)
    pub rotation: [f32; 3],      // Вращение объекта
    pub scale: f32,              // Масштаб объекта
    pub initial_z: f32,          // Начальная Z-координата
    pub is_center_trajectory: bool, // Флаг центральной траектории
    pub passed_center: bool,     // Прошел ли объект центр
    pub size_multiplier: f32,    // Множитель размера
    pub target_exit_position: [f32; 2], // Целевая позиция выхода (X,Y координаты)
    pub opacity_factor: f32,     // Фактор прозрачности (0.0-1.0)
    pub distance_traveled_ratio: f32, // Отношение пройденного расстояния к общему (0.0-1.0)
}

// Структура для хранения данных о частице хвоста
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TailParticle {
    pub position: [f32; 3],      // Позиция частицы
    pub velocity: [f32; 3],      // Скорость частицы
    pub lifetime: f32,           // Оставшееся время жизни частицы
    pub max_lifetime: f32,       // Максимальное время жизни частицы
    pub size: f32,               // Размер частицы
    pub initial_size: f32,       // Начальный размер частицы
    pub randomness: f32,         // Случайный параметр для визуального разнообразия
    pub color: [f32; 3],         // Цвет частицы (RGB)
    pub fade_factor: f32,        // Фактор затухания
}

// Система управления объектами в пространстве
#[derive(Clone, Debug)]
pub struct SpaceObjectSystem {
    pub objects: Vec<SpaceObject>,
    pub next_id: usize,
    pub max_objects: usize,      // Максимальное количество объектов
    pub used_ids: HashSet<String>,
    pub target_object_count: usize,
    pub time: f32,               // Общее время существования системы
}

// Создание уникального ID для объекта
static NEXT_OBJECT_ID: AtomicUsize = AtomicUsize::new(1);

pub fn get_next_object_id() -> usize {
    NEXT_OBJECT_ID.fetch_add(1, Ordering::SeqCst)
}

// Создает пустой объект со случайными параметрами
fn create_empty_object(rng: &mut impl Rng) -> SpaceObject {
    // Используем константы для определения границ пространства
    let field_width = 100.0;  // Половина ширины всего пространства
    let x_range = field_width / 2.0;
    let y_range = field_width / 2.0;
    
    // Зарождаем объект на дальней Z-плоскости
    let z_pos = SPACE_FAR_Z;
    
    // Позиция X и Y - случайная в пределах всего пространства
    let x_pos = rng.gen_range(-x_range..x_range);
    let y_pos = rng.gen_range(-y_range..y_range);
    
    // Случайная задержка появления для более естественного распределения
    let spawn_delay = rng.gen_range(MIN_SPAWN_DELAY..MAX_SPAWN_DELAY);
    
    // Время жизни - случайное, но достаточное для прохождения всего пути
    let base_lifespan = 15.0;
    let lifespan = base_lifespan + rng.gen::<f32>() * 10.0;
    
    // Начальный размер ВСЕГДА 0.0 при зарождении, как требует задание
    let initial_size = INITIAL_OBJECT_SIZE;
    
    // Максимальный размер в диапазоне от MIN до MAX размера объекта
    let size_ratio = MIN_OBJECT_SIZE_RATIO + rng.gen::<f32>() * (MAX_OBJECT_SIZE_RATIO - MIN_OBJECT_SIZE_RATIO);
    let max_size = size_ratio * field_width;
    
    // Случайный цвет
    let r = 0.5 + rng.gen::<f32>() * 0.5; // от 0.5 до 1.0
    let g = 0.5 + rng.gen::<f32>() * 0.5;
    let b = 0.5 + rng.gen::<f32>() * 0.5;
    let opacity = 0.2; // Начальная прозрачность низкая
    
    // Мы знаем, что наше поле зрения это 25% от всего пространства
    let viewing_width = field_width * VIEWING_PLANE_SIZE_RATIO;
    let viewing_height = field_width * VIEWING_PLANE_SIZE_RATIO;
    
    // Выбираем точку выхода за пределами нашего угла видимости
    // Гарантируем, что точка выхода находится за пределами нашего поля видимости
    let exit_x = if rng.gen_bool(0.5) {
        // Выход слева или справа от поля зрения
        if rng.gen_bool(0.5) {
            rng.gen_range(-x_range..-viewing_width/2.0) // Левая сторона
        } else {
            rng.gen_range(viewing_width/2.0..x_range) // Правая сторона
        }
    } else {
        // Внутри поля зрения по X
        rng.gen_range(-viewing_width/2.0..viewing_width/2.0)
    };
    
    let mut exit_y = if rng.gen_bool(0.5) {
        // Выход сверху или снизу от поля зрения
        if rng.gen_bool(0.5) {
            rng.gen_range(-y_range..-viewing_height/2.0) // Нижняя сторона
        } else {
            rng.gen_range(viewing_height/2.0..y_range) // Верхняя сторона
        }
    } else {
        // Внутри поля зрения по Y
        rng.gen_range(-viewing_height/2.0..viewing_height/2.0)
    };
    
    // Убеждаемся, что точка выхода не находится внутри поля видимости
    // Если обе координаты попали в диапазон видимости, смещаем Y-координату
    if exit_x.abs() < viewing_width/2.0 && exit_y.abs() < viewing_height/2.0 {
        if rng.gen_bool(0.5) {
            // Смещаем вверх
            exit_y = viewing_height/2.0 + rng.gen_range(0.0..y_range - viewing_height/2.0);
        } else {
            // Смещаем вниз
            exit_y = -viewing_height/2.0 - rng.gen_range(0.0..y_range - viewing_height/2.0);
        }
    }
    
    // Вычисляем направление движения от начальной точки к выходной
    // Это даст нам вектор направления в плоскости XY
    let total_distance = ((exit_x - x_pos).powi(2) + (exit_y - y_pos).powi(2)).sqrt();
    let norm_factor = 1.0 / total_distance;
    
    // Корректируем скорость по X и Y с учетом направления
    let dir_x = (exit_x - x_pos) * norm_factor;
    let dir_y = (exit_y - y_pos) * norm_factor;
    
    // Базовая скорость по Z - случайная в допустимых пределах
    // Используем MIN_OBJECT_SPEED и MAX_OBJECT_SPEED из глобальных констант
    let base_speed = MIN_OBJECT_SPEED + rng.gen::<f32>() * (MAX_OBJECT_SPEED - MIN_OBJECT_SPEED);
    
    // Вычисляем компоненты скорости по всем осям
    // Для Z всегда положительная скорость (движение к просмотровой плоскости)
    let z_velocity = base_speed;
    
    // Для X и Y скорость зависит от направления на выходную точку
    // Масштабируем относительно Z-скорости, чтобы объект достиг выхода вовремя
    let xy_speed_ratio = 0.3; // 30% от Z-скорости для плавного движения
    let x_vel = dir_x * base_speed * xy_speed_ratio;
    let y_vel = dir_y * base_speed * xy_speed_ratio;
    
    // Общая скорость объекта
    let z_vel = z_velocity;
    
    // Создаем объект с указанными параметрами
    let mut object = SpaceObject {
        id: get_next_object_id(),
        position: [x_pos, y_pos, z_pos],
        velocity: [x_vel, y_vel, z_vel],
        acceleration: [0.0, 0.0, 0.0],
        size: initial_size, // Начальный размер всегда 0
        color: [r, g, b, opacity],
        is_active: true,
        lifespan,
        age: -spawn_delay, // Отрицательный возраст = объект еще не активирован
        max_size,
        grow_rate: 0.1,
        object_type: SpaceObjectType::NeonComet,
        tail_particles: None,
        rotation: [0.0, 0.0, 0.0],
        scale: 1.0,
        initial_z: z_pos,
        is_center_trajectory: false,
        passed_center: false,
        size_multiplier: 1.0,
        target_exit_position: [exit_x, exit_y],
        opacity_factor: opacity,
        distance_traveled_ratio: 0.0,
    };
    
    // Инициализируем хвост для комет
    if object.object_type == SpaceObjectType::NeonComet {
        object.tail_particles = Some(Vec::with_capacity(100));
    }
    
    object
}

impl SpaceObjectSystem {
    // Создать новую систему объектов с заданным количеством частиц
    pub fn new(num_particles: usize) -> Self {
        let max_objects = 10; // Максимальное количество объектов
        let num_to_create = num_particles.min(max_objects);
        
        let mut objects = Vec::with_capacity(num_to_create);
        
        let mut rng = rand::thread_rng();
        
        for _ in 0..num_to_create {
            objects.push(create_empty_object(&mut rng));
        }
        
        SpaceObjectSystem {
            objects,
            next_id: get_next_object_id(),
            max_objects,
            used_ids: HashSet::new(),
            target_object_count: num_particles,
            time: 0.0,
        }
    }
    
    // Создать новую систему с фиксированным количеством частиц
    pub fn new_with_fixed_particles(num_particles: usize) -> Self {
        let max_objects = 10; // Максимальное количество объектов
        let num_to_create = num_particles.min(max_objects);
        
        let mut objects = Vec::with_capacity(num_to_create);
        
        let mut rng = rand::thread_rng();
        
        for _ in 0..num_to_create {
            objects.push(Self::create_fixed_object(&mut rng));
        }
        
        SpaceObjectSystem {
            objects,
            next_id: get_next_object_id(),
            max_objects,
            used_ids: HashSet::new(),
            target_object_count: num_particles,
            time: 0.0,
        }
    }
    
    // Создать объект с фиксированными параметрами (для тестирования)
    fn create_fixed_object(rng: &mut impl Rng) -> SpaceObject {
        // Используем константы для определения пространства
        let field_width = 100.0;  // Полная ширина поля в обе стороны
        let x_range = field_width / 2.0;
        let y_range = field_width / 2.0;
        
        // Зарождаем объект на дальней Z-плоскости
        let z_pos = SPACE_FAR_Z;
        
        // Случайная позиция X и Y в пределах всего пространства
        let x_pos = rng.gen_range(-x_range..x_range);
        let y_pos = rng.gen_range(-y_range..y_range);
        
        // Задержка появления для естественного распределения
        let spawn_delay = rng.gen_range(MIN_SPAWN_DELAY..MAX_SPAWN_DELAY);
        
        // Начальный размер всегда нулевой (будет расти по мере приближения)
        let initial_size = INITIAL_OBJECT_SIZE;
        
        // Максимальный размер в диапазоне от минимального до максимального
        let size_ratio = MIN_OBJECT_SIZE_RATIO + rng.gen::<f32>() * (MAX_OBJECT_SIZE_RATIO - MIN_OBJECT_SIZE_RATIO);
        let max_size = size_ratio * field_width;
        
        // Генерация цветов (голубой-синий спектр для комет)
        let r = rng.gen_range(0.2..0.5);
        let g = rng.gen_range(0.5..0.9);
        let b = rng.gen_range(0.8..1.0);
        let opacity = 0.2;  // Начальная прозрачность низкая
        
        // Наш угол видимости определяется размером просмотровой плоскости
        let viewing_width = field_width * VIEWING_PLANE_SIZE_RATIO;
        let viewing_height = field_width * VIEWING_PLANE_SIZE_RATIO;
        
        // Выбираем точку выхода за пределами нашего угла видимости
        // Гарантируем, что точка выхода находится за пределами нашего поля видимости
        let exit_x = if rng.gen_bool(0.5) {
            // Выход слева или справа от поля зрения
            if rng.gen_bool(0.5) {
                rng.gen_range(-x_range..-viewing_width/2.0) // Левая сторона
            } else {
                rng.gen_range(viewing_width/2.0..x_range) // Правая сторона
            }
        } else {
            // Внутри поля зрения по X
            rng.gen_range(-viewing_width/2.0..viewing_width/2.0)
        };
        
        let mut exit_y = if rng.gen_bool(0.5) {
            // Выход сверху или снизу от поля зрения
            if rng.gen_bool(0.5) {
                rng.gen_range(-y_range..-viewing_height/2.0) // Нижняя сторона
            } else {
                rng.gen_range(viewing_height/2.0..y_range) // Верхняя сторона
            }
        } else {
            // Внутри поля зрения по Y
            rng.gen_range(-viewing_height/2.0..viewing_height/2.0)
        };
        
        // Убеждаемся, что точка выхода не находится внутри поля видимости
        // Если обе координаты попали в диапазон видимости, смещаем Y-координату
        if exit_x.abs() < viewing_width/2.0 && exit_y.abs() < viewing_height/2.0 {
            if rng.gen_bool(0.5) {
                // Смещаем вверх
                exit_y = viewing_height/2.0 + rng.gen_range(0.0..y_range - viewing_height/2.0);
            } else {
                // Смещаем вниз
                exit_y = -viewing_height/2.0 - rng.gen_range(0.0..y_range - viewing_height/2.0);
            }
        }
        
        // Вычисляем направление движения к точке выхода
        let dir_to_exit = [
            exit_x - x_pos,
            exit_y - y_pos,
            SPACE_NEAR_Z - z_pos,
        ];
        
        // Нормализуем направление
        let dir_length = (dir_to_exit[0].powi(2) + dir_to_exit[1].powi(2) + dir_to_exit[2].powi(2)).sqrt();
        let dir_normalized = [
            dir_to_exit[0] / dir_length,
            dir_to_exit[1] / dir_length,
            dir_to_exit[2] / dir_length,
        ];
        
        // Базовая скорость в пределах от минимальной до максимальной
        let base_speed = MIN_OBJECT_SPEED + rng.gen::<f32>() * (MAX_OBJECT_SPEED - MIN_OBJECT_SPEED);
        
        // Масштабируем скорость для более заметного движения
        let speed_scale = 10.0;
        let speed = base_speed * speed_scale;
        
        // Устанавливаем компоненты скорости
        // Z-компонента всегда положительная (движение к просмотровой плоскости)
        // X и Y компоненты зависят от направления к точке выхода
        let x_vel = dir_normalized[0] * speed * 0.8;
        let y_vel = dir_normalized[1] * speed * 0.8;
        let z_vel = dir_normalized[2] * speed;
        
        // Создаем объект с заданными параметрами
        let mut object = SpaceObject {
            id: get_next_object_id(),
            position: [x_pos, y_pos, z_pos],
            velocity: [x_vel, y_vel, z_vel],
            acceleration: [0.0, 0.0, 0.0],
            size: initial_size,  // Начальный размер всегда нулевой
            color: [r, g, b, opacity],
            is_active: true,
            lifespan: 30.0,  // Достаточное время для преодоления всего расстояния
            age: -spawn_delay,  // Отрицательный возраст для задержки появления
            max_size,
            grow_rate: 0.1,
            object_type: SpaceObjectType::NeonComet,
            tail_particles: None,
            rotation: [0.0, 0.0, 0.0],
            scale: 1.0,
            initial_z: z_pos,
            is_center_trajectory: false,
            passed_center: false,
            size_multiplier: 1.0,
            target_exit_position: [exit_x, exit_y],
            opacity_factor: opacity,
            distance_traveled_ratio: 0.0,
        };
        
        // Инициализируем хвост для комет с некоторыми начальными частицами
        if object.object_type == SpaceObjectType::NeonComet {
            object.tail_particles = Some(Vec::with_capacity(100));
        }
        
        object
    }
    
    // Создать новые объекты до нужного количества
    fn spawn_new_objects(&mut self) {
        let mut rng = rand::thread_rng();
        let target_count = self.target_object_count;
        
        while self.objects.len() < target_count {
            // Создаем новый объект с использованием глобальной функции
            let object = create_empty_object(&mut rng);
            
            // Обновляем next_id
            self.next_id = get_next_object_id();
            
            // Добавляем объект в систему
            self.objects.push(object);
        }
    }
    
    // Обновить состояние всех объектов в системе
    pub fn update(&mut self, delta_time: f32) {
        let mut objects_to_remove = Vec::new();
        
        for object in &mut self.objects {
            // Увеличиваем возраст объекта
            object.age += delta_time;
            
            // Пропускаем обновление объекта, если он еще не "родился" (отрицательный возраст)
            if object.age < 0.0 {
                continue;
            }
            
            // Вычисляем пройденное расстояние от начальной точки до текущей позиции
            // Используем абсолютные значения для корректного расчёта расстояний
            let total_distance = f32::abs(SPACE_FAR_Z - SPACE_NEAR_Z);
            let traveled_distance = f32::abs(object.position[2] - SPACE_FAR_Z);
            object.distance_traveled_ratio = traveled_distance / total_distance;
            
            // Проверяем, пересек ли объект просмотровую плоскость
            if !object.passed_center && object.position[2] >= VIEWING_PLANE_Z {
                object.passed_center = true;
                
                // При пересечении просмотровой плоскости создаем эффект
                if object.object_type == SpaceObjectType::NeonComet {
                    check_and_create_comet_effect(object);
                }
            }
            
            // Обновляем непрозрачность объекта
            if !object.passed_center {
                // До пересечения плоскости - объект становится более непрозрачным по мере приближения
                object.opacity_factor = 0.2 + (object.distance_traveled_ratio * 0.8);
            } else {
                // После пересечения - объект начинает исчезать
                // Используем OBJECT_LIFESPAN_AFTER_CROSSING для определения времени жизни после пересечения
                let post_crossing_distance = SPACE_NEAR_Z - VIEWING_PLANE_Z;
                let max_post_crossing_life = post_crossing_distance * OBJECT_LIFESPAN_AFTER_CROSSING;
                let post_travel_distance = object.position[2] - VIEWING_PLANE_Z;
                let post_distance_ratio = post_travel_distance / max_post_crossing_life;
                let life_remaining = 1.0 - post_distance_ratio;
                object.opacity_factor = life_remaining.max(0.0);
            }
            
            // Обновляем цвет с учетом непрозрачности
            object.color[3] = object.opacity_factor;
            
            // Динамическое изменение размера в зависимости от позиции
            // Объект должен начинать с нулевого размера и достигать максимального размера при достижении центра
            if !object.passed_center {
                // Используем квадратичную функцию для экспоненциального роста
                // Это создаст эффект более быстрого роста по мере приближения к центру
                let size_factor = object.distance_traveled_ratio.powf(2.0) * object.size_multiplier;
                object.size = object.max_size * size_factor;
            } else {
                // После прохождения плоскости размер остается максимальным
                object.size = object.max_size * object.size_multiplier;
            }
            
            // Экспоненциальное ускорение объекта по мере приближения к просмотровой плоскости
            if !object.passed_center {
                // Чем ближе к просмотровой плоскости, тем сильнее ускорение
                // Используем экспоненциальную функцию для создания эффекта экспоненциального ускорения
                let acceleration_factor = 1.0 + (object.distance_traveled_ratio.powf(2.0) * 3.0);
                
                // Применяем экспоненциальное ускорение
                object.velocity[0] *= 1.0 + (delta_time * (ACCELERATION_FACTOR - 1.0) * acceleration_factor);
                object.velocity[1] *= 1.0 + (delta_time * (ACCELERATION_FACTOR - 1.0) * acceleration_factor);
                object.velocity[2] *= 1.0 + (delta_time * (ACCELERATION_FACTOR - 1.0) * acceleration_factor);
            }
            
            // Обновляем положение объекта с учетом скорости и времени
            update_object_position(object, delta_time);
            
            // Проверяем, нужно ли удалить объект
            // 1. Объект прошел слишком далеко от просмотровой плоскости
            // 2. Объект превысил свое время жизни
            // 3. Объект стал полностью прозрачным (практически невидимым)
            // 4. Объект прошел просмотровую плоскость и превысил заданное расстояние после пересечения
            if object.position[2] > SPACE_NEAR_Z || 
               object.age > object.lifespan || 
               object.opacity_factor <= 0.01 ||
               (object.passed_center && object.position[2] - VIEWING_PLANE_Z > (SPACE_NEAR_Z - VIEWING_PLANE_Z) * OBJECT_LIFESPAN_AFTER_CROSSING) {
                objects_to_remove.push(object.id);
                continue;
            }
            
            // Обрабатываем частицы хвоста для комет
            if let Some(particles) = &mut object.tail_particles {
                // Обновляем существующие частицы
                particles.retain_mut(|particle| {
                    // Уменьшаем время жизни частицы
                    particle.lifetime -= delta_time;
                    
                    // Обновляем позицию частицы
                    particle.position[0] += particle.velocity[0] * delta_time;
                    particle.position[1] += particle.velocity[1] * delta_time;
                    particle.position[2] += particle.velocity[2] * delta_time;
                    
                    // Обновляем fade_factor на основе оставшегося времени жизни
                    particle.fade_factor = particle.lifetime / particle.max_lifetime;
                    
                    // Оставляем частицу, если её время жизни положительное
                    particle.lifetime > 0.0
                });
                
                // Генерируем новые частицы только для активных объектов
                if object.is_active && object.age > 0.0 {
                    // Генерируем новую частицу с некоторой вероятностью
                    let mut rng = rand::thread_rng();
                    
                    // Вероятность увеличивается с размером объекта
                    let spawn_chance = object.size / object.max_size * 0.3;
                    
                    if rng.gen::<f32>() < spawn_chance {
                        // Создаем новую частицу позади объекта
                        let offset = 0.2; // Небольшое смещение от центра объекта
                        let pos = [
                            object.position[0] - object.velocity[0] * offset * rng.gen::<f32>(),
                            object.position[1] - object.velocity[1] * offset * rng.gen::<f32>(),
                            object.position[2] - object.velocity[2] * offset * rng.gen::<f32>(),
                        ];
                        
                        // Скорость частицы - смесь скорости объекта и случайного компонента
                        let vel = [
                            object.velocity[0] * 0.8 + rng.gen_range(-0.5..0.5),
                            object.velocity[1] * 0.8 + rng.gen_range(-0.5..0.5),
                            object.velocity[2] * 0.8 + rng.gen_range(-0.5..0.5),
                        ];
                        
                        // Время жизни частицы - случайное, но зависит от скорости объекта
                        let max_lifetime = 0.5 + rng.gen::<f32>() * 1.0;
                        
                        // Цвет частицы - близкий к цвету объекта, но с вариациями
                        let color_variation = 0.2;
                        let color = [
                            (object.color[0] + rng.gen_range(-color_variation..color_variation)).clamp(0.0, 1.0),
                            (object.color[1] + rng.gen_range(-color_variation..color_variation)).clamp(0.0, 1.0),
                            (object.color[2] + rng.gen_range(-color_variation..color_variation)).clamp(0.0, 1.0),
                        ];
                        
                        // Размер частицы - меньше размера объекта
                        let size = object.size * rng.gen_range(0.1..0.3);
                        
                        // Создаем новую частицу и добавляем ее в хвост
                        let new_particle = TailParticle {
                            position: pos,
                            velocity: vel,
                            lifetime: max_lifetime,
                            max_lifetime,
                            size,
                            initial_size: size,
                            randomness: rng.gen(),
                            color,
                            fade_factor: 1.0,
                        };
                        
                        particles.push(new_particle);
                    }
                }
            } else if object.is_active && object.age > 0.0 && object.object_type == SpaceObjectType::NeonComet {
                // Если у объекта нет хвоста, но это комета, создаем хвост
                let particles = Vec::new();
                object.tail_particles = Some(particles);
            }
        }
        
        // Удаляем объекты, которые нужно убрать
        for id in objects_to_remove {
            self.objects.retain(|o| o.id != id);
        }
        
        // Добавляем новые объекты, чтобы поддерживать нужное количество
        self.spawn_new_objects();
    }
    
    // Добавить новый объект в систему
    pub fn add_object(&mut self, object: SpaceObject) {
        // Проверяем, не превышено ли максимальное количество объектов
        if self.objects.len() >= self.max_objects {
            // Если превышено, заменяем самый старый объект
            if let Some(oldest) = self.find_oldest_object_index() {
                self.objects[oldest] = object;
            }
            return;
        }
        
        self.objects.push(object);
    }
    
    // Найти индекс самого старого объекта
    fn find_oldest_object_index(&self) -> Option<usize> {
        if self.objects.is_empty() {
            return None;
        }
        
        let mut oldest_idx = 0;
        let mut max_age = self.objects[0].age;
        
        for (idx, obj) in self.objects.iter().enumerate().skip(1) {
            if obj.age > max_age {
                max_age = obj.age;
                oldest_idx = idx;
            }
        }
        
        Some(oldest_idx)
    }
    
    // Инициализирует систему с заданным количеством объектов
    pub fn initialize(&mut self, target_count: usize) {
        self.target_object_count = target_count;
        self.objects.clear();
        self.next_id = 1;
        
        // Заполняем систему начальными объектами
        self.spawn_new_objects();
    }
}

// Создать новую систему космических объектов
#[wasm_bindgen]
pub fn create_space_object_system(num_particles: usize) -> *mut SpaceObjectSystem {
    log(&format!("Creating space object system with {} particles", num_particles));
    
    let system = Box::new(SpaceObjectSystem::new(num_particles));
    Box::into_raw(system)
}

#[wasm_bindgen]
pub fn update_space_object_system(
    system_ptr: *mut SpaceObjectSystem,
    delta_time: f32
) -> bool {
    unsafe {
        if let Some(system) = system_ptr.as_mut() {
            system.time += delta_time;
            let mut intersected = false;

            // Обновляем все активные объекты
            for object in system.objects.iter_mut().filter(|o| o.is_active) {
                // Обновляем позицию объекта
                let initial_position = [object.position[0], object.position[1], object.position[2]];
                
                // Увеличиваем скорость с течением времени (эффект ускорения к зрителю)
                object.velocity[2] += ACCELERATION_FACTOR * delta_time;
                
                // Обновляем позицию
                object.position[0] += object.velocity[0] * delta_time;
                object.position[1] += object.velocity[1] * delta_time;
                object.position[2] += object.velocity[2] * delta_time;
                
                // Проверка прохождения центра и обновление размера
                if !object.passed_center && object.position[2] >= VIEWING_PLANE_Z {
                    object.passed_center = true;
                    
                    // Если это комета - проверяем пересечение с плоскостью наблюдения и создаем эффект
                    if object.object_type == SpaceObjectType::NeonComet {
                        // Получаем ID плоскости наблюдения
                        let plane_id = get_viewing_plane_id();
                        
                        // Вычисляем векторы положения до и после пересечения
                        let position_before = glam::Vec3::new(
                            initial_position[0],
                            initial_position[1],
                            initial_position[2]
                        );
                        
                        let position_after = glam::Vec3::new(
                            object.position[0],
                            object.position[1],
                            object.position[2]
                        );
                        
                        // Проверяем пересечение с кубом, представляющим плоскость наблюдения
                        if let Some(intersection) = crate::intersections::check_line_cube_intersection(
                            position_before,
                            position_after,
                            plane_id as u32,
                            system.time
                        ) {
                            // Создаем объект Intersection из objective_main модуля с данными из intersections модуля
                            let objective_intersection = crate::objective_main::Intersection {
                                position: intersection.position,
                                normal: intersection.normal,
                                distance: 0.0, // Значение по умолчанию
                                intersection_type: crate::objective_main::IntersectionType::Entry,
                                object_id: object.id,
                                plane_id: plane_id,
                                time: intersection.time,
                            };
                            
                            // Вызываем функцию создания эффекта кометы при пересечении
                            crate::neon_comets::create_comet_effect_at_intersection(&objective_intersection, object);
                            intersected = true;
                        }
                    }
                }
                
                // Рассчитываем размер объекта на основе расстояния до камеры
                // Объекты начинают с нулевого размера и растут по мере приближения к камере
                let z_distance = CAMERA_POSITION_Z - object.position[2];
                if z_distance > 0.0 {
                    // Используем экспоненциальное увеличение размера
                    let scale_factor = 1.0 - (-z_distance / SCALING_DISTANCE_FACTOR).exp();
                    object.size = object.max_size * scale_factor;
                } else {
                    // Если объект за камерой, устанавливаем нулевой размер
                    object.size = 0.0;
                }
                
                // Если объект вышел за пределы видимости, деактивируем его
                if object.position[2] > CAMERA_POSITION_Z + DEACTIVATION_DISTANCE {
                    object.is_active = false;
                }
                
                // Обновляем хвост частиц, если они есть
                if let Some(particles) = &mut object.tail_particles {
                    for particle in particles.iter_mut() {
                        if particle.lifetime > 0.0 {
                            particle.lifetime -= delta_time;
                            
                            // Обновляем позицию частицы
                            particle.position[0] += particle.velocity[0] * delta_time;
                            particle.position[1] += particle.velocity[1] * delta_time;
                            particle.position[2] += particle.velocity[2] * delta_time;
                            
                            // Обновляем размер частицы
                            let life_ratio = particle.lifetime / particle.max_lifetime;
                            particle.size = particle.initial_size * life_ratio * object.size;
                            
                            // Обновляем fade_factor для визуальных эффектов
                            particle.fade_factor = life_ratio;
                        }
                    }
                }
            }
            
            // Возвращаем флаг, указывающий было ли пересечение в этом кадре
            return intersected;
        }
    }
    false
}

#[wasm_bindgen]
pub fn get_space_objects_data(system_ptr: *mut SpaceObjectSystem) -> JsValue {
    unsafe {
        if let Some(system) = system_ptr.as_ref() {
            return to_value(&system.objects).unwrap_or(JsValue::NULL);
        }
    }
    JsValue::NULL
}

#[wasm_bindgen]
pub fn free_space_object_system(system_ptr: *mut SpaceObjectSystem) {
    unsafe {
        if !system_ptr.is_null() {
            let _ = Box::from_raw(system_ptr);
        }
    }
}

// Добавить новый объект с заданными параметрами
#[wasm_bindgen]
pub fn add_space_object(system_ptr: *mut SpaceObjectSystem, 
                      x: f32, y: f32, z: f32, 
                      vx: f32, vy: f32, vz: f32,
                      size: f32, 
                      r: f32, g: f32, b: f32, a: f32) {
    unsafe {
        if let Some(system) = system_ptr.as_mut() {
            let object = SpaceObject {
                id: get_next_object_id(),
                position: [x, y, z],
                velocity: [vx, vy, vz],
                acceleration: [0.0, 0.0, 0.0],
                size,
                color: [r, g, b, a],
                is_active: true,
                lifespan: 15.0,
                age: 0.0,
                max_size: size * 2.0,
                grow_rate: 0.1,
                object_type: SpaceObjectType::NeonComet,
                tail_particles: None,
                rotation: [0.0, 0.0, 0.0],
                scale: 1.0,
                initial_z: z,
                is_center_trajectory: false,
                passed_center: false,
                size_multiplier: 1.0,
                target_exit_position: [0.0, 0.0],
                opacity_factor: 1.0,
                distance_traveled_ratio: 0.0,
            };
            
            system.add_object(object);
        }
    }
}

// Создать систему объектов с указанным типом объектов
#[wasm_bindgen]
pub fn create_space_object_system_with_fixed_particles(num_particles: usize, object_type: usize, particles_per_object: usize) -> *mut SpaceObjectSystem {
    log(&format!("Creating space object system with {} fixed particles of type {}, with {} particles per object", 
                num_particles, object_type, particles_per_object));
    
    let mut system = SpaceObjectSystem::new_with_fixed_particles(num_particles);
    
    // Настраиваем тип объектов в системе
    for obj in &mut system.objects {
        match object_type {
            0 => obj.object_type = SpaceObjectType::NeonComet,
            1 => obj.object_type = SpaceObjectType::PolygonalCrystal,
            2 => obj.object_type = SpaceObjectType::EnergySphere,
            _ => obj.object_type = SpaceObjectType::NeonComet, // По умолчанию - кометы
        }
        
        // Инициализируем хвост для комет с заданным количеством частиц
        if obj.object_type == SpaceObjectType::NeonComet {
            obj.tail_particles = Some(Vec::with_capacity(particles_per_object));
        }
    }
    
    Box::into_raw(Box::new(system))
}

// Получить данные о неоновых кометах для системы
#[wasm_bindgen]
pub fn get_neon_comet_data(system_ptr: *mut SpaceObjectSystem) -> JsValue {
    unsafe {
        if let Some(system) = system_ptr.as_ref() {
            // Используем функцию из neon_comets для получения данных в нужном формате
            let comet_data = crate::neon_comets::get_neon_comet_data_from_objects(&system.objects);
            return serde_wasm_bindgen::to_value(&comet_data).unwrap_or(JsValue::NULL);
        }
    }
    JsValue::NULL
}

#[wasm_bindgen]
pub struct SpaceObjectSystemHandle(SpaceObjectSystem);

#[wasm_bindgen]
impl SpaceObjectSystemHandle {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console::log_1(&JsValue::from_str("Creating new space object system"));
        SpaceObjectSystemHandle(SpaceObjectSystem::new(10))
    }

    #[wasm_bindgen]
    pub fn update(&mut self, delta_time: f32) {
        self.0.update(delta_time);
    }

    #[wasm_bindgen]
    pub fn get_objects_data(&self) -> JsValue {
        let objects_data: Vec<_> = self.0.objects
            .iter()
            .filter(|obj| obj.is_active)
            .map(|obj| (obj.id, obj.position, obj.size, obj.color))
            .collect();
        to_value(&objects_data).unwrap()
    }

    #[wasm_bindgen]
    pub fn free(self) {
        drop(self);
    }

    pub fn get_space_objects(&self) -> JsValue {
        let objects_data: Vec<_> = self.0.objects
            .iter()
            .filter(|obj| obj.is_active)
            .map(|obj| (obj.id, obj.position, obj.size, obj.color))
            .collect();
        to_value(&objects_data).unwrap()
    }

    pub fn get_space_object(&self, id: &str) -> JsValue {
        let objects_data: Vec<_> = self.0.objects
            .iter()
            .filter(|obj| obj.is_active && obj.id.to_string() == id)
            .map(|obj| (obj.id, obj.position, obj.size, obj.color))
            .collect();
        to_value(&objects_data).unwrap()
    }
}

// Обновить положение объекта с учетом скорости и времени
fn update_object_position(object: &mut SpaceObject, delta_time: f32) {
    // Используем glam::Vec3 для векторных операций
    let position = Vec3::from_slice(&object.position);
    let velocity = Vec3::from_slice(&object.velocity);
    
    // Обновляем позицию с учетом скорости
    let new_position = position + velocity * delta_time;
    
    // Обновляем значения в объекте
    object.position[0] = new_position.x;
    object.position[1] = new_position.y;
    object.position[2] = new_position.z;
}

// Проверить пересечение кометы с просмотровой плоскостью и создать эффект
fn check_and_create_comet_effect(object: &SpaceObject) {
    let viewing_plane_id = get_viewing_plane_id();
    if viewing_plane_id == 0 {
        return; // Просмотровая плоскость не определена
    }
    
    // Получаем доступ к просмотровой плоскости
    if let Ok(cubes) = SPACE_CUBES.lock() {
        if let Some(cube) = cubes.get(&viewing_plane_id) {
            // Создаем положение до и после пересечения
            let before_position = [
                object.position[0] - object.velocity[0] * 0.1,
                object.position[1] - object.velocity[1] * 0.1,
                object.position[2] - object.velocity[2] * 0.1,
            ];
            
            let after_position = object.position;
            
            // Получаем текущее время
            let time = web_sys::window()
                .and_then(|w| w.performance())
                .map(|p| p.now() / 1000.0)
                .unwrap_or(0.0) as f32;
            
            // Проверяем пересечение и создаем эффект
            if let Some(intersection) = cube.intersects_center_plane_with_info(
                before_position, 
                after_position, 
                object.id, 
                time
            ) {
                // Вызываем функцию создания эффекта из модуля neon_comets
                crate::neon_comets::create_comet_effect_at_intersection(&intersection, object);
            }
        }
    }
} 