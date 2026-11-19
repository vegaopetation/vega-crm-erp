"use client";
import {useEffect,useState} from "react";
import type {Session, User} from "@supabase/supabase-js";
import { ProjectWorkspace } from "./project-workspace";
import {supabase} from "../lib/supabase";
const roleLabels: Record<string, string> = {
  admin: "Administrator",
  project_director: "Project Director",
  sales: "Sales",
  operations: "Operations",
  viewer: "Viewer",
};

type Profile = { full_name: string; role: string };

export default function Home() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [verified, setVerified] = useState<{
    userId: string;
    user: User | null;
    profile: Profile | null;
  } | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [isLoginPage, setIsLoginPage] = useState(false);

  useEffect(() => {
    setRecovery(new URLSearchParams(window.location.search).get("reset") === "1");
    setIsLoginPage(window.location.pathname === "/login");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) setVerified(null);
      setSession(nextSession);
    });

    function recheckRestoredPage(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }

    window.addEventListener("pageshow", recheckRestoredPage);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pageshow", recheckRestoredPage);
    };
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function verifySession(expectedUserId: string) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (cancelled) return;

        if (error || user?.id !== expectedUserId) {
          setVerified({ userId: expectedUserId, user: null, profile: null });
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .maybeSingle();

        if (!cancelled) setVerified({ userId: expectedUserId, user, profile });
      } catch {
        if (!cancelled) setVerified({ userId: expectedUserId, user: null, profile: null });
      }
    }

    void verifySession(userId);
    return () => { cancelled = true; };
  }, [userId]);

  const currentIdentity = verified?.userId === userId ? verified : null;
  const authReady = session === null || currentIdentity !== null;
  const user = currentIdentity?.user ?? null;

  useEffect(() => {
    if (!authReady || recovery) return;
    if (!user && !isLoginPage) window.location.replace("/login");
    if (user && isLoginPage) window.location.replace("/");
  }, [authReady, isLoginPage, recovery, user]);

  if (authReady && (recovery || (!user && isLoginPage))) {
    return <AuthGate recovery={recovery} onRecoveryComplete={() => {
      history.replaceState({}, "", window.location.pathname);
      setRecovery(false);
    }} />;
  }

  if (!authReady || !user || isLoginPage) {
    return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#08090d",color:"#fff",fontFamily:"Arial"}}>Loading secure VEGA workspace…</div>;
  }

  return <Dashboard key={user.id} user={user} profile={currentIdentity?.profile ?? null} />;
}

