"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, PointerEvent } from "react";
import { supabase } from "../lib/supabase";

const bucket = "hall-floorplans";
const statuses = ["available", "reserved", "sold", "blocked"];
const geometryKeys = ["x", "y", "width", "height"] as const;
const maxFileSize = 10 * 1024 * 1024;

type Geometry = Record<(typeof geometryKeys)[number], number>;
type Booth = {id: string; code: string; status: string} & Record<keyof Geometry, number | null>;
type Gesture = {
  booth: Booth;
  start: Geometry;
  mode: "move" | "resize";
  pointerId: number;
  clientX: number;
  clientY: number;
  canvasWidth: number;
  canvasHeight: number;
};

async function renderPdf(file: Blob) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer())});
  try {
    const pdf = await task.promise;
    if (pdf.numPages !== 1) throw new Error("Choose a single-page hall floor plan.");
    const page = await pdf.getPage(1);
    const original = page.getViewport({scale: 1});
    const viewport = page.getViewport({scale: 2000 / Math.max(original.width, original.height)});
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({canvas, viewport}).promise;
    return { image: canvas.toDataURL("image/png"), ratio: original.width / original.height };
  } finally {
    await task.destroy();
  }
}

function clamp(value: number, low: number, high: number) {
  return Math.round(Math.max(low, Math.min(high, value)) * 100) / 100;
}

function geometry(booth: Booth): Geometry {
  const width = clamp(booth.width ?? 1, 0.25, 100);
  const height = clamp(booth.height ?? 1, 0.25, 100);
  return {width, height, x: clamp(booth.x ?? 0, 0, 100 - width), y: clamp(booth.y ?? 0, 0, 100 - height)};
}

function nextGeometry(start: Geometry, mode: Gesture["mode"], dx: number, dy: number): Geometry {
  if (mode === "resize") return {
    ...start, width: clamp(start.width + dx, 0.25, 100 - start.x),
    height: clamp(start.height + dy, 0.25, 100 - start.y),
  };
  return {...start, x: clamp(start.x + dx, 0, 100 - start.width), y: clamp(start.y + dy, 0, 100 - start.height)};
}

