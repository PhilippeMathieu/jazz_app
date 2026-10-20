// Interrupteur du micro, même forme partout (barre du haut des écrans « au piano »).
import { MIC_MESSAGES, startMic, stopMic, useMicState } from '../core/listen/mic';
import { MicIcon } from './icons';
import { go } from './router';

export function MicPill({ onChange, echo }: { onChange?: (on: boolean) => void; echo?: boolean }) {
  const st = useMicState();
  const on = st === 'on';
  const failed = st === 'denied' || st === 'error' || st === 'unsupported';
  return (
    <button
      class={'mic-pill' + (on ? ' on' : '') + (failed ? ' failed' : '')}
      aria-pressed={on}
      aria-label={on ? 'Couper le micro' : 'Écouter mon piano au micro'}
      title={failed ? MIC_MESSAGES[st] : undefined}
      onClick={async () => {
        if (failed) return go('/micro');
        if (on) {
          stopMic();
          onChange?.(false);
          return;
        }
        // Attention : onChange?.(await startMic()) n'appellerait pas startMic sans onChange.
        const ok = await startMic({ echo });
        onChange?.(ok);
      }}
    >
      <MicIcon />
      <span>{on ? 'Écoute' : st === 'asking' ? '…' : failed ? 'Micro ?' : 'Micro'}</span>
    </button>
  );
}
