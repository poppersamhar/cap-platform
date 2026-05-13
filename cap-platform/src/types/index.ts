// ── 应用模式 ──
export type AppMode = 'training' | 'research';

// ── 屏幕路由 ──
export type Screen =
  | 'splash'
  | 'onboarding'
  | 'home'
  | 'mode'
  | 'personaList'
  | 'brief'
  | 'encounter'
  | 'endConfirm'
  | 'debrief'
  | 'history'
  | 'personaEditor';

// ── 情绪状态 ──
export interface EmotionState {
  trust: number;       // 0-100
  intent: number;      // 0-100
  rapport: number;     // 0-100
  resistance: number;  // 0-100
  anxiety: number;     // 0-100
}

export type EmotionDelta = Partial<EmotionState>;

export type SpecialState = 'customer_leaving' | 'decision_phase' | 'confrontation' | null;

// ── 基础信息 ──
export interface PersonaProfile {
  name: string;
  age: number;
  gender: 'M' | 'F';
  city: string;
  occupation: string;
  family: string;
  current_car: string;
}

// ── 购车画像 ──
export interface PurchaseProfile {
  budget_stated: string;
  budget_real: string;
  car_type: string;
  stage: string;
  timeline: string;
  usage_scenarios: string[];
}

// ── 痛点 ──
export interface PainPoint {
  topic: string;
  intensity: number;
  detail: string;
}

// ── 隐藏信息 ──
export interface HiddenInfo {
  content: string;
  trigger_condition: string;
}

// ── 异议 ──
export interface Objection {
  content: string;
  trigger_topic: string;
  resistance: number;
}

// ── 行为参数 ──
export interface BehaviorParams {
  anti_guide: number;
  price_sensitivity: number;
  expressiveness: number;
  decisiveness: number;
  tech_literacy: number;
}

// ── 沟通风格 ──
export interface CommunicationStyle {
  style: string;
  description: string;
  speech_patterns: string[];
}

// ── 分身 ──
export interface Persona {
  id: string;
  profile: PersonaProfile;
  purchase: PurchaseProfile;
  pain_points: PainPoint[];
  hidden_info: HiddenInfo[];
  objections: Objection[];
  competitor_awareness: string;
  behavior: BehaviorParams;
  communication: CommunicationStyle;
  tags: string[];
}

// ── 聊天消息 ──
export interface ChatMessage {
  role: 'user' | 'client';
  content: string;
  timestamp: number;
  triggered_tags?: string[];
  hidden_revealed?: string[];
}

// ── 督导评分 ──
export interface RoundScore {
  insight: number;
  adaptation: number;
  matching: number;
  objection: number;
  trust_building: number;
}

export interface Highlight {
  round: number;
  text: string;
}

export interface Failure {
  round: number;
  text: string;
  suggestion: string;
}

export interface Evaluation {
  round_scores: RoundScore[];
  highlights: Highlight[];
  failures: Failure[];
  persona_consistency: number;
  updated_at: number;
}

// ── 训练报告 ──
export interface TrainingReport {
  overall_score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  dimension_scores: RoundScore;
  highlights: Highlight[];
  failures: Failure[];
  improvement_suggestions: string[];
  recommended_next_scenario: string;
}

// ── 调研报告 ──
export interface ResearchReport {
  needs_ranking: { need: string; importance: number }[];
  pain_points_analysis: string;
  config_acceptance: string;
  price_sensitivity: string;
  competitor_preference: string;
  conclusions: string;
  recommendations: string[];
}

export type Report = TrainingReport | ResearchReport;

// ── 会话 ──
export interface Session {
  id: string;
  persona_id: string;
  persona?: Persona; // 完整的 persona 画像（创建会话时后端返回）
  mode: AppMode;
  messages: ChatMessage[];
  emotion_state: EmotionState;
  special_state: SpecialState;
  round: number;
  evaluation?: Evaluation;
  report?: Report;
  status: 'active' | 'ended';
  created_at: number;
}

// ── 应用状态 ──
export interface AppState {
  screen: Screen;
  mode: AppMode | null;
  currentSession: Session | null;
  personas: Persona[];
  isLoading: boolean;
  error: string | null;
  hasOnboarded: boolean;
  onboardingStep: number;
  viewedHistoryId: string | null;
  history: Session[];
}
