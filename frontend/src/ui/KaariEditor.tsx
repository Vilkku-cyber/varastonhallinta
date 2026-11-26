import { useEffect, useMemo, useRef, useState } from 'react';
import html from '../kaari/kaari.html?raw';
import { parseCurveDocument, type CurveDocument } from '../domain/ledProjects';
import { Dialog } from './shared';

/** Loaded only after opening the optional Kaari tool. No access to app storage. */
export default function KaariEditor({
  initial,
  close,
  useShape,
}: {
  initial: CurveDocument;
  close: () => void;
  useShape: (document: CurveDocument) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    token = useRef(crypto.randomUUID()).current;
  const initialized = useRef(false),
    initialDocument = useRef(initial);
  const useShapeRef = useRef(useShape);
  useShapeRef.current = useShape;
  const [document, setDocument] = useState<CurveDocument | null>(null),
    [error, setError] = useState('');
  const source = useMemo(
    () =>
      html.replace(
        '</body>',
        `<script>
    (()=>{
      const token=${JSON.stringify(token)}; let initialized=false;
      const emit=()=>{if(initialized)parent.postMessage({type:'kaari-document',token,document:JSON.parse(snapshot())},'*');};
      const original=renderStudio;renderStudio=function(){original();emit();};
      window.addEventListener('message',event=>{
        if(event.source!==parent||event.data?.token!==token)return;
        if(event.data.type==='kaari-commit'){
          finishWaveUpdate();parent.postMessage({type:'kaari-commit',token,document:JSON.parse(snapshot())},'*');return;
        }
        if(event.data.type!=='kaari-load')return;
        try{const state=validProject(event.data.document);initialized=true;applyState(state);emit();}
        catch(error){parent.postMessage({type:'kaari-error',token,error:String(error.message)},'*');}
      });
      document.getElementById('saveProject').textContent='Vie JSON';
      document.getElementById('loadProject').textContent='Tuo JSON';
      parent.postMessage({type:'kaari-ready',token},'*');
    })();
    </script></body>`,
      ),
    [token],
  );
  const initialize = () => {
    if (initialized.current || !frame.current?.contentWindow) return;
    initialized.current = true;
    frame.current.contentWindow.postMessage(
      { type: 'kaari-load', token, document: initialDocument.current },
      '*',
    );
  };
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.token !== token) return;
      if (event.data.type === 'kaari-ready') initialize();
      if (event.data.type === 'kaari-error')
        setError('Kaari-suunnitelman avaaminen ei onnistunut.');
      if (event.data.type === 'kaari-document' || event.data.type === 'kaari-commit') {
        try {
          const parsed = parseCurveDocument(event.data.document);
          setDocument(parsed);
          setError('');
          if (event.data.type === 'kaari-commit') useShapeRef.current(parsed);
        } catch {
          setError('Kaari-suunnitelman tiedot eivät ole kelvollisia.');
        }
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [token]);
  return (
    <Dialog title="Kaari – LED-seinän muotoilu" close={close}>
      <div className="kaari-editor">
        <iframe
          ref={frame}
          title="Kaari-muotoilutyökalu"
          sandbox="allow-scripts allow-downloads"
          srcDoc={source}
          onLoad={initialize}
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer className="actions">
          <p className="hint">
            Käytä muotoa LED-suunnittelussa. Keikalle tallennus ja kalustopäivitys tehdään sen
            jälkeen erikseen.
          </p>
          <button className="secondary" onClick={close}>
            Peruuta
          </button>
          <button
            disabled={!document || !!error}
            onClick={() =>
              frame.current?.contentWindow?.postMessage({ type: 'kaari-commit', token }, '*')
            }
          >
            Käytä muotoa
          </button>
        </footer>
      </div>
    </Dialog>
  );
}