function Dashboard({ user, profile }: { user: User; profile: Profile | null }) {
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [activeSection, setActiveSection] = useState("Overview");
  const [canViewFinancials, setCanViewFinancials] = useState(profile?.role === "admin");
  const menuItems = ["Overview", "Exhibition Projects", "Exhibitors", "Booth Inventory", "Finance", "Reports", "Staff & Permissions"];
  const visibleMenu = menuItems.filter(item =>
    (item !== "Staff & Permissions" || profile?.role === "admin") &&
    (!["Finance", "Reports"].includes(item) || canViewFinancials)
  );
  const name = profile?.full_name?.trim() || user.email || user.phone || "VEGA user";
  const initials = profile?.full_name?.trim()
    ? name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()
    : name.slice(0, 2).toUpperCase();
  const role = profile ? roleLabels[profile.role] ?? profile.role : "Role unavailable";

  async function logout() {
    setSigningOut(true);
    setLogoutError("");

    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch {
      setLogoutError("Could not log out. Try again.");
      setSigningOut(false);
    }
  }

  return (
    <main className="shell">
      <aside>
        <div className="brand"><b>V</b><span><strong>VEGA</strong><small>INTERTRADE &amp; EXHIBITIONS</small></span></div>
        <p className="work"><i/> VEGA CRM 2.0</p>
        <nav className="vega-sidebar-nav" aria-label="Main navigation">
          {visibleMenu.map(item => <button key={item} type="button"
            className={activeSection === item ? "on" : ""}
            aria-current={activeSection === item ? "page" : undefined}
            onClick={() => setActiveSection(item)} title={item}>
            <span>{item}</span>
          </button>)}
        </nav>
        <div className="user"><i aria-hidden="true">{initials}</i><span><b>{name}</b><small>{role}</small></span></div>
        <button type="button" className="logout" onClick={logout} disabled={signingOut}>
          {signingOut ? "Signing out…" : "Logout"}
        </button>
        {logoutError && <p className="logout-error" role="alert">{logoutError}</p>}
      </aside>
      {profile ? <ProjectWorkspace userId={user.id} isAdmin={profile.role === "admin"} activeSection={activeSection} onFinancialAccessChange={setCanViewFinancials} /> : (
        <section className="content">
          <h1>Access pending</h1>
          <p>Your CRM workspace will be available after a staff profile is assigned.</p>
        </section>
      )}
    </main>
  );
}
function AuthGate({recovery=false,onRecoveryComplete}:{recovery?:boolean;onRecoveryComplete?:()=>void}){const [mode,setMode]=useState<"signin"|"signup"|"request">("signin"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);const isReset=recovery||mode==="request";async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");let error:{message:string}|null=null;if(recovery){({error}=await supabase.auth.updateUser({password}));if(!error){setMessage("Password updated. Opening your workspace…");onRecoveryComplete?.();}}else if(mode==="request"){({error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+"/?reset=1"}));if(!error)setMessage("If that email has an account, a reset link has been sent.");}else{const credentials={email:email.trim(),password};const result=mode==="signin"?await supabase.auth.signInWithPassword(credentials):await supabase.auth.signUp({...credentials,options:{emailRedirectTo:window.location.origin}});error=result.error;if(!error)setMessage(mode==="signin"?"Signed in — opening your workspace.":"Check your email to confirm your secure VEGA account.");}setBusy(false);if(error)setMessage(error.message)}return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"radial-gradient(circle at top right,#401010,#08090d 55%)",fontFamily:"Arial, sans-serif"}}><form onSubmit={submit} style={{width:"min(430px,100%)",padding:36,border:"1px solid #ffffff22",borderRadius:20,background:"#121319",boxShadow:"0 30px 80px #0008",color:"#fff"}}><div style={{color:"#e21b23",fontSize:36,fontWeight:900,letterSpacing:3}}>VEGA</div><p style={{marginTop:4,color:"#babcc5",fontSize:12,letterSpacing:1}}>INTERTRADE & EXHIBITIONS</p><h1 style={{fontSize:28,margin:"32px 0 8px"}}>{recovery?"Set a new password":mode==="request"?"Reset your password":mode==="signin"?"Welcome back":"Request secure access"}</h1><p style={{color:"#9fa1aa",lineHeight:1.5}}>{recovery?"Choose a new password for your VEGA CRM account.":mode==="request"?"We will send a secure password-reset link to your email.":"VEGA CRM 2.0 uses role-based access for exhibition operations."}</p>{!recovery&&<label style={{display:"grid",gap:8,marginTop:24,fontSize:13}}>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" style={{padding:13,borderRadius:8,border:"1px solid #ffffff2b",background:"#090a0e",color:"#fff"}}/></label>}{mode!=="request"&&<label style={{display:"grid",gap:8,marginTop:16,fontSize:13}}>{recovery?"New password":"Password"}<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" style={{padding:13,borderRadius:8,border:"1px solid #ffffff2b",background:"#090a0e",color:"#fff"}}/></label>}{message&&<p role="status" style={{color:"#f0b4b4",fontSize:13,lineHeight:1.5}}>{message}</p>}<button disabled={busy} style={{width:"100%",marginTop:24,padding:14,border:0,borderRadius:8,background:"#e21b23",color:"#fff",fontWeight:800,cursor:"pointer"}}>{busy?"Please wait…":recovery?"Save new password":mode==="request"?"Send reset link":mode==="signin"?"Sign in":"Create secure account"}</button>{!recovery&&<><button type="button" onClick={()=>{setMode(mode==="signin"?"signup":"signin");setMessage("")}} style={{width:"100%",marginTop:12,padding:10,border:0,background:"transparent",color:"#fff",cursor:"pointer"}}>{mode==="signin"?"New staff member? Create your account":"Already have access? Sign in"}</button>{mode==="signin"&&<button type="button" onClick={()=>{setMode("request");setMessage("")}} style={{width:"100%",padding:10,border:0,background:"transparent",color:"#f0b4b4",cursor:"pointer"}}>Forgot password?</button>}{mode==="request"&&<button type="button" onClick={()=>{setMode("signin");setMessage("")}} style={{width:"100%",padding:10,border:0,background:"transparent",color:"#fff",cursor:"pointer"}}>Back to sign in</button>}</>}<p style={{marginTop:24,color:"#777",fontSize:12,lineHeight:1.5}}>Assigned roles are granted only from VEGA’s secure staff records.</p></form></main>}
