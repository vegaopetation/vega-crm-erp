"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase";
import { ArrowLeft, Download, Search, Upload, RefreshCw, Users, FileSpreadsheet, AlertCircle, Trash2, Pencil, Plus } from "lucide-react";
import Link from "next/link";

type Exhibitor = {
  id: string; company_name: string; contact_name?: string | null; email?: string | null;
  phone?: string | null; status?: string | null; source_sr_no?: string | null;
  source_status?: string | null; stand_no?: string | null; area_sqm?: number | null;
  stand_type?: string | null; hall?: string | null; source_country?: string | null;
};
const EVENT_NAME = "25th Kuwait International Gold & Jewellery Exhibition (KIF) — 2026";
const columns = ["Serial Number", "Company Name", "Status", "Contact Person", "Contact Details", "E-Mail", "Stand No", "Area (sqm)", "Stand Type", "Country", "Hall"];
const norm = (s: string) => s.trim().toLowerCase().replace(/[._-]/g, " ").replace(/\s+/g, " ");
const duplicateKey = (company: string, stand: string) => `${norm(company)}::${norm(stand || "")}`;
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
  const [selectedIds,setSelectedIds] = useState<string[]>([]);
  const [search,setSearch] = useState("");
  const [filters,setFilters] = useState({country:"All countries",status:"All statuses",hall:"All halls",standType:"All stand types"});
  const [sort,setSort] = useState<{key:keyof Exhibitor|"serial";direction:"asc"|"desc"}>({key:"serial",direction:"asc"});
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [editor,setEditor] = useState<Exhibitor|null|false>(false);
  const [draft,setDraft] = useState({company_name:"",contact_name:"",email:"",phone:"",source_status:"",source_sr_no:"",stand_no:"",area_sqm:"",stand_type:"",source_country:"",hall:""});
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const {data:exs,error:exErr}=await client.from("exhibitions").select("id,name:exhibition_name").order("exhibition_name");
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
  const optionsFor=(values:(string|null|undefined)[],allLabel:string)=>[allLabel,...Array.from(new Set(values.filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b))];
  const countries=useMemo(()=>optionsFor(items.map(x=>x.source_country),"All countries"),[items]);
  const statuses=useMemo(()=>optionsFor(items.map(x=>x.source_status||x.status),"All statuses"),[items]);
  const halls=useMemo(()=>optionsFor(items.map(x=>x.hall),"All halls"),[items]);
  const standTypes=useMemo(()=>optionsFor(items.map(x=>x.stand_type),"All stand types"),[items]);
  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    const result=items.filter(x=>{
      const matches=!q || [x.company_name,x.contact_name,x.email,x.phone,x.stand_no,x.source_sr_no,x.source_country,x.hall,x.stand_type,x.source_status,x.status].some(v=>String(v||"").toLowerCase().includes(q));
      return matches && (filters.country==="All countries"||x.source_country===filters.country)
        && (filters.status==="All statuses"||(x.source_status||x.status)===filters.status)
        && (filters.hall==="All halls"||x.hall===filters.hall)
        && (filters.standType==="All stand types"||x.stand_type===filters.standType);
    });
    const value=(x:Exhibitor,key:keyof Exhibitor|"serial")=>key==="serial"?(Number(x.source_sr_no)||0):(x[key]??"");
    result.sort((a,b)=>{const av=value(a,sort.key),bv=value(b,sort.key);const cmp=typeof av==="number"&&typeof bv==="number"?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:"base"});return sort.direction==="asc"?cmp:-cmp;});
    return result;
  },[items,search,filters,sort]);
  const toggleSort=(key:keyof Exhibitor|"serial")=>setSort(s=>({key,direction:s.key===key&&s.direction==="asc"?"desc":"asc"}));
  const resetFilters=()=>{setSearch("");setFilters({country:"All countries",status:"All statuses",hall:"All halls",standType:"All stand types"});};
  const visibleIds=filtered.map(x=>x.id);
  const allVisibleSelected=visibleIds.length>0&&visibleIds.every(id=>selectedIds.includes(id));
  const toggleOne=(id:string)=>setSelectedIds(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
  const toggleVisible=()=>setSelectedIds(current=>allVisibleSelected?current.filter(id=>!visibleIds.includes(id)):Array.from(new Set([...current,...visibleIds])));
  const exportCsv=()=>{const lines=[columns,...filtered.map(x=>[x.source_sr_no,x.company_name,x.source_status||x.status,x.contact_name,x.phone,x.email,x.stand_no,x.area_sqm,x.stand_type,x.source_country,x.hall])];
    const csv=lines.map(r=>r.map(v=>{const s=String(v??"");return '"' + s.replace(/"/g,'""') + '"';}).join(",")).join("\r\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}); const url=URL.createObjectURL(blob); const a=document.createElement("a");a.href=url;a.download="KIF-2026-Exhibitors.csv";a.click();URL.revokeObjectURL(url);};
  const openAdd=()=>{setDraft({company_name:"",contact_name:"",email:"",phone:"",source_status:"",source_sr_no:"",stand_no:"",area_sqm:"",stand_type:"",source_country:"",hall:""});setEditor(null);setError("");};
  const openEdit=(item:Exhibitor)=>{setDraft({company_name:item.company_name||"",contact_name:item.contact_name||"",email:item.email||"",phone:item.phone||"",source_status:item.source_status||"",source_sr_no:item.source_sr_no||"",stand_no:item.stand_no||"",area_sqm:item.area_sqm==null?"":String(item.area_sqm),stand_type:item.stand_type||"",source_country:item.source_country||"",hall:item.hall||""});setEditor(item);setError("");};
  const saveExhibitor=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault(); if(!eventId)return;
    if(!draft.company_name.trim()){setError("Company name is required.");return;}
    const {data:matches,error:checkError}=await client.from("exhibitors").select("id,company_name,stand_no").eq("exhibition_id",eventId);
    if(checkError){setError(checkError.message);return;}
    const key=duplicateKey(draft.company_name,draft.stand_no);
    const duplicate=(matches||[]).find((x:any)=>x.id!==(editor !== false && editor !== null ? editor.id : "") && duplicateKey(x.company_name||"",x.stand_no||"")===key);
    if(duplicate){setError(`Duplicate blocked: ${draft.company_name} already exists for stand ${draft.stand_no||"(blank)"}.`);return;}
    setBusy(true);setError("");setMessage("");
    const payload={company_name:draft.company_name.trim(),contact_person:draft.contact_name.trim()||null,email:draft.email.trim()||null,phone:draft.phone.trim()||null,source_status:draft.source_status.trim()||null,source_sr_no:draft.source_sr_no.trim()||null,stand_no:draft.stand_no.trim()||null,area_sqm:draft.area_sqm.trim()?Number(draft.area_sqm):null,stand_type:draft.stand_type.trim()||null,source_country:draft.source_country.trim()||null,hall:draft.hall.trim()||null};
    try{
      const result=editor?await client.from("exhibitors").update(payload).eq("id",editor.id):await client.from("exhibitors").insert({...payload,exhibition_id:eventId,status:"confirmed"});
      if(result.error)throw result.error;
      setEditor(false);setMessage(editor?"Exhibitor updated successfully.":"Exhibitor added successfully.");await load();
    }catch(err:any){setError(err?.message||"Unable to save exhibitor.");}finally{setBusy(false);}
  };
  const deleteRow=async(item:Exhibitor)=>{
    if(!window.confirm(`Delete ${item.company_name} from the KIF 2026 exhibitor list? This cannot be undone.`)) return;
    setBusy(true);setMessage("");setError("");
    try{const {error:deleteErr}=await client.from("exhibitors").delete().eq("id",item.id);if(deleteErr)throw deleteErr;setMessage(`Deleted ${item.company_name}.`);await load();}
    catch(e:any){setError(e?.message||"Unable to delete this exhibitor.");}finally{setBusy(false);}
  };
  const deleteSelected=async()=>{
    if(!selectedIds.length)return;
    if(!window.confirm("Permanently delete "+selectedIds.length+" selected exhibitor row(s) from KIF 2026? This cannot be undone."))return;
    setBusy(true);setMessage("");setError("");
    try{const {error:deleteErr}=await client.from("exhibitors").delete().in("id",selectedIds).eq("exhibition_id",eventId);if(deleteErr)throw deleteErr;const count=selectedIds.length;setSelectedIds([]);setMessage("Deleted "+count+" selected exhibitor row(s).");await load();}
    catch(e:any){setError(e?.message||"Unable to delete selected exhibitors.");}finally{setBusy(false);}
  };
  const deleteAll=async()=>{
    if(!eventId) return;
    if(!window.confirm(`DELETE ALL ${items.length} exhibitors from KIF 2026? This only affects this exhibition and cannot be undone. Continue?`)) return;
    if(!window.confirm("Final confirmation: permanently delete every exhibitor record linked to KIF 2026?")) return;
    setBusy(true);setMessage("");setError("");
    try{const {error:deleteErr}=await client.from("exhibitors").delete().eq("exhibition_id",eventId);if(deleteErr)throw deleteErr;setMessage("All KIF 2026 exhibitor records have been deleted.");await load();}
    catch(e:any){setError(e?.message||"Unable to delete the KIF exhibitor list.");}finally{setBusy(false);}
  };
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
        return {exhibition_id:eventId,company_name:company,contact_person:get(r,"Contact Person")||null,email:get(r,"E-Mail","Email","E Mail")||null,phone:phone||null,status:"confirmed",source_sr_no:sr||null,source_status:get(r,"Status")||null,stand_no:get(r,"Stand No","Stand Number")||null,area_sqm:area?Number(area.replace(/[^0-9.]/g,""))||null:null,stand_type:get(r,"Stand Type")||null,source_country:get(r,"Country","COUN TRY","COUNTRY")||null,source_row_number:headerRow+i+2};
      }).filter(Boolean) as any[];
      if(!records.length) throw new Error("No company rows were found in the file.");
      const {data:existing,error:existingErr}=await client.from("exhibitors").select("company_name,stand_no").eq("exhibition_id",eventId);
      if(existingErr) throw existingErr;
      const seen=new Set((existing||[]).map((x:any)=>duplicateKey(x.company_name||"",x.stand_no||"")));
      const unique:any[]=[]; let skipped=0;
      for(const record of records){const key=duplicateKey(record.company_name,record.stand_no||"");if(seen.has(key)){skipped++;continue;}seen.add(key);unique.push(record);}
      if(!unique.length){setMessage(`No new exhibitors imported. ${skipped} duplicate row(s) were skipped.`);return;}
      const {error:insertErr}=await client.from("exhibitors").insert(unique);
      if(insertErr) throw insertErr;
      setMessage(`Imported ${unique.length} new exhibitor(s). Skipped ${skipped} duplicate row(s).`); await load();
    }catch(e:any){setError(e?.message||"Import failed.");}finally{setBusy(false);if(fileRef.current)fileRef.current.value="";}
  };
  return <main className="min-h-screen bg-[var(--vega-main-bg)] p-4 md:p-8 text-[var(--ink)]">
    <div className="mx-auto max-w-[1500px]">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#b5121b]"><ArrowLeft size={16}/> Back to VEGA Dashboard</Link>
      <header className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold tracking-[.18em] text-[#b5121b]">VEGA INTERTRADE & EXHIBITIONS</p><h1 className="mt-1 text-3xl font-bold">Exhibitor List</h1><p className="mt-1 text-gray-500">{EVENT_NAME}</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openAdd} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-semibold"><Plus size={17}/> Add Exhibitor</button>
          <button onClick={()=>fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#b5121b] px-4 py-2.5 font-semibold text-white hover:bg-[#950e16] disabled:opacity-50"><Upload size={17}/> Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e=>e.target.files?.[0]&&importCsv(e.target.files[0])}/>
          <button onClick={deleteSelected} disabled={busy||selectedIds.length===0} className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"><Trash2 size={17}/> Delete Selected ({selectedIds.length})</button>
          <button onClick={deleteAll} disabled={busy||items.length===0} className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"><Trash2 size={17}/> Delete All</button>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-semibold"><Download size={17}/> Export CSV</button>
          <button onClick={load} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5"><RefreshCw size={17}/></button>
        </div>
      </header>
      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--vega-surface)] p-4 shadow-[var(--vega-shadow)]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3"><Search size={17} className="text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search all exhibitor details…" className="w-full py-2 outline-none"/></label>
          <select aria-label="Filter by country" value={filters.country} onChange={e=>setFilters(f=>({...f,country:e.target.value}))} className="rounded-lg border border-gray-200 px-3 py-2">{countries.map(c=><option key={c}>{c}</option>)}</select>
          <select aria-label="Filter by status" value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))} className="rounded-lg border border-gray-200 px-3 py-2">{statuses.map(c=><option key={c}>{c}</option>)}</select>
          <select aria-label="Filter by hall" value={filters.hall} onChange={e=>setFilters(f=>({...f,hall:e.target.value}))} className="rounded-lg border border-gray-200 px-3 py-2">{halls.map(c=><option key={c}>{c}</option>)}</select>
          <select aria-label="Filter by stand type" value={filters.standType} onChange={e=>setFilters(f=>({...f,standType:e.target.value}))} className="rounded-lg border border-gray-200 px-3 py-2">{standTypes.map(c=><option key={c}>{c}</option>)}</select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"><Users size={17}/><b>{filtered.length}</b><span className="text-gray-500">of {items.length} records</span></div><button onClick={resetFilters} className="text-[#b5121b] font-semibold hover:underline">Clear filters</button><span className="text-gray-400">Click any column heading to sort ascending or descending.</span></div>
        {message&&<p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
        {error&&<p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{error}</p>}
      </div>
      <section className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--vega-surface)] shadow-[var(--vega-shadow)]">
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3 text-sm font-semibold"><FileSpreadsheet size={17} className="text-[#b5121b]"/> KIF 2026 exhibitor database {busy&&<span className="ml-auto text-gray-400">Loading…</span>}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1160px] text-left text-sm"><thead className="bg-[var(--vega-main-bg)] text-xs uppercase tracking-wide text-[var(--muted)]"><tr><th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Select all visible rows" checked={allVisibleSelected} onChange={toggleVisible} disabled={!visibleIds.length||busy}/></th>{columns.map((c,i)=><th key={c} className="px-4 py-3 font-semibold whitespace-nowrap"><button type="button" onClick={()=>toggleSort((["serial","company_name","source_status","contact_name","phone","email","stand_no","area_sqm","stand_type","source_country","hall"] as const)[i])} className="inline-flex items-center gap-1 hover:text-[#b5121b]">{c}<span className="text-[#b5121b]">{sort.key===(["serial","company_name","source_status","contact_name","phone","email","stand_no","area_sqm","stand_type","source_country","hall"] as const)[i]?(sort.direction==="asc"?"↑":"↓"):"↕"}</span></button></th>)}<th className="px-4 py-3 font-semibold">Action</th></tr></thead><tbody className="divide-y divide-gray-100">
          {filtered.map((x,i)=><tr key={x.id} className={selectedIds.includes(x.id)?"bg-red-50/70 hover:bg-red-50":"hover:bg-red-50/30"}><td className="px-3 py-3"><input type="checkbox" aria-label={"Select "+x.company_name} checked={selectedIds.includes(x.id)} onChange={()=>toggleOne(x.id)} disabled={busy}/></td><td className="px-4 py-3 text-gray-500">{x.source_sr_no||i+1}</td><td className="px-4 py-3 font-semibold">{x.company_name}</td><td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{x.source_status||x.status||"—"}</span></td><td className="px-4 py-3">{x.contact_name||"—"}</td><td className="px-4 py-3">{x.phone||"—"}</td><td className="px-4 py-3">{x.email||"—"}</td><td className="px-4 py-3">{x.stand_no||"—"}</td><td className="px-4 py-3">{x.area_sqm??"—"}</td><td className="px-4 py-3">{x.stand_type||"—"}</td><td className="px-4 py-3">{x.source_country||"—"}</td><td className="px-4 py-3">{x.hall||"—"}</td><td className="px-4 py-3"><button onClick={()=>openEdit(x)} disabled={busy} title="Edit this exhibitor" className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"><Pencil size={14}/> Edit</button> <button onClick={()=>deleteRow(x)} disabled={busy} title="Delete this exhibitor" aria-label={`Delete ${x.company_name}`} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"><Trash2 size={14}/> Delete</button></td></tr>)}
          {!busy&&!filtered.length&&<tr><td colSpan={13} className="px-4 py-16 text-center text-gray-500"><Users size={30} className="mx-auto mb-2 text-gray-300"/><p className="font-semibold text-gray-700">No exhibitors found</p><p className="mt-1 text-xs">Import a CSV export of the KIF Excel list, or adjust your search.</p></td></tr>}
        </tbody></table></div>
      </section>
      {editor!==false&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={saveExhibitor} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-[var(--vega-surface)] p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{editor?"Edit Exhibitor":"Add Exhibitor"}</h2><button type="button" onClick={()=>setEditor(false)} className="rounded-md px-3 py-1 text-gray-500 hover:bg-gray-100">Close</button></div><div className="grid gap-4 sm:grid-cols-2">{([{key:"company_name",label:"Company Name",required:true},{key:"contact_name",label:"Contact Person"},{key:"phone",label:"Contact Details / Phone"},{key:"email",label:"Email"},{key:"source_sr_no",label:"Serial Number"},{key:"source_status",label:"Source Status"},{key:"stand_no",label:"Stand No."},{key:"area_sqm",label:"Area (sqm)",type:"number"},{key:"stand_type",label:"Stand Type"},{key:"source_country",label:"Country"},{key:"hall",label:"Hall"}] as const).map(field=><label key={field.key} className="block text-sm font-medium text-gray-700">{field.label}<input required={"required" in field?field.required:false} type={"type" in field?field.type:"text"} min={"type" in field&&field.type==="number"?0:undefined} step={"type" in field&&field.type==="number"?"any":undefined} value={draft[field.key]} onChange={e=>setDraft(d=>({...d,[field.key]:e.target.value}))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#b5121b]"/></label>)}</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={()=>setEditor(false)} className="rounded-lg border px-4 py-2">Cancel</button><button type="submit" disabled={busy} className="rounded-lg bg-[var(--vega-primary)] px-5 py-2 font-semibold text-white shadow-md disabled:opacity-50">{busy?"Saving…":"Save Exhibitor"}</button></div></form></div>}
      <p className="mt-3 text-xs text-gray-500">Excel import note: open the source workbook and Save As CSV first. Imported records are event-specific and traceable by source row number.</p>
    </div>
  </main>;
}
