"use client";

import { PointerEvent, useMemo, useRef, useState } from "react";

type Status = "available" | "on_hold" | "booked" | "blocked";
type Booth = { id: string; status: Status; width: number; depth: number; x: number; y: number; w: number; h: number; exhibitor?: string };
type Drag = { id: string; mode: "move" | "resize"; startX: number; startY: number; x: number; y: number; w: number; h: number };
const halls = ["Hall 5", "Hall 6", "Hall 7"];
const drawings: Record<string, string> = { "Hall 5": "/floorplans/kif-2026-hall-5-original.pdf", "Hall 6": "/floorplans/kif-2026-hall-6-original.pdf", "Hall 7": "/floorplans/kif-2026-hall-7-original.pdf" };
const colors: Record<Status, string> = { available: "#c7f2d5", on_hold: "#e4a52b", booked: "#d71920", blocked: "#515158" };
const labels: Record<Status, string> = { available: "Available", on_hold: "On hold", booked: "Booked", blocked: "Blocked" };

function createBooths(hall: string): Booth[] {
  const prefix = hall.replace("Hall ", "");
  return Array.from({ length: 30 }, (_, index) => {
    const col = index % 6, row = Math.floor(index / 6), width = index % 5 === 0 ? 6 : 4, depth = index % 5 === 0 ? 4 : 3;
    const status: Status = index % 11 === 0 ? "blocked" : index % 7 === 0 ? "on_hold" : index % 4 === 0 ? "available" : "booked";
    return { id: `${prefix}.${index + 1}`, status, width, depth, x: 4 + col * 15.5, y: 8 + row * 17, w: 12, h: 12, exhibitor: status === "booked" ? "Exhibitor" : undefined };
  });
}

