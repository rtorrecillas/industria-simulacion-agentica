import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  BrainCircuit,
  Cpu,
  Database,
  Factory,
  FlaskConical,
  GitBranch,
  Gauge,
  Leaf,
  Network,
  PackageCheck,
  RadioTower,
  ScanSearch,
  Settings2,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";

export type ToolKind = "DES" | "MES" | "APS" | "SCADA" | "PLC" | "CARBON" | "AGENT";
export type Severity = "info" | "tool" | "reason" | "warning" | "success";

export interface AgentEvent {
  id: number;
  at: string;
  tool: ToolKind;
  severity: Severity;
  title: string;
  detail: string;
  metric?: string;
  table?: Array<[string, string]>;
}

export interface Scenario {
  id: string;
  label: string;
  name: string;
  phase: string;
  summary: string;
  stepStart: number;
  icon: LucideIcon;
  metrics: {
    throughput: number;
    wip: number;
    leadTime: number;
    oee: number;
    energy: number;
    carbon: number;
    confidence: number;
  };
  deltas: {
    throughput: string;
    leadTime: string;
    oee: string;
  };
}

export interface Station {
  id: string;
  name: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
  icon: LucideIcon;
  tool?: ToolKind;
  activeSteps: number[];
  warningSteps?: number[];
  optimizedSteps?: number[];
}

export const INTRO_STEP = -2;
export const AGENT_START_STEP = 0;
export const FINAL_STEP = 17;
export const TOTAL_STEPS = 19;
export const STEP_MS = 2200;

export const scenarios: Scenario[] = [
  {
    id: "baseline",
    label: "S0",
    name: "Base DES",
    phase: "Cuello de botella",
    summary: "La inspección acumula WIP y bloquea packaging durante los cambios de lote.",
    stepStart: 0,
    icon: Factory,
    metrics: {
      throughput: 186,
      wip: 42,
      leadTime: 38,
      oee: 68,
      energy: 14.8,
      carbon: 0.82,
      confidence: 72,
    },
    deltas: {
      throughput: "base",
      leadTime: "base",
      oee: "base",
    },
  },
  {
    id: "aps",
    label: "S1",
    name: "Secuenciación APS",
    phase: "Menos cambios",
    summary: "Agrupa familias de producto y reduce microparadas por setup en ensamblaje.",
    stepStart: 5,
    icon: GitBranch,
    metrics: {
      throughput: 204,
      wip: 35,
      leadTime: 31,
      oee: 73,
      energy: 14.1,
      carbon: 0.76,
      confidence: 79,
    },
    deltas: {
      throughput: "+9.7%",
      leadTime: "-18%",
      oee: "+5 pp",
    },
  },
  {
    id: "diagnosis",
    label: "S2",
    name: "Diagnóstico MES/SCADA",
    phase: "Causa raíz",
    summary: "Cruza OEE, alarmas PLC, tiempos SCADA y CO2e/u: el robot de inspección satura por falsos rechazos.",
    stepStart: 9,
    icon: ScanSearch,
    metrics: {
      throughput: 212,
      wip: 29,
      leadTime: 27,
      oee: 76,
      energy: 13.9,
      carbon: 0.72,
      confidence: 84,
    },
    deltas: {
      throughput: "+14%",
      leadTime: "-29%",
      oee: "+8 pp",
    },
  },
  {
    id: "optimized",
    label: "S3",
    name: "Escenario optimizado",
    phase: "Nueva política",
    summary: "Introduce bypass controlado, buffer dinámico y ajuste de velocidad minimizando CO2e por unidad.",
    stepStart: 14,
    icon: Sparkles,
    metrics: {
      throughput: 238,
      wip: 21,
      leadTime: 22,
      oee: 83,
      energy: 12.7,
      carbon: 0.68,
      confidence: 91,
    },
    deltas: {
      throughput: "+28%",
      leadTime: "-42%",
      oee: "+15 pp",
    },
  },
];

