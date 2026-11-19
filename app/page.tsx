"use client";

import { FormEvent, useMemo, useState } from "react";

type Project = {
  id: number; name: string; code: string; location: string; dates: string; status: "Live" | "Planning" | "At risk";
  exhibitors: number; booths: number; booked: number; progress: number; owner: string; due: string;
};

const starterProjects: Project[] = [
  { id: 1, name: "Kuwait International Jewellery Fair", code: "KIF 2026", location: "Kuwait City, Kuwait", dates: "10–14 Dec 2026", status: "Live", exhibitors: 48, booths: 108, booked: 86, progress: 79, owner: "AZ", due: "Floorplan review · 20 Jan" },
  { id: 2, name: "Jewellery Arabia Bahrain", code: "JAB 2026", location: "Manama, Bahrain", dates: "17–21 Nov 2026", status: "Planning", exhibitors: 42, booths: 86, booked: 67, progress: 63, owner: "MK", due: "Sales launch · 24 Jan" },
  { id: 3, name: "Muscat International Jewellery Exhibition", code: "MIJEX 2026", location: "Muscat, Oman", dates: "04–08 Feb 2026", status: "Live", exhibitors: 38, booths: 72, booked: 60, progress: 83, owner: "RA", due: "Exhibitor approval · 25 Jan" },
  { id: 4, name: "Dubai Gold Week", code: "DGW 2026", location: "Dubai, UAE", dates: "15–19 Apr 2026", status: "At risk", exhibitors: 23, booths: 64, booked: 31, progress: 48, owner: "SA", due: "Budget sign-off · 18 Jan" }
];

const nav = ["Overview", "Exhibition projects", "Exhibitors", "Booth inventory", "Finance", "Reports"];

function mark(status: Project["status"]) { return status === "Live" ? "live" : status === "Planning" ? "planning" : "risk"; }

