use wasm_bindgen::prelude::*;
use glam::{Vec3, Vec2};
use std::f32::consts::PI;

// JS-compatible wrapper for Vec3
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct Vec3Wrapper {
    x: f32,
    y: f32,
    z: f32,
}

#[wasm_bindgen]
impl Vec3Wrapper {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
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

    pub fn to_array(&self) -> Box<[f32]> {
        Box::new([self.x, self.y, self.z])
    }
}

impl From<Vec3> for Vec3Wrapper {
    fn from(v: Vec3) -> Self {
        Self {
            x: v.x,
            y: v.y,
            z: v.z,
        }
    }
}

impl From<Vec3Wrapper> for Vec3 {
    fn from(v: Vec3Wrapper) -> Self {
        Vec3::new(v.x, v.y, v.z)
    }
}

// JS-compatible wrapper for Vec2
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct Vec2Wrapper {
    x: f32,
    y: f32,
}

#[wasm_bindgen]
impl Vec2Wrapper {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }

    #[wasm_bindgen(getter)]
    pub fn x(&self) -> f32 {
        self.x
    }

    #[wasm_bindgen(getter)]
    pub fn y(&self) -> f32 {
        self.y
    }

    pub fn to_array(&self) -> Box<[f32]> {
        Box::new([self.x, self.y])
    }
}

impl From<Vec2> for Vec2Wrapper {
    fn from(v: Vec2) -> Self {
        Self {
            x: v.x,
            y: v.y,
        }
    }
}

impl From<Vec2Wrapper> for Vec2 {
    fn from(v: Vec2Wrapper) -> Self {
        Vec2::new(v.x, v.y)
    }
}

/// Определяет размеры и характеристики трехмерного пространства
#[derive(Clone, Debug)]
pub struct SpaceDefinition {
    // Границы пространства по каждой оси
    pub min_x: f32,
    pub max_x: f32,
    pub min_y: f32,
    pub max_y: f32,
    pub min_z: f32,
    pub max_z: f32,
    
    // Размеры видового экрана относительно общего пространства (в процентах)
    pub viewport_size_percent: f32,
    
    // Позиция наблюдателя в пространстве
    pub observer_position: Vec3,
    
    // Угол обзора (в радианах)
    pub field_of_view: f32,
}

// Add a wasm-bindgen wrapper for SpaceDefinition
#[wasm_bindgen]
pub struct SpaceDefinitionWrapper {
    inner: SpaceDefinition,
}

#[wasm_bindgen]
impl SpaceDefinitionWrapper {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: SpaceDefinition::new(),
        }
    }

    #[wasm_bindgen(getter)]
    pub fn min_x(&self) -> f32 {
        self.inner.min_x
    }

    #[wasm_bindgen(getter)]
    pub fn max_x(&self) -> f32 {
        self.inner.max_x
    }

    #[wasm_bindgen(getter)]
    pub fn min_y(&self) -> f32 {
        self.inner.min_y
    }

    #[wasm_bindgen(getter)]
    pub fn max_y(&self) -> f32 {
        self.inner.max_y
    }

    #[wasm_bindgen(getter)]
    pub fn min_z(&self) -> f32 {
        self.inner.min_z
    }

    #[wasm_bindgen(getter)]
    pub fn max_z(&self) -> f32 {
        self.inner.max_z
    }

    #[wasm_bindgen(getter)]
    pub fn viewport_size_percent(&self) -> f32 {
        self.inner.viewport_size_percent
    }

    #[wasm_bindgen(getter)]
    pub fn observer_position(&self) -> Vec3Wrapper {
        self.inner.observer_position.into()
    }

    #[wasm_bindgen(getter)]
    pub fn field_of_view(&self) -> f32 {
        self.inner.field_of_view
    }

    pub fn get_dimensions(&self) -> Vec3Wrapper {
        self.inner.get_dimensions().into()
    }

    pub fn get_viewport_dimensions(&self) -> Vec2Wrapper {
        self.inner.get_viewport_dimensions().into()
    }

    pub fn is_in_view_frustum(&self, position_x: f32, position_y: f32, position_z: f32) -> bool {
        let position = Vec3::new(position_x, position_y, position_z);
        self.inner.is_in_view_frustum(&position)
    }

    pub fn get_scale_factor(&self, position_x: f32, position_y: f32, position_z: f32) -> f32 {
        let position = Vec3::new(position_x, position_y, position_z);
        self.inner.get_scale_factor(&position)
    }

    pub fn get_transparency_factor(&self, position_x: f32, position_y: f32, position_z: f32) -> f32 {
        let position = Vec3::new(position_x, position_y, position_z);
        self.inner.get_transparency_factor(&position)
    }
}

impl SpaceDefinition {
    pub fn new() -> Self {
        // Создаем пространство от -100 до 100 по всем осям
        Self {
            min_x: -100.0,
            max_x: 100.0,
            min_y: -100.0,
            max_y: 100.0,
            min_z: -100.0,
            max_z: 100.0,
            viewport_size_percent: 25.0, // Видовой экран занимает 25% пространства
            observer_position: Vec3::new(0.0, 0.0, -25.0), // Обновляем позицию наблюдателя в соответствии с настройками камеры в React
            field_of_view: PI / 3.0, // 60 градусов
        }
    }
    
