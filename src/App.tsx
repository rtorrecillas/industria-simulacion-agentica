import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Gauge,
  Maximize2,
  Pause,
  Play,
  PlayCircle,
  RotateCcw,
  Timer,
  Zap,
} from "lucide-react";
import {
  AGENT_START_STEP,
  FINAL_STEP,
  INTRO_STEP,
  STEP_MS,
  TOTAL_STEPS,
  agentEvents,
  getProgress,
  getScenarioForStep,
  getScenarioIndexForStep,
  getVisibleEvents,
  headlineStats,
  playbackMilestones,
  scenarios,
  stations,
  toolIcons,
  toolLabels,
  type AgentEvent,
  type Scenario,
  type Severity,
  type Station,
  type ToolKind,
} from "./data";

const severityLabel: Record<Severity, string> = {
  info: "evento",
  tool: "herramienta",
  reason: "razona",
  warning: "alerta",
  success: "decide",
};

const toolColor: Record<ToolKind, string> = {
  DES: "#009FDF",
  MES: "#47EBDD",
  APS: "#2BCA95",
  SCADA: "#FFA100",
  PLC: "#FF00B3",
  AGENT: "#FFFFFF",
};

type StoryMode = "intro" | "agent" | "final";

const controlStops = playbackMilestones.map((milestone) => milestone.step);

function isControlStop(step: number): boolean {
  return controlStops.includes(step);
}

function getNextControlStop(step: number): number {
  return controlStops.find((stop) => stop > step) ?? controlStops[controlStops.length - 1] ?? step;
}

function getPreviousControlStop(step: number): number {
  for (let index = controlStops.length - 1; index >= 0; index -= 1) {
    if (controlStops[index] < step) {
      return controlStops[index];
    }
  }

  return controlStops[0] ?? step;
}

function shouldAutoPlayOnEntry(step: number): boolean {
  return step === AGENT_START_STEP;
}

function App() {
  const [activeStep, setActiveStep] = useState(INTRO_STEP);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveStep((current) => {
        if (current < AGENT_START_STEP) {
          return AGENT_START_STEP;
        }

        if (current >= TOTAL_STEPS - 1) {
          window.setTimeout(() => setIsPlaying(false), 0);
          return current;
        }

        const nextStep = current + 1;

        if (isControlStop(nextStep)) {
          window.setTimeout(() => setIsPlaying(false), 0);
        }

        return nextStep;
      });
    }, STEP_MS);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const scenario = getScenarioForStep(activeStep);
  const scenarioIndex = getScenarioIndexForStep(activeStep);
  const visibleEvents = useMemo(() => getVisibleEvents(activeStep), [activeStep]);
  const storyMode: StoryMode = activeStep < AGENT_START_STEP ? "intro" : activeStep >= FINAL_STEP ? "final" : "agent";

  const jumpToStep = (step: number) => {
    setActiveStep(step);
    setIsPlaying(shouldAutoPlayOnEntry(step));
  };

  const runFromStep = (step: number) => {
    setActiveStep(step);
    setIsPlaying(step >= AGENT_START_STEP && step < FINAL_STEP);
  };

  const goToNextStop = () => {
    const nextStop = getNextControlStop(activeStep);

    setActiveStep(nextStop);
    setIsPlaying(shouldAutoPlayOnEntry(nextStop));
  };

  const goToPreviousStop = () => {
    setActiveStep(getPreviousControlStop(activeStep));
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (activeStep < AGENT_START_STEP) {
      runFromStep(AGENT_START_STEP);
      return;
    }

    if (activeStep >= FINAL_STEP) {
      setIsPlaying(false);
      return;
    }

    setIsPlaying((value) => !value);
  };

  const reset = () => {
    setActiveStep(INTRO_STEP);
    setIsPlaying(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => undefined);
      return;
    }

    document.exitFullscreen().catch(() => undefined);
  };

  return (
    <main className="app-shell">
      <div className="ambient-grid" />
      <div className="ambient-line ambient-line-a" />
      <div className="ambient-line ambient-line-b" />

      {storyMode === "agent" ? (
        <section className="presentation-frame">
          <AgentPanel activeStep={activeStep} isPlaying={isPlaying} visibleEvents={visibleEvents} />

          <section className="simulator-area">
            <TopBar
              activeStep={activeStep}
              isPlaying={isPlaying}
              scenario={scenario}
              scenarioIndex={scenarioIndex}
              onJump={jumpToStep}
              onNextStop={goToNextStop}
              onPreviousStop={goToPreviousStop}
              onReset={reset}
              onTogglePlay={togglePlay}
              onFullscreen={toggleFullscreen}
            />

            <div className="simulator-grid">
              <ScenarioSummary activeStep={activeStep} scenario={scenario} />
              <PlantSimulator activeStep={activeStep} scenario={scenario} />
            </div>
          </section>
        </section>
      ) : (
        <DigitalTwinStage
          activeStep={activeStep}
          isPlaying={isPlaying}
          mode={storyMode}
          scenario={scenario}
          scenarioIndex={scenarioIndex}
          onJump={jumpToStep}
          onRunFrom={runFromStep}
          onNextStop={goToNextStop}
          onPreviousStop={goToPreviousStop}
          onReset={reset}
          onTogglePlay={togglePlay}
          onFullscreen={toggleFullscreen}
        />
      )}
    </main>
  );
}

interface DigitalTwinStageProps {
  activeStep: number;
  isPlaying: boolean;
  mode: Exclude<StoryMode, "agent">;
  scenario: Scenario;
  scenarioIndex: number;
  onJump: (step: number) => void;
  onRunFrom: (step: number) => void;
  onNextStop: () => void;
  onPreviousStop: () => void;
  onReset: () => void;
  onTogglePlay: () => void;
  onFullscreen: () => void;
}

