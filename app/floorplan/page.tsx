"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";

type Status = "available" | "on_hold" | "booked" | "blocked";
type BoothType = "Space only" | "Shell scheme" | "Custom booth";
type Location = "Standard" | "Corner" | "Island" | "VIP" | "Front Row";
type BoothStyle = "1 side open" | "2 side open" | "3 side open" | "All 4 sides open";
type Booth = { id: string; status: Status; width: number; depth: number; type: BoothType; location: Location; style: BoothStyle; exhibitor?: string };

const halls = ["Hall 5", "Hall 6", "Hall 7"];
const drawings: Record<string, string> = { "Hall 5": "/floorplans/kif-2026-hall-5-original.pdf", "Hall 6": "/floorplans/kif-2026-hall-6-original.pdf", "Hall 7": "/floorplans/kif-2026-hall-7-original.pdf" };
const labels: Record<Status, string> = { available: "Available", on_hold: "On hold", booked: "Booked", blocked: "Blocked" };
const colors: Record<Status, string> = { available: "#c7f2d5", on_hold: "#e4a52b", booked: "#d71920", blocked: "#515158" };
const names = ["Aurum House", "Blue Diamond", "Noor Jewels", "Goldline"];

function buildBooths(hall: string): Booth[] {
  const prefix = hall.replace("Hall ", "");
  return Array.from({ length: 42 }, (_, index) => {
    const width = index % 5 === 0 ? 6 : index % 3 === 0 ? 4 : 3;
    const depth = index % 5 === 0 ? 4 : index % 3 === 0 ? 3 : 4;
    const status: Status = index % 11 === 0 ? "blocked" : index % 7 === 0 ? "on_hold" : index % 4 === 0 ? "available" : "booked";
    return { id: `${prefix}.${index + 1}`, status, width, depth, type: index % 3 === 0 ? "Space only" : "Shell scheme", location: index % 6 === 0 ? "Corner" : "Standard", style: index % 4 === 0 ? "2 side open" : "1 side open", exhibitor: status === "booked" ? names[index % names.length] : undefined };
  });
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="floor-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

export default function FloorplanPage() {
  const [hall, setHall] = useState("Hall 5");
  const [inventory, setInventory] = useState<Record<string, Booth[]>>(() => Object.fromEntries(halls.map((name) => [name, buildBooths(name)])));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [client, setClient] = useState(false);
  const [view, setView] = useState<"drawing" | "interactive">("drawing");
  const [opacity, setOpacity] = useState(55);
  const [uploadedDrawing, setUploadedDrawing] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploadedIsPdf, setUploadedIsPdf] = useState(false);
  const [includeBackground, setIncludeBackground] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [holdHours, setHoldHours] = useState<12 | 72>(12);
  const [holdReason, setHoldReason] = useState("");
  const [holdPrompt, setHoldPrompt] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const booths = inventory[hall];
  const selected = booths.find((booth) => booth.id === selectedId) ?? null;
  const counts = useMemo(() => Object.fromEntries((["available", "on_hold", "booked", "blocked"] as Status[]).map((name) => [name, booths.filter((booth) => booth.status === name).length])) as Record<Status, number>, [booths]);

  function updateBooth(changes: Partial<Booth>) { if (selected) setInventory((current) => ({ ...current, [hall]: current[hall].map((booth) => booth.id === selected.id ? { ...booth, ...changes } : booth) })); }
  function changeStatus(status: Status) { if (!selected) return; updateBooth({ status, exhibitor: status === "booked" ? selected.exhibitor ?? "New exhibitor" : undefined }); }
  function hold() { if (!selected) return; if (holdHours === 72 && !holdReason.trim()) { setHoldPrompt(true); return; } changeStatus("on_hold"); setHoldPrompt(false); }
  function chooseHall(name: string) { setHall(name); setSelectedId(null); setView("drawing"); }
  function uploadDrawing(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; if (uploadedDrawing) URL.revokeObjectURL(uploadedDrawing); setUploadedDrawing(URL.createObjectURL(file)); setUploadedName(file.name); setUploadedIsPdf(file.type === "application/pdf"); setView("interactive"); }
  function addBooth(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const id = String(form.get("booth") || "").trim(); if (!id || booths.some((booth) => booth.id.toLowerCase() === id.toLowerCase())) return; setInventory((current) => ({ ...current, [hall]: [...current[hall], { id, width: Number(form.get("width")), depth: Number(form.get("depth")), status: "available", type: form.get("type") as BoothType, location: form.get("location") as Location, style: form.get("style") as BoothStyle }] })); setSelectedId(id); setAddOpen(false); setView("interactive"); }
  function deleteBooth() { if (!selected || !window.confirm(`Delete booth ${selected.id}?`)) return; setInventory((current) => ({ ...current, [hall]: current[hall].filter((booth) => booth.id !== selected.id) })); setSelectedId(null); }
  function printFloorplan() { document.body.dataset.printBackground = includeBackground ? "yes" : "no"; window.print(); }
  function openWhatsApp() { if (!selected || selected.status !== "available") return; changeStatus("on_hold"); const text = encodeURIComponent(`VEGA booth booking request\nEvent: 25TH KIF GOLD EXPO\nHall: ${hall}\nBooth: ${selected.id}\nType: ${selected.type}\nLocation: ${selected.location}\nDimensions: ${selected.width} × ${selected.depth} m\nArea: ${selected.width * selected.depth} sqm`); window.open(`https://wa.me/971509811011?text=${text}`, "_blank", "noopener,noreferrer"); }

  return <main className="floor-shell">
    <header className="floor-header"><a href="/">‹ Back to projects</a><div><small>25TH KIF GOLD EXPO · BOOTH MANAGEMENT · USD</small><h1>{hall} — floorplan</h1></div><button className="filter-option" onClick={() => { setClient((value) => !value); setSelectedId(null); }}>{client ? "Staff view" : "Client view"}</button><button className="new">Publish changes</button></header>
    <section className="floor-main"><aside className="floor-side"><p>VENUE</p>{halls.map((name) => <button key={name} className={name === hall ? "hall-active" : ""} onClick={() => chooseHall(name)}>{name}<span>›</span></button>)}<hr /><p>INVENTORY · USD</p><div className="legend">{(["available", "on_hold", "booked", "blocked"] as Status[]).map((status) => <span key={status}><i style={{ backgroundColor: colors[status] }} /> {labels[status]} <b>{counts[status]}</b></span>)}</div></aside>
      <section className="plan"><div className="plan-top"><span>{view === "drawing" ? "Original KIF drawing — preserved unchanged." : "Interactive working layer — verified booth data only."}</span><b>{view === "drawing" ? "ORIGINAL DRAWING" : `${counts.booked + counts.on_hold} / ${booths.length} allocated`}</b></div>
        <div className="drawing-tabs"><button className={view === "drawing" ? "active" : ""} onClick={() => { setView("drawing"); setSelectedId(null); }}>Original KIF drawing</button><button className={view === "interactive" ? "active" : ""} onClick={() => setView("interactive")}>Interactive layer</button><button onClick={() => uploadRef.current?.click()}>Upload floorplan</button><button onClick={() => setAddOpen(true)}>+ Add booth</button><button onClick={printFloorplan}>Print / download</button><a href={uploadedDrawing || drawings[hall]} download={uploadedName || undefined}>Download drawing ↓</a><input ref={uploadRef} className="hidden-upload" type="file" accept="application/pdf,image/png,image/jpeg" onChange={uploadDrawing} /></div>
        {view === "drawing" ? <div className="drawing-frame"><iframe key={hall} title={`${hall} original KIF drawing`} src={`${drawings[hall]}#view=FitH`} /></div> : <><div className="floor-tools"><label>Background opacity <input type="range" min="0" max="100" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /> <b>{opacity}%</b></label><label className="print-choice"><input type="checkbox" checked={includeBackground} onChange={(event) => setIncludeBackground(event.target.checked)} /> Print with drawing background</label>{uploadedName && <span>Using: {uploadedName}</span>}</div><div className={`hall-plan ${includeBackground ? "print-background" : ""}`}>{uploadedDrawing && <div className="floorplan-background" style={{ opacity: opacity / 100 }}>{uploadedIsPdf ? <iframe title="Uploaded floorplan" src={uploadedDrawing} /> : <img src={uploadedDrawing} alt="Uploaded floorplan" />}</div>}<div className="entry">MAIN ENTRANCE</div><div className="aisle horizontal" /><div className="aisle vertical" />{booths.map((booth) => <button key={booth.id} style={{ backgroundColor: colors[booth.status], color: booth.status === "available" ? "#12673d" : "#fff" }} disabled={client && booth.status !== "available"} onClick={() => setSelectedId(booth.id)} className={`booth ${booth.status} ${selectedId === booth.id ? "selected" : ""}`}><b>{booth.id}</b><small>{booth.width} × {booth.depth} m · {booth.width * booth.depth} sqm</small></button>)}</div></>}</section></section>
    {selected && <aside className="booth-panel"><button className="close" onClick={() => setSelectedId(null)}>×</button><p>{client ? "CLIENT BOOTH REQUEST" : "BOOTH DETAILS · USD"}</p><h2>{selected.id}</h2><span className={`badge ${selected.status}`}>{labels[selected.status]}</span><div className="booth-details"><small>HALL</small><b>{hall}</b><small>DIMENSIONS / AREA</small><b>{selected.width} × {selected.depth} m · {selected.width * selected.depth} sqm</b><SelectField label="BOOTH TYPE" value={selected.type} options={["Space only", "Shell scheme", "Custom booth"]} onChange={(value) => updateBooth({ type: value as BoothType })} /><SelectField label="LOCATION" value={selected.location} options={["Standard", "Corner", "Island", "VIP", "Front Row"]} onChange={(value) => updateBooth({ location: value as Location })} /><SelectField label="BOOTH STYLE" value={selected.style} options={["1 side open", "2 side open", "3 side open", "All 4 sides open"]} onChange={(value) => updateBooth({ style: value as BoothStyle })} /></div>{client ? <button className="new full" disabled={selected.status !== "available"} onClick={openWhatsApp}>Book — contact Sales</button> : <><p>RESERVATION & BOOKING HOLD</p><div className="hold-controls"><button className={holdHours === 12 ? "chosen" : ""} onClick={() => setHoldHours(12)}>12 hours</button><button className={holdHours === 72 ? "chosen" : ""} onClick={() => setHoldHours(72)}>3 days</button></div>{holdHours === 72 && <textarea placeholder="Reason for 3-day hold (required)" value={holdReason} onChange={(event) => setHoldReason(event.target.value)} />}{holdPrompt && <small className="field-error">Enter a reason before a 3-day hold.</small>}<p>ASSIGN STATUS</p><div className="status-actions"><button className="book" onClick={() => changeStatus("booked")}>Book</button><button className="hold" onClick={hold}>Hold {holdHours === 72 ? "3d" : "12h"}</button><button className="release" onClick={() => changeStatus("available")}>Release</button><button className="block" onClick={() => changeStatus("blocked")}>Block</button></div><button className="delete-booth" onClick={deleteBooth}>Delete booth</button></>}</aside>}
    {addOpen && <div className="modal-backdrop"><form className="modal" onSubmit={addBooth}><button type="button" className="close" onClick={() => setAddOpen(false)}>×</button><p>CREATE BOOTH · {hall}</p><h2>Add booth</h2><label>Booth number<input name="booth" placeholder={`${hall.replace("Hall ", "")}.43`} required /></label><div className="form-row"><label>Width (m)<input name="width" type="number" min="1" required /></label><label>Depth (m)<input name="depth" type="number" min="1" required /></label></div><div className="form-row"><label>Type<select name="type"><option>Space only</option><option>Shell scheme</option><option>Custom booth</option></select></label><label>Location<select name="location"><option>Standard</option><option>Corner</option><option>Island</option><option>VIP</option><option>Front Row</option></select></label></div><label>Booth style<select name="style"><option>1 side open</option><option>2 side open</option><option>3 side open</option><option>All 4 sides open</option></select></label><button className="new full" type="submit">Add available booth</button></form></div>}
  </main>;
}
