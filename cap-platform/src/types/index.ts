// ── 应用模式 ──
export type AppMode = 'training' | 'research';

// ── 屏幕路由 ──
export type Screen =
  | 'splash'
  | 'onboarding'
  | 'home'
  | 'mode'
  | 'researchSelect'
  | 'researchSetup'
  | 'surveySetup'
  | 'surveyRunning'
  | 'surveyResult'
  | 'personaList'
  | 'brief'
  | 'encounter'
  | 'endConfirm'
  | 'debrief'
  | 'history'
  | 'personaEditor'
  | 'importPersona'
  | 'knowledge'
  | 'factory';

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

// ── 原始对话溯源 ──
export interface SourceDialogue {
  type: 'outbound_call' | 'test_drive';
  title: string;
  source_field: string;
  transcript: string;
  turn_count?: number;
  record_count?: number;
}

export interface SourceSummary {
  type: 'call_summary' | 'drive_summary' | 'concern_tags';
  title: string;
  content: string;
}

export interface SourceDialoguesData {
  persona_id: string;
  source_customer_id: string;
  dialogues: SourceDialogue[];
  summaries: SourceSummary[];
  record_count: number;
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
  /** 数据来源标记，如 '4x' 表示来自4X车型数据 */
  _source?: string;
  _cluster_title?: string;
  _cluster_stats?: {
    unique_customers: number;
    age_range: [number, number];
    top_concerns: [string, number][];
  };
  /** 是否有原始对话溯源数据 */
  _has_source_dialogues?: boolean;
}

// ── 溯源引用 ──
export interface SourceQuote {
  text: string;
  type: string;
  context: string;
  matched_substring?: string;
}

// ── 聊天消息 ──
export interface ChatMessage {
  role: 'user' | 'client';
  content: string;
  timestamp: number;
  triggered_tags?: string[];
  hidden_revealed?: string[];
  source_quotes?: SourceQuote[];
}

// ── 督导评分 ──
export interface TrainingRoundScore {
  needs_discovery: number;
  trust_building: number;
  objection_handling: number;
  solution_matching: number;
  closing_awareness: number;
}

export interface ResearchRoundScore {
  question_quality: number;
  information_completeness: number;
  hidden_needs_uncovered: number;
  emotional_insight: number;
  bias_avoidance: number;
}

export type RoundScore = TrainingRoundScore | ResearchRoundScore;

export interface Highlight {
  round: number;
  text: string;
}

export interface Failure {
  round: number;
  text: string;
  suggestion: string;
  better_approach: string;
}

export interface MissedOpportunity {
  item: string;
  should_ask: string;
}

export interface HiddenInfoCheck {
  content: string;
  triggered: boolean;
  round: number | null;
  note: string;
}

export interface PainPointCheck {
  topic: string;
  recognized: boolean;
  round: number | null;
  response_quality?: string;
  depth?: string;
  note: string;
}

export interface Evaluation {
  mode: AppMode;
  round_scores: RoundScore;
  highlights: Highlight[];
  failures: Failure[];
  missed_opportunities: MissedOpportunity[];
  hidden_info_check: HiddenInfoCheck[];
  pain_points_check: PainPointCheck[];
  persona_consistency: number;
  coaching_summary: string;
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
  key_quotes?: string[];
  topic_tags?: string[];
}

export type Report = TrainingReport | ResearchReport;

// ── 问卷问题 ──
export interface SurveyQuestion {
  id: string;
  question: string;
  category: string;
}

export interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  questions: SurveyQuestion[];
}

// ── 问卷答案 ──
export interface SurveyAnswer {
  question_id: string;
  question: string;
  answer: string;
  category: string;
}

// ── 单个分身问卷报告 ──
export interface PersonaSurveyReport {
  persona_id: string;
  persona_name: string;
  answers: SurveyAnswer[];
  generated_at: number;
}

// ── 问卷运行任务 ──
export interface SurveyTask {
  id: string;
  template: SurveyTemplate;
  persona_ids: string[];
  status: 'running' | 'completed' | 'failed';
  progress: { persona_id: string; persona_name: string; status: 'pending' | 'running' | 'completed' | 'failed' }[];
  reports: PersonaSurveyReport[];
  created_at: number;
}

// ── 问卷历史记录项（持久化用，精简版）──
export interface SurveyHistoryItem {
  id: string;
  template_name: string;
  persona_count: number;
  status: 'completed' | 'failed';
  reports: PersonaSurveyReport[];
  created_at: number;
  completed_at: number;
}

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
  research_topic?: string;
  research_goals?: string;
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
  previewPersona: Persona | null; // 导入过程中的预览分身
  knowledgeSources: string[];
  toast: { message: string; type: 'info' | 'success' | 'error' } | null;
  /** 客群分组自定义名称 { source: displayName } */
  personaGroupNames: Record<string, string>;
  /** 当前问卷任务 */
  currentSurvey: SurveyTask | null;
  /** 问卷历史记录 */
  surveyHistory: SurveyHistoryItem[];
}