export default function FloorplanPage() {
  const [hall, setHall] = useState("Hall 5");
  const [inventory, setInventory] = useState<Record<string, Booth[]>>(() => Object.fromEntries(halls.map((name) => [name, createBooths(name)])));
  const [history, setHistory] = useState<Record<string, Booth[]>[]>([]);
  const [future, setFuture] = useState<Record<string, Booth[]>[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [client, setClient] = useState(false);
  const [view, setView] = useState<"drawing" | "designer">("drawing");
  const [detecting, setDetecting] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [opacity, setOpacity] = useState(42);
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const booths = inventory[hall];
  const selected = booths.find((booth) => booth.id === selectedId) ?? null;
  const counts = useMemo(() => Object.fromEntries((["available", "on_hold", "booked", "blocked"] as Status[]).map((key) => [key, booths.filter((booth) => booth.status === key).length])) as Record<Status, number>, [booths]);
  function chooseHall(name: string) { setHall(name); setSelectedId(null); setView("drawing"); }
  function saveSnapshot() { setHistory((items) => [...items.slice(-29), inventory]); setFuture([]); }
  function update(id: string, changes: Partial<Booth>, record = true) { if (record) saveSnapshot(); setInventory((all) => ({ ...all, [hall]: all[hall].map((booth) => booth.id === id ? { ...booth, ...changes } : booth) })); }
  function undo() { const previous = history.at(-1); if (!previous) return; setFuture((items) => [...items, inventory]); setInventory(previous); setHistory((items) => items.slice(0, -1)); setSelectedId(null); }
  function redo() { const next = future.at(-1); if (!next) return; setHistory((items) => [...items, inventory]); setInventory(next); setFuture((items) => items.slice(0, -1)); setSelectedId(null); }
  function startDrag(event: PointerEvent<HTMLElement>, booth: Booth, mode: Drag["mode"]) { if (client) return; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); saveSnapshot(); drag.current = { id: booth.id, mode, startX: event.clientX, startY: event.clientY, x: booth.x, y: booth.y, w: booth.w, h: booth.h }; setSelectedId(booth.id); }
  function move(event: PointerEvent<HTMLDivElement>) { const active = drag.current, rect = board.current?.getBoundingClientRect(); if (!active || !rect) return; const dx = ((event.clientX - active.startX) / rect.width) * 100, dy = ((event.clientY - active.startY) / rect.height) * 100; if (active.mode === "move") update(active.id, { x: Math.max(0, Math.min(100 - active.w, active.x + dx)), y: Math.max(0, Math.min(100 - active.h, active.y + dy)) }, false); else update(active.id, { w: Math.max(5, Math.min(100 - active.x, active.w + dx)), h: Math.max(5, Math.min(100 - active.y, active.h + dy)) }, false); }
  function endDrag() { drag.current = null; }
  function detect() { setDetecting(true); setTimeout(() => { setView("designer"); setDetecting(false); }, 800); }
  function request() { if (!selected || selected.status !== "available") return; update(selected.id, { status: "on_hold" }); window.open(`https://wa.me/971509811011?text=${encodeURIComponent(`VEGA booth request — ${hall}, booth ${selected.id}, ${selected.width} × ${selected.depth} m`)}`, "_blank", "noopener,noreferrer"); }
  return <main className="floor-shell"><header className="floor-header"><a href="/">‹ Back to projects</a><div><small>25TH KIF GOLD EXPO · FLOORPLAN DESIGNER</small><h1>{hall} — booth map</h1></div>{!client && <div className="history-actions"><button disabled={!history.length} onClick={undo}>↶ Undo</button><button disabled={!future.length} onClick={redo}>↷ Redo</button></div>}<button className="filter-option" onClick={() => { setClient((x) => !x); setSelectedId(null); }}>{client ? "Staff design view" : "Client view"}</button><button className="new">Publish changes</button></header>
    <section className="floor-main"><aside className="floor-side"><p>VENUE</p>{halls.map((name) => <button key={name} className={name === hall ? "hall-active" : ""} onClick={() => chooseHall(name)}>{name}<span>›</span></button>)}<hr /><p>INVENTORY</p><div className="legend">{(["available", "on_hold", "booked", "blocked"] as Status[]).map((status) => <span key={status}><i style={{ backgroundColor: colors[status] }} /> {labels[status]} <b>{counts[status]}</b></span>)}</div></aside>
      <section className="plan"><div className="plan-top"><span>{view === "drawing" ? "Original KIF drawing — source reference" : client ? "Select an available booth to contact Sales." : "Drag booths to position. Drag the lower-right handle to resize."}</span><b>{view === "drawing" ? "ORIGINAL" : "DESIGNER MODE"}</b></div><div className="drawing-tabs"><button className={view === "drawing" ? "active" : ""} onClick={() => setView("drawing")}>Original KIF drawing</button><button className={view === "designer" ? "active" : ""} onClick={() => setView("designer")}>Interactive designer</button>{!client && <button onClick={detect} disabled={detecting}>{detecting ? "Detecting…" : "Auto-detect booths"}</button>}<a href={drawings[hall]} target="_blank" rel="noreferrer">Open PDF ↗</a></div>{view === "drawing" ? <div className="drawing-frame"><iframe key={hall} title={`${hall} original KIF drawing`} src={`${drawings[hall]}#view=FitH`} /></div> : <><div className="designer-tools"><label><input type="checkbox" checked={showBackground} onChange={(e) => setShowBackground(e.target.checked)} /> Original drawing background</label>{showBackground && <label>Opacity <input type="range" min="0" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} /> {opacity}%</label>}<span>{client ? "Client selection" : "Draft detection — verify every booth before publishing"}</span></div><div className="designer-board" ref={board} onPointerMove={move} onPointerUp={endDrag} onPointerLeave={endDrag}>{showBackground && <iframe className="designer-background" title="KIF drawing reference" src={`${drawings[hall]}#view=FitH`} style={{ opacity: opacity / 100 }} />}{booths.map((booth) => <button key={booth.id} className={`shape ${selectedId === booth.id ? "selected" : ""}`} disabled={client && booth.status !== "available"} onPointerDown={(e) => startDrag(e, booth, "move")} onClick={() => setSelectedId(booth.id)} style={{ left: `${booth.x}%`, top: `${booth.y}%`, width: `${booth.w}%`, height: `${booth.h}%`, background: colors[booth.status], color: booth.status === "available" ? "#146b43" : "#fff" }}><b>{booth.id}</b><small>{booth.width} × {booth.depth} m</small>{!client && <i title="Resize booth" onPointerDown={(e) => startDrag(e, booth, "resize")} />}</button>)}</div></>}</section></section>
    {selected && <aside className="booth-panel"><button className="close" onClick={() => setSelectedId(null)}>×</button><p>{client ? "BOOTH SELECTION" : "EDITABLE BOOTH"}</p><h2>{selected.id}</h2><span className={`badge ${selected.status}`}>{labels[selected.status]}</span><div className="booth-details"><small>DIMENSIONS</small><b>{selected.width} × {selected.depth} m · {selected.width * selected.depth} sqm</b><small>POSITION</small><b>{Math.round(selected.x)}% × {Math.round(selected.y)}%</b><small>STATUS</small><b>{labels[selected.status]}</b></div>{client ? <button className="new full" disabled={selected.status !== "available"} onClick={request}>Book — contact Sales</button> : <><p>EDIT</p><div className="status-actions"><button className="release" onClick={() => update(selected.id, { status: "available" })}>Available</button><button className="hold" onClick={() => update(selected.id, { status: "on_hold" })}>Hold</button><button className="book" onClick={() => update(selected.id, { status: "booked" })}>Book</button><button className="block" onClick={() => update(selected.id, { status: "blocked" })}>Block</button></div></>}</aside>}
  </main>;
}