export default function Home() {
  const [projects, setProjects] = useState(starterProjects);
  const [activeNav, setActiveNav] = useState("Exhibition projects");
  const [filter, setFilter] = useState("All projects");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Project | null>(starterProjects[0]);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("All systems operational");

  const visible = useMemo(() => projects.filter(project => {
    const matched = `${project.name} ${project.code} ${project.location}`.toLowerCase().includes(query.toLowerCase());
    return matched && (filter === "All projects" || project.status === filter);
  }), [projects, filter, query]);
  const stats = useMemo(() => ({
    projects: projects.length,
    exhibitors: projects.reduce((a,p) => a + p.exhibitors, 0),
    booths: projects.reduce((a,p) => a + p.booths, 0),
    booked: projects.reduce((a,p) => a + p.booked, 0)
  }), [projects]);
  const occupancy = Math.round((stats.booked / stats.booths) * 100);

  function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "New Exhibition");
    const code = String(form.get("code") || "VEGA 2026");
    const location = String(form.get("location") || "Dubai, UAE");
    const project: Project = { id: Date.now(), name, code, location, dates: "Dates to be confirmed", status: "Planning", exhibitors: 0, booths: 0, booked: 0, progress: 5, owner: "AZ", due: "Create first milestone" };
    setProjects(current => [project, ...current]); setSelected(project); setAdding(false); setNotice(`${code} created and ready for setup`);
  }

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">V</span><div><strong>VEGA</strong><small>INTERTRADE & EXHIBITIONS</small></div></div>
      <div className="workspace"><span className="pulse"/> VEGA CRM 2.0 <button aria-label="switch workspace">⌄</button></div>
      <nav>{nav.map(item => <button key={item} onClick={() => { setActiveNav(item); if(item === "Booth inventory") window.location.assign("/floorplan"); }} className={activeNav === item ? "active" : ""}><span>{item === "Overview" ? "⌂" : item === "Exhibition projects" ? "◫" : item === "Exhibitors" ? "◎" : item === "Booth inventory" ? "▦" : item === "Finance" ? "◈" : "▥"}</span>{item}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help">? <span>Need help?</span></div><div className="profile"><div className="avatar">AZ</div><div><b>Abdul Zain</b><small>Administrator</small></div><span>⌄</span></div></div>
    </aside>
    <section className="content">
      <header><div className="crumb">Projects <span>/</span> Exhibition portfolio</div><div className="header-actions"><label className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects, cities…" /></label><button className="icon-btn" onClick={() => setNotice("You have 3 open notifications")}>♧<i/></button><button className="new" onClick={() => setAdding(true)}><b>＋</b> New project</button></div></header>
      <div className="status-line"><span className="status-dot"/> {notice}<span>•</span><button onClick={() => setNotice("Last updated just now")}>Refresh data</button></div>
      <section className="hero"><div><p>EXHIBITION OPERATIONS</p><h1>Projects, always<br/><em>in command.</em></h1><span>Plan the details. Move the numbers. Deliver remarkable events.</span></div><div className="hero-grid"><span/><span/><span/><span/></div><div className="hero-orbit"><b>{occupancy}%</b><small>PORTFOLIO<br/>OCCUPANCY</small></div></section>
      <section className="metrics"><Metric label="Active projects" value={String(stats.projects).padStart(2,"0")} note="Across 4 markets"/><Metric label="Exhibitors" value={String(stats.exhibitors)} note="12 added this month"/><Metric label="Booths sold" value={`${stats.booked}/${stats.booths}`} note={`${occupancy}% portfolio occupancy`}/><Metric label="Open milestones" value="07" note="2 need attention" warn/></section>
      <section className="section-heading"><div><p>PHASE 01</p><h2>Exhibition projects</h2><span>One place to see the health and momentum of every event.</span></div><div className="filters">{["All projects","Live","Planning","At risk"].map(item => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "selected" : ""}>{item}</button>)}</div></section><section className="phase-tools"><button onClick={()=>window.location.assign("/floorplan")}><b>▦</b><span>Floorplan manager<small>Halls 5, 6 & 7</small></span><i>→</i></button><button onClick={()=>setNotice("KIF manuals and announcements workspace opened")}><b>▤</b><span>Manuals & announcements<small>3 new documents</small></span><i>→</i></button><div className="currency"><span>USD <small>DEFAULT</small></span><b>1 USD</b><em>= 3.67 AED</em><button onClick={()=>setNotice("Currency rates refreshed")}>↻</button></div></section>
      <section className="project-area"><div className="table-wrap"><table><thead><tr><th>EXHIBITION</th><th>STATUS</th><th>BOOKING HEALTH</th><th>OWNER</th><th>NEXT MILESTONE</th><th/></tr></thead><tbody>{visible.map(project => <tr key={project.id} onClick={() => setSelected(project)}><td><div className="project-cell"><div className="event-tile">{project.code.split(" ")[0].slice(0,3)}</div><div><b>{project.name}</b><small>{project.code} · {project.dates}</small><small className="location">⌖ {project.location}</small></div></div></td><td><span className={`badge ${mark(project.status)}`}>{project.status}</span></td><td><div className="health"><b>{project.booked} <small>/ {project.booths} booths</small></b><div><i style={{width:`${project.progress}%`}}/></div><small>{project.progress}% on target</small></div></td><td><div className="avatar mini">{project.owner}</div></td><td><span className="due">◷ {project.due}</span></td><td><button className="more" aria-label={`open ${project.name}`}>›</button></td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty">No projects match this view.</div>}</div>
        <aside className="side-card"><div className="card-top"><span>THIS WEEK</span><button>•••</button></div><h3>Momentum board</h3><div className="board-stat"><b>04</b><span>events moving<br/>this week</span></div><div className="mini-list"><p><i className="red"/> KIF floorplan approval <b>Tomorrow</b></p><p><i className="gold"/> MIJEX contract review <b>Friday</b></p><p><i className="purple"/> DGW budget decision <b>Jan 18</b></p></div><button className="outline" onClick={() => setNotice("Calendar view is coming in the next Phase 1 update")}>View project calendar <span>→</span></button></aside></section>
    </section>
    {selected && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="drawer" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setSelected(null)}>×</button><p>PROJECT OVERVIEW</p><h2>{selected.name}</h2><div className="drawer-code">{selected.code} <span className={`badge ${mark(selected.status)}`}>{selected.status}</span></div><div className="drawer-progress"><div><span>Delivery progress</span><b>{selected.progress}%</b></div><div><i style={{width:`${selected.progress}%`}}/></div></div><div className="detail-grid"><div><small>LOCATION</small><b>{selected.location}</b></div><div><small>EVENT DATES</small><b>{selected.dates}</b></div><div><small>EXHIBITORS</small><b>{selected.exhibitors}</b></div><div><small>BOOTH OCCUPANCY</small><b>{selected.booked}/{selected.booths}</b></div></div><div className="drawer-next"><small>NEXT MILESTONE</small><b>{selected.due}</b><span>Assigned to {selected.owner}</span></div><button className="full" onClick={() => selected.code.includes("KIF") ? window.location.assign("/floorplan") : setNotice(`${selected.code} workspace opened`)}>Open project workspace →</button></aside></div>}
    {adding && <div className="modal-backdrop"><form className="modal" onSubmit={createProject}><button type="button" className="close" onClick={() => setAdding(false)}>×</button><p>PHASE 01 · EXHIBITIONS</p><h2>Start a new project</h2><label>Exhibition name<input required name="name" placeholder="e.g. Dubai Jewellery Week"/></label><div className="form-row"><label>Project code<input required name="code" placeholder="e.g. DJW 2026"/></label><label>Location<input required name="location" placeholder="City, country"/></label></div><button className="full" type="submit">Create exhibition project →</button></form></div>}
  </main>;
}

function Metric({ label, value, note, warn }: {label:string;value:string;note:string;warn?:boolean}) { return <article className="metric"><span className={warn ? "metric-icon warn" : "metric-icon"}>◌</span><div><small>{label}</small><b>{value}</b><em className={warn ? "attention" : ""}>{warn ? "● " : "↑ "}{note}</em></div></article>; }
