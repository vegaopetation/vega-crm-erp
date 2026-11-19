"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";

type Role = "admin" | "project_director" | "sales" | "operations" | "viewer";
type Row = Record<string, string | number | null>;
type Field = { key: string; label: string; type?: string; options?: string[]; optional?: boolean; initial?: string };
type Resource = { table: string; label: string; fields: Field[]; scope?: string };
const projectRoles = ["project_director", "sales", "operations", "viewer"];
const staffRoles = ["admin", ...projectRoles];
const boothStatuses = ["available", "reserved", "sold", "blocked"];
const field = (key: string, label: string, options: Omit<Field, "key" | "label"> = {}): Field => ({key, label, ...options});

const projects: Resource = { table: "projects", label: "Project", fields: [
  field("name", "Name"), field("code", "Code"), field("city", "City", { optional: true }),
  field("country", "Country", { optional: true }), field("starts_on", "Start date", { type: "date", optional: true }),
  field("ends_on", "End date", { type: "date", optional: true }),
  field("status", "Status", { options: ["planning", "live", "at_risk", "completed"], initial: "planning" }),
  field("default_currency", "Currency", { initial: "USD" }),
] };
const exhibitors: Resource = { table: "exhibitors", label: "Exhibitor", scope: "project_id", fields: [
  field("name", "Name"), field("contact_email", "Email", { type: "email", optional: true }),
] };
const halls: Resource = { table: "halls", label: "Hall", scope: "project_id", fields: [
  field("name", "Name"), field("sort_order", "Sort order", { type: "number", initial: "0" }),
] };
const booths: Resource = { table: "booths", label: "Booth", scope: "hall_id", fields: [
  field("code", "Code"), field("x", "X", { type: "number", initial: "0" }),
  field("y", "Y", { type: "number", initial: "0" }), field("width", "Width", { type: "number", initial: "1" }),
  field("height", "Height", { type: "number", initial: "1" }), field("status", "Status", { options: boothStatuses }),
  field("exhibitor_name", "Exhibitor name", { optional: true }),
] };
const finance: Resource = { table: "finance_records", label: "Finance record", scope: "project_id", fields: [
  field("description", "Description"), field("amount", "Amount", { type: "number" }),
  field("currency", "Currency", { initial: "USD" }),
] };
const reports: Resource = { table: "project_reports", label: "Report", scope: "project_id", fields: [
  field("title", "Title"), field("body", "Report text", { type: "textarea" }),
] };
const staff: Resource = { table: "profiles", label: "Staff profile", fields: [
  field("full_name", "Full name"), field("role", "Staff role", { options: staffRoles }),
] };
const assignments: Resource = { table: "project_members", label: "Assignment", scope: "project_id", fields: [
  field("role", "Project role", { options: projectRoles }),
] };

function RecordEditor({ resource, row, fields = resource.fields, createFields = [], scopeId, identity,
  editable, removable, onSaved }: {
  resource: Resource; row?: Row; fields?: Field[]; createFields?: Field[]; scopeId?: string;
  identity?: Record<string, string>; editable?: boolean; removable?: boolean; onSaved: () => void;
}) {
  const [editing, setEditing] = useState(!row);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formFields = row ? fields : [...createFields, ...fields];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values: Row = {};
    for (const input of formFields) {
      const value = String(data.get(input.key) ?? "").trim();
      if (row && value === String(row[input.key] ?? "")) continue;
      if (!row && !value && input.initial) continue;
      values[input.key] = value || null;
    }
    if (row && !Object.keys(values).length) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError("");
    const query = supabase.from(resource.table);
    const result = row
      ? await query.update(values).match(identity ?? {id: row.id}).select()
      : await query.insert({...values, ...(resource.scope && scopeId ? {[resource.scope]: scopeId} : {})}).select();
    setBusy(false);
    if (result.error || !result.data?.length) {
      setError(result.error?.message ?? "Access changed. Refresh and try again.");
      return;
    }
    setEditing(false);
    onSaved();
  }

  async function remove() {
    if (!window.confirm(`Delete this ${resource.label.toLowerCase()}?`)) return;
    setBusy(true);
    setError("");
    const {data, error} = await supabase.from(resource.table).delete().match(identity ?? {id: row?.id}).select();
    setBusy(false);
    if (error || !data?.length) {
      setError(error?.message ?? "Access changed. Refresh and try again.");
      return;
    }
    onSaved();
  }

  return <article className="permission-record">
    {!editing && row && <>
      <dl>{resource.fields.map(({key, label}) => <div key={key}><dt>{label}</dt><dd>{row[key] ?? "—"}</dd></div>)}</dl>
      {editable && <button className="new" type="button" onClick={() => setEditing(true)}>Edit {resource.label.toLowerCase()}</button>}
      {removable && <button type="button" disabled={busy} onClick={remove}>Delete {resource.label.toLowerCase()}</button>}
    </>}
    {editing && <form onSubmit={save}>
      {formFields.map(input => {
        const value = String(row?.[input.key] ?? input.initial ?? "");
        return <label key={input.key}>{input.label}
          {input.options ? <select name={input.key} defaultValue={value || input.options[0]} required={!input.optional}>
            {input.options.map(option => <option key={option}>{option}</option>)}
          </select> : input.type === "textarea" ? <textarea name={input.key} defaultValue={value} required={!input.optional} />
            : <input name={input.key} type={input.type ?? "text"} step={input.type === "number" ? "any" : undefined}
              defaultValue={value} required={!input.optional} />}
        </label>;
      })}
      <button className="new" disabled={busy}>{row ? "Save changes" : `Add ${resource.label.toLowerCase()}`}</button>
      {row && <button type="button" onClick={() => setEditing(false)}>Cancel</button>}
    </form>}
    {error && <p role="alert">{error}</p>}
  </article>;
}

