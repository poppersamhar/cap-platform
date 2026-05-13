const API_BASE = 'http://localhost:8787';

export async function fetchPersonas() {
  const resp = await fetch(`${API_BASE}/api/personas`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function createSession(personaId: string, mode: string) {
  const resp = await fetch(`${API_BASE}/api/session/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona_id: personaId, mode }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function sendChat(sessionId: string, message: string) {
  const resp = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function getEvaluation(sessionId: string) {
  const resp = await fetch(`${API_BASE}/api/session/${sessionId}/evaluation`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function endSession(sessionId: string) {
  const resp = await fetch(`${API_BASE}/api/session/${sessionId}/end`, {
    method: 'POST',
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function generateReport(sessionId: string) {
  const resp = await fetch(`${API_BASE}/api/session/${sessionId}/report`, {
    method: 'POST',
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}
