use wasm_bindgen::prelude::*;
use glam::{Vec3, Quat};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use rand::{Rng, rngs::StdRng, SeedableRng};
use once_cell::sync::Lazy;
use std::any::Any;
use std::sync::atomic::{AtomicUsize, Ordering};
use dashmap::DashMap;

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

// Глобальное хранилище систем объектов - используем thread-safe DashMap
// который является конкурентным HashMap без блокировок
pub static SPACE_OBJECT_SYSTEMS: Lazy<DashMap<usize, SpaceObjectSystem>> = 
    Lazy::new(|| DashMap::new());

// ID для следующей системы - используем атомик для потокобезопасного инкремента
static NEXT_SYSTEM_ID: AtomicUsize = AtomicUsize::new(0);

#[wasm_bindgen]
pub fn create_space_object_system(viewport_size_percent: f32, fov_degrees: f32) -> usize {
    // Генерируем уникальный ID атомарно без блокировок
    let id = NEXT_SYSTEM_ID.fetch_add(1, Ordering::SeqCst);
    
    let mut system = SpaceObjectSystem::default();
    
    // Update space definition with provided parameters
    if viewport_size_percent > 0.0 {
        system.space.viewport_size_percent = viewport_size_percent;
    }
    
    if fov_degrees > 0.0 {
        // Convert degrees to radians
        system.space.field_of_view = fov_degrees * std::f32::consts::PI / 180.0;
    }
    
    // Устанавливаем позицию наблюдателя как в React (-25 по оси Z)
    // Это соответствует camera.position.set(0, 0, -25) в SpaceScene.tsx
    system.space.observer_position = Vec3::new(0.0, 0.0, -25.0);
    
    // Вставляем систему в хранилище
    SPACE_OBJECT_SYSTEMS.insert(id, system);
    id
}

#[wasm_bindgen]
pub fn update_space_object_system(system_id: usize, dt: f32) -> bool {
    // Check if system exists first
    if !SPACE_OBJECT_SYSTEMS.contains_key(&system_id) {
        return false;
    }
    
    // Get a reference to the space definition first to avoid multiple borrows
    let space_definition = {
        let system = SPACE_OBJECT_SYSTEMS.get(&system_id).unwrap();
        system.space.clone()
    };
    
    // Now do the actual update
    if let Some(mut system_ref) = SPACE_OBJECT_SYSTEMS.get_mut(&system_id) {
        // Обновляем все объекты
        for (_type, objects) in system_ref.objects.iter_mut() {
            // Используем retain для удаления неактивных объектов
            objects.retain_mut(|obj| obj.update(dt, &space_definition));
        }
        true
    } else {
        // This should never happen since we checked above
        false
    }
}

// Вспомогательные функции для генерации случайных значений
pub fn random_position_on_far_plane(rng: &mut StdRng, space: &SpaceDefinition) -> Vec3 {
    // Генерируем позицию на дальней плоскости (z = max_z)
    // Расчет ширины и высоты дальней плоскости для размещения комет
    let viewport = space.get_viewport_dimensions();
    
    // Устанавливаем максимальное отклонение от центра плоскости
    // для предотвращения слишком быстрых боковых движений
    let max_width = viewport.x * 1.5;  // Было 1.2, увеличиваем немного зону появления
    let max_height = viewport.y * 1.5; // Было 1.2
    
    // Более равномерное распределение с акцентом на центральную область
    let (x, y) = if rng.gen::<f32>() < 0.7 {
        // 70% появляются в центральной части плоскости
        (
            rng.gen_range(-max_width * 0.7..max_width * 0.7),
            rng.gen_range(-max_height * 0.7..max_height * 0.7)
        )
    } else {
        // 30% появляются ближе к краям, но не слишком далеко
        // Это позволит сохранить разнообразие траекторий
        (
            rng.gen_range(-max_width..max_width),
            rng.gen_range(-max_height..max_height)
        )
    };
    
    // Устанавливаем стабильное значение Z для всех комет
    // с небольшой вариацией для естественности
    let z_variation = rng.gen_range(-1.0..1.0);
    let z = space.max_z + z_variation;
    
    Vec3::new(x, y, z)
}

