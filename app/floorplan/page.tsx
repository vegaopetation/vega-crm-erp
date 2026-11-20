"use client";

import { useMemo, useState } from "react";

type Status = "available" | "on_hold" | "booked" | "blocked";
type Booth = { id: string; status: Status; width: number; depth: number; exhibitor?: string };

const halls = ["Hall 5", "Hall 6", "Hall 7"];
const names = ["Aurum House", "Blue Diamond", "Noor Jewels", "Goldline"];
const labels: Record<Status, string> = { available: "Available", on_hold: "On hold", booked: "Booked", blocked: "Blocked" };
const colors: Record<Status, string> = { available: "#c7f2d5", on_hold: "#e4a52b", booked: "#d71920", blocked: "#515158" };

function buildBooths(hall: string): Booth[] {
  const number = hall.replace("Hall ", "");
  return Array.from({ length: 42 }, (_, index) => {
    const width = index % 5 === 0 ? 6 : index % 3 === 0 ? 4 : 3;
    const depth = index % 5 === 0 ? 4 : index % 3 === 0 ? 3 : 4;
    const status: Status = index % 11 === 0 ? "blocked" : index % 7 === 0 ? "on_hold" : index % 4 === 0 ? "available" : "booked";
    return { id: `${number}.${index + 1}`, status, width, depth, exhibitor: status === "booked" ? names[index % names.length] : undefined };
  });
}

export default function FloorplanPage() {
  const [hall, setHall] = useState("Hall 5");
  const [inventory, setInventory] = useState<Record<string, Booth[]>>(() => Object.fromEntries(halls.map((name) => [name, buildBooths(name)])));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [client, setClient] = useState(false);
  const booths = inventory[hall];
  const selected = booths.find((booth) => booth.id === selectedId) ?? null;
  const counts = useMemo(() => Object.fromEntries((["available", "on_hold", "booked", "blocked"] as Status[]).map((name) => [name, booths.filter((booth) => booth.status === name).length])) as Record<Status, number>, [booths]);

  function changeStatus(next: Status) {
    if (!selected) return;
    setInventory((current) => ({ ...current, [hall]: current[hall].map((booth) => booth.id === selected.id ? { ...booth, status: next, exhibitor: next === "booked" ? booth.exhibitor ?? "New exhibitor" : undefined } : booth) }));
  }
  function openWhatsApp() {
    if (!selected || selected.status !== "available") return;
    const message = encodeURIComponent(`VEGA booth booking request\nEvent: 25TH KIF GOLD EXPO\nHall: ${hall}\nBooth: ${selected.id}\nDimensions: ${selected.width} × ${selected.depth} m\nArea: ${selected.width * selected.depth} sqm`);
    changeStatus("on_hold");
    window.open(`https://wa.me/971509811011?text=${message}`, "_blank", "noopener,noreferrer");
  }
  function chooseHall(name: string) { setHall(name); setSelectedId(null); }

  return <main className="floor-shell">
    <header className="floor-header"><a href="/">‹ Back to projects</a><div><small>25TH KIF GOLD EXPO · FLOORPLAN MANAGEMENT</small><h1>{hall} — booking map</h1></div><button className="filter-option" onClick={() => { setClient((value) => !value); setSelectedId(null); }}>{client ? "Staff view" : "Client view"}</button><button className="new">Publish changes</button></header>
    <section className="floor-main"><aside className="floor-side"><p>VENUE</p>{halls.map((name) => <button key={name} className={name === hall ? "hall-active" : ""} onClick={() => chooseHall(name)}>{name}<span>›</span></button>)}<hr /><p>INVENTORY</p><div className="legend">{(["available", "on_hold", "booked", "blocked"] as Status[]).map((status) => <span key={status}><i className={status} style={{ backgroundColor: colors[status] }} /> {labels[status]} <b>{counts[status]}</b></span>)}</div></aside>
      <section className="plan"><div className="plan-top"><span>{client ? "Choose an available booth. Booking opens Sales WhatsApp and creates a five-hour hold." : "Select a booth, then Book, Hold, Release or Block it."}</span><b>{counts.booked + counts.on_hold} / {booths.length} allocated</b></div><div className="hall-plan"><div className="entry">MAIN ENTRANCE</div><div className="aisle horizontal" /><div className="aisle vertical" />{booths.map((booth) => <button key={booth.id} style={{ backgroundColor: colors[booth.status], color: booth.status === "available" ? "#12673d" : "#fff" }} disabled={client && booth.status !== "available"} onClick={() => setSelectedId(booth.id)} className={`booth ${booth.status} ${selectedId === booth.id ? "selected" : ""}`}><b>{booth.id}</b><small>{booth.width} × {booth.depth} m · {booth.width * booth.depth} sqm</small></button>)}</div></section></section>
    {selected && <aside className="booth-panel"><button className="close" onClick={() => setSelectedId(null)}>×</button><p>{client ? "BOOTH SELECTION" : "BOOTH DETAILS"}</p><h2>{selected.id}</h2><span className={`badge ${selected.status}`}>{labels[selected.status]}</span><div className="booth-details"><small>EXHIBITOR</small><b>{selected.exhibitor ?? "Unassigned"}</b><small>HALL</small><b>{hall}</b><small>DIMENSIONS</small><b>{selected.width} × {selected.depth} m</b><small>AREA</small><b>{selected.width * selected.depth} sqm</b></div>{client ? <button className="new full" disabled={selected.status !== "available"} onClick={openWhatsApp}>Book — contact Sales</button> : <><p>ASSIGN STATUS</p><div className="status-actions"><button className="book" onClick={() => changeStatus("booked")}>Book</button><button className="hold" onClick={() => changeStatus("on_hold")}>Hold 5h</button><button className="release" onClick={() => changeStatus("available")}>Release</button><button className="block" onClick={() => changeStatus("blocked")}>Block</button></div></>}</aside>}
  </main>;
}