export const agentEvents: AgentEvent[] = [
  {
    id: 0,
    at: "00:00",
    tool: "AGENT",
    severity: "info",
    title: "Inicializando gemelo de decisión",
    detail: "Cargo objetivo: maximizar throughput manteniendo WIP, energía y huella de carbono bajo umbral.",
    metric: "Función objetivo: +THR -WIP -kWh -kgCO2e/u",
  },
  {
    id: 1,
    at: "00:04",
    tool: "DES",
    severity: "tool",
    title: "Conectando con simulador DES",
    detail: "Abro modelo de línea de ensamblaje, packaging y expedición con 8 recursos discretos.",
    table: [
      ["Modelo", "AssemblyPack_v12"],
      ["Horizonte", "2 turnos"],
      ["Réplicas", "32"],
    ],
  },
  {
    id: 2,
    at: "00:09",
    tool: "DES",
    severity: "warning",
    title: "Ejecución base completada",
    detail: "La estación de inspección llega al 94% de utilización y genera bloqueo aguas abajo.",
    metric: "THR 186 u/h · Lead time 38 min",
  },
  {
    id: 3,
    at: "00:14",
    tool: "MES",
    severity: "tool",
    title: "Consultando trazabilidad MES",
    detail: "Recupero órdenes, scrap y microparadas por familia para alimentar la distribución de llegadas.",
    table: [
      ["Ordenes", "84"],
      ["Scrap visual", "3.8%"],
      ["Paradas < 2m", "27"],
    ],
  },
  {
    id: 4,
    at: "00:18",
    tool: "AGENT",
    severity: "reason",
    title: "Hipótesis de mejora",
    detail: "Si se reduce el cambio de familia antes de inspección, packaging recibirá flujo más estable.",
  },
  {
    id: 5,
    at: "00:23",
    tool: "APS",
    severity: "tool",
    title: "Creando escenario APS",
    detail: "Genero una secuencia por familias A/B/C con ventanas congeladas de 45 minutos.",
    metric: "Setup previsto: -16%",
  },
  {
    id: 6,
    at: "00:28",
    tool: "DES",
    severity: "tool",
    title: "Reparametrizando nodos",
    detail: "Actualizo calendarios de llegada, lotes y reglas de prioridad en buffer de entrada.",
  },
  {
    id: 7,
    at: "00:33",
    tool: "AGENT",
    severity: "success",
    title: "Primer resultado válido",
    detail: "La secuenciación mejora el flujo, pero inspección sigue limitando el throughput máximo.",
    metric: "+9.7% throughput · WIP -17%",
  },
  {
    id: 8,
    at: "00:37",
    tool: "SCADA",
    severity: "tool",
    title: "Leyendo señales SCADA",
    detail: "Cruzo temperaturas, velocidad de cinta, cámaras de visión y estados de robot.",
    table: [
      ["Cinta CV-04", "92%"],
      ["Visión QI-02", "falsos +"],
      ["Robot RB-01", "cola alta"],
    ],
  },
  {
    id: 9,
    at: "00:42",
    tool: "PLC",
    severity: "warning",
    title: "Alarmas PLC correlacionadas",
    detail: "El PLC reporta microcortes en rechazo y acumulación en buffer previo a packaging.",
    metric: "27 alarmas · 11 bloqueos parciales",
  },
  {
    id: 10,
    at: "00:47",
    tool: "CARBON",
    severity: "tool",
    title: "Calculando huella de carbono operativa",
    detail: "Cruzo consumo SCADA, scrap MES y factor eléctrico para estimar kgCO2e por unidad en cada escenario.",
    table: [
      ["Base DES", "0.82 kgCO2e/u"],
      ["APS", "0.76 kgCO2e/u"],
      ["Objetivo", "< 0.70 kgCO2e/u"],
    ],
  },
  {
    id: 11,
    at: "00:51",
    tool: "AGENT",
    severity: "reason",
    title: "Causa raíz probable",
    detail: "La cámara de inspección sobrerrechaza tras cambios de lote: genera cola, retrabajo y carbono embebido por scrap.",
  },
  {
    id: 12,
    at: "00:55",
    tool: "DES",
    severity: "tool",
    title: "Creando bypass controlado",
    detail: "Añado un carril temporal para piezas de baja criticidad con reinspección estadística posterior.",
    metric: "Nodo nuevo: BYP-QI",
  },
  {
    id: 13,
    at: "01:00",
    tool: "DES",
    severity: "tool",
    title: "Ajustando buffer dinámico",
    detail: "El buffer B aumenta capacidad cuando SCADA detecta cola y reduce velocidad de ensamblaje para evitar consumo pico.",
  },
  {
    id: 14,
    at: "01:05",
    tool: "PLC",
    severity: "tool",
    title: "Sincronizando política PLC",
    detail: "Simulo señales de control para velocidad de cinta y prioridad del robot de inspección.",
  },
  {
    id: 15,
    at: "01:10",
    tool: "DES",
    severity: "tool",
    title: "Ejecutando lote de experimentos",
    detail: "Comparo 64 combinaciones de capacidad, velocidad, bypass y secuenciación con restricción de CO2e/u.",
    table: [
      ["Experimentos", "64"],
      ["Dominados", "41"],
      ["Candidatos", "5"],
    ],
  },
  {
    id: 16,
    at: "01:17",
    tool: "AGENT",
    severity: "success",
    title: "Escenario recomendado",
    detail: "Selecciono política híbrida: APS por familia, bypass limitado y buffer B adaptativo con menor carbono unitario.",
    metric: "+28% throughput · CO2e/u -17%",
  },
  {
    id: 17,
    at: "01:22",
    tool: "MES",
    severity: "success",
    title: "Generando resumen ejecutivo",
    detail: "Preparo narrativa de impacto: mayor producción, menor WIP, menos energía y menor huella de carbono por unidad.",
  },
  {
    id: 18,
    at: "01:28",
    tool: "AGENT",
    severity: "success",
    title: "Conclusión",
    detail: "El agente no solo evalúa escenarios: modifica el modelo, busca evidencia operacional y converge a una política accionable.",
    metric: "Confianza simulada: 91% · CO2e/u -17%",
  },
];

