import { useSyncExternalStore } from 'react';
import type {
  AppState, Screen, AppMode, Session, EmotionState,
} from '../types';

const ONBOARDED_KEY = 'cap:onboarded';
const HISTORY_KEY = 'cap:history';

function readOnboarded(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeOnboarded(v: boolean) {
  try {
    window.localStorage.setItem(ONBOARDED_KEY, v ? '1' : '0');
  } catch {
    // private mode — non-fatal
  }
}

function readHistory(): Session[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeHistory(sessions: Session[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
  } catch {
    // private mode — non-fatal
  }
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

class Store {
  private state: AppState = {
    screen: 'splash',
    mode: null,
    currentSession: null,
    personas: [],
    isLoading: false,
    error: null,
    hasOnboarded: readOnboarded(),
    onboardingStep: 0,
    viewedHistoryId: null,
    history: readHistory(),
    previewPersona: null,
  };

  private listeners = new Set<() => void>();

  getState = (): AppState => this.state;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private set(next: Partial<AppState>) {
    this.state = { ...this.state, ...next };
    for (const l of this.listeners) l();
  }

  private setLoading(v: boolean) {
    this.set({ isLoading: v });
  }

  private setError(err: string | null) {
    this.set({ error: err });
  }

  // ── Navigation ──
  setScreen = (screen: Screen) => this.set({ screen });

  beginFromSplash = () => {
    this.set({ screen: this.state.hasOnboarded ? 'home' : 'onboarding' });
  };

  // ── Onboarding ──
  setOnboardingStep = (step: number) =>
    this.set({ onboardingStep: Math.max(0, Math.min(2, step)) });

  finishOnboarding = () => {
    writeOnboarded(true);
    this.set({ hasOnboarded: true, screen: 'home', onboardingStep: 0 });
  };

  // ── Mode selection ──
  setMode = (mode: AppMode) => this.set({ mode });

  // ── Personas ──
  async loadPersonas() {
    this.setLoading(true);
    this.setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api/personas`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this.set({ personas: data.personas });
    } catch (e) {
      this.setError(e instanceof Error ? e.message : 'Failed to load personas');
    } finally {
      this.setLoading(false);
    }
  }

  // ── Session ──
  async createSession(personaId: string, mode: AppMode, personaOverride?: Persona) {
    this.setLoading(true);
    this.setError(null);
    try {
      const body: any = { persona_id: personaId, mode };
      if (personaOverride) {
        body.persona_override = personaOverride;
      }
      const resp = await fetch(`${API_BASE}/api/session/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const session: Session = {
        id: data.session_id,
        persona_id: personaId,
        persona: data.persona as any,
        mode,
        messages: [],
        emotion_state: data.emotion_state as EmotionState,
        special_state: null,
        round: 0,
        status: 'active',
        created_at: Date.now(),
      };

      this.set({ currentSession: session, screen: 'brief' });
    } catch (e) {
      this.setError(e instanceof Error ? e.message : 'Failed to create session');
    } finally {
      this.setLoading(false);
    }
  }

  async sendMessage(text: string) {
    const session = this.state.currentSession;
    if (!session || session.status !== 'active') return;

    // 乐观更新：先显示用户消息
    const userMsg = { role: 'user' as const, content: text, timestamp: Date.now() };
    this.set({
      currentSession: {
        ...session,
        messages: [...session.messages, userMsg],
      },
    });

    this.setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, message: text }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const clientMsg = {
        role: 'client' as const,
        content: data.reply,
        timestamp: Date.now(),
        triggered_tags: data.triggered_tags || [],
        hidden_revealed: data.hidden_revealed || [],
      };

      this.set({
        currentSession: {
          ...session,
          messages: [...session.messages, userMsg, clientMsg],
          emotion_state: data.emotion_state,
          special_state: data.special_state,
          round: data.round,
        },
      });
    } catch (e) {
      this.setError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      this.setLoading(false);
    }
  }

  async endSession() {
    const session = this.state.currentSession;
    if (!session) return;

    try {
      await fetch(`${API_BASE}/api/session/${session.id}/end`, { method: 'POST' });
      await fetch(`${API_BASE}/api/session/${session.id}/report`, { method: 'POST' });

      // 获取最终评分
      const evalResp = await fetch(`${API_BASE}/api/session/${session.id}/evaluation`);
      const evalData = await evalResp.json();

      const endedSession: Session = {
        ...session,
        status: 'ended',
        evaluation: evalData.evaluation,
      };

      // 保存到历史记录
      const newHistory = [endedSession, ...this.state.history].slice(0, 50);
      writeHistory(newHistory);

      this.set({
        currentSession: endedSession,
        history: newHistory,
        screen: 'debrief',
      });
    } catch (e) {
      this.setError(e instanceof Error ? e.message : 'Failed to end session');
      this.set({ screen: 'debrief' });
    }
  }

  // ── History ──
  viewHistory = (historyId: string) =>
    this.set({ viewedHistoryId: historyId, screen: 'history' });

  clearViewedHistory = () => this.set({ viewedHistoryId: null });

  clearAllHistory = () => {
    writeHistory([]);
    this.set({ history: [] });
  };

  // ── Persona Import ──
  setPreviewPersona = (persona: Persona | null) =>
    this.set({ previewPersona: persona });

  async extractPersona(dialogue: string) {
    this.setLoading(true);
    this.setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dialogue }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      this.set({ previewPersona: data.persona as Persona, screen: 'importPersona' });
    } catch (e) {
      this.setError(e instanceof Error ? e.message : '提取失败');
    } finally {
      this.setLoading(false);
    }
  }

  async extractPersonaFromExcel(file: File) {
    this.setLoading(true);
    this.setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const resp = await fetch(`${API_BASE}/api/extract/excel`, {
        method: 'POST',
        body: formData,
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      this.set({ previewPersona: data.persona as Persona, screen: 'importPersona' });
    } catch (e) {
      this.setError(e instanceof Error ? e.message : '提取失败');
    } finally {
      this.setLoading(false);
    }
  }
}

export const store = new Store();

// ── React hooks ──
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

export function useScreen(): Screen {
  return useStore((s) => s.screen);
}

export function useSession() {
  return useStore((s) => s.currentSession);
}

export function usePersonas() {
  return useStore((s) => s.personas);
}

export function useLoading() {
  return useStore((s) => s.isLoading);
}

export function useError() {
  return useStore((s) => s.error);
}

export function useAppState(): AppState {
  return useStore((s) => s);
}

export function useHistory() {
  return useStore((s) => s.history);
}

export function usePreviewPersona() {
  return useStore((s) => s.previewPersona);
}
