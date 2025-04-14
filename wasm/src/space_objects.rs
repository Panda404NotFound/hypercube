use wasm_bindgen::prelude::*;
use glam::{Vec3, Quat};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use rand::{Rng, rngs::StdRng, SeedableRng};
use once_cell::sync::Lazy;
use std::sync::Mutex;
use std::any::Any;

use crate::space_core::{SpaceDefinition, Vec3Wrapper};

/// Типы космических объектов
#[wasm_bindgen]
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SpaceObjectType {
    NeonComet,
    EnergySphere,
    PolygonalCrystal,
}

/// JS-compatibility wrapper for Quat
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct QuatWrapper {
    x: f32,
    y: f32,
    z: f32,
    w: f32,
}

#[wasm_bindgen]
impl QuatWrapper {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32, z: f32, w: f32) -> Self {
        Self { x, y, z, w }
    }

    #[wasm_bindgen(getter)]
    pub fn x(&self) -> f32 {
        self.x
    }

    #[wasm_bindgen(getter)]
    pub fn y(&self) -> f32 {
        self.y
    }

    #[wasm_bindgen(getter)]
    pub fn z(&self) -> f32 {
        self.z
    }

    #[wasm_bindgen(getter)]
    pub fn w(&self) -> f32 {
        self.w
    }

    pub fn to_array(&self) -> Box<[f32]> {
        Box::new([self.x, self.y, self.z, self.w])
    }
}

impl From<Quat> for QuatWrapper {
    fn from(q: Quat) -> Self {
        Self {
            x: q.x,
            y: q.y,
            z: q.z,
            w: q.w,
        }
    }
}

impl From<QuatWrapper> for Quat {
    fn from(q: QuatWrapper) -> Self {
        Quat::from_xyzw(q.x, q.y, q.z, q.w)
    }
}

/// Минимальные структурные характеристики космического объекта
#[derive(Clone, Debug)]
pub struct SpaceObjectData {
    // Уникальный идентификатор объекта
    pub id: usize,
    
    // Тип объекта
    pub object_type: SpaceObjectType,
    
    // Позиция в пространстве
    pub position: Vec3,
    
    // Размер объекта (в процентах от максимального размера)
    pub size: f32,
    
    // Масштаб объекта (изменяется в зависимости от расстояния)
    pub scale: f32,
    
    // Прозрачность объекта (от 0.0 до 1.0)
    pub opacity: f32,
    
    // Вращение объекта
    pub rotation: Quat,
    
    // Скорость движения
    pub velocity: Vec3,
    
    // Время жизни объекта (в секундах)
    pub lifetime: f32,
    
    // Максимальное время жизни объекта
    pub max_lifetime: f32,
    
    // Флаг активности объекта
    pub active: bool,
}

/// WASM-friendly wrapper for SpaceObjectData
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct SpaceObjectDataWrapper {
    // Уникальный идентификатор объекта
    pub id: usize,
    
    // Тип объекта
    pub object_type: SpaceObjectType,
    
    // Позиция в пространстве как три float компонента
    position_x: f32,
    position_y: f32,
    position_z: f32,
    
    // Размер объекта (в процентах от максимального размера)
    pub size: f32,
    
    // Масштаб объекта (изменяется в зависимости от расстояния)
    pub scale: f32,
    
    // Прозрачность объекта (от 0.0 до 1.0)
    pub opacity: f32,
    
    // Вращение объекта как четыре float компонента
    rotation_x: f32,
    rotation_y: f32,
    rotation_z: f32,
    rotation_w: f32,
    
    // Скорость движения как три float компонента
    velocity_x: f32,
    velocity_y: f32,
    velocity_z: f32,
    
    // Время жизни объекта (в секундах)
    pub lifetime: f32,
    
    // Максимальное время жизни объекта
    pub max_lifetime: f32,
    
    // Флаг активности объекта
    pub active: bool,
}