pub fn random_trajectory_through_viewport(
    rng: &mut StdRng, 
    start_pos: Vec3, 
    space: &SpaceDefinition
) -> Vec3 {
    // Вероятность различных типов траекторий - дальнейшее снижение прямых попаданий в камеру
    let direct_hit_prob = 0.01;  // Уменьшаем с 2% до 1% вероятность прямого попадания в камеру
    let near_camera_prob = 0.05; // Уменьшаем с 8% до 5% вероятность пролета рядом с камерой
    
    // Позиция наблюдателя (камеры)
    let camera_pos = space.observer_position;
    
    // Генерируем случайное число для определения типа траектории
    let trajectory_type = rng.gen::<f32>();
    
    // Максимальное отклонение от оси Z для обеспечения более равномерного движения
    // Это снизит вероятность появления очень быстрых боковых движений
    let max_lateral_deviation = 40.0; // Снижаем с 50.0 до 40.0
    
    let end_pos = if trajectory_type < direct_hit_prob {
        // Прямо в камеру (случайное смещение не более 1 единицы от центра)
        let offset_x = rng.gen_range(-1.0..1.0);
        let offset_y = rng.gen_range(-1.0..1.0);
        let offset_z = rng.gen_range(-1.0..1.0);
        Vec3::new(
            camera_pos.x + offset_x,
            camera_pos.y + offset_y,
            camera_pos.z + offset_z
        )
    } else if trajectory_type < direct_hit_prob + near_camera_prob {
        // Близко к камере (увеличиваем минимальное расстояние от центра)
        let offset_magnitude = rng.gen_range(5.0..12.0); // Увеличиваем диапазон с 4-10 до 5-12
        let offset_direction = Vec3::new(
            rng.gen_range(-0.8..0.8), // Ограничиваем боковое смещение
            rng.gen_range(-0.8..0.8), // Ограничиваем боковое смещение
            rng.gen_range(-1.0..1.0)
        ).normalize();
        
        camera_pos + offset_direction * offset_magnitude
    } else {
        // Большинство комет летят в случайном направлении внутри пространства
        
        // Используем более ограниченную область для конечных точек по X/Y
        // чтобы предотвратить чрезмерное боковое движение
        let end_x = rng.gen_range(-max_lateral_deviation..max_lateral_deviation);
        let end_y = rng.gen_range(-max_lateral_deviation..max_lateral_deviation);
        
        // Делаем более разнообразное распределение по Z с акцентом на центральную область
        let end_z = if rng.gen_bool(0.8) { // Увеличиваем с 0.7 до 0.8
            // 80% случаев - за камерой на разном расстоянии (предпочтительно)
            rng.gen_range(camera_pos.z - 60.0..camera_pos.z - 10.0) // Изменяем с 5-70 на 10-60
        } else {
            // 20% случаев - перед камерой (с положительной Z)
            rng.gen_range(camera_pos.z + 10.0..camera_pos.z + 25.0) // Уменьшаем с 5-30 на 10-25
        };
        
        Vec3::new(end_x, end_y, end_z)
    };
    
    // Формируем вектор направления от начальной до конечной точки
    let mut direction = (end_pos - start_pos).normalize();
    
    // Ограничиваем боковые компоненты скорости (X и Y)
    // чтобы предотвратить слишком быстрое боковое движение
    let lateral_sqr = direction.x * direction.x + direction.y * direction.y;
    if lateral_sqr > 0.6 * 0.6 { // Снижаем порог с 0.7 до 0.6
        let lateral_scale = 0.6 / lateral_sqr.sqrt();
        direction.x *= lateral_scale;
        direction.y *= lateral_scale;
        // Пересчитываем Z компоненту, чтобы вектор оставался нормализованным
        direction.z = (1.0 - (direction.x * direction.x + direction.y * direction.y)).sqrt() * direction.z.signum();
    }
    
    // Более умеренная скорость для равномерного движения
    let distance = (end_pos - start_pos).length();
    let base_speed = rng.gen_range(12.0..20.0); // Снижаем диапазон скоростей с 15-25 до 12-20
    
    // Более плавный рост скорости для дальних объектов
    let speed_factor = 1.0 + distance / 150.0; // Дальнейшее уменьшение фактора роста с 120 до 150
    let speed = base_speed * speed_factor.min(1.8); // Снижаем множитель с 2.0 до 1.8
    
    direction * speed
}