export const stations: Station[] = [
  {
    id: "receiving",
    name: "Recepción",
    sub: "Kits + ASN",
    x: 4,
    y: 38,
    w: 13,
    h: 16,
    icon: Boxes,
    tool: "MES",
    activeSteps: [3, 5, 6],
  },
  {
    id: "buffer-a",
    name: "Buffer A",
    sub: "Secuencia APS",
    x: 21,
    y: 34,
    w: 13,
    h: 24,
    icon: Waypoints,
    tool: "APS",
    activeSteps: [5, 6, 7],
    optimizedSteps: [14, 15, 16],
  },
  {
    id: "assembly",
    name: "ASY-01",
    sub: "Célula ensamblaje",
    x: 39,
    y: 26,
    w: 16,
    h: 22,
    icon: Settings2,
    tool: "DES",
    activeSteps: [1, 6, 15],
    warningSteps: [2],
    optimizedSteps: [14, 16],
  },
  {
    id: "cobot",
    name: "Cobot",
    sub: "Atornillado",
    x: 42,
    y: 58,
    w: 11,
    h: 15,
    icon: Activity,
    tool: "PLC",
    activeSteps: [8, 14],
  },
  {
    id: "inspection",
    name: "QI-02",
    sub: "Visión + rechazo",
    x: 62,
    y: 24,
    w: 16,
    h: 25,
    icon: ScanSearch,
    tool: "SCADA",
    activeSteps: [8, 9, 10, 11, 12, 15],
    warningSteps: [2, 8, 9, 11],
    optimizedSteps: [12, 15, 16],
  },
  {
    id: "bypass",
    name: "BYP-QI",
    sub: "Reinspección estadística",
    x: 62,
    y: 58,
    w: 16,
    h: 16,
    icon: GitBranch,
    tool: "DES",
    activeSteps: [12, 13, 15, 16],
    optimizedSteps: [12, 13, 14, 15, 16, 17, 18],
  },
  {
    id: "packaging",
    name: "PKG-01",
    sub: "Packaging",
    x: 83,
    y: 28,
    w: 13,
    h: 21,
    icon: PackageCheck,
    tool: "PLC",
    activeSteps: [9, 14, 15, 16],
    warningSteps: [2, 9],
    optimizedSteps: [16, 17, 18],
  },
  {
    id: "shipping",
    name: "Expedición",
    sub: "Buffer salida",
    x: 84,
    y: 61,
    w: 12,
    h: 16,
    icon: ShieldCheck,
    tool: "MES",
    activeSteps: [16, 17, 18],
    optimizedSteps: [16, 17, 18],
  },
];

export const toolIcons: Record<ToolKind, LucideIcon> = {
  DES: Factory,
  MES: Database,
  APS: BarChart3,
  SCADA: RadioTower,
  PLC: Cpu,
  CARBON: Leaf,
  AGENT: Bot,
};

export const toolLabels: Record<ToolKind, string> = {
  DES: "DES",
  MES: "MES",
  APS: "APS",
  SCADA: "SCADA",
  PLC: "PLC",
  CARBON: "CO2e",
  AGENT: "Agent",
};

export const headlineStats = [
  { label: "Objetivo", value: "Optimizar planta", icon: BrainCircuit },
  { label: "Método", value: "Diseño + prueba autónoma", icon: FlaskConical },
  { label: "Salida", value: "Escenario recomendado", icon: Gauge },
  { label: "Integración", value: "DES · MES · APS · SCADA · PLC · CO2e", icon: Network },
];

export function getScenarioForStep(step: number): Scenario {
  return scenarios.reduce((current, scenario) => {
    return step >= scenario.stepStart ? scenario : current;
  }, scenarios[0]);
}

export function getScenarioIndexForStep(step: number): number {
  for (let index = scenarios.length - 1; index >= 0; index -= 1) {
    if (step >= scenarios[index].stepStart) {
      return index;
    }
  }

  return 0;
}

export function getProgress(step: number): number {
  const lastStep = TOTAL_STEPS - 1;
  const normalized = ((step - INTRO_STEP) / (lastStep - INTRO_STEP)) * 100;

  return Math.min(100, Math.max(0, Math.round(normalized)));
}

export function getVisibleEvents(step: number): AgentEvent[] {
  return agentEvents.filter((event) => event.id <= step);
}

export const playbackMilestones = [
  { step: INTRO_STEP, label: "Twin 3D" },
  { step: AGENT_START_STEP, label: "Agente" },
  { step: 5, label: "APS" },
  { step: 9, label: "Diagnóstico" },
  { step: 14, label: "Optimización" },
  { step: FINAL_STEP, label: "Resumen" },
];
