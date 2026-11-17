"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase";
import { ArrowLeft, Plus, Search, CalendarDays, MapPin, Globe, Instagram, Facebook, Linkedin, Youtube, Pencil, ExternalLink, Upload, X, Clock3, Building2, Save, Loader2 } from "lucide-react";

type Exhibition = {
  id:string; exhibition_name:string; venue_name:string|null; city:string|null; country:string|null;
  start_date:string|null; end_date:string|null; status:string|null; total_area_sqm:number|null; description:string|null;
  opening_time:string|null; closing_time:string|null; timezone:string; daily_hours:any;
  setup_start_date:string|null; setup_end_date:string|null; dismantle_start_date:string|null; dismantle_end_date:string|null;
  venue_address:string|null; google_maps_url:string|null; organizer_name:string|null; organizer_logo_path:string|null;
  organizer_website:string|null; organizer_contact_person:string|null; organizer_email:string|null; organizer_phone:string|null;
  official_website:string|null; registration_url:string|null; visitor_info_url:string|null;
  instagram_url:string|null; facebook_url:string|null; linkedin_url:string|null; youtube_url:string|null; tiktok_url:string|null;
  other_social_links:any; exhibition_logo_path:string|null; banner_path:string|null;
};
const empty:Partial<Exhibition> = { exhibition_name:"",venue_name:"",city:"",country:"",start_date:"",end_date:"",status:"Planning",total_area_sqm:0,description:"",opening_time:"",closing_time:"",timezone:"Asia/Dubai",daily_hours:{},setup_start_date:"",setup_end_date:"",dismantle_start_date:"",dismantle_end_date:"",venue_address:"",google_maps_url:"",organizer_name:"",organizer_logo_path:"",organizer_website:"",organizer_contact_person:"",organizer_email:"",organizer_phone:"",official_website:"",registration_url:"",visitor_info_url:"",instagram_url:"",facebook_url:"",linkedin_url:"",youtube_url:"",tiktok_url:"",other_social_links:[],exhibition_logo_path:"",banner_path:""};
const inputClass="w-full min-w-0 rounded-lg border border-white/10 bg-[#101013] px-3 py-2.5 text-sm text-white placeholder:text-[#81777b] outline-none transition focus:border-[#ed1c2e] focus:ring-2 focus:ring-red-500/20";
function Field({label,children}:{label:string;children:any}){return <label className="grid min-w-0 gap-1.5 text-sm font-medium text-[#d8cdd0]">{label}{children}</label>}
function Section({title,children}:{title:string;children:any}){return <section className="min-w-0 rounded-xl border border-white/10 bg-gradient-to-br from-[#21191c] to-[#141316] p-5 shadow-[0_12px_30px_rgba(0,0,0,.24)]"><h3 className="mb-4 border-b border-white/10 pb-3 text-base font-bold text-white">{title}</h3>{children}</section>}
function statusTone(s:string|null){const v=(s||"").toLowerCase();return v.includes("live")||v==="active"?"bg-green-100 text-green-700":v.includes("complete")?"bg-gray-100 text-[#d8cdd0]":v.includes("cancel")?"bg-red-100 text-red-700":"bg-amber-100 text-amber-800";}
export default function ExhibitionsPage(){
 const [rows,setRows]=useState<Exhibition[]>([]); const [counts,setCounts]=useState<Record<string,{exhibitors:number;booths:number;booked:number}>>({});
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [notice,setNotice]=useState(""); const [search,setSearch]=useState("");
 const [editing,setEditing]=useState<Partial<Exhibition>|null>(null); const [tab,setTab]=useState("overview"); const [logoFile,setLogoFile]=useState<File|null>(null); const [bannerFile,setBannerFile]=useState<File|null>(null);
 const client=useMemo(()=>createClient(),[]);
 const load=useCallback(async()=>{setLoading(true);setNotice("");try{
   const {data,error}=await client.from("exhibitions").select("*").order("start_date",{ascending:true,nullsFirst:false});
   if(error)throw error; const list=(data||[]) as Exhibition[];setRows(list);
   const next:Record<string,{exhibitors:number;booths:number;booked:number}>={};
   await Promise.all(list.map(async e=>{const [ex,bo]=await Promise.all([
    client.from("exhibitors").select("id",{count:"exact",head:true}).eq("exhibition_id",e.id),
    client.from("booths").select("id,status",{count:"exact"}).eq("exhibition_id",e.id)
   ]);const boothRows=bo.data||[];next[e.id]={exhibitors:ex.count||0,booths:bo.count||0,booked:boothRows.filter((b:any)=>["booked","confirmed","reserved"].includes(String(b.status||"").toLowerCase())).length};}));
   setCounts(next);
 }catch(e:any){setNotice(e?.message||"Could not load exhibitions.");}finally{setLoading(false);}},[client]);
 useEffect(()=>{load();},[load]);
 const filtered=rows.filter(e=>(e.exhibition_name+" "+(e.city||"")+" "+(e.country||"")+" "+(e.organizer_name||"")).toLowerCase().includes(search.toLowerCase()));
 function startNew(){setEditing({...empty});setTab("overview");setLogoFile(null);setBannerFile(null);}
 function startEdit(e:Exhibition){setEditing({...e});setTab("overview");setLogoFile(null);setBannerFile(null);}
 function patch(k:keyof Exhibition,v:any){setEditing(p=>({...p,[k]:v}));}
 async function uploadAsset(file:File,kind:"organizer"|"banner",id:string){const ext=file.name.split(".").pop()||"png";const path=id+"/"+kind+"-"+Date.now()+"."+ext;const {error}=await client.storage.from("exhibition-assets").upload(path,file,{upsert:true,contentType:file.type});if(error)throw error;const {data}=client.storage.from("exhibition-assets").getPublicUrl(path);return data.publicUrl;}
 async function save(){if(!editing?.exhibition_name?.trim()){setNotice("Exhibition name is required.");setTab("overview");return;}if(editing.start_date&&editing.end_date&&editing.end_date<editing.start_date){setNotice("End date cannot be earlier than start date.");setTab("overview");return;}
 setSaving(true);setNotice("");try{
  const payload:any={...editing,exhibition_name:editing.exhibition_name.trim(),total_area_sqm:Number(editing.total_area_sqm||0),other_social_links:Array.isArray(editing.other_social_links)?editing.other_social_links:[]};
  delete payload.id;delete payload.created_at;delete payload.updated_at;
  let id=editing.id;
  if(id){const {error}=await client.from("exhibitions").update(payload).eq("id",id);if(error)throw error;}
  else {const {data,error}=await client.from("exhibitions").insert(payload).select("id").single();if(error)throw error;id=data.id;}
  if(logoFile){const url=await uploadAsset(logoFile,"organizer",id!);const {error}=await client.from("exhibitions").update({organizer_logo_path:url}).eq("id",id);if(error)throw error;}
  if(bannerFile){const url=await uploadAsset(bannerFile,"banner",id!);const {error}=await client.from("exhibitions").update({banner_path:url}).eq("id",id);if(error)throw error;}
  setEditing(null);setNotice("Exhibition saved successfully.");await load();
 }catch(e:any){setNotice(e?.message||"Could not save exhibition.");}finally{setSaving(false);}}
 const fmt=(d:string|null)=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"Dates to be confirmed";
 const pct=(id:string)=>{const c=counts[id];return c&&c.booths?Math.round(c.booked/c.booths*100):0;};
 return <main className="min-h-screen w-full overflow-x-hidden bg-[radial-gradient(ellipse_at_12%_0%,rgba(174,12,32,.20),transparent_34%),radial-gradient(ellipse_at_95%_90%,rgba(104,7,23,.16),transparent_35%),#09090b] px-3 py-4 text-[#f8f5f6] sm:px-5 md:px-7">
  <div className="mx-auto w-full max-w-[1600px] min-w-0">
   <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
    <div><button onClick={()=>location.href="/dashboard"} className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#aaa0a5] hover:text-red-700"><ArrowLeft size={16}/> Dashboard</button><h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">Exhibitions Management</h1><p className="mt-1 text-sm text-[#aaa0a5]">Manage exhibition profiles, schedules, organizers and online presence.</p></div>
    <button onClick={startNew} className="inline-flex items-center gap-2 rounded-lg bg-[#c8102e] px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-red-800"><Plus size={17}/> Create Exhibition</button>
   </div>
   {notice&&!editing&&<div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{notice}</div>}
   {!editing&&<><div className="mb-5 grid min-w-0 gap-3 sm:grid-cols-3">
    <div className="rounded-xl border border-white/10 bg-[#191719] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#aaa0a5]">Total exhibitions</p><p className="mt-1 text-3xl font-extrabold text-[#f7eef0]">{rows.length}</p></div>
    <div className="rounded-xl border border-white/10 bg-[#191719] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#aaa0a5]">Exhibitor participation records</p><p className="mt-1 text-3xl font-extrabold text-[#f7eef0]">{Object.values(counts).reduce((a,c)=>a+c.exhibitors,0)}</p></div>
    <div className="rounded-xl border border-white/10 bg-[#191719] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#aaa0a5]">Booth inventory</p><p className="mt-1 text-3xl font-extrabold text-[#f7eef0]">{Object.values(counts).reduce((a,c)=>a+c.booths,0)}</p></div>
   </div>
   <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-[#171417] px-4 py-3 shadow-inner"><Search size={17} className="text-[#82777c]"/><input className="w-full border-0 bg-transparent text-sm outline-none" placeholder="Search exhibitions, city, country or organizer..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
   {loading?<div className="rounded-xl bg-[#191719] p-10 text-center text-[#aaa0a5]"><Loader2 className="mx-auto mb-2 animate-spin"/>Loading exhibition records…</div>:filtered.length===0?<div className="rounded-xl border border-dashed border-gray-300 bg-[#191719] p-12 text-center"><Building2 className="mx-auto mb-3 text-[#82777c]" size={32}/><p className="font-bold text-[#e8dce0]">No exhibitions found</p><p className="mt-1 text-sm text-[#aaa0a5]">Create an exhibition profile to get started.</p></div>:<div className="grid min-w-0 gap-3">{filtered.map(e=>{const c=counts[e.id]||{exhibitors:0,booths:0,booked:0};return <article key={e.id} className="overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#21191c] to-[#141316] shadow-[0_12px_28px_rgba(0,0,0,.28)] transition hover:border-red-500/25">
    <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
     <div className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#111013] md:w-40">{e.exhibition_logo_path?<img src={e.exhibition_logo_path} alt="Exhibition logo" className="max-h-full max-w-full object-contain"/>:<div className="text-center"><Building2 className="mx-auto mb-1 text-[#82777c]"/><span className="text-xs font-bold text-[#82777c]">EXHIBITION</span></div>}</div>
     <div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><h2 className="text-lg font-extrabold text-white">{e.exhibition_name}</h2><span className={"rounded-full px-2.5 py-1 text-xs font-bold "+statusTone(e.status)}>{e.status||"Planning"}</span></div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#aaa0a5]"><span className="inline-flex items-center gap-1"><CalendarDays size={14}/>{fmt(e.start_date)} – {e.end_date?fmt(e.end_date):"TBC"}</span><span className="inline-flex items-center gap-1"><MapPin size={14}/>{[e.venue_name,e.city,e.country].filter(Boolean).join(", ")||"Venue to be confirmed"}</span></div>
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-[#111013] p-3 text-center"><div><b className="block text-xl text-[#f7eef0]">{c.exhibitors}</b><span className="text-xs text-[#aaa0a5]">Exhibitors</span></div><div><b className="block text-xl text-[#f7eef0]">{c.booths}</b><span className="text-xs text-[#aaa0a5]">Booths</span></div><div><b className="block text-xl text-red-700">{c.booths?pct(e.id)+"%":"—"}</b><span className="text-xs text-[#aaa0a5]">Booking</span></div></div>
     </div>
     <div className="flex shrink-0 flex-row gap-2 md:flex-col"><button onClick={()=>startEdit(e)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-[#d8cdd0] hover:border-red-500/50 hover:text-red-700"><Pencil size={15}/> Edit profile</button>{e.official_website&&<a href={e.official_website} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-[#d8cdd0]"><ExternalLink size={15}/> Website</a>}</div>
    </div>
    {e.organizer_name&&<div className="flex items-center gap-3 border-t border-white/10 bg-[#171417] px-4 py-2">{e.organizer_logo_path&&<img src={e.organizer_logo_path} alt="Organizer logo" className="h-8 max-w-20 object-contain"/>}<span className="text-xs text-[#aaa0a5]">Organized by</span><b className="text-sm text-[#e8dce0]">{e.organizer_name}</b>{e.organizer_website&&<a className="ml-auto text-xs font-semibold text-red-700" href={e.organizer_website} target="_blank" rel="noreferrer">Organizer website ↗</a>}</div>}
   </article>})}</div>}</>}
   {editing&&<div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#21191c] to-[#111013] p-4 shadow-[0_16px_40px_rgba(0,0,0,.3)] md:p-6">
    <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold text-white">{editing.id?"Edit Exhibition":"Create Exhibition"}</h2><p className="mt-1 text-sm text-[#aaa0a5]">Complete the exhibition profile. Fields can be updated later.</p></div><button onClick={()=>setEditing(null)} className="rounded-lg p-2 text-[#aaa0a5] hover:bg-white/10"><X/></button></div>
    <div className="mb-5 flex flex-wrap gap-2">{[["overview","General Information"],["schedule","Dates & Timing"],["organizer","Organizer"],["online","Website & Social Media"],["venue","Venue & Operations"]].map(([v,l])=><button key={v} onClick={()=>setTab(v)} className={"rounded-lg px-3 py-2 text-sm font-semibold "+(tab===v?"border border-red-300/20 bg-gradient-to-r from-[#e94755] to-[#970c20] text-white shadow-[0_5px_15px_rgba(210,16,43,.2)]":"border border-white/10 bg-[#191719] text-[#aaa0a5] hover:bg-white/[.06] hover:text-white")}>{l}</button>)}</div>
    <div className="grid gap-4">
     {tab==="overview"&&<Section title="Exhibition information"><div className="grid gap-4 md:grid-cols-2">
      <Field label="Official exhibition name *"><input className={inputClass} value={editing.exhibition_name||""} onChange={e=>patch("exhibition_name",e.target.value)} placeholder="Exhibition name and edition"/></Field>
      <Field label="Status"><select className={inputClass} value={editing.status||"Planning"} onChange={e=>patch("status",e.target.value)}>{["Planning","Upcoming","Live","Completed","Cancelled"].map(s=><option key={s}>{s}</option>)}</select></Field>
      <Field label="Exhibition logo URL (optional)"><input className={inputClass} value={editing.exhibition_logo_path||""} onChange={e=>patch("exhibition_logo_path",e.target.value)} placeholder="https://..."/></Field>
      <Field label="Exhibition banner URL (optional)"><input className={inputClass} value={editing.banner_path||""} onChange={e=>patch("banner_path",e.target.value)} placeholder="https://..."/></Field>
      <Field label="Description"><textarea className={inputClass} rows={3} value={editing.description||""} onChange={e=>patch("description",e.target.value)}/></Field>
      <Field label="Total exhibition area (sqm)"><input type="number" min="0" className={inputClass} value={editing.total_area_sqm??0} onChange={e=>patch("total_area_sqm",e.target.value)}/></Field>
     </div></Section>}
     {tab==="schedule"&&<Section title="Exhibition dates and opening hours"><div className="grid gap-4 md:grid-cols-2">
      {([["start_date","Exhibition start date"],["end_date","Exhibition end date"],["setup_start_date","Setup start date"],["setup_end_date","Setup end date"],["dismantle_start_date","Dismantling start date"],["dismantle_end_date","Dismantling end date"]] as [keyof Exhibition,string][]).map(([k,l])=><Field key={k} label={l}><input type="date" className={inputClass} value={(editing[k] as string)||""} onChange={e=>patch(k,e.target.value||null)}/></Field>)}
      <Field label="Public opening time"><input type="time" className={inputClass} value={editing.opening_time||""} onChange={e=>patch("opening_time",e.target.value||null)}/></Field>
      <Field label="Public closing time"><input type="time" className={inputClass} value={editing.closing_time||""} onChange={e=>patch("closing_time",e.target.value||null)}/></Field>
      <Field label="Timezone"><select className={inputClass} value={editing.timezone||"Asia/Dubai"} onChange={e=>patch("timezone",e.target.value)}>{["Asia/Dubai","Asia/Kuwait","Asia/Bahrain","Asia/Muscat","Asia/Riyadh","Asia/Qatar","Europe/London","Asia/Kolkata","Other"].map(t=><option key={t}>{t}</option>)}</select></Field>
      <Field label="Daily / special opening hours (notes)"><textarea className={inputClass} rows={3} value={typeof editing.daily_hours==="string"?editing.daily_hours:JSON.stringify(editing.daily_hours||{},null,2)} onChange={e=>patch("daily_hours",e.target.value)} placeholder="Example: Friday 2 PM–10 PM; other days 10 AM–10 PM"/></Field>
     </div><p className="mt-3 text-xs text-[#aaa0a5]"><Clock3 className="mr-1 inline" size={13}/> Opening hours are stored in the exhibition's selected timezone.</p></Section>}
     {tab==="organizer"&&<Section title="Organizer identity and contact"><div className="grid gap-4 md:grid-cols-2">
      <Field label="Organizer / organizing company name"><input className={inputClass} value={editing.organizer_name||""} onChange={e=>patch("organizer_name",e.target.value)}/></Field>
      <Field label="Organizer contact person"><input className={inputClass} value={editing.organizer_contact_person||""} onChange={e=>patch("organizer_contact_person",e.target.value)}/></Field>
      <Field label="Organizer email"><input type="email" className={inputClass} value={editing.organizer_email||""} onChange={e=>patch("organizer_email",e.target.value)}/></Field>
      <Field label="Organizer phone"><input type="tel" className={inputClass} value={editing.organizer_phone||""} onChange={e=>patch("organizer_phone",e.target.value)}/></Field>
      <Field label="Organizer website"><input type="url" className={inputClass} value={editing.organizer_website||""} onChange={e=>patch("organizer_website",e.target.value)}/></Field>
      <Field label="Organizer logo upload (PNG/JPG/WebP/SVG, max 5MB)"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className={inputClass} onChange={e=>setLogoFile(e.target.files?.[0]||null)}/></Field>
     </div>{editing.organizer_logo_path&&<div className="mt-3 flex items-center gap-3"><img src={editing.organizer_logo_path} className="h-12 max-w-32 object-contain rounded border bg-[#191719] p-1" alt="Organizer logo preview"/><span className="text-xs text-[#aaa0a5]">Current organizer logo</span></div>}</Section>}
     {tab==="online"&&<Section title="Official website and social media"><div className="grid gap-4 md:grid-cols-2">
      {([["official_website","Official exhibition website"],["registration_url","Exhibitor registration URL"],["visitor_info_url","Visitor information URL"],["instagram_url","Instagram URL"],["facebook_url","Facebook URL"],["linkedin_url","LinkedIn URL"],["youtube_url","YouTube URL"],["tiktok_url","TikTok URL"]] as [keyof Exhibition,string][]).map(([k,l])=><Field key={k} label={l}><input type="url" className={inputClass} value={(editing[k] as string)||""} onChange={e=>patch(k,e.target.value)} placeholder="https://"/></Field>)}
      <Field label="Other social media links (one URL per line)"><textarea className={inputClass} rows={4} value={(Array.isArray(editing.other_social_links)?editing.other_social_links:[]).join("\n")} onChange={e=>patch("other_social_links",e.target.value.split("\n").map(v=>v.trim()).filter(Boolean))}/></Field>
     </div><div className="mt-3 flex flex-wrap gap-3 text-xs text-[#aaa0a5]"><span><Globe size={14} className="mr-1 inline"/> Website</span><span><Instagram size={14} className="mr-1 inline"/> Instagram</span><span><Facebook size={14} className="mr-1 inline"/> Facebook</span><span><Linkedin size={14} className="mr-1 inline"/> LinkedIn</span><span><Youtube size={14} className="mr-1 inline"/> YouTube</span></div></Section>}
     {tab==="venue"&&<Section title="Venue, location and access"><div className="grid gap-4 md:grid-cols-2">
      <Field label="Venue name"><input className={inputClass} value={editing.venue_name||""} onChange={e=>patch("venue_name",e.target.value)}/></Field>
      <Field label="City"><input className={inputClass} value={editing.city||""} onChange={e=>patch("city",e.target.value)}/></Field>
      <Field label="Country"><input className={inputClass} value={editing.country||""} onChange={e=>patch("country",e.target.value)}/></Field>
      <Field label="Google Maps URL"><input type="url" className={inputClass} value={editing.google_maps_url||""} onChange={e=>patch("google_maps_url",e.target.value)}/></Field>
      <Field label="Full venue address"><textarea className={inputClass} rows={3} value={editing.venue_address||""} onChange={e=>patch("venue_address",e.target.value)}/></Field>
      <Field label="Exhibition banner upload (optional)"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className={inputClass} onChange={e=>setBannerFile(e.target.files?.[0]||null)}/></Field>
     </div></Section>}
    </div>
    {notice&&<div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{notice}</div>}
    <div className="mt-5 flex flex-wrap justify-end gap-2"><button onClick={()=>setEditing(null)} className="rounded-lg border border-white/10 bg-[#191719] px-4 py-2.5 text-sm font-semibold text-[#e8dce0] hover:bg-white/10">Cancel</button><button disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-[#c8102e] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving?<Loader2 className="animate-spin" size={16}/>:<Save size={16}/>} Save Exhibition</button></div>
   </div>}
  </div>
 </main>;
}
