import { useSyncExternalStore } from 'react';
import type {
  AppState, Screen, AppMode, Session, EmotionState, Persona,
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
    knowledgeSources: [],
    toast: null,
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
  async createSession(
    personaId: string,
    mode: AppMode,
    opts?: { personaOverride?: Persona; researchTopic?: string; researchGoals?: string }
  ) {
    this.setLoading(true);
    this.setError(null);
    try {
      const body: any = { persona_id: personaId, mode };
      if (opts?.personaOverride) {
        body.persona_override = opts.personaOverride;
      }
      if (opts?.researchTopic) {
        body.research_topic = opts.researchTopic;
      }
      if (opts?.researchGoals) {
        body.research_goals = opts.researchGoals;
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
        research_topic: opts?.researchTopic,
        research_goals: opts?.researchGoals,
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
      // 1. 快速结束会话（标记状态）
      await fetch(`${API_BASE}/api/session/${session.id}/end`, { method: 'POST' });

      const endedSession: Session = {
        ...session,
        status: 'ended',
      };

      // 2. 立即保存到历史并跳转 debrief（报告尚未生成）
      const newHistory = [endedSession, ...this.state.history].slice(0, 50);
      writeHistory(newHistory);

      this.set({
        currentSession: endedSession,
        history: newHistory,
        screen: 'debrief',
      });

      // 3. 后台异步生成报告和评分
      this._generateReportAsync(session.id, endedSession);
    } catch (e) {
      this.setError(e instanceof Error ? e.message : 'Failed to end session');
      this.set({ screen: 'debrief' });
    }
  }

  private async _generateReportAsync(sessionId: string, baseSession: Session) {
    const isTraining = baseSession.mode === 'training';
    try {
      // 1. 生成报告（可能耗时 20-30s）
      const reportResp = await fetch(`${API_BASE}/api/session/${sessionId}/report`, { method: 'POST' });
      const reportData = await reportResp.json().catch(() => ({}));

      if (isTraining) {
        // 对练模式：轮询获取督导评分
        let evaluation = null;
        for (let attempt = 0; attempt < 30; attempt++) {
          const evalResp = await fetch(`${API_BASE}/api/session/${sessionId}/evaluation`);
          const evalData = await evalResp.json();
          if (evalData.evaluation) {
            evaluation = evalData.evaluation;
            break;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }

        if (evaluation) {
          const updatedSession: Session = {
            ...baseSession,
            evaluation,
            report: reportData.report || undefined,
          };
          this._updateSessionAndToast(sessionId, updatedSession, '报告已生成');
        } else {
          console.warn('Evaluation not ready after polling');
          this.set({
            toast: { message: '评分生成较慢，请稍后刷新查看', type: 'info' },
          });
          setTimeout(() => this.set({ toast: null }), 4000);
        }
      } else {
        // 调研模式：直接获取洞察报告（督导已下线，不评分）
        let report = reportData.report || null;
        // 如果 POST 未返回报告，轮询 GET
        if (!report) {
          for (let attempt = 0; attempt < 30; attempt++) {
            const r = await fetch(`${API_BASE}/api/session/${sessionId}/report`);
            const d = await r.json();
            if (d.report) {
              report = d.report;
              break;
            }
            await new Promise((res) => setTimeout(res, 2000));
          }
        }

        if (report) {
          const updatedSession: Session = {
            ...baseSession,
            report,
          };
          this._updateSessionAndToast(sessionId, updatedSession, '洞察摘要已生成');
        } else {
          console.warn('Report not ready after polling');
          this.set({
            toast: { message: '洞察生成较慢，请稍后刷新查看', type: 'info' },
          });
          setTimeout(() => this.set({ toast: null }), 4000);
        }
      }
    } catch (e) {
      console.error('Report generation failed:', e);
      this.set({
        toast: { message: isTraining ? '报告生成失败，请刷新重试' : '洞察生成失败，请刷新重试', type: 'error' },
      });
      setTimeout(() => this.set({ toast: null }), 4000);
    }
  }

  private _updateSessionAndToast(sessionId: string, updatedSession: Session, toastMessage: string) {
    const newHistory = this.state.history.map((s) =>
      s.id === sessionId ? updatedSession : s
    );
    writeHistory(newHistory);
    const shouldUpdateCurrent = this.state.currentSession?.id === sessionId;
    this.set({
      ...(shouldUpdateCurrent ? { currentSession: updatedSession } : {}),
      history: newHistory,
      toast: { message: toastMessage, type: 'success' },
    });
    setTimeout(() => {
      if (this.state.toast?.message === toastMessage) {
        this.set({ toast: null });
      }
    }, 3000);
  }

  // ── Toast ──
  showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    this.set({ toast: { message, type } });
    setTimeout(() => this.set({ toast: null }), 3000);
  };

  dismissToast = () => this.set({ toast: null });

  // ── History ──
  viewHistory = (historyId: string) => {
    const session = this.state.history.find((s) => s.id === historyId);
    if (session) {
      this.set({ currentSession: session, screen: 'debrief' });
    }
  };

  clearViewedHistory = () => this.set({ viewedHistoryId: null });

  clearAllHistory = () => {
    writeHistory([]);
    this.set({ history: [] });
  };

  deleteHistoryItem = (sessionId: string) => {
    const newHistory = this.state.history.filter((s) => s.id !== sessionId);
    writeHistory(newHistory);
    this.set({ history: newHistory });
  };

  // ── Knowledge Base ──
  async loadKnowledgeSources() {
    try {
      const resp = await fetch(`${API_BASE}/api/knowledge/sources`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this.set({ knowledgeSources: data.sources || [] });
    } catch (e) {
      this.setError(e instanceof Error ? e.message : 'Failed to load knowledge sources');
    }
  }

  async uploadKnowledge(file: File) {
    this.setLoading(true);
    this.setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch(`${API_BASE}/api/knowledge/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${resp.status}`);
      }
      await this.loadKnowledgeSources();
    } catch (e) {
      this.setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      this.setLoading(false);
    }
  }

  async deleteKnowledgeSource(sourceName: string) {
    this.setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/knowledge/source/${encodeURIComponent(sourceName)}`, {
        method: 'DELETE',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await this.loadKnowledgeSources();
    } catch (e) {
      this.setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      this.setLoading(false);
    }
  }

  // ── Persona Edit ──
  async updatePersona(personaId: string, data: Persona) {
    this.setLoading(true);
    this.setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api/persona/${encodeURIComponent(personaId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: data }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${resp.status}`);
      }
      await this.loadPersonas();
      this.showToast('分身已更新', 'success');
    } catch (e) {
      this.setError(e instanceof Error ? e.message : '更新失败');
    } finally {
      this.setLoading(false);
    }
  }

  // ── Persona Knowledge ──
  async loadPersonaKnowledgeSources(personaId: string) {
    try {
      const resp = await fetch(`${API_BASE}/api/persona/${encodeURIComponent(personaId)}/knowledge/sources`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return data.sources || [];
    } catch (e) {
      console.error('Failed to load persona knowledge sources:', e);
      return [];
    }
  }

  async uploadPersonaKnowledge(personaId: string, file: File) {
    this.setLoading(true);
    this.setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch(`${API_BASE}/api/knowledge/upload?persona_id=${encodeURIComponent(personaId)}`, {
        method: 'POST',
        body: formData,
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${resp.status}`);
      }
      this.showToast('专属文档已上传', 'success');
    } catch (e) {
      this.setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      this.setLoading(false);
    }
  }

  async deletePersonaKnowledgeSource(personaId: string, sourceName: string) {
    this.setLoading(true);
    try {
      const resp = await fetch(
        `${API_BASE}/api/persona/${encodeURIComponent(personaId)}/knowledge/source/${encodeURIComponent(sourceName)}`,
        { method: 'DELETE' }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.showToast('文档已删除', 'success');
    } catch (e) {
      this.setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      this.setLoading(false);
    }
  }

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

  // ── Smart Follow-up Suggestions (research mode) ──
  async fetchSuggestions(sessionId: string): Promise<string[]> {
    try {
      const resp = await fetch(`${API_BASE}/api/session/${sessionId}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return data.suggestions || [];
    } catch (e) {
      console.error('Failed to fetch suggestions:', e);
      return [];
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

export function useKnowledgeSources() {
  return useStore((s) => s.knowledgeSources);
}

// 开发/测试用：将 store 暴露到全局
if (typeof window !== 'undefined') {
  (window as any).store = store;
}

export function useToast() {
  return useStore((s) => s.toast);
}