function DigitalTwinStage({
  activeStep,
  isPlaying,
  mode,
  scenario,
  scenarioIndex,
  onJump,
  onRunFrom,
  onNextStop,
  onPreviousStop,
  onReset,
  onTogglePlay,
  onFullscreen,
}: DigitalTwinStageProps) {
  const finalMode = mode === "final";

  return (
    <section className={`digital-twin-stage ${finalMode ? "final" : "intro"}`}>
      <TwinCanvas optimized={finalMode} />

      <header className="twin-topbar">
        <div className="twin-brand">
          <div className="brand-mark">
            <span className="brand-mark-core" />
          </div>
          <div>
            <p className="eyebrow">{finalMode ? "Escenario recomendado" : "Conexión al gemelo digital"}</p>
            <h1>{finalMode ? "Planta optimizada validada en 3D" : "Plant Simulation conectado"}</h1>
          </div>
        </div>

        <div className="controls twin-controls">
          <button aria-label="Bloque anterior" onClick={onPreviousStop} type="button">
            <ChevronLeft size={17} />
          </button>
          <button aria-label={isPlaying ? "Pausar" : "Reproducir"} onClick={onTogglePlay} type="button">
            {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button aria-label="Bloque siguiente" onClick={onNextStop} type="button">
            <ChevronRight size={17} />
          </button>
          <button aria-label="Reiniciar" onClick={onReset} type="button">
            <RotateCcw size={17} />
          </button>
          <button aria-label="Pantalla completa" onClick={onFullscreen} type="button">
            <Maximize2 size={17} />
          </button>
        </div>
      </header>

      <div className="twin-narrative">
        <p>{finalMode ? "Vuelta al gemelo digital" : "Acto 1"}</p>
        <h2>{finalMode ? "Cambios aplicados sobre la planta" : "Arrancamos desde la planta, no desde el chat"}</h2>
        <span>
          {finalMode
            ? "El agente vuelve al modelo 3D con la política seleccionada: secuenciación APS, bypass de inspección y buffer adaptativo."
            : "La historia empieza conectando con el modelo de Siemens Plant Simulation. A partir de este gemelo digital se activa el agente de simulación."}
        </span>
        <div className="twin-connection">
          <strong>{finalMode ? "Resultado" : "Handshake"}</strong>
          <em>{finalMode ? "+28% throughput · -42% lead time · 91% confianza" : "DES model loaded · AssemblyPack_v12 · 8 recursos"}</em>
        </div>
        {!finalMode && (
          <button className="twin-primary" onClick={() => onRunFrom(AGENT_START_STEP)} type="button">
            <PlayCircle size={17} />
            Iniciar agente de simulación
          </button>
        )}
      </div>

      {finalMode && (
        <div className="final-summary">
          <div>
            <span>Throughput</span>
            <strong>238 u/h</strong>
            <em>+28%</em>
          </div>
          <div>
            <span>Lead time</span>
            <strong>22 min</strong>
            <em>-42%</em>
          </div>
          <div>
            <span>WIP</span>
            <strong>21 uds</strong>
            <em>-50%</em>
          </div>
          <div>
            <span>OEE</span>
            <strong>83%</strong>
            <em>+15 pp</em>
          </div>
          <button className="final-restart-tile" onClick={onReset} type="button">
            <RotateCcw size={17} />
            Reiniciar presentación
          </button>
        </div>
      )}

      <footer className="twin-footer">
        <div className="playback twin-playback">
          <div className="progress-track" aria-label="Progreso de la demo">
            <span style={{ width: `${getProgress(activeStep)}%` }} />
            {playbackMilestones.map((milestone) => (
              <button
                aria-label={`Ir a ${milestone.label}`}
                className={activeStep >= milestone.step ? "milestone active" : "milestone"}
                key={milestone.step}
                onClick={() => onJump(milestone.step)}
                style={{ left: `${getProgress(milestone.step)}%` }}
                type="button"
              >
                <span>{milestone.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="scenario-strip twin-strip">
          {scenarios.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                className={index === scenarioIndex ? "scenario-tab active" : activeStep >= item.stepStart ? "scenario-tab done" : "scenario-tab"}
                key={item.id}
                onClick={() => onJump(item.stepStart)}
                type="button"
              >
                <span>{item.label}</span>
                <Icon size={16} />
                <strong>{item.name}</strong>
              </button>
            );
          })}
        </div>

        <div className="current-scenario">
          <span>{scenario.phase}</span>
          <strong>{scenario.name}</strong>
        </div>
      </footer>
    </section>
  );
}

type TwinCanvasVariant = "hero" | "embedded";

interface TwinCanvasProps {
  optimized: boolean;
  variant?: TwinCanvasVariant;
  activeStep?: number;
  interactive?: boolean;
}

function TwinCanvas({ optimized, variant = "hero", activeStep = INTRO_STEP, interactive = true }: TwinCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const optimizedRef = useRef(optimized);
  const activeStepRef = useRef(activeStep);
  const embedded = variant === "embedded";

  useEffect(() => {
    optimizedRef.current = optimized;
  }, [optimized]);

  useEffect(() => {
    activeStepRef.current = activeStep;
  }, [activeStep]);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xdce4ea, 0.009);

    const camera = new THREE.PerspectiveCamera(embedded ? 48 : 45, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(embedded ? 16 : 18, embedded ? 17 : 18, embedded ? 24 : 26);
    camera.lookAt(embedded ? -0.6 : -1.2, 0.2, embedded ? -1.1 : -0.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(embedded ? -0.6 : -1.2, 0.25, embedded ? -1.1 : -0.8);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableRotate = interactive;
    controls.enableZoom = interactive;
    controls.enablePan = false;
    controls.autoRotate = !embedded;
    controls.autoRotateSpeed = embedded ? 0 : 0.24;
    controls.minDistance = embedded ? 11 : 13;
    controls.maxDistance = embedded ? 34 : 42;
    controls.minPolarAngle = embedded ? 0.38 : 0.45;
    controls.maxPolarAngle = embedded ? 1.2 : 1.28;
    controls.update();

    let interactionTimeout = 0;
    const pauseCameraOrbit = () => {
      window.clearTimeout(interactionTimeout);
      controls.autoRotate = false;
    };
    const resumeCameraOrbit = () => {
      window.clearTimeout(interactionTimeout);
      interactionTimeout = window.setTimeout(() => {
        controls.autoRotate = true;
      }, 3500);
    };

    controls.addEventListener("start", pauseCameraOrbit);
    controls.addEventListener("end", resumeCameraOrbit);

    const group = new THREE.Group();
    group.position.set(embedded ? 0.4 : 1.2, embedded ? -0.08 : -0.04, embedded ? 0.1 : 0);
    group.rotation.y = -0.42;
    group.scale.setScalar(embedded ? 0.86 : 0.92);
    scene.add(group);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x8796a4, 1.35);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(9, 18, 11);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.left = -22;
    keyLight.shadow.camera.right = 22;
    keyLight.shadow.camera.top = 18;
    keyLight.shadow.camera.bottom = -18;
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x79c7ff, 1.4, 46);
    fillLight.position.set(-14, 7, 10);
    scene.add(fillLight);

    const labelTextures: THREE.Texture[] = [];
    const concreteMaterial = new THREE.MeshStandardMaterial({ color: 0x8c969f, roughness: 0.82, metalness: 0.04 });
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xd8dde1, roughness: 0.55, metalness: 0.05 });
    const steelMaterial = new THREE.MeshStandardMaterial({ color: 0x69727c, roughness: 0.46, metalness: 0.52 });
    const darkSteelMaterial = new THREE.MeshStandardMaterial({ color: 0x202a33, roughness: 0.36, metalness: 0.62 });
    const beltMaterial = new THREE.MeshStandardMaterial({ color: 0x30353a, roughness: 0.42, metalness: 0.22 });
    const rollerMaterial = new THREE.MeshStandardMaterial({ color: 0xb8c1c8, roughness: 0.26, metalness: 0.76 });
    const machineWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xf1f4f6, roughness: 0.34, metalness: 0.12 });
    const machineBlueMaterial = new THREE.MeshStandardMaterial({ color: 0x1f6aa5, roughness: 0.32, metalness: 0.2 });
    const machineDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x1d2730, roughness: 0.42, metalness: 0.38 });
    const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x1c9fd0, transparent: true, opacity: 0.34, roughness: 0.04, metalness: 0.02 });
    const safetyMaterial = new THREE.MeshStandardMaterial({ color: 0xf5c400, roughness: 0.36, metalness: 0.16 });
    const fencePanelMaterial = new THREE.MeshStandardMaterial({ color: 0xf5c400, transparent: true, opacity: 0.22, roughness: 0.3, metalness: 0.08 });
    const warningMaterial = new THREE.MeshStandardMaterial({ color: 0xff9f1c, emissive: 0x8a2d00, roughness: 0.32, metalness: 0.12 });
    const greenMaterial = new THREE.MeshStandardMaterial({ color: 0x2bca95, emissive: 0x0b3428, roughness: 0.34, metalness: 0.18 });
    const cyanMaterial = new THREE.MeshStandardMaterial({ color: 0x009fdf, emissive: 0x002b45, roughness: 0.32, metalness: 0.24 });
    const cartonMaterial = new THREE.MeshStandardMaterial({ color: 0xb7834c, roughness: 0.72, metalness: 0.02 });
    const palletMaterial = new THREE.MeshStandardMaterial({ color: 0x9a6a38, roughness: 0.76, metalness: 0.02 });
    const laneMaterial = new THREE.MeshStandardMaterial({ color: 0xffd44d, roughness: 0.48, metalness: 0.04 });
    const redMaterial = new THREE.MeshStandardMaterial({ color: 0xe64242, emissive: 0x4e0808, roughness: 0.35, metalness: 0.1 });
    const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.44, metalness: 0.35 });

    const addBox = (
      size: [number, number, number],
      position: [number, number, number],
      material: THREE.Material,
      parent: THREE.Object3D = group,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
      mesh.position.set(position[0], position[1], position[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    const addCylinder = (
      radiusTop: number,
      radiusBottom: number,
      height: number,
      position: [number, number, number],
      material: THREE.Material,
      parent: THREE.Object3D = group,
      segments = 32,
    ) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
      mesh.position.set(position[0], position[1], position[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    const addLabel = (title: string, subtitle: string, color: string, position: [number, number, number], scale: [number, number]) => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 160;
      const context = canvas.getContext("2d");

      if (context) {
        context.fillStyle = "rgba(16, 22, 28, 0.92)";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = color;
        context.fillRect(0, 0, canvas.width, 12);
        context.fillStyle = "#ffffff";
        context.font = "700 42px Poppins, Arial";
        context.fillText(title, 28, 70);
        context.fillStyle = "rgba(255,255,255,0.72)";
        context.font = "500 27px DM Sans, Arial";
        context.fillText(subtitle, 28, 118);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      labelTextures.push(texture);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
      sprite.position.set(position[0], position[1], position[2]);
      sprite.scale.set(scale[0], scale[1], 1);
      group.add(sprite);
      return sprite;
    };

    const addFloorMarking = (x: number, z: number, width: number, depth: number, rotation = 0) => {
      const marking = addBox([width, 0.022, depth], [x, 0.035, z], laneMaterial);
      marking.rotation.y = rotation;
      marking.castShadow = false;
      return marking;
    };

    const addFactoryShell = () => {
      addBox([34, 0.26, 21], [0, -0.13, 0], concreteMaterial);
      addBox([34, 3.2, 0.32], [0, 1.6, -9.9], wallMaterial);
      addBox([0.32, 3.2, 20.5], [-16.9, 1.6, 0.15], wallMaterial);

      [-13.2, -10.6, -8].forEach((x) => {
        addBox([1.65, 2.15, 0.08], [x, 1.16, -9.72], darkSteelMaterial);
        addBox([1.25, 0.18, 0.12], [x, 2.32, -9.63], safetyMaterial);
      });

      for (let x = -15; x <= 15; x += 5) {
        addBox([0.22, 4.9, 0.22], [x, 2.45, -8.7], steelMaterial);
        addBox([0.22, 4.2, 0.22], [x, 2.1, 7.8], steelMaterial);
        addBox([0.18, 0.18, 16.5], [x, 4.75, -0.4], steelMaterial);
      }

      for (let z = -7; z <= 7; z += 3.5) {
        const lightBar = addBox([24, 0.08, 0.18], [1.5, 4.45, z], new THREE.MeshBasicMaterial({ color: 0xffffff }));
        lightBar.castShadow = false;
        const stripLight = new THREE.PointLight(0xffffff, 0.36, 16);
        stripLight.position.set(1.5, 4.25, z);
        group.add(stripLight);
      }

      addFloorMarking(-7, 5.9, 15, 0.16);
      addFloorMarking(4.5, 5.9, 8.8, 0.16);
      addFloorMarking(6.3, 2.4, 0.16, 7.8, -0.66);
      addFloorMarking(-12, -5.4, 4.2, 0.16);
      addFloorMarking(-7.8, -5.4, 4.2, 0.16);
    };

    type PathPoint = { x: number; z: number };

    const samplePath = (points: PathPoint[], progress: number) => {
      const lengths = points.slice(1).map((point, index) => {
        const previous = points[index];
        return Math.hypot(point.x - previous.x, point.z - previous.z);
      });
      const total = lengths.reduce((sum, length) => sum + length, 0);
      let target = progress * total;

      for (let index = 0; index < lengths.length; index += 1) {
        const segment = lengths[index];
        const from = points[index];
        const to = points[index + 1];

        if (target <= segment || index === lengths.length - 1) {
          const local = segment === 0 ? 0 : target / segment;
          return {
            x: THREE.MathUtils.lerp(from.x, to.x, local),
            z: THREE.MathUtils.lerp(from.z, to.z, local),
            angle: Math.atan2(to.z - from.z, to.x - from.x),
          };
        }

        target -= segment;
      }

      return { ...points[points.length - 1], angle: 0 };
    };

    const addConveyor = (points: [PathPoint, PathPoint], width: number, material: THREE.Material) => {
      const [start, end] = points;
      const conveyor = new THREE.Group();
      const length = Math.hypot(end.x - start.x, end.z - start.z);
      const angle = Math.atan2(end.z - start.z, end.x - start.x);
      conveyor.position.set((start.x + end.x) / 2, 0, (start.z + end.z) / 2);
      conveyor.rotation.y = -angle;
      group.add(conveyor);

      addBox([length, 0.24, width], [0, 0.42, 0], material, conveyor);
      addBox([length, 0.16, 0.08], [0, 0.66, width / 2 + 0.08], steelMaterial, conveyor);
      addBox([length, 0.16, 0.08], [0, 0.66, -width / 2 - 0.08], steelMaterial, conveyor);

      const rollerCount = Math.max(4, Math.floor(length / 0.55));
      for (let index = 0; index < rollerCount; index += 1) {
        const roller = addCylinder(0.055, 0.055, width + 0.16, [-length / 2 + 0.28 + index * 0.55, 0.61, 0], rollerMaterial, conveyor, 16);
        roller.rotation.x = Math.PI / 2;
        roller.castShadow = false;
      }

      for (let x = -length / 2 + 0.7; x < length / 2; x += 2.3) {
        addBox([0.12, 0.75, 0.12], [x, 0.06, width / 2], steelMaterial, conveyor);
        addBox([0.12, 0.75, 0.12], [x, 0.06, -width / 2], steelMaterial, conveyor);
      }

      return conveyor;
    };

    const addMachine = (label: string, subtitle: string, x: number, z: number, width: number, depth: number, height: number, accent: THREE.Material) => {
      const cell = new THREE.Group();
      cell.position.set(x, 0, z);
      group.add(cell);
      addBox([width, 0.26, depth], [0, 0.13, 0], darkSteelMaterial, cell);
      addBox([width * 0.84, height, depth * 0.72], [0, 0.26 + height / 2, 0], machineWhiteMaterial, cell);
      addBox([width * 0.9, 0.16, depth * 0.82], [0, height + 0.44, 0], accent, cell);
      addBox([width * 0.22, height * 0.38, 0.06], [-width * 0.2, height * 0.66, -depth * 0.39], glassMaterial, cell);
      addBox([0.34, 0.26, 0.08], [width * 0.38, height * 0.62, -depth * 0.44], machineDarkMaterial, cell);
      addCylinder(0.12, 0.12, 0.18, [width * 0.38, height + 0.72, -depth * 0.2], accent, cell, 20);
      addLabel(label, subtitle, accent === warningMaterial ? "#ffa100" : accent === greenMaterial ? "#2bca95" : "#009fdf", [x, height + 1.35, z - depth * 0.08], [2.55, 0.8]);
      return cell;
    };

    const addRack = (x: number, z: number) => {
      const rack = new THREE.Group();
      rack.position.set(x, 0, z);
      group.add(rack);

      [-1.15, 1.15].forEach((sideX) => {
        [-0.95, 0.95].forEach((sideZ) => {
          addBox([0.08, 2.7, 0.08], [sideX, 1.35, sideZ], steelMaterial, rack);
        });
      });

      [0.62, 1.42, 2.22].forEach((height) => {
        addBox([2.55, 0.08, 2.1], [0, height, 0], steelMaterial, rack);
      });

      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          addBox([0.58, 0.42, 0.52], [-0.72 + col * 0.72, 0.92 + row * 0.78, -0.36 + (col % 2) * 0.7], cartonMaterial, rack);
        }
      }
    };

    const addPalletStack = (x: number, z: number, cartons = 4) => {
      const stack = new THREE.Group();
      stack.position.set(x, 0, z);
      group.add(stack);
      addBox([1.25, 0.14, 0.95], [0, 0.08, 0], palletMaterial, stack);
      addBox([1.15, 0.1, 0.12], [0, 0.19, -0.28], palletMaterial, stack);
      addBox([1.15, 0.1, 0.12], [0, 0.19, 0.28], palletMaterial, stack);
      for (let index = 0; index < cartons; index += 1) {
        addBox([0.48, 0.42, 0.4], [-0.3 + (index % 2) * 0.6, 0.48 + Math.floor(index / 2) * 0.43, -0.2 + (index % 2) * 0.4], cartonMaterial, stack);
      }
      return stack;
    };

    const addFence = (x: number, z: number, width: number, depth: number) => {
      const fence = new THREE.Group();
      fence.position.set(x, 0, z);
      group.add(fence);
      const postPositions = [
        [-width / 2, -depth / 2],
        [width / 2, -depth / 2],
        [-width / 2, depth / 2],
        [width / 2, depth / 2],
        [0, -depth / 2],
        [0, depth / 2],
      ];
      postPositions.forEach(([px, pz]) => addBox([0.08, 1.45, 0.08], [px, 0.73, pz], safetyMaterial, fence));
      addBox([width, 1.02, 0.04], [0, 0.82, -depth / 2], fencePanelMaterial, fence);
      addBox([width, 1.02, 0.04], [0, 0.82, depth / 2], fencePanelMaterial, fence);
      addBox([0.04, 1.02, depth], [-width / 2, 0.82, 0], fencePanelMaterial, fence);
      addBox([0.04, 1.02, depth], [width / 2, 0.82, 0], fencePanelMaterial, fence);
      return fence;
    };

    const addRobot = (x: number, z: number, accent: THREE.Material) => {
      const robot = new THREE.Group();
      robot.position.set(x, 0, z);
      group.add(robot);
      addCylinder(0.48, 0.64, 0.32, [0, 0.18, 0], machineDarkMaterial, robot);
      addCylinder(0.28, 0.36, 0.72, [0, 0.68, 0], accent, robot);
      const shoulder = new THREE.Group();
      shoulder.position.set(0, 1.08, 0);
      robot.add(shoulder);
      addBox([1.35, 0.26, 0.26], [0.65, 0.06, 0], accent, shoulder);
      const forearm = new THREE.Group();
      forearm.position.set(1.32, 0.06, 0);
      shoulder.add(forearm);
      addBox([1.1, 0.2, 0.2], [0.54, -0.16, 0], accent, forearm);
      addBox([0.24, 0.1, 0.54], [1.12, -0.2, 0], machineDarkMaterial, forearm);
      return { robot, shoulder, forearm };
    };

    const addCartonCarrier = () => {
      const carrier = new THREE.Group();
      group.add(carrier);
      const tray = addBox([0.82, 0.11, 0.68], [0, 0.38, 0], darkSteelMaterial, carrier);
      const body = addBox([0.52, 0.42, 0.46], [0, 0.66, 0], cartonMaterial, carrier);
      const label = addBox([0.28, 0.24, 0.012], [0, 0.69, -0.236], machineWhiteMaterial, carrier);
      tray.castShadow = true;
      body.castShadow = true;
      label.castShadow = false;
      carrier.userData.body = body;
      return carrier;
    };

    const addAGV = () => {
      const agv = new THREE.Group();
      group.add(agv);
      addBox([1.25, 0.3, 0.82], [0, 0.32, 0], greenMaterial, agv);
      addBox([0.8, 0.28, 0.58], [0, 0.62, 0], cartonMaterial, agv);
      [-0.42, 0.42].forEach((x) => {
        [-0.35, 0.35].forEach((z) => {
          const wheel = addCylinder(0.12, 0.12, 0.09, [x, 0.18, z], blackMaterial, agv, 14);
          wheel.rotation.z = Math.PI / 2;
        });
      });
      return agv;
    };

    addFactoryShell();
    addRack(-8.2, 3.65);
    addRack(-5.2, 3.65);
    addRack(-12.7, 2.6);
    addPalletStack(-13.5, -5.3, 6);
    addPalletStack(-11.9, -5.25, 5);
    addPalletStack(12.7, 4.6, 7);
    addPalletStack(14.1, 3.55, 6);
    addPalletStack(10.9, 5.2, 4);

    addConveyor([{ x: -13.2, z: -2.2 }, { x: 8.4, z: -2.2 }], 0.92, beltMaterial);
    addConveyor([{ x: 8.4, z: -2.2 }, { x: 12.8, z: 2.65 }], 0.86, beltMaterial);
    addConveyor([{ x: -8.6, z: -3.55 }, { x: -4.9, z: -3.55 }], 0.74, beltMaterial);
    const bypassConveyor = addConveyor([{ x: 1.7, z: -0.75 }, { x: 8.1, z: 2.4 }], 0.78, greenMaterial);

    addMachine("REC-01", "Recepción + ASN", -12.5, -2.15, 2.15, 1.85, 1.15, cyanMaterial);
    addMachine("BUF-A", "FIFO / lotes APS", -6.6, -2.15, 2.6, 2.25, 1.55, machineBlueMaterial);
    addMachine("ASY-01", "Célula ensamblaje", -2.35, -2.15, 3.4, 2.8, 2.25, cyanMaterial);
    addMachine("QI-02", "Visión + rechazo", 2.75, -2.15, 3.2, 2.9, 2.45, warningMaterial);
    addMachine("PKG-01", "Formado + cerrado", 7.75, -2.15, 3.05, 2.55, 1.95, cyanMaterial);
    addMachine("EXP", "Palletizado salida", 12.6, 2.65, 2.4, 2.15, 1.25, greenMaterial);

    const optimizedBuffer = new THREE.Group();
    optimizedBuffer.position.set(-6.4, -0.02, 0.25);
    group.add(optimizedBuffer);
    addBox([3.2, 0.18, 1.45], [0, 1.98, 0], greenMaterial, optimizedBuffer);
    addLabel("BUF-B+", "buffer adaptativo", "#2bca95", [-6.4, 3.25, 0.25], [2.3, 0.72]);

    addFence(2.75, -2.15, 4.2, 4.15);
    const assemblyRobot = addRobot(-1.1, 1.1, cyanMaterial);
    const inspectionRobot = addRobot(3.2, 0.6, warningMaterial);

    const cameraMast = addCylinder(0.07, 0.07, 2.1, [2.85, 1.15, -0.6], machineDarkMaterial);
    cameraMast.rotation.z = 0.06;
    addBox([1.35, 0.12, 0.16], [2.85, 2.28, -0.6], machineDarkMaterial);
    addBox([0.34, 0.28, 0.22], [3.42, 2.16, -0.6], blackMaterial);

    const hmiPositions: Array<[number, number, string]> = [
      [-2.35, -4.15, "PLC ASY"],
      [2.75, -4.55, "SCADA QI"],
      [7.75, -4.1, "PLC PKG"],
      [-6.6, -4.5, "APS queue"],
    ];
    hmiPositions.forEach(([x, z, text]) => {
      addBox([0.14, 1.05, 0.14], [x, 0.55, z], machineDarkMaterial);
      addBox([0.66, 0.42, 0.08], [x, 1.22, z], blackMaterial);
      addLabel(text, "online", "#009fdf", [x, 1.95, z], [1.45, 0.45]);
    });

    const backlogCartons = Array.from({ length: 11 }).map((_, index) => {
      const backlog = addCartonCarrier();
      backlog.position.set(1.75 + (index % 4) * 0.55, 0, -4.55 + Math.floor(index / 4) * 0.56);
      backlog.scale.setScalar(0.78);
      return backlog;
    });

    const rejectBin = new THREE.Group();
    rejectBin.position.set(5.2, 0, -4.65);
    group.add(rejectBin);
    addBox([1.2, 0.18, 0.8], [0, 0.1, 0], redMaterial, rejectBin);
    addBox([0.08, 0.8, 0.8], [-0.6, 0.5, 0], redMaterial, rejectBin);
    addBox([0.08, 0.8, 0.8], [0.6, 0.5, 0], redMaterial, rejectBin);
    addBox([1.2, 0.8, 0.08], [0, 0.5, 0.4], redMaterial, rejectBin);
    addLabel("REWORK", "piezas rechazadas", "#e64242", [5.2, 1.75, -4.65], [1.85, 0.58]);

    const warningRings = Array.from({ length: 3 }).map((_, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.05 + index * 0.35, 0.018, 8, 90),
        new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? 0xffa100 : 0xe64242, transparent: true, opacity: 0.54 }),
      );
      ring.position.set(2.75, 3.32, -2.15);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      return ring;
    });

    const optimizedGlow = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.025, 8, 120),
      new THREE.MeshBasicMaterial({ color: 0x2bca95, transparent: true, opacity: 0.45 }),
    );
    optimizedGlow.position.set(6.2, 0.08, 0.92);
    optimizedGlow.rotation.x = Math.PI / 2;
    group.add(optimizedGlow);

    const carriers = Array.from({ length: 16 }).map(() => addCartonCarrier());
    const agv = addAGV();
    const baseRoute: PathPoint[] = [
      { x: -13.1, z: -2.2 },
      { x: -6.6, z: -2.2 },
      { x: -2.35, z: -2.2 },
      { x: 2.75, z: -2.2 },
      { x: 7.75, z: -2.2 },
      { x: 12.8, z: 2.65 },
    ];
    const optimizedRoute: PathPoint[] = [
      { x: -13.1, z: -2.2 },
      { x: -6.6, z: -2.2 },
      { x: -2.35, z: -2.2 },
      { x: 1.55, z: -0.85 },
      { x: 6.1, z: 1.24 },
      { x: 12.8, z: 2.65 },
    ];
    const agvRoute: PathPoint[] = [
      { x: -13.4, z: 5.9 },
      { x: -7.2, z: 5.9 },
      { x: -5.1, z: 2.7 },
      { x: -5.1, z: -0.2 },
    ];

    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) {
        return;
      }

      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    let frame = 0;
    let animationId = 0;

    const animate = () => {
      frame += 0.01;
      const step = activeStepRef.current;
      const isOptimized = optimizedRef.current || step >= 13;
      const showDiagnostics = step >= 8 && step < 13;
      const showBypass = isOptimized || step >= 11;
      const showBuffer = isOptimized || step >= 12;
      assemblyRobot.shoulder.rotation.y = Math.sin(frame * 1.7) * 0.42;
      assemblyRobot.forearm.rotation.z = -0.38 + Math.sin(frame * 2.1) * 0.28;
      inspectionRobot.shoulder.rotation.y = 0.85 + Math.sin(frame * 1.35) * 0.32;
      inspectionRobot.forearm.rotation.z = -0.48 + Math.sin(frame * 1.8) * 0.24;
      bypassConveyor.visible = showBypass;
      optimizedBuffer.visible = showBuffer;
      optimizedGlow.visible = isOptimized;
      fillLight.color.setHex(isOptimized ? 0x65ffd2 : 0x79c7ff);
      fillLight.intensity = isOptimized ? 1.75 : 1.25;

      backlogCartons.forEach((carton, index) => {
        carton.visible = !isOptimized || index < 4;
        carton.position.y = Math.sin(frame * 3 + index) * 0.015;
      });

      carriers.forEach((carrier, index) => {
        const speed = isOptimized ? 0.105 : 0.075;
        const t = (frame * speed + index / carriers.length) % 1;
        const sample = samplePath(isOptimized ? optimizedRoute : baseRoute, t);
        carrier.position.set(sample.x, 0.08, sample.z);
        carrier.rotation.y = -sample.angle;
        carrier.visible = isOptimized || !(t > 0.48 && t < 0.62 && index % 3 === 0);
        const body = carrier.userData.body as THREE.Mesh | undefined;
        if (body) {
          body.material = isOptimized && t > 0.48 ? greenMaterial : cartonMaterial;
        }
      });

      const agvSample = samplePath(agvRoute, (frame * 0.05) % 1);
      agv.position.set(agvSample.x, 0.04, agvSample.z);
      agv.rotation.y = -agvSample.angle;

      warningRings.forEach((ring, index) => {
        ring.rotation.z += 0.01 + index * 0.004;
        ring.visible = !isOptimized && (showDiagnostics || !embedded);
        ring.scale.setScalar(1 + Math.sin(frame * 2.4 + index) * 0.045);
      });

      optimizedGlow.rotation.z -= 0.008;
      controls.update();
      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(animationId);
      window.clearTimeout(interactionTimeout);
      controls.removeEventListener("start", pauseCameraOrbit);
      controls.removeEventListener("end", resumeCameraOrbit);
      controls.dispose();
      resizeObserver.disconnect();
      group.traverse((object) => {
        const disposable = object as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
        disposable.geometry?.dispose();
        const material = disposable.material;

        if (material) {
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });
      labelTextures.forEach((texture) => texture.dispose());
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [embedded, interactive]);

  return <div className={embedded ? "twin-canvas twin-canvas-embedded" : "twin-canvas"} ref={mountRef} />;
}

