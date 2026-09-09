import { useState } from 'react';
import type { Repository } from '../data/repository';
import type { State } from '../domain/model';
import { isDemoWorkspace, type LegacyPreview } from '../domain/cloudImport';
import { download } from './shared';

export function CloudImport({ repo, state }: { repo: Repository; state: State }) {
  const [preview, setPreview] = useState<LegacyPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (state.migration)
    return (
      <>
        <p>
          Vanhan verkkokannan tiedot on tuotu. Alkuperäinen lähde ja korvattu testityötila
          sisältyvät varmuuskopioon.
        </p>
        <p>
          Tuonti on kertaluonteinen: vanhassa versiossa myöhemmin tehdyt muutokset eivät siirry
          tähän.
        </p>
      </>
    );
  if (!isDemoWorkspace(state))
    return <p>Automaattinen tuonti on käytettävissä vain testityötilan korvaamiseen.</p>;
  return (
    <>
      <p>Lue ajantasaiset tuotteet, keikat, arkisto, hyllyt ja tehtävät vanhasta verkkokannasta.</p>
      <p>
        Pidä vanhan ja uuden version muokkaukset tauolla tuonnin ajan. Tuonti ei synkronoi versioita
        jatkossa.
      </p>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage('');
          setPreview(null);
          try {
            setPreview(await repo.prepareLegacyImport!());
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Käsitellään…' : 'Lue vanhan verkkokannan tiedot'}
      </button>
      {preview && (
        <div className="import-preview">
          <h3>Tuotava aineisto</h3>
          <p>
            {Object.keys(preview.state.products).length} tuotetta ·{' '}
            {Object.keys(preview.state.trips).length} keikkaa ·{' '}
            {Object.keys(preview.state.locations).length} hyllypaikkaa ·{' '}
            {preview.state.reviews.length} tarkistusmerkintää
          </p>
          <p>
            Testituotteet ja testikeikat poistuvat aktiivisesta työtilasta. Niiden varmuuskopio sekä
            alkuperäinen tuontiaineisto tallentuvat uuden työtilan varmuuskopioon.
          </p>
          <p>
            Epäselvät vanhat pakkausrivit säilyvät tarkistettavina; niiden tuoteyhteyttä ei arvata.
            Tarkista tuonnin jälkeen aktiiviset keikat ja määräristiriidat ennen operatiivista
            käyttöä.
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage('');
              try {
                download(`av-arsenal-ennen-tuontia-${Date.now()}.json`, {
                  format: 'av-arsenal-backup',
                  version: 2,
                  state: preview.previous,
                  legacySource: preview.source,
                });
                await repo.commitLegacyImport!(preview);
                setPreview(null);
                setMessage('Tuonti valmis.');
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Tuo tiedot ja korvaa testiaineisto
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </>
  );
}
