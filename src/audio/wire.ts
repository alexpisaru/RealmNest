// Connects the AudioEngine to the app (docs/AUDIO.md): settings and navigation decide what plays,
// events from the runtime play the effects, the window's visibility puts it to sleep.

import type { EventBus } from '../core/events';
import type { AppStore } from '../store/appStore';
import type { AudioEngine } from './engine';
import { sceneFor } from './engine';

export function wireAudio(engine: AudioEngine, store: AppStore, bus: EventBus) {
  let night = store.getState().settings.night;
  const apply = () => {
    const st = store.getState();
    // the switch off is silence: the engine stops its players and sleeps
    engine.setVolumes(st.settings.sound ? st.settings.volume : { ...st.settings.volume, master: 0 });
    engine.setScene(sceneFor(st.screen, st.currentWorldId, st.settings.night));
    if (st.settings.night !== night) {
      night = st.settings.night;
      if (st.settings.sound) engine.play(night ? 'nightfall' : 'daybreak');
    }
  };
  store.subscribe(apply);
  apply();

  // real work only: the Mock simulation's pretend tasks stay silent
  bus.on('agent.run.started', () => engine.play('taskStart'));
  bus.on('agent.run.completed', () => engine.play('taskDone'));
  bus.on('agent.run.failed', () => engine.play('taskFail'));
  bus.on('tool.awaiting_approval', () => engine.play('approval'));
  bus.on('conversation.run.completed', () => engine.play('message'));
  bus.on('conversation.run.failed', () => engine.play('taskFail'));
  bus.on('workflow.event', (p) => (p.kind === 'approval' ? engine.play('approval') : p.kind === 'complete' ? engine.play('finale') : undefined));
  bus.on('crew.event', (p) => (p.kind === 'final' ? engine.play('approval') : undefined));

  if (typeof document === 'undefined') return;
  // audio may only start after a gesture (and only once the switch is on)
  const unlock = () => store.getState().settings.sound && engine.start();
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  // a soft tick on buttons (not on the world's canvas, not on disabled ones)
  document.addEventListener(
    'click',
    (e) => {
      const b = (e.target as Element | null)?.closest?.('button, [role=tab], [role=option]');
      if (b && !(b as HTMLButtonElement).disabled) engine.play('click');
    },
    { capture: true },
  );
  document.addEventListener('visibilitychange', () => engine.setHidden(document.hidden));
}
