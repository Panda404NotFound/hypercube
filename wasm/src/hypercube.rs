use wasm_bindgen::prelude::*;
use nalgebra as na;
use serde::{Serialize, Deserialize};

// Структура, представляющая 4D точку
#[wasm_bindgen]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Point4D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub w: f64,
}

#[wasm_bindgen]
impl Point4D {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64, z: f64, w: f64) -> Self {
        Self { x, y, z, w }
    }
    
    pub fn distance(&self, other: &Point4D) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        let dw = self.w - other.w;
        
        (dx * dx + dy * dy + dz * dz + dw * dw).sqrt()
    }
    
    // Проекция 4D точки в 3D пространство через стереографическую проекцию
    pub fn project_to_3d(&self, w_camera: f64) -> Vec<f64> {
        let factor = 1.0 / (w_camera - self.w);
        
        let proj_x = self.x * factor;
        let proj_y = self.y * factor;
        let proj_z = self.z * factor;
        
        vec![proj_x, proj_y, proj_z]
    }
}

// Структура, представляющая Гиперкуб
#[wasm_bindgen]
pub struct Hypercube {
    vertices: Vec<Point4D>,
    edges: Vec<(usize, usize)>,
}

#[wasm_bindgen]
impl Hypercube {
    #[wasm_bindgen(constructor)]
    pub fn new(size: f64) -> Self {
        let mut vertices = Vec::new();
        let half_size = size / 2.0;
        
        // Создаем 16 вершин гиперкуба (все возможные комбинации ±half_size)
        for i in 0..16 {
            let x = if (i & 1) != 0 { half_size } else { -half_size };
            let y = if (i & 2) != 0 { half_size } else { -half_size };
            let z = if (i & 4) != 0 { half_size } else { -half_size };
            let w = if (i & 8) != 0 { half_size } else { -half_size };
            
            vertices.push(Point4D::new(x, y, z, w));
        }
        
        // Создаем 32 ребра гиперкуба
        // Каждая вершина соединена с 4 другими вершинами
        let mut edges = Vec::new();
        
        for i in 0..16 {
            for j in 0..4 {
                let neighbor = i ^ (1 << j); // XOR для получения соседней вершины
                if i < neighbor { // Избегаем дублирования ребер
                    edges.push((i, neighbor));
                }
            }
        }
        
        Self { vertices, edges }
    }
    
    // Применяем вращение к гиперкубу в разных плоскостях
    pub fn rotate(&mut self, xy_angle: f64, xz_angle: f64, xw_angle: f64, yz_angle: f64, yw_angle: f64, zw_angle: f64) {
        // Создаем матрицы вращения для каждой плоскости
        let mut rotated_vertices = Vec::new();
        
        for vertex in &self.vertices {
            let mut v = na::Vector4::new(vertex.x, vertex.y, vertex.z, vertex.w);
            
            // Применяем последовательные вращения в разных плоскостях
            // XY плоскость
            let xy_rotation = na::Matrix4::new(
                xy_angle.cos(), -xy_angle.sin(), 0.0, 0.0,
                xy_angle.sin(), xy_angle.cos(), 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            );
            v = xy_rotation * v;
            
            // XZ плоскость
            let xz_rotation = na::Matrix4::new(
                xz_angle.cos(), 0.0, -xz_angle.sin(), 0.0,
                0.0, 1.0, 0.0, 0.0,
                xz_angle.sin(), 0.0, xz_angle.cos(), 0.0,
                0.0, 0.0, 0.0, 1.0,
            );
            v = xz_rotation * v;
            
            // XW плоскость
            let xw_rotation = na::Matrix4::new(
                xw_angle.cos(), 0.0, 0.0, -xw_angle.sin(),
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                xw_angle.sin(), 0.0, 0.0, xw_angle.cos(),
            );
            v = xw_rotation * v;
            
            // YZ плоскость
            let yz_rotation = na::Matrix4::new(
                1.0, 0.0, 0.0, 0.0,
                0.0, yz_angle.cos(), -yz_angle.sin(), 0.0,
                0.0, yz_angle.sin(), yz_angle.cos(), 0.0,
                0.0, 0.0, 0.0, 1.0,
            );
            v = yz_rotation * v;
            
            // YW плоскость
            let yw_rotation = na::Matrix4::new(
                1.0, 0.0, 0.0, 0.0,
                0.0, yw_angle.cos(), 0.0, -yw_angle.sin(),
                0.0, 0.0, 1.0, 0.0,
                0.0, yw_angle.sin(), 0.0, yw_angle.cos(),
            );
            v = yw_rotation * v;
            
            // ZW плоскость
            let zw_rotation = na::Matrix4::new(
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, zw_angle.cos(), -zw_angle.sin(),
                0.0, 0.0, zw_angle.sin(), zw_angle.cos(),
            );
            v = zw_rotation * v;
            
            // Сохраняем повернутую вершину
            rotated_vertices.push(Point4D::new(v[0], v[1], v[2], v[3]));
        }
        
        self.vertices = rotated_vertices;
    }
    
    // Получение координат вершин после проецирования в 3D пространство
    pub fn get_projected_vertices(&self, w_camera: f64) -> Vec<f64> {
        let mut result = Vec::new();
        
        for vertex in &self.vertices {
            let projected = vertex.project_to_3d(w_camera);
            result.extend(projected);
        }
        
        result
    }
    
    // Получение индексов рёбер
    pub fn get_edges(&self) -> Vec<u32> {
        let mut result = Vec::new();
        
        for (start, end) in &self.edges {
            result.push(*start as u32);
            result.push(*end as u32);
        }
        
        result
    }
} 