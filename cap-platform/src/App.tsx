import { useEffect } from 'react';
import { store, useScreen } from './store/Store';
import { SplashScreen } from './components/SplashScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { HomeScreen } from './components/HomeScreen';
import { ModeSelectScreen } from './components/ModeSelectScreen';
import { PersonaListScreen } from './components/PersonaListScreen';
import { BriefScreen } from './components/BriefScreen';
import { EncounterScreen } from './components/EncounterScreen';
import { EndConfirmScreen } from './components/EndConfirmScreen';
import { DebriefScreen } from './components/DebriefScreen';
import { HistoryScreen } from './components/HistoryScreen';

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
      {screen === 'splash' && <SplashScreen />}
      {screen === 'onboarding' && <OnboardingScreen />}
      {screen === 'home' && <HomeScreen />}
      {screen === 'mode' && <ModeSelectScreen />}
      {screen === 'personaList' && <PersonaListScreen />}
      {screen === 'brief' && <BriefScreen />}
      {screen === 'encounter' && <EncounterScreen />}
      {screen === 'endConfirm' && <EndConfirmScreen />}
      {screen === 'debrief' && <DebriefScreen />}
      {screen === 'history' && <HistoryScreen />}
    </div>
  );
}
