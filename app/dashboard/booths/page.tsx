"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase";
import {
  ArrowLeft, Building2, CalendarDays, Check, ChevronDown,
  Grip, Loader2, MapPin, Plus, Printer, RefreshCw, Save, Search,
  Settings2, Trash2, Upload, X
} from "lucide-react";
import "./booths.css";

type Exhibition = { id: string; exhibition_name: string; venue_name?: string | null; city?: string | null; start_date?: string | null; end_date?: string | null };
type Hall = { id: string; exhibition_id: string; hall_name: string; hall_number?: string | null; floorplan_image_path?: string | null; width_meters?: number | null; height_meters?: number | null };
type Booth = {
  id: string; exhibition_id: string; hall_id?: string | null; booth_number: string; area_sqm: number; width_meters: number; depth_meters: number;
  booth_type: string; status: string; price: number; currency: string;
  hall?: string | null; zone?: string | null; x_position: number; y_position: number;
  width_percent: number; height_percent: number; rotation_degrees: number; notes?: string | null;
};
type Exhibitor = { id: string; company_name: string; contact_person?: string | null };

const statuses = ["Available", "Reserved", "Booked", "Blocked"];
const statusClass = (status: string) => (status || "Available").toLowerCase().replaceAll(" ", "-");

export default function BoothManagementPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [exhibitionId, setExhibitionId] = useState("");
  const [booths, setBooths] = useState<Booth[]>([]);
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [hallId, setHallId] = useState("");
  const [selected, setSelected] = useState<Booth | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [layoutImage, setLayoutImage] = useState("");
  const [layoutIsPdf, setLayoutIsPdf] = useState(false);
  const [floorplanZoom, setFloorplanZoom] = useState(1);
  const [floorplanOpacity, setFloorplanOpacity] = useState(0.82);
  const [boothPickerOpen, setBoothPickerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize"; edge?: string; pointerX: number; pointerY: number; startX: number; startY: number; width: number; height: number; startWidthMeters: number; startDepthMeters: number } | null>(null);
  const [bookingExhibitor, setBookingExhibitor] = useState("");
  const [bookingMode, setBookingMode] = useState<"hold" | "book">("hold");

  const load = useCallback(async (id?: string, selectedHallId?: string) => {
    setLoading(true); setMessage("");
    try {
      const { data: eventRows, error: eventError } = await supabase
        .from("exhibitions").select("id,exhibition_name,venue_name,city,start_date,end_date")
        .order("start_date", { ascending: true });
      if (eventError) throw eventError;
      const events = (eventRows || []) as Exhibition[];
      setExhibitions(events);
      const activeId = id || exhibitionId || events[0]?.id || "";
      if (!activeId) { setBooths([]); setExhibitionId(""); setLoading(false); return; }
      setExhibitionId(activeId);
      const { data: hallRows, error: hallError } = await supabase.from("exhibition_halls").select("*").eq("exhibition_id", activeId).order("sort_order").order("hall_name");
      if (hallError) throw hallError;
      const hallList = (hallRows || []) as Hall[]; setHalls(hallList);
      const activeHall = selectedHallId === "" ? null : (hallList.find(h => h.id === (selectedHallId || hallId)) || hallList[0] || null);
      setHallId(activeHall?.id || "");
      const [{ data: boothRows, error: boothError }, { data: exhibitorRows, error: exhibitorError }, { data: event }] = await Promise.all([
        (activeHall ? supabase.from("booths").select("*").eq("exhibition_id", activeId).eq("hall_id", activeHall.id) : supabase.from("booths").select("*").eq("exhibition_id", activeId)).order("sort_order").order("booth_number"),
        supabase.from("exhibitors").select("id,company_name,contact_person").eq("exhibition_id", activeId).order("company_name"),
        supabase.from("exhibitions").select("floorplan_image_path").eq("id", activeId).maybeSingle()
      ]);
      if (boothError) throw boothError;
      if (exhibitorError) throw exhibitorError;
      setBooths((boothRows || []) as Booth[]);
      setExhibitors((exhibitorRows || []) as Exhibitor[]);
      setSelected(null);
      const floorplanPath = activeHall?.floorplan_image_path || event?.floorplan_image_path;
      if (floorplanPath) {
        const { data: signed } = await supabase.storage.from("booth-floorplans").createSignedUrl(floorplanPath, 3600);
        setLayoutImage(signed?.signedUrl || "");
        setLayoutIsPdf(floorplanPath.toLowerCase().endsWith(".pdf"));
      } else { setLayoutImage(""); setLayoutIsPdf(false); }
      // Expire timed holds when this exhibition workspace is opened.
      const { data: expired } = await supabase.from("booth_bookings").select("id,booth_id")
        .eq("status", "Reserved").not("hold_expires_at", "is", null).lt("hold_expires_at", new Date().toISOString());
      if (expired?.length) {
        await supabase.from("booth_bookings").update({ status: "Expired" }).in("id", expired.map((b: any) => b.id));
        await supabase.from("booths").update({ status: "Available" }).in("id", expired.map((b: any) => b.booth_id)).eq("status", "Reserved");
        const refreshQuery = supabase.from("booths").select("*").eq("exhibition_id", activeId);
        const { data: refreshed } = await (activeHall ? refreshQuery.eq("hall_id", activeHall.id) : refreshQuery).order("sort_order").order("booth_number");
        if (refreshed) setBooths(refreshed as Booth[]);
      }
    } catch (error: any) {
      setMessage(error?.message || "Could not load booth data. Check your connection and permissions.");
    } finally { setLoading(false); }
  }, [supabase, exhibitionId, hallId]);

  useEffect(() => { load(); }, []); // initial workspace load

  const filtered = booths.filter(b => [b.booth_number, b.hall, b.zone, b.status].join(" ").toLowerCase().includes(query.toLowerCase()));
  const totals = {
    total: booths.length,
    available: booths.filter(b => b.status === "Available").length,
    reserved: booths.filter(b => b.status === "Reserved").length,
    booked: booths.filter(b => b.status === "Booked").length,
    blocked: booths.filter(b => b.status === "Blocked").length,
  };
  const selectedExhibition = exhibitions.find(e => e.id === exhibitionId);

  function startNew() {
    setSelected(null);
    setForm({ booth_number: "", area_sqm: "12", width_meters: "3", depth_meters: "4", booth_type: "Standard", status: "Available", price: "0", currency: "USD", hall_id: hallId, hall: "", zone: "", x_position: 8 + (booths.length % 4) * 19, y_position: 8 + (Math.floor(booths.length / 4) % 4) * 21, width_percent: 16, height_percent: 16, notes: "" });
    setFormOpen(true);
  }
  function editBooth(booth: Booth) {
    setSelected(booth);
    setForm({ ...booth });
    setFormOpen(true);
  }
  async function saveBooth() {
    if (!exhibitionId) { setMessage("Create an exhibition profile first."); return; }
    if (!String(form.booth_number || "").trim()) { setMessage("Enter a booth number."); return; }
    setSaving(true); setMessage("");
    const payload = {
      exhibition_id: exhibitionId, booth_number: String(form.booth_number).trim(),
      area_sqm: Number(form.area_sqm || 0), booth_type: form.booth_type || "Standard",
      status: form.status || "Available", price: Number(form.price || 0), currency: form.currency || "USD",
      hall_id: form.hall_id || hallId || null, hall: halls.find(h => h.id === (form.hall_id || hallId))?.hall_name || form.hall || null, zone: form.zone || null, width_meters: Number(form.width_meters || 3), depth_meters: Number(form.depth_meters || 4), x_position: Number(form.x_position || 0),
      y_position: Number(form.y_position || 0), width_percent: Number(form.width_percent || 16),
      height_percent: Number(form.height_percent || 16), rotation_degrees: Number(form.rotation_degrees || 0),
      notes: form.notes || null, updated_at: new Date().toISOString()
    };
    try {
      const result = selected
        ? await supabase.from("booths").update(payload).eq("id", selected.id).select("*").single()
        : await supabase.from("booths").insert(payload).select("*").single();
      if (result.error) throw result.error;
      setBooths(prev => selected ? prev.map(b => b.id === selected.id ? result.data as Booth : b) : [...prev, result.data as Booth]);
      setSelected(result.data as Booth); setFormOpen(false); setMessage(selected ? "Booth details updated." : "Booth added to this exhibition.");
    } catch (error: any) { setMessage(error?.message || "Could not save booth."); }
    finally { setSaving(false); }
  }

  function onCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((event.clientX - drag.pointerX) / rect.width) * 100;
    const dy = ((event.clientY - drag.pointerY) / rect.height) * 100;
    setBooths(prev => prev.map(b => {
      if (b.id !== drag.id) return b;
      if (drag.mode === "move") return { ...b, x_position: Math.max(0, Math.min(100 - drag.width, drag.startX + dx)), y_position: Math.max(0, Math.min(100 - drag.height, drag.startY + dy)) };
      const edge = drag.edge || ""; let x = drag.startX, y = drag.startY, w = drag.width, h = drag.height;
      if (edge.includes("e")) w = Math.max(3, Math.min(100 - x, drag.width + dx));
      if (edge.includes("s")) h = Math.max(3, Math.min(100 - y, drag.height + dy));
      if (edge.includes("w")) { const nw = Math.max(3, drag.width - dx); x = Math.max(0, drag.startX + drag.width - nw); w = nw; }
      if (edge.includes("n")) { const nh = Math.max(3, drag.height - dy); y = Math.max(0, drag.startY + drag.height - nh); h = nh; }
      const widthMeters = Number(((w / drag.width) * (drag.startWidthMeters || b.width_meters || 3)).toFixed(2));
      const depthMeters = Number(((h / drag.height) * (drag.startDepthMeters || b.depth_meters || 4)).toFixed(2));
      return { ...b, x_position:x, y_position:y, width_percent:w, height_percent:h, width_meters:widthMeters, depth_meters:depthMeters, area_sqm:Number((widthMeters*depthMeters).toFixed(2)) };
    }));
  }
  async function finishDrag() {
    if (!drag) return;
    const booth = booths.find(b => b.id === drag.id);
    setDrag(null);
    if (!booth) return;
    const { error } = await supabase.from("booths").update({ x_position: booth.x_position, y_position: booth.y_position, width_percent: booth.width_percent, height_percent: booth.height_percent, width_meters: booth.width_meters, depth_meters: booth.depth_meters, area_sqm: Number(booth.width_meters || 0) * Number(booth.depth_meters || 0), updated_at: new Date().toISOString() }).eq("id", booth.id);
    if (error) setMessage("Could not save booth position: " + error.message);
  }
  function beginDrag(event: React.PointerEvent<HTMLButtonElement>, booth: Booth) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelected(booth);
    setDrag({ id: booth.id, mode: "move", pointerX: event.clientX, pointerY: event.clientY, startX: booth.x_position || 0, startY: booth.y_position || 0, width: booth.width_percent || 16, height: booth.height_percent || 16, startWidthMeters: booth.width_meters || 3, startDepthMeters: booth.depth_meters || 4 });
  }

  function beginResize(event: React.PointerEvent<HTMLSpanElement>, booth: Booth, edge: string) {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelected(booth);
    setDrag({ id: booth.id, mode: "resize", edge, pointerX: event.clientX, pointerY: event.clientY, startX: booth.x_position || 0, startY: booth.y_position || 0, width: booth.width_percent || 16, height: booth.height_percent || 16, startWidthMeters: booth.width_meters || 3, startDepthMeters: booth.depth_meters || 4 });
  }

  async function uploadFloorplan(file?: File) {
    if (!file || !exhibitionId) return;
    if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) { setMessage("Upload a PNG, JPG, WEBP or PDF floorplan."); return; }
    if (file.size > 15 * 1024 * 1024) { setMessage("Floorplan file must be 15 MB or smaller."); return; }
    setSaving(true);
    try {
      const path = exhibitionId + "/" + (hallId || "project") + "/" + Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { error: uploadError } = await supabase.storage.from("booth-floorplans").upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { error: updateError } = hallId
        ? await supabase.from("exhibition_halls").update({ floorplan_image_path: path, updated_at: new Date().toISOString() }).eq("id", hallId)
        : await supabase.from("exhibitions").update({ floorplan_image_path: path }).eq("id", exhibitionId);
      if (updateError) throw updateError;
      const { data } = await supabase.storage.from("booth-floorplans").createSignedUrl(path, 3600);
      setLayoutImage(data?.signedUrl || ""); setLayoutIsPdf(file.type === "application/pdf"); setMessage("Venue drawing uploaded. Booths can now be positioned over it.");
    } catch (error: any) { setMessage(error?.message || "Floorplan upload failed."); }
    finally { setSaving(false); }
  }

  function printFloorplan(includeBackground: boolean) {
    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) { setMessage("Please allow pop-ups to print or save the floorplan."); return; }
    const boothMarkup = filtered.map(b => {
      const key = statusClass(b.status);
      return '<div class="booth ' + key + '" style="left:' + (b.x_position ?? 8) + '%;top:' + (b.y_position ?? 8) + '%;width:' + (b.width_percent ?? 16) + '%;height:' + (b.height_percent ?? 16) + '%"><b>' + String(b.booth_number).replace(/[&<>"]/g, "") + '</b><small>' + (b.width_meters || 3) + 'm × ' + (b.depth_meters || 4) + 'm</small></div>';
    }).join("");
    const background = includeBackground && layoutImage ? (layoutIsPdf ? '<iframe class="floorplan" src="' + layoutImage + '#toolbar=0&navpanes=0"></iframe>' : '<div class="floorplan" style="background-image:url(&quot;' + layoutImage + '&quot;);opacity:' + floorplanOpacity + ';transform:scale(' + floorplanZoom + ')"></div>') : "";
    win.document.write('<!doctype html><html><head><title>VEGA Booth Floorplan</title><style>@page{size:landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#222}.heading{display:flex;justify-content:space-between;align-items:center;margin:0 0 10px}.heading h1{font-size:18px;margin:0}.heading p{font-size:10px;color:#666;margin:4px 0}.canvas{height:calc(100vh - 70px);min-height:500px;position:relative;overflow:hidden;border:1px solid #bbb;background:#fff;background-size:contain;background-position:center;background-repeat:no-repeat}.floorplan{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background-size:contain;background-position:center;background-repeat:no-repeat;pointer-events:none}.booth{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid;border-radius:5px;background:#fffD;font-size:11px;text-align:center;padding:2px;overflow:hidden}.available{background:#d4ecdd;color:#174f34;border-color:#24734b}.reserved{background:#f3dfb5;color:#6f4707;border-color:#94600d}.booked{background:#f3cfd1;color:#861a20;border-color:#a51e26}.blocked{background:#d9d9dd;color:#414249;border-color:#555760}.booth small{font-size:8px}@media print{.canvas{height:calc(100vh - 70px)}}</style></head><body><div class="heading"><div><h1>VEGA Jewellery Events And Exhibitions — Booth Floorplan</h1><p>' + (selectedExhibition?.exhibition_name || "Exhibition") + (hallId ? " · " + (halls.find(h => h.id === hallId)?.hall_name || "") : "") + '</p></div><p>' + (includeBackground ? "With uploaded floorplan" : "Booths only") + '</p></div><div class="canvas">' + background + boothMarkup + '</div><script>window.onload=()=>setTimeout(()=>window.print(),500)</script></body></html>');
    win.document.close();
  }

  async function createBooking() {
    if (!selected) return;
    if (!bookingExhibitor) { setMessage("Select an exhibitor before creating a booth reservation."); return; }
    setSaving(true); setMessage("");
    try {
      const hold = bookingMode === "hold";
      if (hold && selected.status !== "Available") throw new Error("Only available booths can be placed on hold.");
      if (!hold && selected.status === "Reserved") {
        const { error } = await supabase.from("booth_bookings").update({
          exhibitor_id: bookingExhibitor, status: "Booked", hold_expires_at: null, approved_at: new Date().toISOString()
        }).eq("booth_id", selected.id).eq("status", "Reserved");
        if (error) throw error;
      } else {
        const expiry = hold ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null;
        const { error } = await supabase.from("booth_bookings").insert({
          booth_id: selected.id, exhibitor_id: bookingExhibitor, booking_date: new Date().toISOString().slice(0, 10),
          status: hold ? "Reserved" : "Booked", total_amount: selected.price || 0, currency: selected.currency || "USD",
          hold_expires_at: expiry, approved_at: hold ? null : new Date().toISOString()
        });
        if (error) throw error;
      }
      const { error: boothError } = await supabase.from("booths").update({ status: hold ? "Reserved" : "Booked" }).eq("id", selected.id);
      if (boothError) throw boothError;
      setBookingExhibitor(""); setMessage(hold ? "30-minute booth hold created." : "Booth booking confirmed.");
      await load(exhibitionId);
    } catch (error: any) { setMessage(error?.message || "Could not create booking. This booth may already have an active reservation."); }
    finally { setSaving(false); }
  }

  async function changeStatus(status: string) {
    if (!selected) return;
    setSaving(true);
    if (status === "Available" || status === "Blocked") {
      const { error: bookingError } = await supabase.from("booth_bookings")
        .update({ status: "Cancelled", cancelled_at: new Date().toISOString(), hold_expires_at: null })
        .eq("booth_id", selected.id).in("status", ["Reserved", "Booked", "Pending", "Confirmed"]);
      if (bookingError) { setMessage(bookingError.message); setSaving(false); return; }
    }
    const { error } = await supabase.from("booths").update({ status, updated_at: new Date().toISOString() }).eq("id", selected.id);
    if (error) setMessage(error.message);
    else { setBooths(prev => prev.map(b => b.id === selected.id ? { ...b, status } : b)); setSelected({ ...selected, status }); setMessage("Booth status updated."); }
    setSaving(false);
  }

  async function deleteBooth() {
    if (!selected || !window.confirm("Delete this booth? Existing booking history may prevent deletion.")) return;
    setSaving(true);
    const { error } = await supabase.from("booths").delete().eq("id", selected.id);
    if (error) setMessage(error.message);
    else { setBooths(prev => prev.filter(b => b.id !== selected.id)); setSelected(null); setFormOpen(false); setMessage("Booth deleted."); }
    setSaving(false);
  }

  return <main className="booth-page">
    <header className="booth-topbar">
      <button className="booth-back" onClick={() => router.push("/dashboard")}><ArrowLeft size={17}/> Dashboard</button>
      <div className="booth-brand">VEGA <span>JEWELLERY EVENTS & EXHIBITIONS</span></div>
    </header>
    <section className="booth-heading">
      <div><div className="booth-eyebrow">EVENTS & SALES / VENUE DELIVERY</div><h1>Booth Management</h1><p>Design exhibition layouts, manage booth inventory and control reservations from one workspace.</p></div>
      <button className="booth-primary" onClick={startNew}><Plus size={17}/> Add booth</button>
    </section>
    <section className="booth-toolbar">
      <label className="booth-event-select"><Building2 size={18}/><select value={exhibitionId} onChange={e => load(e.target.value)}><option value="">Select exhibition</option>{exhibitions.map(e => <option key={e.id} value={e.id}>{e.exhibition_name}</option>)}</select><ChevronDown size={15}/></label>
      {exhibitionId && <label className="booth-event-select"><Building2 size={16}/><select value={hallId} onChange={e => load(exhibitionId,e.target.value)}><option value="">Select hall / All halls</option>{halls.map(h=><option key={h.id} value={h.id}>{h.hall_name}</option>)}</select></label>}
      <button className="booth-secondary" onClick={() => location.href="/dashboard/halls"}>Manage halls</button>
      <label className="booth-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search booth, hall or zone"/></label>
      <button className="booth-secondary" onClick={() => load()}><RefreshCw size={15}/> Refresh</button>
      <label className="booth-secondary booth-upload"><Upload size={15}/> Upload venue drawing<input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" onChange={e => uploadFloorplan(e.target.files?.[0])}/></label>
    </section>
    {message && <div className="booth-message" onClick={() => setMessage("")}>{message}<button><X size={14}/></button></div>}
    <section className="booth-metrics">
      {[["Total booths",totals.total,"total"],["Available",totals.available,"available"],["Reserved",totals.reserved,"reserved"],["Booked",totals.booked,"booked"],["Blocked",totals.blocked,"blocked"]].map(([label,value,key]: any) => <article key={key} className={"booth-metric " + key}><span>{label}</span><strong>{value}</strong></article>)}
    </section>
    <div className="booth-workspace">
      <section className="booth-layout-panel">
        <div className="booth-panel-head booth-floorplan-head"><div><h2>Interactive floorplan</h2><p>{selectedExhibition ? [selectedExhibition.venue_name,selectedExhibition.city].filter(Boolean).join(" · ") : "Select an exhibition to view its layout"}</p></div><span className="booth-count">{filtered.length} booths</span><div className="booth-zoom-controls"><span>Drawing</span><button aria-label="Zoom floorplan out" onClick={()=>setFloorplanZoom(z=>Math.max(.5,Number((z-.1).toFixed(1))))}>−</button><span>{Math.round(floorplanZoom*100)}%</span><button aria-label="Zoom floorplan in" onClick={()=>setFloorplanZoom(z=>Math.min(3,Number((z+.1).toFixed(1))))}>+</button><button onClick={()=>setFloorplanZoom(1)}>Fit</button></div></div><div className="booth-floorplan-tools"><label>Drawing opacity <input type="range" min="0" max="1" step="0.05" value={floorplanOpacity} onChange={e=>setFloorplanOpacity(Number(e.target.value))}/><span>{Math.round(floorplanOpacity*100)}%</span></label><div><button className="booth-secondary" onClick={()=>printFloorplan(true)}><Printer size={14}/> Print / Save PDF with drawing</button><button className="booth-secondary" onClick={()=>printFloorplan(false)}><Printer size={14}/> Print / Save PDF booths only</button></div></div>
        <div className="booth-legend">{statuses.map(s => <span key={s}><i className={statusClass(s)}/>{s}</span>)}</div>
        {loading ? <div className="booth-empty"><Loader2 className="spin" size={25}/>Loading exhibition layout…</div> :
          !exhibitionId ? <div className="booth-empty"><Building2 size={30}/><b>No exhibition selected</b><span>Create an exhibition first, then add booths to its floorplan.</span></div> :
          <div ref={canvasRef} className={"booth-canvas " + (!layoutImage ? "no-image" : "")} onPointerMove={onCanvasPointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
            {!layoutImage && <div className="booth-canvas-grid"/>}
            {layoutImage && <div className="booth-floorplan-layer" style={{opacity:floorplanOpacity,transform:"translate(-50%,-50%) scale("+floorplanZoom+")"}}>{layoutIsPdf ? <iframe className="booth-pdf-underlay" src={layoutImage + "#toolbar=0&navpanes=0"} title="Venue floorplan PDF"/> : <div className="booth-floorplan-image" style={{backgroundImage:"url("+JSON.stringify(layoutImage)+")"}}/>}</div>}
            {filtered.map(booth => <button key={booth.id} className={"booth-tile " + statusClass(booth.status) + (selected?.id === booth.id ? " selected" : "")} style={{ left: (booth.x_position ?? 8) + "%", top: (booth.y_position ?? 8) + "%", width: (booth.width_percent ?? 16) + "%", height: (booth.height_percent ?? 16) + "%", transform: "rotate(" + (booth.rotation_degrees || 0) + "deg)" }} onPointerDown={e => beginDrag(e, booth)} onClick={() => setSelected(booth)} title="Drag to reposition; click to inspect">
              <Grip size={12}/><b>{booth.booth_number}</b><span>{booth.width_meters || 3}m × {booth.depth_meters || 4}m</span>{selected?.id===booth.id && ["nw","n","ne","e","se","s","sw","w"].map(edge=><span key={edge} className={"booth-resize-handle "+edge} onPointerDown={e=>beginResize(e,booth,edge)} title="Drag to resize"/>) }
            </button>)}
            {!filtered.length && <div className="booth-canvas-empty"><Building2 size={30}/><b>No booths in this exhibition yet</b><span>Add booths to start designing the floorplan.</span><button className="booth-primary" onClick={startNew}><Plus size={15}/> Add first booth</button></div>}
          </div>}
        <p className="booth-hint">Drag booth tiles to reposition them. Changes save automatically when you release. On a phone, press and drag a booth tile.</p>
      </section>
      <aside className="booth-side-panel">
        {formOpen ? <div className="booth-form">
          <div className="booth-panel-head"><div><h2>{selected ? "Edit booth" : "New booth"}</h2><p>Booth details and floorplan position</p></div><button className="booth-icon-btn" onClick={() => setFormOpen(false)}><X size={17}/></button></div>
          <div className="booth-form-grid">
            <label>Booth number<input value={form.booth_number || ""} onChange={e => setForm({...form,booth_number:e.target.value})} placeholder="e.g. A-01"/></label>
            <label>Booth type<select value={form.booth_type || "Standard"} onChange={e => setForm({...form,booth_type:e.target.value})}><option>Standard</option><option>Corner</option><option>Island</option><option>Shell Scheme</option><option>Raw Space</option><option>Custom</option><option>VIP</option></select></label>
            <label>Area (sqm)<input type="number" min="0" step="0.5" value={form.area_sqm ?? ""} onChange={e => setForm({...form,area_sqm:e.target.value})}/></label>
            <label>Price<input type="number" min="0" step="0.01" value={form.price ?? ""} onChange={e => setForm({...form,price:e.target.value})}/></label>
            <label>Currency<select value={form.currency || "USD"} onChange={e => setForm({...form,currency:e.target.value})}>{["USD","AED","SAR","KWD","BHD","QAR","OMR","EUR","GBP"].map(c=><option key={c}>{c}</option>)}</select></label>
            <label>Status<select value={form.status || "Available"} onChange={e => setForm({...form,status:e.target.value})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
            <label>Hall<select value={form.hall_id || hallId || ""} onChange={e => setForm({...form,hall_id:e.target.value})}><option value="">Unassigned</option>{halls.map(h=><option key={h.id} value={h.id}>{h.hall_name}</option>)}</select></label>
            <label>Zone<input value={form.zone || ""} onChange={e => setForm({...form,zone:e.target.value})} placeholder="Zone A"/></label>
            <label>Width (%)<input type="number" min="3" max="100" value={form.width_percent ?? 16} onChange={e => setForm({...form,width_percent:e.target.value})}/></label>
            <label>Width (metres)<input type="number" min="0.1" step="0.1" value={form.width_meters ?? 3} onChange={e => setForm({...form,width_meters:e.target.value})}/></label>
            <label>Depth (metres)<input type="number" min="0.1" step="0.1" value={form.depth_meters ?? 4} onChange={e => setForm({...form,depth_meters:e.target.value})}/></label>
            <label>Height (%)<input type="number" min="3" max="100" value={form.height_percent ?? 16} onChange={e => setForm({...form,height_percent:e.target.value})}/></label>
            <label className="wide">Notes<textarea rows={3} value={form.notes || ""} onChange={e => setForm({...form,notes:e.target.value})}/></label>
          </div>
          <div className="booth-form-actions"><button className="booth-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button className="booth-primary" disabled={saving} onClick={saveBooth}>{saving?<Loader2 className="spin" size={15}/>:<Save size={15}/>} Save booth</button></div>
          {selected && <button className="booth-delete" onClick={deleteBooth}><Trash2 size={14}/> Delete booth</button>}
        </div> : selected ? <div className="booth-details">
          <div className="booth-panel-head"><div><h2>Booth {selected.booth_number}</h2><p>{selected.hall || "Hall not set"}{selected.zone ? " · " + selected.zone : ""}</p></div><button className="booth-icon-btn" onClick={() => setSelected(null)}><X size={17}/></button></div>
          <div className={"booth-status-pill " + statusClass(selected.status)}>{selected.status}</div>
          <div className="booth-detail-grid"><div><span>Dimensions</span><b>{selected.width_meters || 3}m × {selected.depth_meters || 4}m</b></div><div><span>Area</span><b>{selected.area_sqm} sqm</b></div><div><span>Booth type</span><b>{selected.booth_type}</b></div><div><span>Price</span><b>{selected.price} {selected.currency}</b></div><div><span>Location</span><b>{selected.hall || "—"} / {selected.zone || "—"}</b></div></div>
          <button className="booth-secondary full" onClick={() => editBooth(selected)}><Settings2 size={15}/> Edit booth details</button>
          <div className="booth-divider"/>
          <h3>Reservation & booking</h3>
          <label className="booth-field-label">Exhibitor<select value={bookingExhibitor} onChange={e => setBookingExhibitor(e.target.value)}><option value="">Select exhibitor</option>{exhibitors.map(e=><option key={e.id} value={e.id}>{e.company_name}</option>)}</select></label>
          <div className="booth-booking-mode"><button className={bookingMode==="hold"?"active":""} onClick={()=>setBookingMode("hold")}>30-minute hold</button><button className={bookingMode==="book"?"active":""} onClick={()=>setBookingMode("book")}>Confirm booking</button></div>
          <button className="booth-primary full" disabled={saving || !(selected.status === "Available" || (selected.status === "Reserved" && bookingMode === "book"))} onClick={createBooking}><CalendarDays size={15}/>{bookingMode==="hold"?"Reserve for 30 minutes":"Confirm booth booking"}</button>
          <div className="booth-divider"/>
          <h3>Quick status</h3>
          <div className="booth-status-actions">{statuses.map(s=><button key={s} className={selected.status===s?"active":""} onClick={()=>changeStatus(s)}>{s}</button>)}</div>
        </div> : <div className="booth-empty side"><Settings2 size={27}/><b>Select a booth</b><span>Choose a booth on the floorplan to view its details, change status or create a reservation.</span></div>}
      </aside>
    </div>
    {formOpen && <div className="booth-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="booth-modal-title" onMouseDown={e => { if (e.target === e.currentTarget) setFormOpen(false); }}>
      <section className="booth-modal">
        <div className="booth-panel-head"><div><div className="booth-eyebrow">BOOTH INVENTORY</div><h2 id="booth-modal-title">{selected ? "Edit booth " + selected.booth_number : "Add a new booth"}</h2><p>{selectedExhibition?.exhibition_name || "Select an exhibition"} · Enter booth details below</p></div><button className="booth-icon-btn" onClick={() => setFormOpen(false)} aria-label="Close form"><X size={18}/></button></div>
        {!exhibitionId && <div className="booth-modal-warning">Please select an exhibition before saving a booth.</div>}
        <div className="booth-form-grid">
          <label>Booth number<input autoFocus value={form.booth_number || ""} onChange={e => setForm({...form,booth_number:e.target.value})} placeholder="e.g. A-01"/></label>
          <label>Booth type<select value={form.booth_type || "Standard"} onChange={e => setForm({...form,booth_type:e.target.value})}><option>Standard</option><option>Corner</option><option>Island</option><option>Shell Scheme</option><option>Raw Space</option><option>Custom</option><option>VIP</option></select></label>
          <label>Area (sqm)<input type="number" min="0" step="0.5" value={form.area_sqm ?? ""} onChange={e => setForm({...form,area_sqm:e.target.value})}/></label>
          <label>Price<input type="number" min="0" step="0.01" value={form.price ?? ""} onChange={e => setForm({...form,price:e.target.value})}/></label>
          <label>Currency<select value={form.currency || "USD"} onChange={e => setForm({...form,currency:e.target.value})}>{["USD","AED","SAR","KWD","BHD","QAR","OMR","EUR","GBP"].map(c=><option key={c}>{c}</option>)}</select></label>
          <label>Status<select value={form.status || "Available"} onChange={e => setForm({...form,status:e.target.value})}>{statuses.map(st=><option key={st}>{st}</option>)}</select></label>
          <label>Hall<select value={form.hall_id || hallId || ""} onChange={e => setForm({...form,hall_id:e.target.value})}><option value="">Unassigned</option>{halls.map(h=><option key={h.id} value={h.id}>{h.hall_name}</option>)}</select></label>
          <label>Zone<input value={form.zone || ""} onChange={e => setForm({...form,zone:e.target.value})} placeholder="Zone A"/></label>
          <label>Width (%)<input type="number" min="3" max="100" value={form.width_percent ?? 16} onChange={e => setForm({...form,width_percent:e.target.value})}/></label>
          <label>Width (metres)<input type="number" min="0.1" step="0.1" value={form.width_meters ?? 3} onChange={e => setForm({...form,width_meters:e.target.value})}/></label>
          <label>Depth (metres)<input type="number" min="0.1" step="0.1" value={form.depth_meters ?? 4} onChange={e => setForm({...form,depth_meters:e.target.value})}/></label>
          <label>Height (%)<input type="number" min="3" max="100" value={form.height_percent ?? 16} onChange={e => setForm({...form,height_percent:e.target.value})}/></label>
          <label className="wide">Notes<textarea rows={3} value={form.notes || ""} onChange={e => setForm({...form,notes:e.target.value})}/></label>
        </div>
        <div className="booth-form-actions"><button className="booth-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button className="booth-primary" disabled={saving || !exhibitionId} onClick={saveBooth}>{saving?<Loader2 className="spin" size={15}/>:<Save size={15}/>} Save booth</button></div>
      </section>
    </div>}
    <div className="booth-floating-picker">{boothPickerOpen && <div className="booth-picker-menu"><b>Select a booth</b>{filtered.length ? filtered.map(b=><button key={b.id} onClick={()=>{setSelected(b);setBoothPickerOpen(false);canvasRef.current?.scrollIntoView({behavior:"smooth",block:"center"});}}><span>{b.booth_number}</span><small>{b.status}</small></button>) : <span className="empty">No booths available</span>}</div>}<button className="booth-primary" onClick={()=>setBoothPickerOpen(v=>!v)}><MapPin size={16}/> Select a booth</button></div>
    <footer className="booth-footer"><span>VEGA Jewellery Events And Exhibitions</span><span><Check size={14}/> Booth inventory connected to Supabase</span></footer>
  </main>;
}