interface AgentPanelProps {
  activeStep: number;
  isPlaying: boolean;
  visibleEvents: AgentEvent[];
}

function AgentPanel({ activeStep, isPlaying, visibleEvents }: AgentPanelProps) {
  const timelineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeline = timelineRef.current;

    if (!timeline) {
      return;
    }

    timeline.scrollTo({
      top: timeline.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleEvents.length]);

  return (
    <aside className="agent-panel">
      <div className="agent-header">
        <div className="brand-mark">
          <span className="brand-mark-core" />
        </div>
        <div>
          <p className="eyebrow">Sistema agéntico industrial</p>
          <h1>Optimización autónoma de planta</h1>
        </div>
      </div>

      <div className="agent-state">
        <div>
          <span className={isPlaying ? "state-dot playing" : "state-dot paused"} />
          <span>{isPlaying ? "Agente en marcha" : "Control manual"}</span>
        </div>
        <strong>{getProgress(activeStep)}%</strong>
      </div>

      <div className="tool-matrix">
        {(Object.keys(toolLabels) as ToolKind[]).map((tool) => {
          const Icon = toolIcons[tool];
          const used = visibleEvents.some((event) => event.tool === tool);
          return (
            <div className={used ? "tool-chip used" : "tool-chip"} key={tool}>
              <Icon size={15} />
              <span>{toolLabels[tool]}</span>
            </div>
          );
        })}
      </div>

      <div className="agent-goal">
        <div className="goal-icon">
          <Gauge size={18} />
        </div>
        <div>
          <span>Función objetivo</span>
          <p>Maximizar producción, bajar WIP y energía, conservar robustez operacional.</p>
        </div>
      </div>

      <div className="timeline" ref={timelineRef}>
        {visibleEvents.map((event) => (
          <AgentLog key={event.id} event={event} active={event.id === activeStep} />
        ))}
      </div>
    </aside>
  );
}

