import { useMemo, useState } from "react";
import { buildCreatorDefinition, defaultCreatorDraft, type CreatorDraft, type CreatorFamily } from "@games/creator";
import { validateGameDefinition } from "@games/engine/validator";
import "./GameCreator.css";

const familyLabel: Record<CreatorFamily, string> = {
  "draw-compare": "Draw & compare",
  "paired-battle": "Paired battle",
  "matching-discard": "Matching discard",
};

const familyHelp: Record<CreatorFamily, string> = {
  "draw-compare": "Each player draws one private card. Reveal together and compare ranks.",
  "paired-battle": "Two hidden piles reveal against each other, including War-style ties and a table zone.",
  "matching-discard": "Persistent private hands play by matching suit/rank; an 8 is wild and chooses the suit.",
};

const slug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

export function GameCreator({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<CreatorDraft>(() => defaultCreatorDraft());
  const [idTouched, setIdTouched] = useState(false);
  const [copied, setCopied] = useState(false);

  const definition = useMemo(() => buildCreatorDefinition(draft), [draft]);
  const validation = useMemo(() => validateGameDefinition(definition), [definition]);
  const json = useMemo(() => JSON.stringify(definition, null, 2), [definition]);

  const patch = (next: Partial<CreatorDraft>) => setDraft(current => ({ ...current, ...next }));
  const chooseFamily = (family: CreatorFamily) => {
    const next = defaultCreatorDraft(family);
    setDraft(next);
    setIdTouched(false);
    setCopied(false);
  };
  const changeName = (name: string) => {
    setDraft(current => ({ ...current, name, id: idTouched ? current.id : slug(name) }));
  };
  const copyDefinition = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return <section className="creator" aria-labelledby="creator-title">
    <div className="creator-head">
      <div><p className="eyebrow">GAME CREATOR V0</p><h2 id="creator-title">Design from proven rules</h2>
        <p>Compose only rule families the authoritative engine already knows how to validate and run.</p></div>
      <button type="button" className="button-quiet" onClick={onClose}>Back to rooms</button>
    </div>

    <div className="creator-layout">
      <div className="creator-form">
        <fieldset className="creator-panel">
          <legend>1. Rule family</legend>
          <div className="creator-family-grid">
            {(Object.keys(familyLabel) as CreatorFamily[]).map(family => <button type="button" key={family}
              className={`creator-family${draft.family === family ? " creator-family--active" : ""}`}
              onClick={() => chooseFamily(family)} aria-pressed={draft.family === family}>
              <strong>{familyLabel[family]}</strong><span>{familyHelp[family]}</span>
            </button>)}
          </div>
        </fieldset>

        <fieldset className="creator-panel creator-grid">
          <legend>2. Identity</legend>
          <label>Game name<input value={draft.name} maxLength={100} onChange={event => changeName(event.target.value)} /></label>
          <label>Game ID<input value={draft.id} maxLength={64} onChange={event => { setIdTouched(true); patch({ id: event.target.value }); }} />
            <small>Lowercase kebab-case, used by saved definitions later.</small></label>
        </fieldset>

        {draft.family === "draw-compare" && <fieldset className="creator-panel creator-grid">
          <legend>3. Players & outcome</legend>
          <label>Minimum players<input type="number" min={2} max={8} value={draft.minPlayers}
            onChange={event => patch({ minPlayers: Number(event.target.value) })} /></label>
          <label>Maximum players<input type="number" min={2} max={8} value={draft.maxPlayers}
            onChange={event => patch({ maxPlayers: Number(event.target.value) })} /></label>
          <label>Winner<select value={draft.rankWinner} onChange={event => patch({ rankWinner: event.target.value as CreatorDraft["rankWinner"] })}>
            <option value="highest-wins">Highest rank wins</option><option value="lowest-wins">Lowest rank wins</option>
          </select></label>
          <p className="creator-note">Fixed by this rule family: standard 52-card deck, shuffle, one private draw per player, ace high, reveal after everyone acts, ties allowed.</p>
        </fieldset>}

        {draft.family === "paired-battle" && <fieldset className="creator-panel creator-grid">
          <legend>3. Battle table</legend>
          <label>Table zone<input value={draft.tableZone} maxLength={32} onChange={event => patch({ tableZone: event.target.value })} />
            <small>Lowercase kebab-case. The renderer can present each zone differently later.</small></label>
          <label>Ownership while on table<select value={draft.tableOwnership}
            onChange={event => patch({ tableOwnership: event.target.value as CreatorDraft["tableOwnership"] })}>
            <option value="neutral">Neutral pot</option><option value="placer">Remains owned by placer</option>
          </select></label>
          <label>Remember who placed it<select value={draft.tableAttribution}
            onChange={event => patch({ tableAttribution: event.target.value as CreatorDraft["tableAttribution"] })}>
            <option value="placer">Yes</option><option value="none">No</option>
          </select></label>
          <p className="creator-note">Fixed by this v0 family: exactly 2 players, 26-card piles, high card wins, 3 face-down + 1 face-up on ties, insufficient cards lose.</p>
        </fieldset>}

        {draft.family === "matching-discard" && <fieldset className="creator-panel">
          <legend>3. Matching rules</legend>
          <p className="creator-note">Current safe vocabulary fixes this family to 2–4 players, 5 cards each, suit-or-rank matching, 8 as the wild rank, one fallback draw, and first empty hand wins. More controls will appear as the DSL gains proven primitives.</p>
        </fieldset>}

        <div className={`creator-validation ${validation.ok ? "creator-validation--ok" : "creator-validation--error"}`} role="status">
          {validation.ok ? <><strong>Definition valid</strong><span>Ready to save/test once dynamic custom-game sessions are wired.</span></> : <>
            <strong>{validation.errors.length} validation {validation.errors.length === 1 ? "error" : "errors"}</strong>
            <ul>{validation.errors.map((error, index) => <li key={`${error.path}-${index}`}><code>{error.path}</code> — {error.message}</li>)}</ul>
          </>}
        </div>
      </div>

      <aside className="creator-preview">
        <div className="creator-preview-head"><div><p className="eyebrow">VALIDATED DATA</p><h3>GameDefinition</h3></div>
          <button type="button" onClick={copyDefinition}>{copied ? "Copied" : "Copy JSON"}</button></div>
        <pre><code>{json}</code></pre>
        <p>No callbacks, scripts, expressions, or client-side authority are generated.</p>
      </aside>
    </div>
  </section>;
}
