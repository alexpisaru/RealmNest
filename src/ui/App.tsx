import { lazy, Suspense, useEffect, useLayoutEffect } from 'react';
import { pinRenderer } from '../render/worldRenderer';
import { applyTheme } from '../themes';
import { useRendererReady } from './shared';
import { CharacterCreator } from './CharacterCreator';
import { ErrorBoundary, ScreenCrash } from './ErrorBoundary';
import { StorageBanner } from './StorageBanner';
import { UpdateNotice } from './update/UpdateViews';
import { useApp, useServices } from './context';
import { HomeScreen } from './screens/Home';
import { Sidebar } from './Sidebar';
import { ToolApprovals } from './tools/ToolApproval';

// every screen but Home loads when first opened: the app starts from a smaller bundle
const ArtifactsScreen = lazy(() => import('./screens/Artifacts').then((m) => ({ default: m.ArtifactsScreen })));
const KnowledgeScreen = lazy(() => import('./screens/Knowledge').then((m) => ({ default: m.KnowledgeScreen })));
const MemoryScreen = lazy(() => import('./screens/Memory').then((m) => ({ default: m.MemoryScreen })));
const ChatScreen = lazy(() => import('./screens/Chat').then((m) => ({ default: m.ChatScreen })));
const AgentsScreen = lazy(() => import('./screens/Agents').then((m) => ({ default: m.AgentsScreen })));
const SettingsScreen = lazy(() => import('./screens/Settings').then((m) => ({ default: m.SettingsScreen })));
const SkillsScreen = lazy(() => import('./screens/Skills').then((m) => ({ default: m.SkillsScreen })));
const SimulationScreen = lazy(() => import('./screens/Simulation').then((m) => ({ default: m.SimulationScreen })));
const WorldsScreen = lazy(() => import('./screens/Worlds').then((m) => ({ default: m.WorldsScreen })));
const ResearchScreen = lazy(() => import('./screens/Research').then((m) => ({ default: m.ResearchScreen })));
const CrewsScreen = lazy(() => import('./screens/Crews').then((m) => ({ default: m.CrewsScreen })));
const WorkflowsScreen = lazy(() => import('./screens/Workflows').then((m) => ({ default: m.WorkflowsScreen })));

export function App() {
  const st = useApp();
  const { store } = useServices();

  // the theme drives every colour token (src/themes.ts)
  useLayoutEffect(() => applyTheme(st.settings.theme), [st.settings.theme]);

  useEffect(() => {
    if (!st.toast) return;
    const id = setTimeout(() => store.getState().toast?.at === st.toast?.at && store.toast(''), 3200);
    return () => clearTimeout(id);
  }, [st.toast, store]);

  // keep the current world's scene in memory whatever else gets built
  useEffect(() => pinRenderer(st.currentWorldId), [st.currentWorldId]);
  useRendererReady();
  if (!st.ready) return <div className="boot">RealmNest OS</div>;
  // the World and Chat get the room: the navigation folds into an icon rail
  const rail = st.screen === 'simulation' || st.screen === 'chat';

  return (
    <>
      <div className={`shell ${rail ? 'shell-rail' : ''} shell-${st.screen}`}>
        <Sidebar compact={rail} />
        <main className="stage" key={st.screen}>
          {/* a screen that fails (or fails to load) keeps the sidebar and the rest of the app alive */}
          <ErrorBoundary fallback={(error, retry) => <ScreenCrash error={error} lang={st.settings.language} onRetry={retry} onHome={() => store.navigate('home')} />}>
            <Suspense fallback={null}>
              {st.screen === 'home' && <HomeScreen />}
              {st.screen === 'worlds' && <WorldsScreen />}
              {st.screen === 'agents' && <AgentsScreen />}
              {st.screen === 'simulation' && <SimulationScreen />}
              {st.screen === 'chat' && <ChatScreen />}
              {st.screen === 'settings' && <SettingsScreen />}
              {st.screen === 'skills' && <SkillsScreen />}
              {st.screen === 'artifacts' && <ArtifactsScreen />}
              {st.screen === 'knowledge' && <KnowledgeScreen />}
              {st.screen === 'memory' && <MemoryScreen />}
              {st.screen === 'research' && <ResearchScreen />}
              {st.screen === 'crews' && <CrewsScreen />}
              {st.screen === 'workflows' && <WorkflowsScreen />}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      {st.creator && <CharacterCreator />}
      <ToolApprovals />
      <StorageBanner />
      <UpdateNotice />
      {st.toast?.text && (
        <div className="toast" role="status">
          {st.toast.text}
        </div>
      )}
    </>
  );
}