    // Получить размеры пространства
    pub fn get_dimensions(&self) -> Vec3 {
        Vec3::new(
            self.max_x - self.min_x,
            self.max_y - self.min_y,
            self.max_z - self.min_z
        )
    }
    
    // Получить размеры viewport в абсолютных единицах
    pub fn get_viewport_dimensions(&self) -> Vec2 {
        let space_dimensions = self.get_dimensions();
        let factor = self.viewport_size_percent / 100.0;
        
        Vec2::new(
            space_dimensions.x * factor,
            space_dimensions.y * factor
        )
    }
    
    // Проверка, находится ли точка в видимой области
    pub fn is_in_view_frustum(&self, position: &Vec3) -> bool {
        // Вычисляем вектор от наблюдателя до точки
        let to_point = *position - self.observer_position;
        
        // Allow objects on the far plane (maximum z) to always be visible
        // This is important for comets that are just spawning
        if (position.z - self.max_z).abs() < 1.0 {
            return true;
        }
        
        // Если объект находится слишком далеко позади наблюдателя, он не видим
        // Используем большее значение (-30), чтобы объекты оставались видимыми дольше
        if to_point.z < -30.0 {
            return false;
        }
        
        // Если объект находится прямо перед наблюдателем (в пределах 5 единиц), 
        // он всегда видим независимо от углов
        let distance = to_point.length();
        if distance < 5.0 {
            return true;
        }
        
        // Вычисляем границы видимой области на расстоянии точки
        let viewport_dims = self.get_viewport_dimensions();
        
        // Увеличиваем видимую область на 50% для обеспечения видимости объектов на краях
        let half_width = viewport_dims.x * 0.75; // 1.5x шире
        let half_height = viewport_dims.y * 0.75; // 1.5x выше
        
        // Используем абсолютное значение z для обработки объектов, которые могут быть немного позади
        // Избегаем деления на очень маленькие числа
        let z_distance = to_point.z.abs().max(0.01);
        
        // Расширяем видимую область для близких объектов
        let scale_factor = 1.0 + (1.0 / z_distance) * 5.0; // Дополнительный масштаб для близких объектов
        
        let adjusted_half_width = half_width * scale_factor;
        let adjusted_half_height = half_height * scale_factor;
        
        // Проецируем положение объекта на плоскость просмотра
        let projected_x = to_point.x / z_distance * self.max_z;
        let projected_y = to_point.y / z_distance * self.max_z;
        
        // Более гибкая проверка - немного расширяем видимую область
        projected_x.abs() <= adjusted_half_width && projected_y.abs() <= adjusted_half_height
    }
    
    // Получить коэффициент масштабирования объекта в зависимости от расстояния
    pub fn get_scale_factor(&self, position: &Vec3) -> f32 {
        // Вектор от наблюдателя до объекта
        let to_point = *position - self.observer_position;
        
        // Расстояние от наблюдателя до объекта
        let distance = to_point.length();
        
        // Максимальная дистанция для расчета масштаба
        let max_distance = 200.0; // Фиксированное значение вместо вычисления
        
        // Нормализованное расстояние (0-1)
        let normalized_distance = (distance / max_distance).min(1.0);
        
        // Применяем более линейную функцию для предотвращения эффекта замедления
        // при приближении к камере. Используем более мягкий переход.
        let scale = 1.0 - normalized_distance * 0.8;
        
        // Для очень близких объектов используем плавное увеличение масштаба
        // без резких изменений, чтобы избежать эффекта "отталкивания" от камеры
        if distance < 10.0 {
            // Плавное увеличение от 1.1x до 1.4x для близких объектов
            let close_factor = 1.1 + (1.0 - (distance / 10.0)) * 0.3;
            return scale * close_factor;
        }
        
        scale
    }
    
    // Получить коэффициент прозрачности объекта в зависимости от расстояния
    pub fn get_transparency_factor(&self, position: &Vec3) -> f32 {
        // Вектор от наблюдателя до объекта
        let to_point = *position - self.observer_position;
        
        // Расстояние от наблюдателя до объекта
        let distance = to_point.length();
        
        // Максимальная дистанция для расчета прозрачности
        let max_distance = 200.0;
        
        // Нормализованное расстояние
        let normalized_distance = (distance / max_distance).min(1.0);
        
        // Убираем особую прозрачность для объектов около наблюдателя,
        // вместо этого используем более мягкий переход
        if distance < 10.0 {
            // От 0.4 (очень близко) до 0.8 (на расстоянии 10 единиц)
            return 0.4 + (distance / 10.0) * 0.4;
        }
        
        // На среднем расстоянии (10-150 единиц) объект полностью непрозрачный
        if normalized_distance < 0.75 {
            return 1.0;
        }
        
        // На дальних дистанциях (более 150 единиц) объект постепенно исчезает
        let fade_factor = (1.0 - normalized_distance) * 4.0; // Плавное исчезновение
        return fade_factor.max(0.0).min(1.0);
    }
} 