use wasm_bindgen::prelude::*;
use rand::{Rng, rngs::ThreadRng};
use serde::{Serialize, Deserialize};
use web_sys::console;

use crate::space_objects::{SpaceObject, SpaceObjectType};

/**
 * polygonal_crystals.rs
 * 
 * Модуль для реализации полигональных кристаллов - геометрических объектов
 * с острыми гранями и внутренним свечением. Кристаллы имеют полупрозрачную
 * структуру, которая преломляет свет, создавая радужные отблески.
 * 
 * Кристаллы медленно вращаются вокруг своих осей, создавая игру света.
 * При взаимодействии с другими объектами, они могут раскалываться на более
 * мелкие фрагменты, каждый из которых сохраняет свойства оригинала.
 * 
 * TODO: Реализовать полную функциональность полигональных кристаллов
 */

// Структура для данных о кристаллах для рендеринга
#[derive(Serialize, Deserialize)]
pub struct PolygonalCrystalData {
    pub positions: Vec<f32>,         // Позиции всех кристаллов
    pub rotations: Vec<f32>,         // Вращения всех кристаллов
    pub scales: Vec<f32>,            // Масштабы всех кристаллов
    pub colors: Vec<f32>,            // Цвета всех кристаллов
    pub vertex_counts: Vec<u32>,     // Количество вершин в каждом кристалле
    pub edge_emission: Vec<f32>,     // Свечение рёбер кристаллов
    pub face_opacities: Vec<f32>,    // Прозрачность граней кристаллов
}

// Создание пустого кристалла с произвольными параметрами
pub fn create_empty_crystal(rng: &mut ThreadRng) -> SpaceObject {
    // Позиция кристалла в пространстве - более широкий разброс, чем у комет
    let position = [
        rng.gen_range(-15.0..15.0),
        rng.gen_range(-15.0..15.0),
        rng.gen_range(-25.0..-5.0),
    ];
    
    // Скорость вращения кристалла - медленнее чем у комет
    let rotation_speed = rng.gen_range(0.01..0.05);
    
    // Определяем основной цвет кристалла
    let crystal_colors = [
        [0.9, 0.2, 0.3],  // Рубиновый
        [0.2, 0.8, 0.9],  // Аквамарин
        [0.9, 0.9, 0.2],  // Янтарный
        [0.7, 0.3, 0.9],  // Аметистовый
        [0.3, 0.9, 0.4],  // Изумрудный
    ];
    let color = crystal_colors[rng.gen_range(0..crystal_colors.len())];
    
    // Время жизни объекта - кристаллы живут дольше комет
    let max_lifetime = rng.gen_range(30.0..60.0);
    
    SpaceObject {
        position,
        velocity: [
            rng.gen_range(-0.05..0.05),
            rng.gen_range(-0.05..0.05),
            rng.gen_range(0.05..0.15),
        ],
        acceleration: [0.0, 0.0, 0.0],
        rotation: [
            rng.gen_range(0.0..std::f32::consts::PI * 2.0),
            rng.gen_range(0.0..std::f32::consts::PI * 2.0),
            rng.gen_range(0.0..std::f32::consts::PI * 2.0),
        ],
        scale: rng.gen_range(0.8..1.5),
        lifetime: max_lifetime,
        max_lifetime,
        object_type: SpaceObjectType::PolygonalCrystal,
        tail_particles: None,  // У кристаллов нет хвоста
        color,
        initial_z: position[2],
        is_center_trajectory: false,  // Для кристаллов это поле не используется
    }
}

// Обновление состояния кристаллов
pub fn update_polygonal_crystal(object: &mut SpaceObject, dt: f32) {
    // Вращение кристалла со временем
    object.rotation[0] += 0.01 * dt;
    object.rotation[1] += 0.02 * dt;
    object.rotation[2] += 0.015 * dt;
    
    // Медленное изменение цвета с течением времени
    // TODO: Реализовать плавное изменение цвета кристалла
}

// Извлечение данных о кристаллах для рендеринга
pub fn extract_crystal_data(objects: &[SpaceObject]) -> PolygonalCrystalData {
    let mut positions = Vec::new();
    let mut rotations = Vec::new();
    let mut scales = Vec::new();
    let mut colors = Vec::new();
    let mut vertex_counts = Vec::new();
    let mut edge_emission = Vec::new();
    let mut face_opacities = Vec::new();
    
    for object in objects {
        if let SpaceObjectType::PolygonalCrystal = object.object_type {
            positions.extend_from_slice(&object.position);
            rotations.extend_from_slice(&object.rotation);
            scales.push(object.scale);
            colors.extend_from_slice(&object.color);
            
            // Генерируем случайное количество вершин для каждого кристалла (от 4 до 8)
            // В реальной реализации это должно быть свойством объекта
            vertex_counts.push(4 + (object.position[0].abs() as u32 % 5));
            
            // Свечение рёбер кристалла (больше для более "свежих" кристаллов)
            let life_ratio = object.lifetime / object.max_lifetime;
            edge_emission.push(0.5 + 0.5 * life_ratio);
            
            // Прозрачность граней кристалла
            face_opacities.push(0.3 + 0.2 * life_ratio);
        }
    }
    
    PolygonalCrystalData {
        positions,
        rotations,
        scales,
        colors,
        vertex_counts,
        edge_emission,
        face_opacities,
    }
} 