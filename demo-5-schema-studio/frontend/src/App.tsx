import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from './components/Editor';
import { DiagnosticsRail } from './components/DiagnosticsRail';
import { PackagePanel } from './components/PackagePanel';
import { ExtractPanel } from './components/ExtractPanel';
import { GenerateModal } from './components/GenerateModal';
import { LatencyStrip, type Sample } from './components/LatencyStrip';
import { PRESETS } from './lib/presets';
import { api, type CompileResult, type ExtractResult, type StatusResult } from './lib/api';

const COMPILE_DEBOUNCE_MS = 220;

export function App() {
  const [schema, setSchema] = useState(PRESETS[0]!.source);
  const [document, setDocument] = useState(PRESETS[0]!.document);
  const [presetId, setPresetId] = useState(PRESETS[0]!.id);

  const [compile, setCompile] = useState<CompileResult | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [transportError, setTransportError] = useState<string | null>(null);

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  /** `nonce` lets the same diagnostic be re-revealed on repeated clicks. */
  const [reveal, setReveal] = useState<{ index: number; nonce: number } | null>(null);

  const [extract, setExtract] = useState<ExtractResult | null>(null);
  const [extracting, setExtracting] = useState(false);

  const [status, setStatus] = useState<StatusResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [tab, setTab] = useState<'package' | 'extract'>('package');
  const [splitPct, setSplitPct] = useState(54);

  const revisionRef = useRef(0);
  const appliedRef = useRef(-1);
  const failuresRef = useRef(0);
  const [retryTick, setRetryTick] = useState(0);

  // The backend spends a few seconds loading the BAML runtime before it listens.
  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      api
        .status()
        .then((next) => {
          if (!cancelled) setStatus(next);
        })
        .catch(() => {
          if (!cancelled) window.setTimeout(poll, 1200);
        });
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── the loop: every settled edit compiles the text with the real compiler ──
  useEffect(() => {
    const revision = ++revisionRef.current;
    const controller = new AbortController();
    setCompiling(true);
    const timer = window.setTimeout(() => {
      api
        .compile(schema, revision, controller.signal)
        .then((result) => {
          failuresRef.current = 0;
          if (result.revision < appliedRef.current) return; // stale
          appliedRef.current = result.revision;
          setCompile(result);
          setTransportError(null);
          setSamples((prev) => [
            ...prev.slice(-200),
            { compileMs: result.timing.compileMs, totalMs: result.timing.totalMs, ok: result.ok },
          ]);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          // The backend takes a few seconds to load the runtime on boot; a miss
          // during that window is not worth a banner, a persistent one is.
          failuresRef.current += 1;
          if (failuresRef.current > 3) {
            setTransportError(err instanceof Error ? err.message : String(err));
          } else {
            window.setTimeout(() => setRetryTick((t) => t + 1), 1500);
          }
        })
        .finally(() => {
          if (revisionRef.current === revision) setCompiling(false);
        });
    }, COMPILE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [schema, retryTick]);

  const classes = compile?.ok ? compile.classes : [];
  const diagnostics = compile?.diagnostics ?? [];

  // Keep a sensible extraction target selected as the package changes shape.
  useEffect(() => {
    if (classes.length === 0) return;
    if (selectedClass && classes.some((c) => c.qualifiedName === selectedClass)) return;
    const richest = [...classes].sort((a, b) => b.fields.length - a.fields.length)[0]!;
    setSelectedClass(richest.qualifiedName);
  }, [classes, selectedClass]);

  const selected = useMemo(
    () => classes.find((c) => c.qualifiedName === selectedClass) ?? null,
    [classes, selectedClass],
  );

  const applyPreset = useCallback((id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(preset.id);
    setSchema(preset.source);
    setDocument(preset.document);
    setExtract(null);
    setSelectedClass(null);
  }, []);

  const runExtract = useCallback(() => {
    if (!selected || document.trim().length === 0) return;
    setExtracting(true);
    setExtract(null);
    api
      .extract(schema, selected.qualifiedName, document)
      .then(setExtract)
      .catch((err: unknown) =>
        setExtract({
          ok: false,
          className: selected.name,
          rows: [],
          json: null,
          raw: '',
          prompt: '',
          source: 'mock',
          model: null,
          latencyMs: 0,
          error: { code: 'TRANSPORT', message: err instanceof Error ? err.message : String(err) },
        }),
      )
      .finally(() => setExtracting(false));
  }, [schema, selected, document]);

  const runGenerate = useCallback(
    (description: string) => {
      setGenerating(true);
      setGenerateError(null);
      api
        .generate(description)
        .then((result) => {
          if (!result.ok) {
            setGenerateError(result.error?.message ?? 'The model did not return a schema.');
            return;
          }
          setSchema(result.schema);
          setPresetId('custom');
          setExtract(null);
          setSelectedClass(null);
          setModalOpen(false);
          setTab('package');
        })
        .catch((err: unknown) => setGenerateError(err instanceof Error ? err.message : String(err)))
        .finally(() => setGenerating(false));
    },
    [],
  );

  // Draggable split.
  const splitRef = useRef<HTMLDivElement | null>(null);
  const onGutterDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    const host = splitRef.current;
    if (!host) return;
    const move = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(72, Math.max(30, pct)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.document.body.style.cursor = '';
    };
    window.document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const live = status?.mode === 'live';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Schema Studio</span>
          <span className="brand-sub">write a schema, get an extractor</span>
        </div>

        <select className="select" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
          {presetId === 'custom' && <option value="custom">Custom schema</option>}
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <button type="button" className="btn" onClick={() => setModalOpen(true)}>
          Let the model write it
        </button>

        <div className="topbar-spacer" />

        {compiling ? (
          <span className="status-pill busy">
            <span className="dot pulse" />
            compiling
          </span>
        ) : compile?.ok ? (
          <span className="status-pill ok">
            <span className="dot" />
            compiled in <b>{compile.timing.compileMs.toFixed(1)}ms</b>
          </span>
        ) : compile ? (
          <span className="status-pill err">
            <span className="dot" />
            {errorCount} {errorCount === 1 ? 'error' : 'errors'} in <b>{compile.timing.compileMs.toFixed(1)}ms</b>
          </span>
        ) : (
          <span className="status-pill">
            <span className="dot" />
            starting
          </span>
        )}

        {status && (
          <span className={`status-pill ${live ? 'ok' : ''}`} title={live ? 'live model calls enabled' : 'no API key: extractions use a canned response'}>
            {live ? status.model ?? 'live model' : 'offline mode'}
          </span>
        )}
      </header>

      <div
        className="split"
        ref={splitRef}
        style={{ gridTemplateColumns: `${splitPct}% 5px calc(${100 - splitPct}% - 5px)` }}
      >
        <section className="pane left">
          <div className="pane-head">
            <span className="pane-title">schema.baml</span>
            <span className="spacer" />
            <span className="dim">
              {schema.split('\n').length} lines · compiles on every pause
            </span>
          </div>

          {status?.runtime === 'unavailable' && (
            <div className="banner" style={{ margin: '10px 12px 0' }}>
              The BAML runtime failed to load, so nothing here is real: <code>{status.runtimeError}</code>
            </div>
          )}
          {transportError && (
            <div className="banner" style={{ margin: '10px 12px 0' }}>
              {transportError}
            </div>
          )}

          <div className="editor-wrap">
            <Editor value={schema} onChange={setSchema} diagnostics={diagnostics} reveal={reveal} />
          </div>

          <DiagnosticsRail
            diagnostics={diagnostics}
            onReveal={(index) => setReveal((prev) => ({ index, nonce: (prev?.nonce ?? 0) + 1 }))}
            compiling={compiling}
            ok={compile?.ok ?? false}
            classCount={classes.length}
          />
          <LatencyStrip samples={samples} />
        </section>

        <div className="gutter" onPointerDown={onGutterDown} role="separator" aria-orientation="vertical" />

        <section className="pane">
          <div className="pane-head">
            <div className="tabs">
              <button type="button" className={`tab ${tab === 'package' ? 'active' : ''}`} onClick={() => setTab('package')}>
                Package{classes.length > 0 ? ` (${classes.length})` : ''}
              </button>
              <button type="button" className={`tab ${tab === 'extract' ? 'active' : ''}`} onClick={() => setTab('extract')}>
                Extract
              </button>
            </div>
            <span className="spacer" />
            {selected && <span className="dim">target: {selected.name}</span>}
          </div>

          <div className="tab-body">
            {tab === 'package' ? (
              <PackagePanel
                classes={classes}
                selected={selectedClass}
                onSelect={(name) => {
                  setSelectedClass(name);
                  setTab('extract');
                }}
                ok={compile?.ok ?? false}
              />
            ) : (
              <ExtractPanel
                document={document}
                onDocumentChange={setDocument}
                onRun={runExtract}
                running={extracting}
                disabled={!selected || document.trim().length === 0}
                disabledReason={
                  !compile?.ok
                    ? 'the schema has to compile first'
                    : !selected
                      ? 'pick a class in the Package tab'
                      : 'paste a document to extract from'
                }
                result={extract}
                targetClass={selected?.name ?? null}
              />
            )}
          </div>
        </section>
      </div>

      <GenerateModal
        open={modalOpen}
        busy={generating}
        error={generateError}
        live={live}
        onClose={() => setModalOpen(false)}
        onSubmit={runGenerate}
      />
    </div>
  );
}
