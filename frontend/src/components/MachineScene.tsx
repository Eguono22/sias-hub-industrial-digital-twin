"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { Suspense, useRef, useState, Component, type ReactNode } from "react";
import type { Mesh } from "three";
function Part({
  name,
  position,
  size,
  color,
  onSelect,
}: {
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  onSelect: (s: string) => void;
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
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={hover ? "#88b5fa" : color}
        metalness={0.5}
        roughness={0.35}
      />
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
      >
        <cylinderGeometry args={[0.23, 0.23, 1.65, 32]} />
        <meshStandardMaterial
          color="#becddd"
          metalness={0.8}
          roughness={0.25}
        />
        <mesh position={[0.23, 0, 0]}>
          <boxGeometry args={[0.012, 1.6, 0.025]} />
          <meshStandardMaterial color="#7f98b2" />
        </mesh>
      </mesh>
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
        fallback={
          <div className="scene-fallback">
            WebGL is unavailable. Select a component below.
          </div>
        }
      >
        <color attach="background" args={["#f8fafd"]} />
        <ambientLight intensity={1.8} />
        <directionalLight position={[4, 8, 5]} intensity={3} />
        <Suspense fallback={null}>
          <group position={[0, -0.3, 0]}>
            <Part
              name="Machine frame"
              position={[0, 0, 0]}
              size={[4.8, 0.2, 1.8]}
              color="#a9bbd0"
              onSelect={onSelect}
            />
            {[-2, 2].flatMap((x) =>
              [-0.65, 0.65].map((z) => (
                <Part
                  key={`${x},${z}`}
                  name="Support frame"
                  position={[x, -0.4, z]}
                  size={[0.16, 0.8, 0.16]}
                  color="#8297ae"
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
                  color="#4479bf"
                  onSelect={onSelect}
                />
                <group position={[0.5, 0.65, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <mesh onClick={() => onSelect("Heated barrel")}>
                    <cylinderGeometry args={[0.32, 0.32, 2.8, 32]} />
                    <meshStandardMaterial
                      color="#b4c3d5"
                      metalness={0.75}
                      roughness={0.3}
                    />
                  </mesh>
                  {[-1, -0.5, 0, 0.5, 1].map((y) => (
                    <mesh
                      key={y}
                      position={[0, y, 0]}
                      rotation={[Math.PI / 2, 0, 0]}
                    >
                      <torusGeometry args={[0.33, 0.045, 12, 32]} />
                      <meshStandardMaterial color="#7289a6" />
                    </mesh>
                  ))}
                </group>
                <mesh
                  position={[-0.4, 1.35, 0]}
                  onClick={() => onSelect("Feed hopper")}
                >
                  <cylinderGeometry args={[0.5, 0.13, 0.7, 4]} />
                  <meshStandardMaterial
                    color="#b7c9dd"
                    metalness={0.6}
                    roughness={0.3}
                  />
                </mesh>
                <Part
                  name="Extrusion die"
                  position={[2, 0.65, 0]}
                  size={[0.35, 0.8, 0.8]}
                  color="#7892b0"
                  onSelect={onSelect}
                />
                <Part
                  name="Control cabinet"
                  position={[0.9, 0.8, -0.7]}
                  size={[0.6, 1.5, 0.35]}
                  color="#d2dfed"
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
                      color="#5182bd"
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
                <Part
                  name="Coating web"
                  position={[0, 1.22, 0]}
                  size={[3, 0.025, 1.5]}
                  color="#a0c6f3"
                  onSelect={onSelect}
                />
              </>
            )}
          </group>
          <Grid
            position={[0, -0.82, 0]}
            args={[14, 14]}
            cellSize={0.5}
            cellColor="#e0e7ef"
            sectionColor="#cbd7e5"
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