export function HallFloorplan({projectId, hallId, canEdit, version, onChange}: {
  projectId: string; hallId: string; canEdit: boolean; version: number; onChange: () => void;
}) {
  const [booths, setBooths] = useState<Booth[]>([]);
  const [background, setBackground] = useState<Awaited<ReturnType<typeof renderPdf>> | null>(null);
  const [backgroundLoading, setBackgroundLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [boothError, setBoothError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [drag, setDrag] = useState<{id: string; geometry: Geometry} | null>(null);
  const currentGesture = useRef<Gesture | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const filePath = `${projectId}/${hallId}.pdf`;
  const counts = Object.fromEntries(statuses.map(status => [status, booths.filter(booth => booth.status === status).length]));
  const visible = booths.filter(booth => (!filter || booth.status === filter) && booth.code.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = visible.find(booth => booth.id === selectedId);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const {data, error} = await supabase.storage.from(bucket).download(filePath);
        if (error) {
          const response = "originalError" in error && error.originalError instanceof Response ? error.originalError : null;
          const status = response?.status ?? ("status" in error ? Number(error.status) : 0);
          const message = status === 400 && response ? await response.text() : error.message;
          // Older Storage deployments return 400 for a missing object.
          if (status !== 404 && !(status === 400 && /not found|does not exist/i.test(message))) throw error;
        } else {
          const rendered = await renderPdf(data);
          if (active) setBackground(rendered);
        }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load the floor plan.");
      } finally {
        if (active) setBackgroundLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [filePath]);

  useEffect(() => {
    let active = true;
    void supabase.from("booths").select("id,code,status,x,y,width,height").eq("hall_id", hallId).order("code")
      .then(({data, error}) => {
        if (!active) return;
        setBooths(data ?? []);
        setBoothError(error?.message ?? "");
      });
    return () => { active = false; };
  }, [hallId, version]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!canEdit || busy || !file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") || file.size > maxFileSize) {
      setActionError("Choose a PDF no larger than 10 MB.");
      return;
    }
    if (background && !window.confirm("Replace this hall’s current floor plan?")) return;
    setBusy(true);
    setActionError("");
    try {
      const preview = await renderPdf(file);
      const {error} = await supabase.storage.from(bucket).upload(filePath, file, {
        contentType: "application/pdf", cacheControl: "0", upsert: true,
      });
      if (error) throw error;
      setBackground(preview);
      setLoadError("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not upload the floor plan.");
    } finally {
      setBusy(false);
    }
  }

  async function save(booth: Booth, next: Geometry) {
    if (!canEdit || busy || geometryKeys.every(key => next[key] === geometry(booth)[key])) return;
    setBusy(true);
    setActionError("");
    try {
      let request = supabase.from("booths").update(next).eq("hall_id", hallId).eq("id", booth.id);
      for (const key of geometryKeys) {
        const previous = booth[key];
        request = previous === null ? request.is(key, null) : request.eq(key, previous);
      }
      const {data, error} = await request.select("id,code,status,x,y,width,height").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("The booth changed while you were editing. The latest layout has been loaded.");
      setBooths(rows => rows.map(row => row.id === data.id ? data : row));
      onChange();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not save the booth layout.");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  function startGesture(event: PointerEvent<HTMLButtonElement>, booth: Booth, mode: Gesture["mode"]) {
    if (event.button !== 0 || !event.isPrimary || !canEdit || busy || currentGesture.current || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    setSelectedId(booth.id);
    currentGesture.current = {booth, mode, start: geometry(booth), pointerId: event.pointerId,
      clientX: event.clientX, clientY: event.clientY, canvasWidth: rect.width, canvasHeight: rect.height};
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function position(event: PointerEvent<HTMLButtonElement>, gesture: Gesture) {
    return nextGeometry(gesture.start, gesture.mode,
      100 * (event.clientX - gesture.clientX) / gesture.canvasWidth,
      100 * (event.clientY - gesture.clientY) / gesture.canvasHeight);
  }

  function moveGesture(event: PointerEvent<HTMLButtonElement>) {
    const gesture = currentGesture.current;
    if (gesture?.pointerId === event.pointerId) setDrag({id: gesture.booth.id, geometry: position(event, gesture)});
  }

  function endGesture(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const gesture = currentGesture.current;
    if (gesture?.pointerId !== event.pointerId) return;
    currentGesture.current = null;
    setDrag(null);
    if (!cancelled) void save(gesture.booth, position(event, gesture));
  }

  function keyboardMove(event: KeyboardEvent<HTMLButtonElement>, booth: Booth, mode: Gesture["mode"]) {
    const directions: Record<string, [number, number]> = {ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0]};
    const direction = directions[event.key];
    if (!canEdit || !direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    void save(booth, nextGeometry(geometry(booth), mode, direction[0] * step, direction[1] * step));
  }

  return <section className="hall-floorplan" aria-label="Hall floor plan">
    <div className="floorplan-toolbar">
      {canEdit && <label>{background ? "Replace PDF" : "Upload floor plan PDF"}
        <input type="file" accept="application/pdf,.pdf" disabled={busy || backgroundLoading} onChange={upload} />
      </label>}
      <label>Find booth<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label>Status<select value={filter} onChange={event => setFilter(event.target.value)}>
        <option value="">All statuses</option>
        {statuses.map(status => <option key={status} value={status}>{status} ({counts[status]})</option>)}
      </select></label>
      <label>Zoom<select value={zoom} onChange={event => setZoom(Number(event.target.value))}>
        {[75,100,125,150,200,300].map(value => <option key={value} value={value}>{value}%</option>)}
      </select></label>
    </div>
    {backgroundLoading && <p role="status">Loading floor plan…</p>}
    {!backgroundLoading && !background && !loadError && <p>No PDF is attached to this hall.</p>}
    {loadError && <p role="alert">{loadError}</p>}
    {actionError && <p role="alert">{actionError}</p>}
    {boothError && <p role="alert">{boothError}</p>}
    {busy && <p role="status">Saving…</p>}
    <div className="floorplan-scroll" tabIndex={0} aria-label="Scrollable floor plan">
      <div ref={canvas} className="floorplan-canvas" style={{width: `${zoom}%`, aspectRatio: background?.ratio ?? 1.414,
        backgroundImage: background ? `url("${background.image}")` : undefined}}>
        {visible.map(booth => {
          const box = drag?.id === booth.id ? drag.geometry : geometry(booth);
          return <div key={booth.id} className={`floorplan-tile floorplan-${booth.status}`}
            style={{left:`${box.x}%`, top:`${box.y}%`, width:`${box.width}%`, height:`${box.height}%`}}>
            <button type="button" className="floorplan-booth" data-editable={canEdit}
              aria-label={`Booth ${booth.code}, ${booth.status}`} aria-pressed={selectedId === booth.id}
              onClick={() => setSelectedId(booth.id)} onPointerDown={event => startGesture(event, booth, "move")}
              onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={event => endGesture(event, true)}
              onLostPointerCapture={event => endGesture(event, true)} onKeyDown={event => keyboardMove(event, booth, "move")}>
              {booth.code}
            </button>
            {canEdit && selectedId === booth.id && <button type="button" className="floorplan-resize"
              aria-label={`Resize booth ${booth.code}`} onPointerDown={event => startGesture(event, booth, "resize")}
              onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={event => endGesture(event, true)}
              onLostPointerCapture={event => endGesture(event, true)} onKeyDown={event => keyboardMove(event, booth, "resize")} />}
          </div>;
        })}
      </div>
    </div>
    <p aria-live="polite">{visible.length} of {booths.length} booths shown{selected ? ` · ${selected.code}: ${selected.status}` : ""}</p>
    {canEdit && <p>Drag a booth to move it. Select it to reveal the resize handle. Arrow keys also move or resize the focused control.</p>}
  </section>;
}
