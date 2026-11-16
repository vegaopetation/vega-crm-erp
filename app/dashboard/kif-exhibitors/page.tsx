"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase";
import { ArrowLeft, Download, Search, Upload, RefreshCw, Users, FileSpreadsheet, AlertCircle } from "lucide-react";
import Link from "next/link";

type Exhibitor = {
  id: string; company_name: string; contact_name?: string | null; email?: string | null;
  phone?: string | null; status?: string | null; source_sr_no?: string | null;
  source_status?: string | null; stand_no?: string | null; area_sqm?: number | null;
  stand_type?: string | null; hall?: string | null; source_country?: string | null;
};
const EVENT_NAME = "25th Kuwait International Gold & Jewellery Exhibition (KIF) — 2026";
const columns = ["SR.NO", "Company Name", "Status", "Contact Person", "Contact Details", "E-Mail", "Stand No", "Area (sqm)", "Stand Type", "Country"];
const norm = (s: string) => s.trim().toLowerCase().replace(/[._-]/g, " ").replace(/\s+/g, " ");
function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i=0;i<text.length;i++) { const c=text[i];
    if (c === '"' && quoted && text[i+1] === '"') { cell+='"'; i++; }
    else if (c === '"') quoted=!quoted;
    else if (c === "," && !quoted) { row.push(cell); cell=""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && text[i+1] === "\n") i++; row.push(cell); if(row.some(v=>v.trim())) rows.push(row); row=[]; cell=""; }
    else cell+=c;
  }
  row.push(cell); if(row.some(v=>v.trim())) rows.push(row); return rows;
}
export default function KifExhibitorListPage() {
  const [client] = useState(() => createClient());
  const [eventId,setEventId] = useState("");
  const [events,setEvents] = useState<{id:string;name:string}[]>([]);
  const [items,setItems] = useState<Exhibitor[]>([]);
  const [search,setSearch] = useState("");
  const [country,setCountry] = useState("All countries");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const {data:exs,error:exErr}=await client.from("exhibitions").select("id,name:exhibition_name").order("name");
      if(exErr) throw exErr;
      const list=(exs||[]) as {id:string;name:string}[]; setEvents(list);
      const chosen=list.find(e=>e.name.toLowerCase().includes("kuwait") && e.name.toLowerCase().includes("jewellery")) || list.find(e=>e.name.toLowerCase().includes("kif")) || list[0];
      if(!eventId && chosen) setEventId(chosen.id);
      const id=eventId || chosen?.id; if(!id) {setItems([]);return;}
      const {data,error:rowsErr}=await client.from("exhibitors").select("id,company_name,contact_name:contact_person,email,phone,status,source_sr_no,source_status,stand_no,area_sqm,stand_type,hall,source_country").eq("exhibition_id",id).order("company_name");
      if(rowsErr) throw rowsErr; setItems((data||[]) as Exhibitor[]);
    } catch(e:any) { setError(e?.message || "Unable to load exhibitor list. Check database connection and apply the KIF exhibitor migration."); }
    finally {setBusy(false);}
  },[client,eventId]);
  useEffect(()=>{load();},[load]);
  const countries=useMemo(()=>["All countries",...Array.from(new Set(items.map(x=>x.source_country).filter(Boolean) as string[])).sort()], [items]);
  const filtered=useMemo(()=>items.filter(x=>{
    const q=search.toLowerCase(); const matches=!q || [x.company_name,x.contact_name,x.email,x.phone,x.stand_no,x.source_sr_no,x.source_country].some(v=>String(v||"").toLowerCase().includes(q));
    return matches && (country==="All countries" || x.source_country===country);
  }),[items,search,country]);
  const exportCsv=()=>{const lines=[columns,...filtered.map(x=>[x.source_sr_no,x.company_name,x.source_status||x.status,x.contact_name,x.phone,x.email,x.stand_no,x.area_sqm,x.stand_type,x.source_country])];
    const csv=lines.map(r=>r.map(v=>{const s=String(v??"");return '"' + s.replace(/"/g,'""') + '"';}).join(",")).join("\r\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}); const url=URL.createObjectURL(blob); const a=document.createElement("a");a.href=url;a.download="KIF-2026-Exhibitors.csv";a.click();URL.revokeObjectURL(url);};
  const importCsv=async(file:File)=>{
    setBusy(true);setMessage("");setError("");
    try{
      if(!eventId) throw new Error("Select the KIF 2026 exhibition first.");
      const parsed=parseCsv(await file.text()); if(parsed.length<2) throw new Error("The file has no data rows.");
      const headerRow=parsed.findIndex(r=>r.some(v=>norm(v).includes("company name"))); if(headerRow<0) throw new Error("Could not find the Company Name header. Export the Excel sheet as CSV and try again.");
      const headers=parsed[headerRow].map(norm);
      const get=(r:string[],...names:string[])=>{const i=headers.findIndex(h=>names.some(n=>h===norm(n)));return i>=0?(r[i]||"").trim():"";};
      const records=parsed.slice(headerRow+1).map((r,i)=>{
        const company=get(r,"Company Name"); if(!company)return null;
        const sr=get(r,"SR.NO","SR NO","SR. NO"); const area=get(r,"Area (sqm)","Area sqm","Area"); const phone=get(r,"Contact Details","Contact Detail","Phone");
        return {exhibition_id:eventId,company_name:company,contact_name:get(r,"Contact Person")||null,email:get(r,"E-Mail","Email","E Mail")||null,phone:phone||null,status:"confirmed",source_sr_no:sr||null,source_status:get(r,"Status")||null,stand_no:get(r,"Stand No","Stand Number")||null,area_sqm:area?Number(area.replace(/[^0-9.]/g,""))||null:null,stand_type:get(r,"Stand Type")||null,source_country:get(r,"Country","COUN TRY","COUNTRY")||null,source_row_number:headerRow+i+2};
      }).filter(Boolean) as any[];
      if(!records.length) throw new Error("No company rows were found in the file.");
      const {error:insertErr}=await client.from("exhibitors").insert(records);
      if(insertErr) throw insertErr;
      setMessage(`Imported ${records.length} exhibitor rows for KIF 2026.`); await load();
    }catch(e:any){setError(e?.message||"Import failed.");}finally{setBusy(false);if(fileRef.current)fileRef.current.value="";}
  };
  return <main className="min-h-screen bg-[#f7f7f8] p-4 md:p-8 text-[#191919]">
    <div className="mx-auto max-w-[1500px]">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#b5121b]"><ArrowLeft size={16}/> Back to VEGA Dashboard</Link>
      <header className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold tracking-[.18em] text-[#b5121b]">VEGA INTERTRADE & EXHIBITIONS</p><h1 className="mt-1 text-3xl font-bold">Exhibitor List</h1><p className="mt-1 text-gray-500">{EVENT_NAME}</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#b5121b] px-4 py-2.5 font-semibold text-white hover:bg-[#950e16] disabled:opacity-50"><Upload size={17}/> Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e=>e.target.files?.[0]&&importCsv(e.target.files[0])}/>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-semibold"><Download size={17}/> Export CSV</button>
          <button onClick={load} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5"><RefreshCw size={17}/></button>
        </div>
      </header>
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(250px,1fr)_240px_auto]">
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3"><Search size={17} className="text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, contact, stand, country…" className="w-full py-2 outline-none"/></label>
          <select value={country} onChange={e=>setCountry(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2">{countries.map(c=><option key={c}>{c}</option>)}</select>
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 text-sm"><Users size={17}/><b>{filtered.length}</b><span className="text-gray-500">records</span></div>
        </div>
        {message&&<p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
        {error&&<p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{error}</p>}
      </div>
      <section className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 text-sm font-semibold"><FileSpreadsheet size={17} className="text-[#b5121b]"/> KIF 2026 exhibitor database {busy&&<span className="ml-auto text-gray-400">Loading…</span>}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-[#f8f8f8] text-xs uppercase tracking-wide text-gray-500"><tr>{columns.map(c=><th key={c} className="px-4 py-3 font-semibold">{c}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">
          {filtered.map((x,i)=><tr key={x.id} className="hover:bg-red-50/30"><td className="px-4 py-3 text-gray-500">{x.source_sr_no||i+1}</td><td className="px-4 py-3 font-semibold">{x.company_name}</td><td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{x.source_status||x.status||"—"}</span></td><td className="px-4 py-3">{x.contact_name||"—"}</td><td className="px-4 py-3">{x.phone||"—"}</td><td className="px-4 py-3">{x.email||"—"}</td><td className="px-4 py-3">{x.stand_no||"—"}</td><td className="px-4 py-3">{x.area_sqm??"—"}</td><td className="px-4 py-3">{x.stand_type||"—"}</td><td className="px-4 py-3">{x.source_country||"—"}</td></tr>)}
          {!busy&&!filtered.length&&<tr><td colSpan={10} className="px-4 py-16 text-center text-gray-500"><Users size={30} className="mx-auto mb-2 text-gray-300"/><p className="font-semibold text-gray-700">No exhibitors found</p><p className="mt-1 text-xs">Import a CSV export of the KIF Excel list, or adjust your search.</p></td></tr>}
        </tbody></table></div>
      </section>
      <p className="mt-3 text-xs text-gray-500">Excel import note: open the source workbook and Save As CSV first. Imported records are event-specific and traceable by source row number.</p>
    </div>
  </main>;
}
