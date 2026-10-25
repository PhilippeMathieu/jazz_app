// Le lexique : tous les mots du cours, expliqués simplement, avec un exemple à écouter.
import { useState } from 'preact/hooks';
import { TopBar } from '../../ui/Screen';
import { ChevronIcon } from '../../ui/icons';
import { TERMS } from './glossary';
import { TermCard } from './Cours';

export function Lexique() {
  const [open, setOpen] = useState<string | null>(null);
  const list = [...TERMS].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  return (
    <div class="screen">
      <TopBar title="Lexique" back="/" />
      <p class="intro">Les mots du cours, expliqués simplement. Touche un mot.</p>
      <div class="list">
        {list.map((t) => (
          <div key={t.id} class="row-wrap">
            <button class={'row' + (open === t.id ? ' open' : '')} onClick={() => setOpen(open === t.id ? null : t.id)}>
              <span class="row-main">
                <span class="row-title">{t.title}</span>
              </span>
              <ChevronIcon />
            </button>
            {open === t.id ? <TermCard term={t} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
