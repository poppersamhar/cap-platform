import { useEffect } from 'react';
import { store, useScreen, useToast } from './store/Store';
import { SplashScreen } from './components/SplashScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { HomeScreen } from './components/HomeScreen';
import { ModeSelectScreen } from './components/ModeSelectScreen';
import { PersonaListScreen } from './components/PersonaListScreen';
import { ResearchSetupScreen } from './components/ResearchSetupScreen';
import { BriefScreen } from './components/BriefScreen';
import { EncounterScreen } from './components/EncounterScreen';
import { EndConfirmScreen } from './components/EndConfirmScreen';
import { DebriefScreen } from './components/DebriefScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { ImportPersonaScreen } from './components/ImportPersonaScreen';
import { KnowledgeScreen } from './components/KnowledgeScreen';

function Toast() {
  const toast = useToast();
  if (!toast) return null;

  const bgColor =
    toast.type === 'success' ? 'bg-cap-mint' :
    toast.type === 'error' ? 'bg-cap-rose' : 'bg-cap-butter';

  return (
    <div className="fixed top-4 right-4 z-[100] animate-popin"
      onClick={() => store.dismissToast()}
    >
      <div className={`${bgColor} text-white px-4 py-3 rounded-xl shadow-lg font-bold text-sm cursor-pointer flex items-center gap-2`}>
        <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}

export default function App() {
  const screen = useScreen();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && screen === 'encounter') {
        store.setScreen('endConfirm');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [screen]);

  return (
    <div className="min-h-screen bg-cap-cream text-cap-ink">
      <Toast />
      {screen === 'splash' && <SplashScreen />}
      {screen === 'onboarding' && <OnboardingScreen />}
      {screen === 'home' && <HomeScreen />}
      {screen === 'mode' && <ModeSelectScreen />}
      {screen === 'researchSetup' && <ResearchSetupScreen />}
      {screen === 'personaList' && <PersonaListScreen />}
      {screen === 'brief' && <BriefScreen />}
      {screen === 'encounter' && <EncounterScreen />}
      {screen === 'endConfirm' && <EndConfirmScreen />}
      {screen === 'debrief' && <DebriefScreen />}
      {screen === 'history' && <HistoryScreen />}
      {screen === 'importPersona' && <ImportPersonaScreen />}
      {screen === 'knowledge' && <KnowledgeScreen />}
    </div>
  );
}
