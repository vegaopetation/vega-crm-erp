"use client";
import { FormEvent, useState } from "react";
import { createClient } from "../../lib/supabase/client";
export default function LoginPage() {
  const [message, setMessage] = useState("");
  async function signIn(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const { error } = await createClient().auth.signInWithPassword({ email: String(data.get("email")), password: String(data.get("password")) }); setMessage(error ? error.message : "Welcome back. Opening your workspace…"); if (!error) window.location.assign("/"); }
  return <main className="login-page"><section className="login-brand"><div className="brand-mark">V</div><p>VEGA INTERTRADE & EXHIBITIONS</p><h1>The operating system<br/>for remarkable events.</h1><span>VEGA CRM 2.0 · Phase 01</span></section><section className="login-card"><p>SECURE ACCESS</p><h2>Welcome to VEGA</h2><span>Sign in with your authorised work account.</span><form onSubmit={signIn}><label>Work email<input type="email" name="email" required placeholder="you@vega.com" /></label><label>Password<input type="password" name="password" required placeholder="••••••••" /></label><button className="full">Sign in securely →</button></form>{message && <div className="login-message">{message}</div>}<small>Access is controlled by your VEGA role and project assignment.</small></section></main>;
}