interface AgentLogProps {
  event: AgentEvent;
  active: boolean;
}

function AgentLog({ event, active }: AgentLogProps) {
  const Icon = toolIcons[event.tool];

  return (
    <article className={`agent-log ${event.severity} ${active ? "active" : ""}`}>
      <div className="log-rail">
        <span style={{ background: toolColor[event.tool] }} />
      </div>
      <div className="log-card">
        <div className="log-meta">
          <span>{event.at}</span>
          <span className="log-tool" style={{ color: toolColor[event.tool] }}>
            <Icon size={13} />
            {toolLabels[event.tool]}
          </span>
          <span>{severityLabel[event.severity]}</span>
        </div>
        <h3>{event.title}</h3>
        <p>{event.detail}</p>
        {event.metric && <div className="log-metric">{event.metric}</div>}
        {event.table && (
          <div className="mini-table">
            {event.table.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

interface TopBarProps {
  activeStep: number;
  isPlaying: boolean;
  scenario: Scenario;
  scenarioIndex: number;
  onJump: (step: number) => void;
  onNextStop: () => void;
  onPreviousStop: () => void;
  onReset: () => void;
  onTogglePlay: () => void;
  onFullscreen: () => void;
}

function TopBar({
  activeStep,
  isPlaying,
  scenario,
  scenarioIndex,
  onJump,
  onNextStop,
  onPreviousStop,
  onReset,
  onTogglePlay,
  onFullscreen,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="deck-title">
        <p>Demo interactiva</p>
        <h2>Agente que diseña, simula y evalúa escenarios de planta</h2>
      </div>

      <div className="playback">
        <div className="progress-track" aria-label="Progreso de la demo">
          <span style={{ width: `${getProgress(activeStep)}%` }} />
          {playbackMilestones.map((milestone) => (
            <button
              aria-label={`Ir a ${milestone.label}`}
              className={activeStep >= milestone.step ? "milestone active" : "milestone"}
              key={milestone.step}
              onClick={() => onJump(milestone.step)}
              style={{ left: `${getProgress(milestone.step)}%` }}
              type="button"
            >
              <span>{milestone.label}</span>
            </button>
          ))}
        </div>

        <div className="controls">
          <button aria-label="Bloque anterior" onClick={onPreviousStop} type="button">
            <ChevronLeft size={17} />
          </button>
          <button aria-label={isPlaying ? "Pausar" : "Reproducir"} onClick={onTogglePlay} type="button">
            {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button aria-label="Bloque siguiente" onClick={onNextStop} type="button">
            <ChevronRight size={17} />
          </button>
          <button aria-label="Reiniciar" onClick={onReset} type="button">
            <RotateCcw size={17} />
          </button>
          <button aria-label="Pantalla completa" onClick={onFullscreen} type="button">
            <Maximize2 size={17} />
          </button>
        </div>
      </div>

      <div className="scenario-strip">
        {scenarios.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              className={index === scenarioIndex ? "scenario-tab active" : activeStep >= item.stepStart ? "scenario-tab done" : "scenario-tab"}
              key={item.id}
              onClick={() => onJump(item.stepStart)}
              type="button"
            >
              <span>{item.label}</span>
              <Icon size={16} />
              <strong>{item.name}</strong>
            </button>
          );
        })}
      </div>

      <div className="current-scenario">
        <span>{scenario.phase}</span>
        <strong>{scenario.name}</strong>
      </div>
    </header>
  );
}

interface ScenarioSummaryProps {
  activeStep: number;
  scenario: Scenario;
}

function ScenarioSummary({ activeStep, scenario }: ScenarioSummaryProps) {
  const ScenarioIcon = scenario.icon;

  return (
    <section className="scenario-summary">
      <div className="summary-left">
        <div className="summary-heading">
          <ScenarioIcon size={21} />
          <div>
            <p>Escenario activo</p>
            <h2>{scenario.name}</h2>
          </div>
        </div>
        <p className="scenario-copy">{scenario.summary}</p>
      </div>

      <div className="headline-stats">
        {headlineStats.map((stat) => (
          <div className="headline-stat" key={stat.label}>
            <stat.icon size={16} />
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      <div className="metric-rack">
        <Metric label="Throughput" value={`${scenario.metrics.throughput}`} unit="u/h" delta={scenario.deltas.throughput} />
        <Metric label="WIP" value={`${scenario.metrics.wip}`} unit="uds" delta={scenario.id === "baseline" ? "base" : "-50%"} />
        <Metric label="Lead time" value={`${scenario.metrics.leadTime}`} unit="min" delta={scenario.deltas.leadTime} />
        <Metric label="OEE" value={`${scenario.metrics.oee}`} unit="%" delta={scenario.deltas.oee} />
        <Metric label="Energía" value={`${scenario.metrics.energy}`} unit="kWh/u" delta={scenario.id === "baseline" ? "base" : "-14%"} />
        <Metric label="Confianza" value={`${scenario.metrics.confidence}`} unit="%" delta={activeStep > 12 ? "validado" : "simulado"} />
      </div>
    </section>
  );
}

interface MetricProps {
  label: string;
  value: string;
  unit: string;
  delta: string;
}

function Metric({ label, value, unit, delta }: MetricProps) {
  const isPositive = delta.startsWith("+") || delta === "validado";
  const isNeutral = delta === "base" || delta === "simulado";

  return (
    <div className="metric">
      <span>{label}</span>
      <div>
        <strong>{value}</strong>
        <small>{unit}</small>
      </div>
      <em className={isNeutral ? "neutral" : isPositive ? "positive" : "positive"}>{delta}</em>
    </div>
  );
}

interface PlantSimulatorProps {
  activeStep: number;
  scenario: Scenario;
}

function PlantSimulator({ activeStep, scenario }: PlantSimulatorProps) {
  const currentEvent = agentEvents[activeStep];
  const isOptimized = scenario.id === "optimized";
  const twinOptimized = isOptimized || activeStep >= 13;

  return (
    <section className="plant-shell">
      <div className="plant-header">
        <div>
          <p>Simulador DES conectado</p>
          <h2>Assembly + Packaging Line</h2>
        </div>
        <div className="plant-status">
          <span className={currentEvent.severity === "warning" ? "status-warning" : "status-ok"}>
            {currentEvent.severity === "warning" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            {currentEvent.severity === "warning" ? "Anomalía detectada" : "Modelo sincronizado"}
          </span>
          <span>
            <Timer size={15} />
            T+{String(activeStep * 4).padStart(2, "0")}m
          </span>
        </div>
      </div>

      <div className="plant-floor plant-floor-3d">
        <TwinCanvas activeStep={activeStep} optimized={twinOptimized} variant="embedded" />
        <DES3DOverlay activeStep={activeStep} currentEvent={currentEvent} optimized={twinOptimized} scenario={scenario} />
      </div>

      <div className="plant-footer">
        <div className="experiment-panel">
          <span>Experimento actual</span>
          <strong>{currentEvent.title}</strong>
          <p>{currentEvent.detail}</p>
        </div>
        <div className="decision-panel">
          <Zap size={17} />
          <span>Política candidata</span>
          <strong>{isOptimized ? "APS + bypass + buffer adaptativo" : "Buscar mejora dominante"}</strong>
        </div>
      </div>
    </section>
  );
}

interface DES3DOverlayProps {
  activeStep: number;
  currentEvent: AgentEvent;
  optimized: boolean;
  scenario: Scenario;
}

function DES3DOverlay({ activeStep, currentEvent, optimized, scenario }: DES3DOverlayProps) {
  const showAps = activeStep >= 5;
  const showDiagnosis = activeStep >= 8;
  const showBypass = activeStep >= 11;
  const showBuffer = activeStep >= 12;

  return (
    <div className="des-3d-overlay">
      <div className="des-hud-panel">
        <span>DES runtime</span>
        <strong>{currentEvent.title}</strong>
        <p>{scenario.phase}</p>
        <div>
          <em>{currentEvent.tool}</em>
          <em>{optimized ? "Política validada" : "Simulación activa"}</em>
          <em>32 réplicas</em>
        </div>
      </div>

      <div className="des-signal-stack">
        <span className={showAps ? "online" : ""}>APS secuencia</span>
        <span className={showDiagnosis ? "warning" : ""}>SCADA QI-02</span>
        <span className={showDiagnosis ? "online" : ""}>PLC robot</span>
        <span className={showBypass ? "online" : ""}>BYP-QI</span>
        <span className={showBuffer ? "online" : ""}>BUF-B adaptativo</span>
      </div>

      <div className={`des-callout callout-buffer ${showAps ? "visible" : ""}`}>
        <span>Buffer APS</span>
        <strong>{showBuffer ? "capacidad dinámica" : "lotes por familia"}</strong>
      </div>
      <div className={`des-callout callout-inspection ${showDiagnosis ? "visible warning" : ""}`}>
        <span>QI-02</span>
        <strong>{optimized ? "flujo estabilizado" : "94% utilización"}</strong>
      </div>
      <div className={`des-callout callout-bypass ${showBypass ? "visible optimized" : ""}`}>
        <span>Bypass</span>
        <strong>{optimized ? "validado" : "experimento"}</strong>
      </div>
    </div>
  );
}

interface ConnectionLayerProps {
  activeStep: number;
  optimized: boolean;
}

function ConnectionLayer({ activeStep, optimized }: ConnectionLayerProps) {
  return (
    <svg className="connection-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="line-gradient" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#009FDF" stopOpacity="0.35" />
          <stop offset="55%" stopColor="#47EBDD" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#2BCA95" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <path className="plant-line primary" d="M 17 46 L 21 46 L 34 46 L 39 37 L 55 37 L 62 37 L 78 37 L 83 38 L 96 38" />
      <path className="plant-line secondary" d="M 53 65 L 62 66 L 78 66 L 84 69 L 96 69" />
      <path className={`plant-line bypass-line ${optimized || activeStep >= 11 ? "visible" : ""}`} d="M 70 49 L 70 58 L 78 66 L 84 66" />
      <path className={`pulse-line ${activeStep >= 8 ? "visible" : ""}`} d="M 62 22 L 71 16 L 86 18" />
      <path className={`pulse-line magenta ${activeStep >= 9 && activeStep <= 12 ? "visible" : ""}`} d="M 78 36 L 87 50 L 90 60" />
    </svg>
  );
}

interface StationNodeProps {
  station: Station;
  activeStep: number;
}

function StationNode({ station, activeStep }: StationNodeProps) {
  const Icon = station.icon;
  const active = station.activeSteps.includes(activeStep);
  const warning = station.warningSteps?.includes(activeStep) ?? false;
  const optimized = station.optimizedSteps?.includes(activeStep) ?? false;
  const tool = station.tool ? toolLabels[station.tool] : "DES";

  return (
    <article
      className={`station-node ${active ? "active" : ""} ${warning ? "warning" : ""} ${optimized ? "optimized" : ""}`}
      style={{
        left: `${station.x}%`,
        top: `${station.y}%`,
        width: `${station.w}%`,
        height: `${station.h}%`,
      }}
    >
      <div className="station-top">
        <Icon size={18} />
        <span>{tool}</span>
      </div>
      <strong>{station.name}</strong>
      <p>{station.sub}</p>
      <div className="station-bars">
        <span style={{ width: warning ? "94%" : optimized ? "72%" : active ? "84%" : "58%" }} />
        <span style={{ width: optimized ? "42%" : warning ? "86%" : "62%" }} />
      </div>
    </article>
  );
}

interface MovingPartsProps {
  activeStep: number;
  optimized: boolean;
}

function MovingParts({ activeStep, optimized }: MovingPartsProps) {
  const count = optimized ? 9 : activeStep >= 5 ? 7 : 5;

  return (
    <div className="moving-parts">
      {Array.from({ length: count }).map((_, index) => (
        <span
          className={optimized ? "part optimized" : activeStep >= 9 && index > 4 ? "part delayed" : "part"}
          key={index}
          style={{ animationDelay: `${index * -1.15}s` }}
        />
      ))}
    </div>
  );
}

interface QueueDotsProps {
  activeStep: number;
}

function QueueDots({ activeStep }: QueueDotsProps) {
  const inspectionQueue = activeStep < 5 ? 7 : activeStep < 11 ? 5 : activeStep < 15 ? 4 : 2;
  const packagingQueue = activeStep >= 2 && activeStep <= 9 ? 5 : activeStep >= 15 ? 2 : 3;

  return (
    <>
      <div className="queue queue-inspection" aria-label="Cola inspección">
        {Array.from({ length: inspectionQueue }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="queue queue-packaging" aria-label="Cola packaging">
        {Array.from({ length: packagingQueue }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
    </>
  );
}

interface SensorOverlayProps {
  activeStep: number;
}

function SensorOverlay({ activeStep }: SensorOverlayProps) {
  return (
    <div className="sensor-overlay">
      <SensorPoint x={47} y={22} label="PLC-ASY" active={activeStep >= 8} />
      <SensorPoint x={70} y={18} label="SCADA-QI" active={activeStep >= 8} warning={activeStep >= 9 && activeStep <= 12} />
      <SensorPoint x={90} y={23} label="PLC-PKG" active={activeStep >= 9} />
      <SensorPoint x={28} y={29} label="APS" active={activeStep >= 5} />
      <SensorPoint x={10} y={33} label="MES" active={activeStep >= 3} />
    </div>
  );
}

interface SensorPointProps {
  x: number;
  y: number;
  label: string;
  active: boolean;
  warning?: boolean;
}

function SensorPoint({ x, y, label, active, warning = false }: SensorPointProps) {
  return (
    <div className={`sensor-point ${active ? "active" : ""} ${warning ? "warning" : ""}`} style={{ left: `${x}%`, top: `${y}%` }}>
      <span />
      <strong>{label}</strong>
    </div>
  );
}

export default App;
