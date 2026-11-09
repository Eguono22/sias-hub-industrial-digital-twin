"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Edges } from "@react-three/drei";
import { Suspense, useRef, useState, Component, type ReactNode } from "react";
import type { Mesh } from "three";

function Part({
  name,
  position,
  size,
  color,
  onSelect,
  metalness = 0.6,
  roughness = 0.35,
}: {
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  onSelect: (s: string) => void;
  metalness?: number;
  roughness?: number;
}) {
  const [hover, setHover] = useState(false);
  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(name);
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      castShadow
      receiveShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={hover ? "#88b5fa" : color}
        metalness={hover ? metalness + 0.2 : metalness}
        roughness={hover ? roughness - 0.1 : roughness}
        envMapIntensity={1.2}
      />
      <Edges scale={1.02} threshold={15} color="#2a2a2a" />
    </mesh>
  );
}
function Roller({
  position,
  running,
  onSelect,
  name = "Coating roller",
}: {
  position: [number, number, number];
  running: boolean;
  onSelect: (s: string) => void;
  name?: string;
}) {
  const ref = useRef<Mesh>(null);
  const [hover, setHover] = useState(false);
  useFrame((_, delta) => {
    if (running && ref.current) ref.current.rotation.y += delta * 1.8;
  });
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(name);
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.23, 0.23, 1.65, 32]} />
        <meshStandardMaterial
          color={hover ? "#88b5fa" : "#becddd"}
          metalness={hover ? 0.9 : 0.85}
          roughness={hover ? 0.15 : 0.25}
          envMapIntensity={1.3}
        />
        <Edges scale={1.01} threshold={15} color="#1a1a1a" />
        <mesh position={[0.23, 0, 0]} castShadow>
          <boxGeometry args={[0.012, 1.6, 0.025]} />
          <meshStandardMaterial
            color="#5a6d85"
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      </mesh>
      {running && (
        <mesh position={[0.3, 0, 0]}>
          <cylinderGeometry args={[0.24, 0.24, 1.65, 8]} />
          <meshStandardMaterial
            color="rgba(0,0,0,0.05)"
            transparent
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        3D rendering is unavailable. Use the component selector below to inspect
        equipment.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function MachineScene({
  machine,
  running,
  onSelect,
}: {
  machine: string;
  running: boolean;
  onSelect: (s: string) => void;
}) {
  return (
    <SceneBoundary>
      <Canvas
        camera={{ position: [5, 3.7, 5], fov: 38 }}
        dpr={[1, 1.5]}
        shadows
        fallback={
          <div className="scene-fallback">
            WebGL is unavailable. Select a component below.
          </div>
        }
      >
        <color attach="background" args={["#e8eef5"]} />
        <fog attach="fog" args={["#e8eef5", 8, 20]} />

        <ambientLight intensity={0.6} color="#ffffff" />
        <directionalLight
          position={[6, 10, 5]}
          intensity={2.5}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-3}
          castShadow
        />

        <pointLight position={[-4, 6, 3]} intensity={1} color="#ffffff" decay={2} />
        <pointLight position={[4, 5, -4]} intensity={0.8} color="#e8eef5" decay={2} />

        <Suspense fallback={null}>
          <group position={[0, -0.3, 0]}>
            <Part
              name="Machine frame"
              position={[0, 0, 0]}
              size={[4.8, 0.2, 1.8]}
              color="#8fa8bf"
              metalness={0.7}
              roughness={0.3}
              onSelect={onSelect}
            />
            {[-2, 2].flatMap((x) =>
              [-0.65, 0.65].map((z) => (
                <Part
                  key={`${x},${z}`}
                  name="Support frame"
                  position={[x, -0.4, z]}
                  size={[0.16, 0.8, 0.16]}
                  color="#6a7a8f"
                  metalness={0.75}
                  roughness={0.25}
                  onSelect={onSelect}
                />
              )),
            )}
            {machine === "EXT-001" ? (
              <>
                <Part
                  name="Drive motor"
                  position={[-1.5, 0.55, 0]}
                  size={[1, 1, 0.95]}
                  color="#2c5aa0"
                  metalness={0.65}
                  roughness={0.35}
                  onSelect={onSelect}
                />
                <group position={[0.5, 0.65, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <mesh
                    onClick={() => onSelect("Heated barrel")}
                    castShadow
                    receiveShadow
                  >
                    <cylinderGeometry args={[0.32, 0.32, 2.8, 32]} />
                    <meshStandardMaterial
                      color="#9aabbd"
                      metalness={0.8}
                      roughness={0.25}
                      envMapIntensity={1.2}
                    />
                  </mesh>
                  {[-1, -0.5, 0, 0.5, 1].map((y) => (
                    <mesh
                      key={y}
                      position={[0, y, 0]}
                      rotation={[Math.PI / 2, 0, 0]}
                      castShadow
                    >
                      <torusGeometry args={[0.33, 0.045, 12, 32]} />
                      <meshStandardMaterial
                        color="#5a6d85"
                        metalness={0.72}
                        roughness={0.28}
                      />
                    </mesh>
                  ))}
                </group>
                <mesh
                  position={[-0.4, 1.35, 0]}
                  onClick={() => onSelect("Feed hopper")}
                  castShadow
                >
                  <cylinderGeometry args={[0.5, 0.13, 0.7, 4]} />
                  <meshStandardMaterial
                    color="#9dafbe"
                    metalness={0.65}
                    roughness={0.32}
                    envMapIntensity={1.1}
                  />
                </mesh>
                <Part
                  name="Extrusion die"
                  position={[2, 0.65, 0]}
                  size={[0.35, 0.8, 0.8]}
                  color="#5a6d85"
                  metalness={0.72}
                  roughness={0.3}
                  onSelect={onSelect}
                />
                <Part
                  name="Control cabinet"
                  position={[0.9, 0.8, -0.7]}
                  size={[0.6, 1.5, 0.35]}
                  color="#c5d5e8"
                  metalness={0.5}
                  roughness={0.4}
                  onSelect={onSelect}
                />
              </>
            ) : (
              <>
                {[-1.5, 0, 1.5].map((x) => (
                  <group key={x}>
                    <Part
                      name="Roller stand"
                      position={[x, 0.6, 0]}
                      size={[0.15, 1.2, 1.9]}
                      color="#3d5a8a"
                      metalness={0.7}
                      roughness={0.32}
                      onSelect={onSelect}
                    />
                    <Roller
                      position={[x, 1, 0]}
                      running={running}
                      onSelect={onSelect}
                    />
                    <Roller
                      position={[x, 0.45, 0]}
                      running={running}
                      onSelect={onSelect}
                    />
                  </group>
                ))}
                <mesh
                  position={[0, 1.22, 0]}
                  onClick={() => onSelect("Coating web")}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[3, 0.025, 1.5]} />
                  <meshStandardMaterial
                    color="#8dd3f7"
                    metalness={0.4}
                    roughness={0.5}
                    envMapIntensity={0.9}
                  />
                </mesh>
              </>
            )}
          </group>
          <mesh position={[0, -0.82, 0]} receiveShadow>
            <planeGeometry args={[14, 14]} />
            <meshStandardMaterial color="#d8dfe8" roughness={0.6} metalness={0.1} />
          </mesh>
          <Grid
            position={[0, -0.815, 0]}
            args={[14, 14]}
            cellSize={0.5}
            cellColor="#cbd7e5"
            sectionColor="#a8b8cc"
            fadeDistance={16}
          />
          <OrbitControls
            makeDefault
            minDistance={3}
            maxDistance={12}
            maxPolarAngle={Math.PI / 2.1}
          />
        </Suspense>
      </Canvas>
    </SceneBoundary>
  );
}
