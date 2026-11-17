"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase";
import { ArrowLeft, Download, Search, Upload, RefreshCw, Users, FileSpreadsheet, AlertCircle, Trash2, Pencil, Plus, Building2, ChevronRight, Archive, RotateCcw } from "lucide-react";
import Link from "next/link";

type MasterCompany = { id:string; company_name:string; contact_person?:string|null; email?:string|null; phone?:string|null; country?:string|null; address?:string|null; status?:string|null; archived_at?:string|null; archived_by?:string|null; projects:string[] };
type Exhibitor = {
  id: string; customer_id?:string|null; company_name: string; contact_name?: string | null; email?: string | null;
  phone?: string | null; status?: string | null; source_sr_no?: string | null;
  source_status?: string | null; stand_no?: string | null; area_sqm?: number | null;
  stand_type?: string | null; hall?: string | null; source_country?: string | null;
};
const columns = ["S.N", "Company", "Status", "Contact Person", "Contact Details", "E-Mail", "Stand No", "Area (sqm)", "Stand Type", "Country", "Hall"];
const COUNTRY_CODES: Record<string,string> = { "united arab emirates":"AE",uae:"AE",oman:"OM",kuwait:"KW","saudi arabia":"SA",bahrain:"BH",qatar:"QA",india:"IN",pakistan:"PK",lebanon:"LB",yemen:"YE",syria:"SY",iran:"IR",egypt:"EG","united kingdom":"GB",uk:"GB","united states":"US",usa:"US",canada:"CA",australia:"AU",china:"CN",japan:"JP",turkey:"TR",türkiye:"TR",germany:"DE",france:"FR",italy:"IT",spain:"ES",switzerland:"CH",netherlands:"NL",singapore:"SG",malaysia:"MY",thailand:"TH",indonesia:"ID",jordan:"JO",iraq:"IQ",palestine:"PS",sudan:"SD",morocco:"MA",tunisia:"TN",libya:"LY",nigeria:"NG",southafrica:"ZA","south africa":"ZA",russia:"RU",ukraine:"UA",brazil:"BR",mexico:"MX" };
function countryFlag(country?: string|null) { const key=(country||"").trim().toLowerCase(); const code=COUNTRY_CODES[key]||COUNTRY_CODES[key.replace(/\\s+/g,"")]; return code?String.fromCodePoint(...code.split("").map(ch=>127397+ch.charCodeAt(0))):"🌐"; }
function companyInitials(name?: string|null) { return (name||"VEGA").trim().split(/\\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase()||"CO"; }

const norm = (s: string) => s.trim().toLowerCase().replace(/[._-]/g, " ").replace(/\s+/g, " ");
const duplicateKey = (company: string, stand: string) => `${norm(company)}::${norm(stand || "")}`;
function escapeExport(value: unknown) { return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

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
export default function ExhibitorDatabasePage() {
  const [client] = useState(() => createClient());
  const [eventId,setEventId] = useState("all");
  const [events,setEvents] = useState<{id:string;name:string}[]>([]);
  const [items,setItems] = useState<Exhibitor[]>([]);
  const [masterItems,setMasterItems] = useState<MasterCompany[]>([]);
  const [masterCustomers,setMasterCustomers] = useState<Omit<MasterCompany,"projects">[]>([]);
  const [selectedCustomerId,setSelectedCustomerId] = useState("");
  const [suggestionField,setSuggestionField] = useState<"company"|"email"|null>(null);
  const [searchFocused,setSearchFocused] = useState(false);
  const [selectedIds,setSelectedIds] = useState<string[]>([]);
  const [isAdmin,setIsAdmin] = useState(false);
  const [showArchived,setShowArchived] = useState(false);
  const [search,setSearch] = useState("");
  const [searchField,setSearchField] = useState<"all"|"company"|"email"|"name">("all");
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
      const {data:adminFlag,error:adminErr}=await client.rpc("is_current_user_admin");
      if(adminErr) throw adminErr;
      const admin=adminFlag===true; setIsAdmin(admin);
      if(showArchived&&!admin) setShowArchived(false);
      let customerQuery=client.from("customers").select("id,company_name,contact_person,email,phone,country,address,status,archived_at,archived_by").order("company_name").limit(2000);
      customerQuery=showArchived&&admin?customerQuery.not("archived_at","is",null):customerQuery.is("archived_at",null);
      const {data:customers,error:customerErr}=await customerQuery;
      if(customerErr) throw customerErr;
      const master=(customers||[]) as Omit<MasterCompany,"projects">[];
      setMasterCustomers(master);
      if(eventId==="all" || !eventId) {
        const {data:participations,error:participationErr}=await client.from("exhibitors").select("customer_id,exhibition_id").not("customer_id","is",null);
        if(participationErr) throw participationErr;
        const projectNames=new Map(list.map(e=>[e.id,e.name]));
        const byCustomer=new Map<string,Set<string>>();
        (participations||[]).forEach((row:any)=>{
          if(!row.customer_id) return;
          const name=projectNames.get(row.exhibition_id);
          if(!name) return;
          if(!byCustomer.has(row.customer_id)) byCustomer.set(row.customer_id,new Set());
          byCustomer.get(row.customer_id)!.add(name);
        });
        setMasterItems(master.map(c=>({...c,projects:Array.from(byCustomer.get(c.id)||[]).sort((x,y)=>x.localeCompare(y))})));
        setItems([]);
      } else {
        const {data,error:rowsErr}=await client.from("exhibitors").select("id,customer_id,company_name,contact_name:contact_person,email,phone,status,source_sr_no,source_status,stand_no,area_sqm,stand_type,hall,source_country").eq("exhibition_id",eventId).order("company_name");
        if(rowsErr) throw rowsErr;
        setItems((data||[]) as Exhibitor[]);
        setMasterItems([]);
      }
    } catch(e:any) { setError(e?.message || "Unable to load the exhibitor database. Check the database connection and access permissions."); }
    finally {setBusy(false);}
  },[client,eventId,showArchived]);
  useEffect(()=>{load();},[load]);
  const isMainDatabase=eventId==="all";
  const optionsFor=(values:(string|null|undefined)[],allLabel:string)=>[allLabel,...Array.from(new Set(values.filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b))];
  const countries=useMemo(()=>optionsFor(isMainDatabase?masterItems.map(x=>x.country):items.map(x=>x.source_country),"All countries"),[items,masterItems,isMainDatabase]);
  const statuses=useMemo(()=>optionsFor(isMainDatabase?masterItems.map(x=>x.status):items.map(x=>x.source_status||x.status),"All statuses"),[items,masterItems,isMainDatabase]);
  const halls=useMemo(()=>optionsFor(items.map(x=>x.hall),"All halls"),[items]);
  const standTypes=useMemo(()=>optionsFor(items.map(x=>x.stand_type),"All stand types"),[items]);
  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    const result=items.filter(x=>{
      const searchValues=searchField==="company"?[x.company_name]:searchField==="email"?[x.email]:searchField==="name"?[x.contact_name]:[x.company_name,x.contact_name,x.email,x.phone,x.stand_no,x.source_sr_no,x.source_country,x.hall,x.stand_type,x.source_status,x.status];
      const matches=!q || searchValues.some(v=>String(v||"").toLowerCase().includes(q));
      return matches && (filters.country==="All countries"||x.source_country===filters.country)
        && (filters.status==="All statuses"||(x.source_status||x.status)===filters.status)
        && (filters.hall==="All halls"||x.hall===filters.hall)
        && (filters.standType==="All stand types"||x.stand_type===filters.standType);
    });
    const value=(x:Exhibitor,key:keyof Exhibitor|"serial")=>key==="serial"?(Number(x.source_sr_no)||0):(x[key]??"");
    result.sort((a,b)=>{const av=value(a,sort.key),bv=value(b,sort.key);const cmp=typeof av==="number"&&typeof bv==="number"?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:"base"});return sort.direction==="asc"?cmp:-cmp;});
    return result;
  },[items,search,searchField,filters,sort]);
  const filteredMaster=useMemo(()=>{const q=search.trim().toLowerCase();return masterItems.filter(x=>{const values=searchField==="company"?[x.company_name]:searchField==="email"?[x.email]:searchField==="name"?[x.contact_person]:[x.company_name,x.contact_person,x.email,x.phone,x.country,...x.projects];return (!q||values.some(v=>String(v||"").toLowerCase().includes(q)))&&(filters.country==="All countries"||x.country===filters.country)&&(filters.status==="All statuses"||x.status===filters.status);}).sort((a,b)=>a.company_name.localeCompare(b.company_name,undefined,{sensitivity:"base"}));},[masterItems,search,searchField,filters]);
  const customerSuggestions=useMemo(()=>{const q=(suggestionField==="email"?draft.email:draft.company_name).trim().toLowerCase();if(!q||q.length<2)return [];return masterCustomers.filter(c=>(suggestionField==="email"?String(c.email||"").toLowerCase().includes(q):String(c.company_name||"").toLowerCase().includes(q)||String(c.email||"").toLowerCase().includes(q))).slice(0,8);},[masterCustomers,draft.company_name,draft.email,suggestionField]);
  const chooseCustomer=(c:Omit<MasterCompany,"projects">)=>{setSelectedCustomerId(c.id);setDraft(d=>({...d,company_name:c.company_name||"",contact_name:c.contact_person||"",email:c.email||"",phone:c.phone||"",source_country:c.country||""}));setSuggestionField(null);};
  const searchSuggestions=useMemo(()=>{const q=search.trim().toLowerCase();if(!q||q.length<2||!searchFocused)return [];return masterCustomers.filter(c=>{const values=searchField==="company"?[c.company_name]:searchField==="email"?[c.email]:searchField==="name"?[c.contact_person]:[c.company_name,c.email,c.contact_person];return values.some(v=>String(v||"").toLowerCase().includes(q));}).slice(0,7);},[masterCustomers,search,searchField,searchFocused]);
  const toggleSort=(key:keyof Exhibitor|"serial")=>setSort(s=>({key,direction:s.key===key&&s.direction==="asc"?"desc":"asc"}));
  const resetFilters=()=>{setSearch("");setSearchField("all");setFilters({country:"All countries",status:"All statuses",hall:"All halls",standType:"All stand types"});};
  const visibleIds=isMainDatabase?filteredMaster.map(x=>x.id):filtered.map(x=>x.id);
  const allVisibleSelected=visibleIds.length>0&&visibleIds.every(id=>selectedIds.includes(id));
  const toggleOne=(id:string)=>setSelectedIds(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
  const toggleVisible=()=>setSelectedIds(current=>allVisibleSelected?current.filter(id=>!visibleIds.includes(id)):Array.from(new Set([...current,...visibleIds])));
  const getExportRows=()=>isMainDatabase
    ? [["S.N","Company","CONTACT PERSON","EMAIL","PHONE","COUNTRY","Project Name","STATUS"],...filteredMaster.map((x,i)=>[i+1,x.company_name,x.contact_person,x.email,x.phone,x.country,x.projects.join("; "),x.status])]
    : [columns.map(x=>x.toUpperCase()),...filtered.map((x,i)=>[i+1,x.company_name,x.source_status||x.status,x.contact_name,x.phone,x.email,x.stand_no,x.area_sqm,x.stand_type,x.source_country,x.hall])];
  const exportCsv=()=>{const csv=getExportRows().map(r=>r.map(v=>{const value=String(v??"");return '"'+value.replace(/"/g,'""')+'"';}).join(",")).join("\r\n");const blob=new Blob(["\\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=isMainDatabase?"VEGA-MAIN-DATABASE.csv":"VEGA-PROJECT-EXHIBITORS.csv";a.click();URL.revokeObjectURL(url);};
  const exportExcel=()=>{const rows=getExportRows();const table=rows.map((r,i)=>"<tr>"+r.map(v=>i===0?"<th>"+escapeExport(v)+"</th>":"<td>"+escapeExport(v)+"</td>").join("")+"</tr>").join("");const html="<html><head><meta charset='utf-8'><style>body{font-family:Arial}table{border-collapse:collapse}th{background:#c9252c;color:#fff;font-weight:bold}th,td{border:1px solid #ccc;padding:7px;text-align:left;white-space:nowrap}td{mso-number-format:'\\@'}</style></head><body><h2>VEGA JEWELLERY EVENTS AND EXHIBITIONS</h2><h3>"+(isMainDatabase?"MAIN COMPANY DATABASE":"PROJECT EXHIBITOR DATABASE")+"</h3><table>"+table+"</table></body></html>";const blob=new Blob(["\\uFEFF",html],{type:"application/vnd.ms-excel;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=isMainDatabase?"VEGA-MAIN-DATABASE.xls":"VEGA-PROJECT-EXHIBITORS.xls";a.click();URL.revokeObjectURL(url);};
  const exportPdf=()=>{const rows=getExportRows();const w=window.open("","_blank");if(!w){setError("Please allow pop-ups to export the PDF.");return;}const table=rows.map((r,i)=>"<tr>"+r.map(v=>i===0?"<th>"+escapeExport(v)+"</th>":"<td>"+escapeExport(v)+"</td>").join("")+"</tr>").join("");w.document.write("<!doctype html><html><head><title>VEGA Database</title><style>body{font:10px Arial;color:#222;padding:20px}h1{font-size:18px;color:#b5121b}h2{font-size:13px}table{border-collapse:collapse;width:100%}th{background:#b5121b;color:#fff}th,td{border:1px solid #bbb;padding:6px;text-align:left;vertical-align:top}tr{break-inside:avoid}@page{size:landscape;margin:12mm}</style></head><body><h1>VEGA JEWELLERY EVENTS AND EXHIBITIONS</h1><h2>"+(isMainDatabase?"MAIN COMPANY DATABASE":"PROJECT EXHIBITOR DATABASE")+"</h2><p>Records: "+(rows.length-1)+"</p><table>"+table+"</table><script>window.onload=()=>window.print()<\\/script></body></html>");w.document.close();};
  const startColumnResize=(e:React.PointerEvent<HTMLDivElement>)=>{
    e.preventDefault();e.stopPropagation();
    const handle=e.currentTarget;
    const th=handle.parentElement as HTMLTableCellElement|null;
    const table=th?.closest("table") as HTMLTableElement|null;
    const headerRow=th?.parentElement as HTMLTableRowElement|null;
    if(!th||!table||!headerRow)return;
    const columnIndex=th.cellIndex;
    const columnCount=Math.max(headerRow.cells.length,...Array.from(table.rows).map(row=>row.cells.length));
    let colgroup=table.querySelector("colgroup");
    if(!colgroup){colgroup=document.createElement("colgroup");table.insertBefore(colgroup,table.firstChild);}
    while(colgroup.children.length<columnCount)colgroup.appendChild(document.createElement("col"));
    const cols=Array.from(colgroup.children) as HTMLTableColElement[];
    const widths=cols.map((col,index)=>{
      const cell=headerRow.cells[index];
      const measured=cell?.getBoundingClientRect().width||col.getBoundingClientRect().width||110;
      const current=parseFloat(col.style.width);
      const width=Number.isFinite(current)&&current>0?current:Math.max(76,measured);
      col.style.width=width+"px";col.style.minWidth="76px";return width;
    });
    table.style.tableLayout="fixed";
    table.style.width=widths.reduce((x,y)=>x+y,0)+"px";
    table.style.minWidth=table.style.width;table.style.maxWidth="none";
    const startX=e.clientX;const startWidth=widths[columnIndex]||th.getBoundingClientRect().width;const pointerId=e.pointerId;
    const move=(ev:PointerEvent)=>{if(ev.pointerId!==pointerId)return;const width=Math.max(76,startWidth+ev.clientX-startX);cols[columnIndex].style.width=width+"px";table.style.width=widths.reduce((sum,value,index)=>sum+(index===columnIndex?width:value),0)+"px";table.style.minWidth=table.style.width;};
    const stop=(ev:PointerEvent)=>{if(ev.pointerId!==pointerId)return;window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop);window.removeEventListener("pointercancel",stop);document.body.style.cursor="";document.body.style.userSelect="";handle.classList.remove("is-resizing");};
    handle.classList.add("is-resizing");document.body.style.cursor="col-resize";document.body.style.userSelect="none";
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop);window.addEventListener("pointercancel",stop);
  };
  const openAdd=()=>{setDraft({company_name:"",contact_name:"",email:"",phone:"",source_status:"",source_sr_no:"",stand_no:"",area_sqm:"",stand_type:"",source_country:"",hall:""});setSelectedCustomerId("");setSuggestionField(null);setEditor(null);setError("");};
  const openEdit=(item:Exhibitor)=>{setDraft({company_name:item.company_name||"",contact_name:item.contact_name||"",email:item.email||"",phone:item.phone||"",source_status:item.source_status||"",source_sr_no:item.source_sr_no||"",stand_no:item.stand_no||"",area_sqm:item.area_sqm==null?"":String(item.area_sqm),stand_type:item.stand_type||"",source_country:item.source_country||"",hall:item.hall||""});setSelectedCustomerId(item.customer_id||"");setSuggestionField(null);setEditor(item);setError("");};
  const saveExhibitor=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault(); if(!eventId)return;
    if(!draft.company_name.trim()){setError("Company name is required.");return;}
    const {data:matches,error:checkError}=await client.from("exhibitors").select("id,company_name,stand_no").eq("exhibition_id",eventId);
    if(checkError){setError(checkError.message);return;}
    const key=duplicateKey(draft.company_name,draft.stand_no);
    const duplicate=(matches||[]).find((x:any)=>x.id!==(editor !== false && editor !== null ? editor.id : "") && duplicateKey(x.company_name||"",x.stand_no||"")===key);
    if(duplicate){setError(`Duplicate blocked: ${draft.company_name} already exists for stand ${draft.stand_no||"(blank)"}.`);return;}
    setBusy(true);setError("");setMessage("");
    const payload={company_name:draft.company_name.trim(),customer_id:selectedCustomerId||null,contact_person:draft.contact_name.trim()||null,email:draft.email.trim().toLowerCase()||null,phone:draft.phone.trim()||null,source_status:draft.source_status.trim()||null,source_sr_no:draft.source_sr_no.trim()||null,stand_no:draft.stand_no.trim()||null,area_sqm:draft.area_sqm.trim()?Number(draft.area_sqm):null,stand_type:draft.stand_type.trim()||null,source_country:draft.source_country.trim()||null,hall:draft.hall.trim()||null};
    try{
      const result=editor?await client.from("exhibitors").update(payload).eq("id",editor.id):await client.from("exhibitors").insert({...payload,exhibition_id:eventId,status:"confirmed"});
      if(result.error)throw result.error;
      setEditor(false);setMessage(editor?"Exhibitor updated successfully.":"Exhibitor added successfully.");await load();
    }catch(err:any){setError(err?.message||"Unable to save exhibitor.");}finally{setBusy(false);}
  };
  const deleteRow=async(item:Exhibitor)=>{
    if(!window.confirm(`Delete ${item.company_name} from the selected exhibition's exhibitor database? This cannot be undone.`)) return;
    setBusy(true);setMessage("");setError("");
    try{const {error:deleteErr}=await client.from("exhibitors").delete().eq("id",item.id);if(deleteErr)throw deleteErr;setMessage(`Deleted ${item.company_name}.`);await load();}
    catch(e:any){setError(e?.message||"Unable to delete this exhibitor.");}finally{setBusy(false);}
  };
  const archiveCompany=async(item:MasterCompany)=>{
    if(!isAdmin||!window.confirm(`Archive ${item.company_name}? It will be hidden from the active Main Database. Project participation records will remain unchanged.`))return;
    setBusy(true);setMessage("");setError("");
    try{const {error:archiveErr}=await client.from("customers").update({archived_at:new Date().toISOString()}).eq("id",item.id);if(archiveErr)throw archiveErr;setSelectedIds(ids=>ids.filter(id=>id!==item.id));setMessage(`Archived ${item.company_name}.`);await load();}
    catch(e:any){setError(e?.message||"Unable to archive this company.");}finally{setBusy(false);}
  };
  const archiveSelectedCompanies=async()=>{
    if(!isAdmin||!selectedIds.length)return;
    if(!window.confirm(`Archive ${selectedIds.length} selected company record(s)? Project participation records will remain unchanged.`))return;
    setBusy(true);setMessage("");setError("");
    try{const {error:archiveErr}=await client.from("customers").update({archived_at:new Date().toISOString()}).in("id",selectedIds).is("archived_at",null);if(archiveErr)throw archiveErr;const count=selectedIds.length;setSelectedIds([]);setMessage(`Archived ${count} selected company record(s).`);await load();}
    catch(e:any){setError(e?.message||"Unable to archive selected companies.");}finally{setBusy(false);}
  };
  const restoreCompany=async(item:MasterCompany)=>{
    if(!isAdmin||!window.confirm(`Restore ${item.company_name} to the active Main Database?`))return;
    setBusy(true);setMessage("");setError("");
    try{const {error:restoreErr}=await client.from("customers").update({archived_at:null,archived_by:null}).eq("id",item.id);if(restoreErr)throw restoreErr;setMessage(`Restored ${item.company_name}.`);await load();}
    catch(e:any){setError(e?.message||"Unable to restore this company.");}finally{setBusy(false);}
  };
  const deleteSelected=async()=>{
    if(!selectedIds.length)return;
    if(!window.confirm("Permanently delete "+selectedIds.length+" selected exhibitor row(s) from this exhibition? This cannot be undone."))return;
    setBusy(true);setMessage("");setError("");
    try{const {error:deleteErr}=await client.from("exhibitors").delete().in("id",selectedIds).eq("exhibition_id",eventId);if(deleteErr)throw deleteErr;const count=selectedIds.length;setSelectedIds([]);setMessage("Deleted "+count+" selected exhibitor row(s).");await load();}
    catch(e:any){setError(e?.message||"Unable to delete selected exhibitors.");}finally{setBusy(false);}
  };
  const deleteAll=async()=>{
    if(!eventId) return;
    if(!window.confirm(`DELETE ALL ${items.length} exhibitors from the selected exhibition? This cannot be undone. Continue?`)) return;
    if(!window.confirm("Final confirmation: permanently delete every exhibitor record linked to the selected exhibition?")) return;
    setBusy(true);setMessage("");setError("");
    try{const {error:deleteErr}=await client.from("exhibitors").delete().eq("exhibition_id",eventId);if(deleteErr)throw deleteErr;setMessage("All exhibitor records for the selected exhibition have been deleted.");await load();}
    catch(e:any){setError(e?.message||"Unable to delete exhibitor records.");}finally{setBusy(false);}
  };
  const importCsv=async(file:File)=>{
    setBusy(true);setMessage("");setError("");
    try{
      if(!eventId) throw new Error("Select an exhibition first.");
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
  return <main className="kif-page">
    <div className="kif-content">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#b5121b]"><ArrowLeft size={16}/> Back to VEGA Dashboard</Link>
      <header className="kif-header">
        <div><p className="text-xs font-bold tracking-[.18em] text-[#b5121b]">VEGA JEWELLERY EVENTS AND EXHIBITIONS</p><h1 className="mt-1 text-3xl font-bold">EXHIBITOR DATABASE</h1><p className="mt-1 text-gray-500">{isMainDatabase?(showArchived?"Archived company records":"All VEGA projects · Central company records"):(events.find(e=>e.id===eventId)?.name || "Select an exhibition")}</p></div>
        <div className="kif-actions"><label className="flex items-center gap-2 text-sm font-semibold text-gray-700">Project / Exhibition<select aria-label="Select project or exhibition" value={eventId} onChange={e=>{setEventId(e.target.value);setSelectedIds([]);resetFilters();}} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5"><option value="all">All Projects — Main Database</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
          {!isMainDatabase&&<button onClick={openAdd} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-semibold"><Plus size={17}/> Add Exhibitor</button>}
          {!isMainDatabase&&<button onClick={()=>fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#b5121b] px-4 py-2.5 font-semibold text-white hover:bg-[#950e16] disabled:opacity-50"><Upload size={17}/> Import CSV</button>}
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e=>e.target.files?.[0]&&importCsv(e.target.files[0])}/>
          {isMainDatabase&&isAdmin&&<button onClick={()=>{setShowArchived(v=>!v);setSelectedIds([]);resetFilters();}} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"><Archive size={17}/> {showArchived?"Active Companies":"Archived Companies"}</button>}
          {isMainDatabase&&isAdmin&&!showArchived&&<button onClick={archiveSelectedCompanies} disabled={busy||selectedIds.length===0} className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"><Archive size={17}/> Archive Selected ({selectedIds.length})</button>}
          {!isMainDatabase&&isAdmin&&<button onClick={deleteSelected} disabled={busy||selectedIds.length===0} className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"><Trash2 size={17}/> Delete Selected ({selectedIds.length})</button>}
          {!isMainDatabase&&isAdmin&&<button onClick={deleteAll} disabled={busy||items.length===0} className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"><Trash2 size={17}/> Delete All</button>}
          <button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-semibold"><FileSpreadsheet size={17}/> Excel</button><button onClick={exportPdf} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-semibold"><Download size={17}/> PDF</button><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-semibold">CSV</button>
          <button onClick={load} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5"><RefreshCw size={17}/></button>
        </div>
      </header>
      <section className="kif-colorfusion-hero">
        <div className="kif-colorfusion-copy">
          <span className="kif-colorfusion-eyebrow">VEGA CENTRAL DATABASE</span>
          <h2>Exhibitor <span>Management</span></h2>
          <p>Your central hub for managing companies, exhibitors and their participation across global exhibitions.</p>
          <div className="kif-colorfusion-tags"><span>Connect</span><span>Collaborate</span><span>Grow</span></div>
        </div>
        <div className="kif-colorfusion-orbit kif-orbit-one"/><div className="kif-colorfusion-orbit kif-orbit-two"/>
        <div className="kif-colorfusion-mark">V</div>
      </section>
      <section className="kif-colorfusion-metrics" aria-label="Exhibitor database overview">
        <article className="kif-color-metric kif-metric-red"><div className="kif-metric-icon"><Building2 size={23}/></div><div><span>TOTAL COMPANIES</span><strong>{isMainDatabase?masterItems.length:items.length}</strong><small>Registered exhibitors</small></div><i className="kif-metric-spark"/></article>
        <article className="kif-color-metric kif-metric-purple"><div className="kif-metric-icon"><FileSpreadsheet size={23}/></div><div><span>PROJECTS</span><strong>{events.length}</strong><small>Exhibition projects</small></div><i className="kif-metric-spark"/></article>
        <article className="kif-color-metric kif-metric-teal"><div className="kif-metric-icon"><Users size={23}/></div><div><span>COUNTRIES</span><strong>{Math.max(0,countries.length-1)}</strong><small>Company locations</small></div><i className="kif-metric-spark"/></article>
        <article className="kif-color-metric kif-metric-gold"><div className="kif-metric-icon"><RefreshCw size={23}/></div><div><span>DATABASE STATUS</span><strong>{busy?"SYNCING":"LIVE"}</strong><small>{error?"Needs attention":"Central records available"}</small></div><i className="kif-metric-spark"/></article>
      </section>
      <div className="kif-filter-panel">
        <div className="kif-filter-grid">
          <div className="kif-search-tools"><label className="kif-search-mode"><span>Search by</span><select aria-label="Search field" value={searchField} onChange={e=>setSearchField(e.target.value as typeof searchField)}><option value="all">All fields</option><option value="company">Company</option><option value="email">Email</option><option value="name">Contact name</option></select></label><label className="kif-search relative"><Search size={17} className="text-gray-400"/><input value={search} onFocus={()=>setSearchFocused(true)} onBlur={()=>setTimeout(()=>setSearchFocused(false),150)} onChange={e=>setSearch(e.target.value)} placeholder={searchField==="all"?"Search all fields…":searchField==="company"?"Search company name…":searchField==="email"?"Search email address…":"Search contact person name…"} className="w-full py-2 outline-none"/>{searchSuggestions.length>0&&<div className="kif-autocomplete-menu absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto"><div className="kif-autocomplete-heading">MATCHING COMPANIES / CONTACTS</div>{searchSuggestions.map(c=><button type="button" key={c.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setSearch(searchField==="email"?(c.email||""):searchField==="name"?(c.contact_person||""):c.company_name);setSearchFocused(false);}} className="kif-autocomplete-option"><span className="kif-autocomplete-icon"><Building2 size={16}/></span><span className="kif-autocomplete-copy"><span className="kif-autocomplete-name">{c.company_name}</span><span className="kif-autocomplete-email">{c.contact_person||"Contact not set"} · {c.email||"Email not set"}</span></span><ChevronRight size={15} className="kif-autocomplete-arrow"/></button>)}</div>}</label></div>
          <select aria-label="Filter by country" value={filters.country} onChange={e=>setFilters(f=>({...f,country:e.target.value}))} className="rounded-lg border border-gray-200 px-3 py-2">{countries.map(c=><option key={c}>{c}</option>)}</select>
          <select aria-label="Filter by status" value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))} className="rounded-lg border border-gray-200 px-3 py-2">{statuses.map(c=><option key={c}>{c}</option>)}</select>
          {!isMainDatabase&&<select aria-label="Filter by hall" value={filters.hall} onChange={e=>setFilters(f=>({...f,hall:e.target.value}))} className="rounded-lg border border-gray-200 px-3 py-2">{halls.map(c=><option key={c}>{c}</option>)}</select>}
          {!isMainDatabase&&<select aria-label="Filter by stand type" value={filters.standType} onChange={e=>setFilters(f=>({...f,standType:e.target.value}))} className="rounded-lg border border-gray-200 px-3 py-2">{standTypes.map(c=><option key={c}>{c}</option>)}</select>}
        </div>
        <div className="kif-filter-meta"><div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"><Users size={17}/><b>{isMainDatabase?filteredMaster.length:filtered.length}</b><span className="text-gray-500">of {isMainDatabase?masterItems.length:items.length} records</span></div><button onClick={resetFilters} className="text-[#b5121b] font-semibold hover:underline">Clear filters</button><span className="text-gray-400">Click any column heading to sort ascending or descending.</span></div>
        {message&&<p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
        {error&&<p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{error}</p>}
      </div>
      <section className="kif-table-panel">
        <div className="kif-table-title"><FileSpreadsheet size={17} className="text-[#b5121b]"/> {isMainDatabase?(showArchived?"ARCHIVED COMPANIES":"VEGA Main Exhibitor Database"):"Project Exhibitor Database"} {busy&&<span className="ml-auto text-gray-400">Loading…</span>}</div>
        {isMainDatabase?<div className="kif-table-wrap"><table className="kif-table resizable-table"><thead className="bg-[var(--vega-main-bg)] text-xs uppercase tracking-wide text-[var(--muted)]"><tr><th className="w-10 px-2 py-2"><input type="checkbox" aria-label="Select all visible companies" checked={allVisibleSelected} onChange={toggleVisible} disabled={!visibleIds.length||busy}/><div className="kif-col-resize" onPointerDown={startColumnResize}/></th>{["S.N","Company","Contact Person","Email","Phone","Country","Project Name","Status"].map(c=><th key={c} className="px-3 py-2 font-semibold whitespace-nowrap normal-case">{c}<div className="kif-col-resize" onPointerDown={startColumnResize} title="Drag left or right to resize this column"/></th>)}<th className="px-3 py-2 font-semibold">ACTION</th></tr></thead><tbody className="divide-y divide-gray-100">{filteredMaster.map((x,i)=><tr key={x.id} className={selectedIds.includes(x.id)?"bg-red-50/70 hover:bg-red-50":"hover:bg-red-50/30"}><td className="px-3 py-3"><input type="checkbox" aria-label={"Select "+x.company_name} checked={selectedIds.includes(x.id)} onChange={()=>toggleOne(x.id)} disabled={busy}/></td><td className="px-4 py-3 text-gray-500">{i+1}</td><td className="px-4 py-3"><div className="flex min-w-[190px] items-center gap-3"><span className="vega-company-mark" aria-hidden="true">{companyInitials(x.company_name)}</span><span className="font-semibold text-slate-900">{x.company_name}</span></div></td><td className="px-4 py-3">{x.contact_person||"—"}</td><td className="px-4 py-3">{x.email||"—"}</td><td className="px-4 py-3">{x.phone||"—"}</td><td className="px-4 py-3">{x.country?<span className="inline-flex items-center gap-2 whitespace-nowrap"><span className="vega-country-flag" aria-label={x.country}>{countryFlag(x.country)}</span>{x.country}</span>:"—"}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{x.projects.length?x.projects.map(p=><span key={p} className="rounded-full bg-gray-100 px-2 py-1 text-xs">{p}</span>):<span className="text-gray-400">No project yet</span>}</div></td><td className="px-4 py-3">{x.status||"Active"}</td><td className="px-3 py-3 whitespace-nowrap">{isAdmin&&(showArchived?<button onClick={()=>restoreCompany(x)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-green-300 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-40"><RotateCcw size={14}/> Restore</button>:<button onClick={()=>archiveCompany(x)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"><Archive size={14}/> Archive</button>)}</td></tr>)}{!busy&&!filteredMaster.length&&<tr><td colSpan={10} className="px-4 py-16 text-center text-gray-500"><Users size={30} className="mx-auto mb-2 text-gray-300"/><p className="font-semibold text-gray-700">{showArchived?"No archived companies found":"No companies found"}</p><p className="mt-1 text-xs">{showArchived?"Archived companies will appear here for restoration.":"Try another company name, email or project."}</p></td></tr>}</tbody></table></div>:<div className="kif-table-wrap"><table className="kif-table"><thead className="bg-[var(--vega-main-bg)] text-xs uppercase tracking-wide text-[var(--muted)]"><tr><th className="w-10 px-2 py-2"><input type="checkbox" aria-label="Select all visible rows" checked={allVisibleSelected} onChange={toggleVisible} disabled={!visibleIds.length||busy}/></th>{columns.map((c,i)=><th key={c} className="px-3 py-2 font-semibold whitespace-nowrap"><button type="button" onClick={()=>toggleSort((["serial","company_name","source_status","contact_name","phone","email","stand_no","area_sqm","stand_type","source_country","hall"] as const)[i])} className="inline-flex items-center gap-1 hover:text-[#b5121b]">{i<2?c:c.toUpperCase()}<span className="text-[#b5121b]">{sort.key===(["serial","company_name","source_status","contact_name","phone","email","stand_no","area_sqm","stand_type","source_country","hall"] as const)[i]?(sort.direction==="asc"?"↑":"↓"):"↕"}</span></button><div className="kif-col-resize" onPointerDown={startColumnResize} title="Drag left or right to resize this column"/></th>)}<th className="px-3 py-2 font-semibold">ACTION<div className="kif-col-resize" onPointerDown={startColumnResize}/></th></tr></thead><tbody className="divide-y divide-gray-100">{filtered.map((x,i)=><tr key={x.id} className={selectedIds.includes(x.id)?"bg-red-50/70 hover:bg-red-50":"hover:bg-red-50/30"}><td className="px-3 py-3"><input type="checkbox" aria-label={"Select "+x.company_name} checked={selectedIds.includes(x.id)} onChange={()=>toggleOne(x.id)} disabled={busy}/></td><td className="px-4 py-3 text-gray-500">{i+1}</td><td className="px-4 py-3"><div className="flex min-w-[190px] items-center gap-3"><span className="vega-company-mark" aria-hidden="true">{companyInitials(x.company_name)}</span><span className="font-semibold text-slate-900">{x.company_name}</span></div></td><td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{x.source_status||x.status||"—"}</span></td><td className="px-4 py-3">{x.contact_name||"—"}</td><td className="px-4 py-3">{x.phone||"—"}</td><td className="px-4 py-3">{x.email||"—"}</td><td className="px-4 py-3">{x.stand_no||"—"}</td><td className="px-4 py-3">{x.area_sqm??"—"}</td><td className="px-4 py-3">{x.stand_type||"—"}</td><td className="px-4 py-3">{x.source_country?<span className="inline-flex items-center gap-2 whitespace-nowrap"><span className="vega-country-flag" aria-label={x.source_country}>{countryFlag(x.source_country)}</span>{x.source_country}</span>:"—"}</td><td className="px-4 py-3">{x.hall||"—"}</td><td className="px-4 py-3"><button onClick={()=>openEdit(x)} disabled={busy} title="Edit this exhibitor" className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"><Pencil size={14}/> Edit</button> {isAdmin&&<button onClick={()=>deleteRow(x)} disabled={busy} title="Delete this exhibitor" aria-label={`Delete ${x.company_name}`} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"><Trash2 size={14}/> Delete</button>}</td></tr>)}{!busy&&!filtered.length&&<tr><td colSpan={13} className="px-4 py-16 text-center text-gray-500"><Users size={30} className="mx-auto mb-2 text-gray-300"/><p className="font-semibold text-gray-700">No exhibitors found</p><p className="mt-1 text-xs">Import a CSV file for the selected exhibition, or adjust your search.</p></td></tr>}</tbody></table></div>}
      </section>
      {editor!==false&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={saveExhibitor} className="kif-modal"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{editor?"Edit Exhibitor":"Add Exhibitor"}</h2><button type="button" onClick={()=>{setEditor(false);setSuggestionField(null);}} className="rounded-md px-3 py-1 text-gray-500 hover:bg-gray-100">Close</button></div><div className="grid gap-4 sm:grid-cols-2"><label className="relative block text-sm font-medium text-gray-700">Company Name<input required value={draft.company_name} onFocus={()=>setSuggestionField("company")} onChange={e=>{setDraft(d=>({...d,company_name:e.target.value}));setSelectedCustomerId("");setSuggestionField("company");}} autoComplete="off" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#b5121b]" placeholder="Type company name or email"/>{suggestionField==="company"&&customerSuggestions.length>0&&<div className="kif-autocomplete-menu absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto"><div className="kif-autocomplete-heading">SELECT A COMPANY</div>{customerSuggestions.map(c=><button type="button" key={c.id} onMouseDown={e=>e.preventDefault()} onClick={()=>chooseCustomer(c)} className="kif-autocomplete-option"><span className="kif-autocomplete-icon"><Building2 size={16}/></span><span className="kif-autocomplete-copy"><span className="kif-autocomplete-name">{c.company_name}</span></span><ChevronRight size={15} className="kif-autocomplete-arrow"/></button>)}</div>}</label><label className="relative block text-sm font-medium text-gray-700">Email<input value={draft.email} onFocus={()=>setSuggestionField("email")} onChange={e=>{setDraft(d=>({...d,email:e.target.value}));setSelectedCustomerId("");setSuggestionField("email");}} autoComplete="off" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#b5121b]" placeholder="Type email to find an existing company"/>{suggestionField==="email"&&customerSuggestions.length>0&&<div className="kif-autocomplete-menu absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto"><div className="kif-autocomplete-heading">MATCHING EMAILS</div>{customerSuggestions.map(c=><button type="button" key={c.id} onMouseDown={e=>e.preventDefault()} onClick={()=>chooseCustomer(c)} className="kif-autocomplete-option"><span className="kif-autocomplete-icon"><Building2 size={16}/></span><span className="kif-autocomplete-copy"><span className="kif-autocomplete-name">{c.company_name}</span><span className="kif-autocomplete-email">{c.email||"No email"}</span></span><ChevronRight size={15} className="kif-autocomplete-arrow"/></button>)}</div>}</label>{([{key:"contact_name",label:"Contact Person"},{key:"phone",label:"Contact Details / Phone"},{key:"source_status",label:"Source Status"},{key:"stand_no",label:"Stand No."},{key:"area_sqm",label:"Area (sqm)",type:"number"},{key:"stand_type",label:"Stand Type"},{key:"source_country",label:"Country"},{key:"hall",label:"Hall"}] as const).map(field=><label key={field.key} className="block text-sm font-medium text-gray-700">{field.label}<input type={"type" in field?field.type:"text"} min={"type" in field&&field.type==="number"?0:undefined} step={"type" in field&&field.type==="number"?"any":undefined} value={draft[field.key]} onChange={e=>setDraft(d=>({...d,[field.key]:e.target.value}))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#b5121b]"/></label>)}</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={()=>{setEditor(false);setSuggestionField(null);}} className="rounded-lg border px-4 py-2">Cancel</button><button type="submit" disabled={busy} className="rounded-lg bg-[var(--vega-primary)] px-5 py-2 font-semibold text-white shadow-md disabled:opacity-50">{busy?"Saving…":"Save Exhibitor"}</button></div></form></div>}
      <p className="kif-note">The Main Database is the central company directory. Project views show each exhibition’s separate exhibitor participation, booth and stand details. Company suggestions are searched from the central database.</p>
    </div>
  </main>;
}
