'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { NeonComets } from '../../components/space-objects';

// Компонент для отображения космических объектов в 3D-сцене
export default function SpaceScene() {
  console.log('Рендеринг SpaceScene');
  
  return (
    <Canvas 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%',
        pointerEvents: 'none' // Позволяет кликать на элементы под канвасом
      }}
      camera={{ 
        position: [0, 0, 10], // Отодвигаем камеру дальше
        fov: 75,              // Увеличиваем угол обзора
        near: 0.1,
        far: 1000
      }}
      gl={{ 
        antialias: true,
        alpha: true
      }}
    >
      {/* Для отладки - добавляем оси координат */}
      {/* <axesHelper args={[5]} /> */}
      
      <Suspense fallback={null}>
        {/* Неоновые кометы - увеличиваем количество и скорость */}
        <NeonComets 
          count={20} 
          speed={2.5} 
          colorPrimary="#00ff83" 
          colorSecondary="#0083ff" 
        />
        
        {/* Полигональные кристаллы (будут добавлены позже) */}
        {/* <PolygonalCrystals count={5} /> */}
        
        {/* Энергетические сферы (будут добавлены позже) */}
        {/* <EnergySpheres count={3} /> */}
      </Suspense>
      
      {/* Усиливаем освещение для лучшей видимости */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 10]} intensity={1.0} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
    </Canvas>
  );
} 