function ResourceList({resource, scopeId, isAdmin, canEdit, canCreate, fields, createFields, rowIdentity, rowLabel, exportReport}: {
  resource: Resource; scopeId?: string; isAdmin: boolean; canEdit: boolean; canCreate: boolean;
  fields?: (row: Row) => Field[]; createFields?: Field[];
  rowIdentity?: (row: Row) => Record<string, string>; rowLabel?: (row: Row) => string;
  exportReport?: boolean;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion(v => v + 1);
  useEffect(() => {
    let active = true;
    const query = supabase.from(resource.table).select("*");
    const request = resource.scope && scopeId ? query.eq(resource.scope, scopeId) : query;
    void request.then(({data, error}) => {
      if (!active) return;
      setRows(data ?? []);
      setError(error?.message ?? "");
    });
    return () => { active = false; };
  }, [resource, scopeId, version]);
  return <>
    {error && <p role="alert">{error}</p>}
    {rows === null && <p role="status">Loading…</p>}
    {rows?.length === 0 && !error && <p>No records.</p>}
    {rows?.map(row => <section key={String(row.id ?? row.user_id)}>
      {rowLabel && <h3>{rowLabel(row)}</h3>}
      <RecordEditor resource={resource} row={row} fields={fields?.(row)} identity={rowIdentity?.(row)}
        editable={canEdit && (!fields || fields(row).length > 0)} removable={isAdmin} onSaved={refresh} />
      {exportReport && <button type="button" onClick={() => {
        const url = URL.createObjectURL(new Blob([String(row.body)], {type:"text/plain;charset=utf-8"}));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${row.title}.txt`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Export report</button>}
    </section>)}
    {canCreate && <details><summary>Add {resource.label.toLowerCase()}</summary>
      <RecordEditor key={version} resource={resource} scopeId={scopeId} createFields={createFields} onSaved={refresh} />
    </details>}
  </>;
}

function BoothInventory({projectId, role}: {projectId: string; role: Role | null}) {
  const [hallRows, setHallRows] = useState<Row[]>([]);
  const [hallId, setHallId] = useState("");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const isAdmin = role === "admin";
  const canEditLayout = isAdmin || role === "project_director" || role === "operations";
  useEffect(() => {
    let active = true;
    void supabase.from("halls").select("*").eq("project_id", projectId).order("sort_order").then(({data, error}) => {
      if (!active) return;
      const rows = data ?? [];
      setHallRows(rows);
      setHallId(value => rows.some(row => row.id === value) ? value : String(rows[0]?.id ?? ""));
      setError(error?.message ?? "");
    });
    return () => { active = false; };
  }, [projectId, version]);
  const refreshHalls = () => setVersion(value => value + 1);
  const hall = hallRows.find(row => row.id === hallId);
  return <>
    {error && <p role="alert">{error}</p>}
    {hallRows.length > 0 ? <label>Hall<select value={hallId} onChange={event => setHallId(event.target.value)}>
      {hallRows.map(row => <option key={String(row.id)} value={String(row.id)}>{row.name}</option>)}
    </select></label> : <p>No halls.</p>}
    {hall && <>
      <RecordEditor key={hallId} resource={halls} row={hall} editable={canEditLayout} removable={isAdmin} onSaved={refreshHalls} />
      <ResourceList key={hallId} resource={booths} scopeId={hallId} isAdmin={isAdmin}
        canEdit={canEditLayout || role === "sales"} canCreate={isAdmin} fields={row => {
          if (role === "sales") return row.status === "available"
            ? [field("status", "Status", {options: ["reserved"], initial: "reserved"}), field("exhibitor_name", "Exhibitor name")] : [];
          if (role === "operations") {
            const layout = booths.fields.slice(0, 5);
            return row.status === "available" || row.status === "blocked"
              ? [...layout, field("status", "Status", {options: ["available", "blocked"]})] : layout;
          }
          return booths.fields;
        }} />
    </>}
    {isAdmin && <details><summary>Add hall</summary>
      <RecordEditor key={version} resource={halls} scopeId={projectId} onSaved={refreshHalls} />
    </details>}
  </>;
}

export function ProjectWorkspace({userId, isAdmin}: {userId: string; isAdmin: boolean}) {
  const [data, setData] = useState<{ projects: Row[]; roles: Record<string, Role> } | null>(null);
  const [projectId, setProjectId] = useState("");
  const [view, setView] = useState("Project");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from("projects").select("*").order("name"),
      supabase.from("project_members").select("project_id, role").eq("user_id", userId),
    ]).then(([projects, memberships]) => {
      if (!active) return;
      if (projects.error || memberships.error) {
        setError(projects.error?.message ?? memberships.error?.message ?? "");
        setData(null);
        return;
      }
      setError("");
      setData({projects: projects.data, roles: Object.fromEntries(memberships.data.map(({project_id, role}) => [project_id, role]))});
      setProjectId(id => projects.data.some(p => p.id === id) ? id : projects.data[0]?.id ?? "");
    });
    return () => { active = false; };
  }, [userId, version]);

  const project = data?.projects.find(row => row.id === projectId);
  const role = isAdmin ? "admin" : data?.roles[projectId] ?? null;
  const director = role === "project_director";
  const sales = role === "sales";
  const canViewFinancials = isAdmin || director;
  const tabs = ["Project", "Exhibitors", "Booth inventory"];
  if (canViewFinancials) tabs.push("Finance", "Reports");
  if (isAdmin) tabs.push("Assignments");
  const activeView = tabs.includes(view) ? view : "Project";

  return <section className="content permission-workspace">
    <header><b>Exhibition projects</b></header>
    {error && <p role="alert">{error}</p>}
    {!error && !data && <p role="status">Loading projects…</p>}
    {data?.projects.length === 0 && <p>No projects are assigned to your account.</p>}
    {data && data.projects.length > 0 && <label>Project<select value={projectId}
      onChange={event => { setProjectId(event.target.value); setView("Project"); }}>
      {data.projects.map(row => <option key={String(row.id)} value={String(row.id)}>{row.name}</option>)}
    </select></label>}
    {project && <>
      <div aria-label="Project workspaces" className="permission-tabs">
        {tabs.map(tab => <button type="button" key={tab} aria-pressed={tab === activeView} onClick={() => setView(tab)}>{tab}</button>)}
      </div>
      <section key={`${projectId}:${activeView}`}>
        <h1>{activeView}</h1>
        {activeView === "Project" && <RecordEditor resource={projects} row={project} editable={isAdmin || director}
          removable={isAdmin} onSaved={refresh} />}
        {activeView === "Exhibitors" && <ResourceList resource={exhibitors} scopeId={projectId} isAdmin={isAdmin}
          canEdit={isAdmin || director || sales} canCreate={isAdmin || sales} />}
        {activeView === "Booth inventory" && <BoothInventory projectId={projectId} role={role} />}
        {activeView === "Finance" && <ResourceList resource={finance} scopeId={projectId} isAdmin={isAdmin}
          canEdit={canViewFinancials} canCreate={isAdmin} />}
        {activeView === "Reports" && <ResourceList resource={reports} scopeId={projectId} isAdmin={isAdmin}
          canEdit={isAdmin} canCreate={isAdmin} exportReport />}
        {activeView === "Assignments" && <ResourceList resource={assignments} scopeId={projectId} isAdmin
          canEdit canCreate createFields={[field("user_id", "Staff user ID")]}
          rowIdentity={row => ({project_id: projectId, user_id: String(row.user_id)})}
          rowLabel={row => String(row.user_id)} />}
      </section>
    </>}
    {isAdmin && data && <>
      <details><summary>Add project</summary><RecordEditor key={version} resource={projects} onSaved={refresh} /></details>
      <details><summary>Staff profiles</summary><ResourceList resource={staff} isAdmin canEdit canCreate
        createFields={[field("id", "Supabase Auth user ID")]} rowLabel={row => String(row.id)} /></details>
    </>}
  </section>;
}
