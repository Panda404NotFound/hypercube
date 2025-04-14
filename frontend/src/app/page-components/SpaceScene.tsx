'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { NeonComets } from '../../components/space-objects';
import { OrbitControls } from '@react-three/drei';

// CameraController component to adjust the camera on mount
function CameraController() {
  const { camera, scene } = useThree();
  
  useEffect(() => {
    // Position the camera to look at the negative Z direction
    // This way we'll see comets coming toward us rather than flying away
    camera.position.set(0, 0, -25);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    
    // Log the camera position to confirm it's set correctly
    console.log('Camera positioned at:', camera.position);
  }, [camera, scene]);
  
  return null;
}

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
        position: [0, 0, -25], // Position camera on negative Z axis
        fov: 60,              // Use a more standard field of view
        near: 0.1,
        far: 1000
      }}
      gl={{ 
        antialias: true,
        alpha: true
      }}
    >
      
      {/* OrbitControls to allow camera movement */}
      <OrbitControls enableZoom={true} enablePan={true} enableRotate={true} />
      
      {/* Camera controller for initial positioning */}
      <CameraController />
      
      <Suspense fallback={null}>
        {/* Неоновые кометы - конфигурация полностью в WASM */}
        <NeonComets />
        
        {/* Полигональные кристаллы (будут добавлены позже) */}
        {/* <PolygonalCrystals /> */}
        
        {/* Энергетические сферы (будут добавлены позже) */}
        {/* <EnergySpheres /> */}
      </Suspense>
      
      {/* Enhanced lighting for better visibility */}
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 10]} intensity={1.5} />
      <pointLight position={[10, 10, 10]} intensity={1.2} />
    </Canvas>
  );
} 