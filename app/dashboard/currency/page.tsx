"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, RefreshCw, Save, Wallet } from "lucide-react";
import { createClient } from "../../../lib/supabase";

type RateResponse = { data: { currency: string; rates: Record<string,string> } };
type CurrencyListResponse = { data: Array<{id:string;name:string}> };
const common = ["USD","AED","KWD","BHD","SAR","QAR","OMR","EUR","GBP","INR","PKR","CNY","JPY","CHF","CAD","AUD"];
const labels: Record<string,string> = {
 USD:"US Dollar",AED:"UAE Dirham",KWD:"Kuwaiti Dinar",BHD:"Bahraini Dinar",SAR:"Saudi Riyal",
 QAR:"Qatari Riyal",OMR:"Omani Rial",EUR:"Euro",GBP:"British Pound",INR:"Indian Rupee",
 PKR:"Pakistani Rupee",CNY:"Chinese Yuan",JPY:"Japanese Yen",CHF:"Swiss Franc",CAD:"Canadian Dollar",AUD:"Australian Dollar"
};
export default function CurrencyConverterPage() {
 const supabase = useMemo(() => createClient(), []);
 const [rates,setRates] = useState<Record<string,number>>({});
 const [updated,setUpdated] = useState("");
 const [currencyOptions,setCurrencyOptions] = useState<Array<{id:string;name:string}>>(common.map(id=>({id,name:labels[id]||id})));
 const [from,setFrom] = useState("USD");
 const [to,setTo] = useState("AED");
 const [amount,setAmount] = useState("1");
 const [loading,setLoading] = useState(true);
 const [saving,setSaving] = useState(false);
 const [error,setError] = useState("");
 const [notice,setNotice] = useState("");
 const [filter,setFilter] = useState("");
 const [history,setHistory] = useState<any[]>([]);
 async function loadHistory() { const {data,error:e}=await supabase.from("currency_rate_snapshots").select("id,base_currency,quote_currency,exchange_rate,provider,captured_at,provider_updated_at").order("captured_at",{ascending:false}).limit(20); if(!e)setHistory(data||[]); }
 async function refresh() {
  setLoading(true); setError("");
  try {
   const [response,currencyResponse] = await Promise.all([
    fetch("https://api.coinbase.com/v2/exchange-rates?currency=USD",{cache:"no-store"}),
    fetch("https://api.coinbase.com/v2/currencies",{cache:"no-store"})
   ]);
   if(!response.ok) throw new Error("Exchange-rate provider returned HTTP "+response.status);
   const data = await response.json() as RateResponse;
   if(!data.data?.rates) throw new Error("Exchange-rate provider did not return valid rates.");
   setRates(Object.fromEntries(Object.entries(data.data.rates).map(([code,value])=>[code,Number(value)])));
   setUpdated(new Date().toISOString());
   if(currencyResponse.ok){const currencyData=await currencyResponse.json() as CurrencyListResponse; if(Array.isArray(currencyData.data))setCurrencyOptions(currencyData.data.filter(x=>data.data.rates[x.id]).map(x=>({id:x.id,name:x.name})));}
  } catch(e:any) { setError(e?.message || "Could not load exchange rates."); }
  finally { setLoading(false); }
 }
 useEffect(()=>{ refresh(); loadHistory(); },[]);
 const codes = useMemo(()=>currencyOptions.filter(x=>!filter || (x.id+" "+x.name).toLowerCase().includes(filter.toLowerCase())).map(x=>x.id),[currencyOptions,filter]);
 const rate = rates[from] && rates[to] ? rates[to]/rates[from] : (from===to?1:0);
 const result = Number(amount||0)*rate;
 async function saveSnapshot() {
  if(!rate) return;
  setSaving(true); setNotice("");
  const {error:e}=await supabase.from("currency_rate_snapshots").insert({
   base_currency:from,quote_currency:to,exchange_rate:rate,provider:"Coinbase public exchange rates",
   provider_updated_at:updated ? new Date(updated).toISOString() : null
  });
  setSaving(false);
  setNotice(e ? "Could not save exchange-rate history: "+e.message : "Exchange-rate snapshot saved."); if(!e) await loadHistory();
 }
 return <main style={{minHeight:"100vh",background:"#f4f4f6",padding:"28px",color:"#202126",fontFamily:"Inter,Arial,sans-serif"}}>
  <div style={{maxWidth:1050,margin:"0 auto"}}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:24}}>
    <div><div style={{fontSize:10,fontWeight:800,letterSpacing:1.4,color:"#c9252c"}}>VEGA FINANCE & OPERATIONS</div><h1 style={{fontSize:30,margin:"7px 0"}}>Live Currency Converter</h1><p style={{color:"#777",fontSize:13,margin:0}}>USD is the default base currency. Convert between supported currencies.</p></div>
    <button onClick={refresh} disabled={loading} style={btn}><RefreshCw size={15}/> Refresh rates</button>
   </div>
   <section style={{background:"#fff",border:"1px solid #e3e4e8",borderRadius:16,padding:24,boxShadow:"0 8px 28px #0000000a"}}>
    <label style={{...field,marginBottom:14}}>Search currency<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search by currency code or name" style={selectStyle}/></label>
    <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:14,alignItems:"end"}}>
     <label style={field}>You send
      <input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)} style={amountInput}/>
      <select value={from} onChange={e=>setFrom(e.target.value)} style={selectStyle}>{codes.map(c=><option key={c} value={c}>{c} — {labels[c]||c}</option>)}</select>
     </label>
     <button aria-label="Swap currencies" onClick={()=>{setFrom(to);setTo(from)}} style={{...btn,marginBottom:2}}><ArrowDownUp size={17}/></button>
     <label style={field}>They receive
      <div style={{...amountInput,background:"#fafafa",minHeight:46,display:"flex",alignItems:"center",fontSize:23,fontWeight:800,overflowWrap:"anywhere"}}>{loading?"Loading…":rate?result.toLocaleString(undefined,{maximumFractionDigits:6}):"—"}</div>
      <select value={to} onChange={e=>setTo(e.target.value)} style={selectStyle}>{codes.map(c=><option key={c} value={c}>{c} — {labels[c]||c}</option>)}</select>
     </label>
    </div>
    <div style={{marginTop:22,padding:16,background:"#fafafa",borderRadius:10,display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
     <div><div style={{fontSize:11,color:"#777"}}>Exchange rate</div><strong>1 {from} = {rate?rate.toLocaleString(undefined,{maximumFractionDigits:8}):"—"} {to}</strong></div>
     <div><div style={{fontSize:11,color:"#777"}}>Fetched at</div><strong>{updated||"Not available"}</strong></div>
     <div><div style={{fontSize:11,color:"#777"}}>Rate source</div><strong>{"Live public FX feed"}</strong></div>
    </div>
    {error&&<p style={{color:"#b4232d",fontSize:12}}>{error} Existing saved rates are not represented as live rates.</p>}
    {notice&&<p style={{color:"#24734b",fontSize:12}}>{notice}</p>}
    <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><button style={btnPrimary} onClick={saveSnapshot} disabled={!rate||saving}>{saving?"Saving…":<><Save size={15}/> Save rate snapshot</>}</button></div>
   </section>
   <section style={{marginTop:18,background:"#fff",border:"1px solid #e3e4e8",borderRadius:12,padding:18}}>
    <h2 style={{fontSize:14,margin:"0 0 12px"}}>Saved exchange-rate history</h2>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr>{["Pair","Rate","Provider","Captured at"].map(h=><th key={h} style={{textAlign:"left",padding:9,borderBottom:"1px solid #eee",color:"#777"}}>{h}</th>)}</tr></thead><tbody>{history.map(row=><tr key={row.id}><td style={{padding:9,borderBottom:"1px solid #f0f0f0"}}>{row.base_currency}/{row.quote_currency}</td><td style={{padding:9,borderBottom:"1px solid #f0f0f0"}}>{Number(row.exchange_rate).toFixed(8)}</td><td style={{padding:9,borderBottom:"1px solid #f0f0f0"}}>{row.provider}</td><td style={{padding:9,borderBottom:"1px solid #f0f0f0"}}>{new Date(row.captured_at).toLocaleString()}</td></tr>)}</tbody></table></div>
    {!history.length&&<p style={{fontSize:11,color:"#888"}}>No saved rate snapshots yet. Select Save rate snapshot to preserve a rate for future reference.</p>}
   </section>
   <section style={{marginTop:18,background:"#fff",border:"1px solid #e3e4e8",borderRadius:12,padding:18}}>
    <h2 style={{fontSize:14,margin:"0 0 8px"}}>Rate information</h2>
    <p style={{fontSize:12,color:"#666",lineHeight:1.6,margin:0}}>The converter fetches current public exchange rates from Coinbase when opened or refreshed. The displayed fetched time records when VEGA retrieved the rates; these indicative rates are not bank settlement quotes and should be confirmed with your bank before financial settlement.</p>
    <p style={{fontSize:11,margin:"10px 0 0"}}><a href="https://api.coinbase.com/v2/exchange-rates?currency=USD" target="_blank" rel="noreferrer" style={{color:"#b21f29"}}>Coinbase public exchange-rate feed</a></p>
   </section>
  </div>
 </main>;
}
const btn:React.CSSProperties={display:"inline-flex",alignItems:"center",gap:8,padding:"10px 13px",border:"1px solid #dedfe5",borderRadius:9,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"};
const btnPrimary:React.CSSProperties={...btn,background:"#c9252c",borderColor:"#c9252c",color:"#fff"};
const field:React.CSSProperties={display:"flex",flexDirection:"column",gap:9,fontSize:12,fontWeight:700,color:"#555"};
const amountInput:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"12px",border:"1px solid #dedfe5",borderRadius:9,fontSize:22,color:"#202126"};
const selectStyle:React.CSSProperties={width:"100%",padding:"10px",border:"1px solid #dedfe5",borderRadius:9,background:"#fff",fontSize:12,color:"#202126"};
