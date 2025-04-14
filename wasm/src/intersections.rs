use glam::{Vec3, Vec4};
use serde::{Serialize, Deserialize};
use wasm_bindgen::prelude::*;

// Определение структуры для хранения данных о пересечении
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Intersection {
    pub position: [f32; 3],      // Позиция пересечения
    pub cube_id: u32,            // ID куба, с которым произошло пересечение
    pub time: f32,               // Время пересечения
    pub normal: [f32; 3],        // Нормаль к поверхности в точке пересечения
    pub entry_face_index: u8,    // Индекс грани, через которую вошли
}

// Грани куба в порядке: -X, +X, -Y, +Y, -Z, +Z
const CUBE_FACE_NORMALS: [Vec3; 6] = [
    Vec3::new(-1.0, 0.0, 0.0), // -X
    Vec3::new(1.0, 0.0, 0.0),  // +X
    Vec3::new(0.0, -1.0, 0.0), // -Y
    Vec3::new(0.0, 1.0, 0.0),  // +Y
    Vec3::new(0.0, 0.0, -1.0), // -Z
    Vec3::new(0.0, 0.0, 1.0),  // +Z
];

// Константы для упрощенного представления плоскости наблюдения как куба
// Центр плоскости наблюдения и её границы определяются в space_objects.rs
const VIEWING_PLANE_SIZE: f32 = 20.0; // Размер куба плоскости наблюдения
const VIEWING_PLANE_HALF_SIZE: f32 = VIEWING_PLANE_SIZE / 2.0;

// Функция проверки пересечения линии с кубом
pub fn check_line_cube_intersection(
    start: Vec3,
    end: Vec3,
    cube_id: u32,
    time: f32
) -> Option<Intersection> {
    // Для плоскости наблюдения используем константы из space_objects
    // Позиция плоскости наблюдения по Z совпадает с VIEWING_PLANE_Z из space_objects
    let viewing_plane_z = 0.0; // Должно соответствовать VIEWING_PLANE_Z
    
    // Размеры и позиция куба (плоскости наблюдения)
    let cube_min = Vec3::new(
        -VIEWING_PLANE_HALF_SIZE,
        -VIEWING_PLANE_HALF_SIZE,
        viewing_plane_z - 0.01
    );
    
    let cube_max = Vec3::new(
        VIEWING_PLANE_HALF_SIZE,
        VIEWING_PLANE_HALF_SIZE,
        viewing_plane_z + 0.01
    );
    
    // Направление линии
    let direction = end - start;
    
    // Параметры пересечения
    let mut t_min = 0.0;
    let mut t_max = 1.0;
    let mut entry_face_index = 0;
    
    // Проверка пересечения по каждой оси
    for i in 0..3 {
        if direction[i].abs() < f32::EPSILON {
            // Линия параллельна оси i
            if start[i] < cube_min[i] || start[i] > cube_max[i] {
                // Линия находится за пределами куба
                return None;
            }
        } else {
            // Вычисляем параметры пересечения с плоскостями
            let inv_d = 1.0 / direction[i];
            let mut t1 = (cube_min[i] - start[i]) * inv_d;
            let mut t2 = (cube_max[i] - start[i]) * inv_d;
            
            // Убедимся, что t1 <= t2
            if t1 > t2 {
                std::mem::swap(&mut t1, &mut t2);
                // Если t1 стало меньше, то это указывает на вход через противоположную грань
                if i == 0 && t1 < t_min && t1 > 0.0 {
                    entry_face_index = if inv_d < 0.0 { 1 } else { 0 };
                } else if i == 1 && t1 < t_min && t1 > 0.0 {
                    entry_face_index = if inv_d < 0.0 { 3 } else { 2 };
                } else if i == 2 && t1 < t_min && t1 > 0.0 {
                    entry_face_index = if inv_d < 0.0 { 5 } else { 4 };
                }
            } else {
                // Определяем грань входа
                if i == 0 && t1 > t_min && t1 < t_max {
                    entry_face_index = if inv_d > 0.0 { 0 } else { 1 };
                } else if i == 1 && t1 > t_min && t1 < t_max {
                    entry_face_index = if inv_d > 0.0 { 2 } else { 3 };
                } else if i == 2 && t1 > t_min && t1 < t_max {
                    entry_face_index = if inv_d > 0.0 { 4 } else { 5 };
                }
            }
            
            t_min = t_min.max(t1);
            t_max = t_max.min(t2);
            
            if t_min > t_max {
                return None;
            }
        }
    }
    
    // Если t_min в диапазоне [0, 1], пересечение существует
    if t_min >= 0.0 && t_min <= 1.0 {
        // Вычисляем позицию пересечения
        let intersection_point = start + direction * t_min;
        let normal = CUBE_FACE_NORMALS[entry_face_index as usize];
        
        // Возвращаем данные о пересечении
        return Some(Intersection {
            position: [intersection_point.x, intersection_point.y, intersection_point.z],
            cube_id,
            time,
            normal: [normal.x, normal.y, normal.z],
            entry_face_index,
        });
    }
    
    None
}

// Функция для проверки, находится ли точка внутри куба
pub fn is_point_inside_cube(point: Vec3, cube_min: Vec3, cube_max: Vec3) -> bool {
    point.x >= cube_min.x && point.x <= cube_max.x &&
    point.y >= cube_min.y && point.y <= cube_max.y &&
    point.z >= cube_min.z && point.z <= cube_max.z
} 