#[wasm_bindgen]
impl SpaceObjectDataWrapper {
    #[wasm_bindgen(constructor)]
    pub fn new(id: usize, object_type: SpaceObjectType) -> Self {
        Self {
            id,
            object_type,
            position_x: 0.0,
            position_y: 0.0,
            position_z: 0.0,
            size: 0.0,
            scale: 1.0,
            opacity: 1.0,
            rotation_x: 0.0,
            rotation_y: 0.0,
            rotation_z: 0.0,
            rotation_w: 1.0,
            velocity_x: 0.0,
            velocity_y: 0.0,
            velocity_z: 0.0,
            lifetime: 0.0,
            max_lifetime: 0.0,
            active: false,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn position(&self) -> Vec3Wrapper {
        Vec3Wrapper::new(self.position_x, self.position_y, self.position_z)
    }

    #[wasm_bindgen(getter)]
    pub fn rotation(&self) -> QuatWrapper {
        QuatWrapper::new(self.rotation_x, self.rotation_y, self.rotation_z, self.rotation_w)
    }

    #[wasm_bindgen(getter)]
    pub fn velocity(&self) -> Vec3Wrapper {
        Vec3Wrapper::new(self.velocity_x, self.velocity_y, self.velocity_z)
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_position(&mut self, pos: &Vec3Wrapper) {
        self.position_x = pos.x();
        self.position_y = pos.y();
        self.position_z = pos.z();
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_rotation(&mut self, rot: &QuatWrapper) {
        self.rotation_x = rot.x();
        self.rotation_y = rot.y();
        self.rotation_z = rot.z();
        self.rotation_w = rot.w();
    }
    
    #[wasm_bindgen(setter)]
    pub fn set_velocity(&mut self, vel: &Vec3Wrapper) {
        self.velocity_x = vel.x();
        self.velocity_y = vel.y();
        self.velocity_z = vel.z();
    }
}

impl From<SpaceObjectData> for SpaceObjectDataWrapper {
    fn from(data: SpaceObjectData) -> Self {
        Self {
            id: data.id,
            object_type: data.object_type,
            position_x: data.position.x,
            position_y: data.position.y,
            position_z: data.position.z,
            size: data.size,
            scale: data.scale,
            opacity: data.opacity,
            rotation_x: data.rotation.x,
            rotation_y: data.rotation.y,
            rotation_z: data.rotation.z,
            rotation_w: data.rotation.w,
            velocity_x: data.velocity.x,
            velocity_y: data.velocity.y,
            velocity_z: data.velocity.z,
            lifetime: data.lifetime,
            max_lifetime: data.max_lifetime,
            active: data.active,
        }
    }
}

impl From<SpaceObjectDataWrapper> for SpaceObjectData {
    fn from(wrapper: SpaceObjectDataWrapper) -> Self {
        Self {
            id: wrapper.id,
            object_type: wrapper.object_type,
            position: Vec3::new(wrapper.position_x, wrapper.position_y, wrapper.position_z),
            size: wrapper.size,
            scale: wrapper.scale,
            opacity: wrapper.opacity,
            rotation: Quat::from_xyzw(wrapper.rotation_x, wrapper.rotation_y, wrapper.rotation_z, wrapper.rotation_w),
            velocity: Vec3::new(wrapper.velocity_x, wrapper.velocity_y, wrapper.velocity_z),
            lifetime: wrapper.lifetime,
            max_lifetime: wrapper.max_lifetime,
            active: wrapper.active,
        }
    }
}

/// Трейт для космических объектов
pub trait SpaceObject: Any + Send + Sync {
    // Получить базовые данные объекта
    fn get_data(&self) -> &SpaceObjectData;
    
    // Получить изменяемые данные объекта
    fn get_data_mut(&mut self) -> &mut SpaceObjectData;
    
    // Обновить состояние объекта
    fn update(&mut self, dt: f32, space: &SpaceDefinition) -> bool;
    
    // Инициализировать объект с случайными параметрами
    fn initialize_random(&mut self, rng: &mut StdRng, space: &SpaceDefinition);
    
    // Проверить, находится ли объект в видовом пространстве
    fn is_visible(&self, space: &SpaceDefinition) -> bool {
        space.is_in_view_frustum(&self.get_data().position)
    }
    
    // Получить тип объекта
    fn get_type(&self) -> SpaceObjectType {
        self.get_data().object_type
    }
    
    // Проверить, активен ли объект
    fn is_active(&self) -> bool {
        self.get_data().active
    }
    
    // Деактивировать объект
    fn deactivate(&mut self) {
        self.get_data_mut().active = false;
    }
    
    // Преобразовать в Any для даункаста до конкретного типа
    fn as_any(&self) -> &dyn Any;
    fn as_any_mut(&mut self) -> &mut dyn Any;
}

/// Система управления космическими объектами
pub struct SpaceObjectSystem {
    // Определение пространства
    pub space: SpaceDefinition,
    
    // Список объектов по типам
    objects: HashMap<SpaceObjectType, Vec<Box<dyn SpaceObject>>>,
    
    // Генератор случайных чисел (thread-safe version)
    rng: StdRng,
    
    // Счетчик для генерации уникальных ID
    pub next_id: usize,
}

impl SpaceObjectSystem {
    // Accessor methods for private fields
    
    // Get a reference to the random number generator
    pub fn get_rng_mut(&mut self) -> &mut StdRng {
        &mut self.rng
    }
    
    // Get a reference to objects collection
    pub fn get_objects(&self) -> &HashMap<SpaceObjectType, Vec<Box<dyn SpaceObject>>> {
        &self.objects
    }
    
    // Get a mutable reference to objects collection
    pub fn get_objects_mut(&mut self) -> &mut HashMap<SpaceObjectType, Vec<Box<dyn SpaceObject>>> {
        &mut self.objects
    }
}

impl Default for SpaceObjectSystem {
    fn default() -> Self {
        Self {
            space: SpaceDefinition::new(),
            objects: HashMap::new(),
            rng: StdRng::from_entropy(),
            next_id: 0,
        }
    }
}

// Глобальное хранилище систем объектов
pub static SPACE_OBJECT_SYSTEMS: Lazy<Mutex<HashMap<usize, SpaceObjectSystem>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

// ID для следующей системы
static NEXT_SYSTEM_ID: Lazy<Mutex<usize>> = Lazy::new(|| Mutex::new(0));

#[wasm_bindgen]
pub fn create_space_object_system(viewport_size_percent: f32, fov_degrees: f32) -> usize {
    let mut system_id = NEXT_SYSTEM_ID.lock().unwrap();
    let id = *system_id;
    *system_id += 1;
    
    let mut system = SpaceObjectSystem::default();
    
    // Update space definition with provided parameters
    if viewport_size_percent > 0.0 {
        system.space.viewport_size_percent = viewport_size_percent;
    }
    
    if fov_degrees > 0.0 {
        // Convert degrees to radians
        system.space.field_of_view = fov_degrees * std::f32::consts::PI / 180.0;
    }
    
    // Ensure we're using proper space configuration with the observer at the center
    system.space.observer_position = Vec3::new(0.0, 0.0, 0.0);
    
    SPACE_OBJECT_SYSTEMS.lock().unwrap().insert(id, system);
    id
}

#[wasm_bindgen]
pub fn update_space_object_system(system_id: usize, dt: f32) -> bool {
    let mut systems = SPACE_OBJECT_SYSTEMS.lock().unwrap();
    
    if let Some(system) = systems.get_mut(&system_id) {
        // Обновляем все объекты
        for (_type, objects) in system.objects.iter_mut() {
            // Используем retain для удаления неактивных объектов
            objects.retain_mut(|obj| obj.update(dt, &system.space));
        }
        true
    } else {
        false
    }
}

// Вспомогательные функции для генерации случайных значений
pub fn random_position_on_far_plane(rng: &mut StdRng, space: &SpaceDefinition) -> Vec3 {
    // Генерируем позицию на дальней плоскости (z = max_z)
    let viewport = space.get_viewport_dimensions();
    
    // Генерируем позицию в пределах видимой области, но на дальней плоскости
    // Limit initial positions to a more visible area (central 80% of viewport)
    let x = rng.gen_range(-viewport.x * 0.8..viewport.x * 0.8);
    let y = rng.gen_range(-viewport.y * 0.8..viewport.y * 0.8);
    let z = space.max_z;
    
    Vec3::new(x, y, z)
}

pub fn random_trajectory_through_viewport(
    rng: &mut StdRng, 
    start_pos: Vec3, 
    space: &SpaceDefinition
) -> Vec3 {
    // Генерируем конечную точку за пределами наблюдателя (z < 0)
    let viewport = space.get_viewport_dimensions();
    
    // Генерируем позицию в пределах видимой области, но за наблюдателем
    // Make sure the trajectory passes closer to the center for better visibility
    let end_x = rng.gen_range(-viewport.x * 0.6..viewport.x * 0.6);
    let end_y = rng.gen_range(-viewport.y * 0.6..viewport.y * 0.6);
    let end_z = space.min_z * 0.5; // Половина минимальной Z координаты
    
    let end_pos = Vec3::new(end_x, end_y, end_z);
    
    // Формируем вектор направления от начальной до конечной точки
    let direction = (end_pos - start_pos).normalize();
    
    // Генерируем случайную скорость - увеличиваем минимальную для лучшей видимости
    let speed = rng.gen_range(10.0..25.0);
    
    direction * speed
}
