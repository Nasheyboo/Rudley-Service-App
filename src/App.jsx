import React, { useState, useEffect, useMemo } from "react";
import {
  Plus, ArrowLeft, Trash2, Share2, Mail, Printer, Check,
  ChevronRight, Search, Pencil, MapPin, FileText,
  Receipt, Users, LayoutGrid, Settings, ArrowRightLeft, Copy,
  CircleCheck, Clock, AlertCircle, Ban, Wallet, Wrench, Hammer,
  ClipboardList, CalendarClock, MoreHorizontal, PlayCircle
} from "lucide-react";

/* ---------------------------------------------------------
   NOTE: icon, manifest, fonts, and theme-color meta tags now
   live as static tags in index.html — no need to inject them
   from JS on a real deployed site the way the artifact
   version had to.
---------------------------------------------------------- */

/* ---------------------------------------------------------
   STORAGE
   SHARED across every phone that opens this site — Rudley
   and his help both read/write the same row in Supabase.
   Last save wins if two people edit the same thing at the
   same moment.
---------------------------------------------------------- */
import { loadAppData, saveAppData } from "./lib/storage";

const defaultData = {
  business: {
    name: "Rudley Duncombe",
    tagline: "Service Provider",
    phone: "",
    email: "",
    location: "Exuma, The Bahamas",
  },
  settings: {
    nextInvoiceNumber: 3, // continuing the count — 001, 002 already issued
    nextQuoteNumber: 1,
    quickItems: [
      { label: "Service Call", type: "labor" },
      { label: "Diagnostics", type: "labor" },
      { label: "Repair", type: "labor" },
      { label: "Installation", type: "labor" },
      { label: "Maintenance Visit", type: "labor" },
      { label: "Parts & Materials", type: "parts" },
    ],
    expenseCategories: ["Fuel", "Parts & Materials", "Tools & Equipment", "Vehicle", "Other"],
  },
  clients: [],
  documents: [],
  expenses: [],
  jobs: [],
};

async function loadData() {
  try {
    return await loadAppData();
  } catch (e) {
    console.error("Load failed", e);
    return null;
  }
}
async function saveData(data) {
  try {
    await saveAppData(data);
  } catch (e) {
    console.error("Save failed", e);
  }
}

/* ---------------------------------------------------------
   HELPERS
---------------------------------------------------------- */
const money = (n) =>
  (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const monthKey = (iso) => (iso || "").slice(0, 7);

const docLabel = (doc) =>
  doc.type === "invoice" ? `INV-${String(doc.number).padStart(3, "0")}` : `QTE-${String(doc.number).padStart(3, "0")}`;

const total = (doc) => (doc.items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0);
const laborTotal = (doc) => (doc.items || []).filter((it) => it.type !== "parts").reduce((s, it) => s + (Number(it.amount) || 0), 0);
const partsTotal = (doc) => (doc.items || []).filter((it) => it.type === "parts").reduce((s, it) => s + (Number(it.amount) || 0), 0);

const STATUS_META = {
  draft: { label: "Draft", color: "#8a8578", bg: "#EFEBE1", icon: Pencil },
  sent: { label: "Sent", color: "#2F7A78", bg: "#E4F1F0", icon: Clock },
  paid: { label: "Paid", color: "#1a3c34", bg: "#DCEAE4", icon: CircleCheck },
  overdue: { label: "Overdue", color: "#B0402F", bg: "#F7E3DE", icon: AlertCircle },
  accepted: { label: "Accepted", color: "#1a3c34", bg: "#DCEAE4", icon: CircleCheck },
  declined: { label: "Declined", color: "#B0402F", bg: "#F7E3DE", icon: Ban },
  expired: { label: "Expired", color: "#8a8578", bg: "#EFEBE1", icon: Clock },
};

const JOB_STATUS_META = {
  scheduled: { label: "Scheduled", color: "#2F7A78", bg: "#E4F1F0", icon: CalendarClock },
  in_progress: { label: "In Progress", color: "#B98A2E", bg: "#F5EBD6", icon: PlayCircle },
  completed: { label: "Completed", color: "#1a3c34", bg: "#DCEAE4", icon: CircleCheck },
  cancelled: { label: "Cancelled", color: "#8a8578", bg: "#EFEBE1", icon: Ban },
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ---------------------------------------------------------
   Cross-device sharing helpers
   - wa.me requires full international digits (no +, no
     leading 0). Bahamian numbers are often saved as a bare
     7-digit local number or a 10-digit one with the 242 area
     code but no leading "1" — both are auto-corrected here.
   - "Open" via a real anchor.click() instead of window.open():
     window.open() is unreliable inside iOS home-screen apps
     and sandboxed embeds; a real <a> tag is not.
   - Clipboard falls back through three layers since the
     modern Clipboard API can be silently blocked by
     permissions policy in embedded/sandboxed contexts.
---------------------------------------------------------- */
function toWaPhone(raw) {
  let digits = (raw || "").replace(/[^0-9]/g, "");
  digits = digits.replace(/^0+/, "");
  if (digits.length === 7) digits = "1242" + digits; // bare local Bahamas number
  else if (digits.length === 10 && digits.startsWith("242")) digits = "1" + digits; // area code, no country code
  else if (digits.length === 10) digits = "1" + digits; // generic NANP fallback
  return digits;
}

function openExternal(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      /* fall through to legacy method */
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return true;
  } catch (e) {
    /* fall through */
  }
  return false;
}

/* ---------------------------------------------------------
   ROOT APP
---------------------------------------------------------- */
export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState({ page: "dashboard" });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      const stored = await loadData();
      let merged = stored || defaultData;
      // backfill fields for anyone upgrading from an older version
      if (!merged.expenses) merged.expenses = [];
      if (!merged.jobs) merged.jobs = [];
      if (!merged.settings.expenseCategories) merged.settings.expenseCategories = defaultData.settings.expenseCategories;
      if (merged.settings.quickItems && typeof merged.settings.quickItems[0] === "string") {
        merged.settings.quickItems = merged.settings.quickItems.map((label) => ({ label, type: "labor" }));
      }
      setData(merged);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!loading && data) saveData(data);
  }, [data, loading]);

  const flash = (msg) => {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 2200);
  };

  if (loading || !data) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }} className="min-h-screen flex items-center justify-center bg-[#FAF7F0]">
        <div className="text-[#8a8578] text-sm tracking-wide">Loading ledger…</div>
      </div>
    );
  }

  return (
    <div
      style={{ fontFamily: "Inter, sans-serif" }}
      className="min-h-screen bg-[#FAF7F0] text-[#231F1A] pb-24"
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; }
          body { background: white !important; }
        }
        .ledger-num { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #D8D0BC; border-radius: 4px; }
      `}</style>

      {route.page === "dashboard" && <Dashboard data={data} setRoute={setRoute} />}
      {route.page === "list" && <DocList data={data} kind={route.kind} setRoute={setRoute} />}
      {route.page === "editor" && (
        <Editor
          data={data}
          setData={setData}
          docId={route.docId}
          kind={route.kind}
          fromQuoteId={route.fromQuoteId}
          fromJobId={route.fromJobId}
          setRoute={setRoute}
          flash={flash}
        />
      )}
      {route.page === "preview" && (
        <Preview data={data} setData={setData} docId={route.docId} setRoute={setRoute} flash={flash} />
      )}
      {route.page === "clients" && <Clients data={data} setRoute={setRoute} />}
      {route.page === "client-editor" && (
        <ClientEditor data={data} setData={setData} clientId={route.clientId} setRoute={setRoute} flash={flash} />
      )}
      {route.page === "expenses" && <Expenses data={data} setRoute={setRoute} />}
      {route.page === "expense-editor" && (
        <ExpenseEditor data={data} setData={setData} expenseId={route.expenseId} setRoute={setRoute} flash={flash} />
      )}
      {route.page === "jobs" && <Jobs data={data} setRoute={setRoute} />}
      {route.page === "job-editor" && (
        <JobEditor data={data} setData={setData} jobId={route.jobId} setRoute={setRoute} flash={flash} />
      )}
      {route.page === "settings" && <SettingsPage data={data} setData={setData} setRoute={setRoute} flash={flash} />}

      {toast && (
        <div className="no-print fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#231F1A] text-white text-sm px-4 py-2.5 rounded-full shadow-lg z-50 flex items-center gap-2">
          <Check size={14} /> {toast}
        </div>
      )}

      {!["editor", "preview", "expense-editor", "client-editor", "job-editor"].includes(route.page) && (
        <BottomNav route={route} setRoute={setRoute} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   BOTTOM NAV
---------------------------------------------------------- */
function BottomNav({ route, setRoute }) {
  const items = [
    { key: "dashboard", label: "Home", icon: LayoutGrid, page: "dashboard" },
    { key: "jobs", label: "Jobs", icon: ClipboardList, page: "jobs" },
    { key: "invoices", label: "Invoices", icon: Receipt, page: "list", kind: "invoice" },
    { key: "quotes", label: "Quotes", icon: FileText, page: "list", kind: "quote" },
    { key: "clients", label: "Clients", icon: Users, page: "clients" },
  ];
  const isActive = (it) => route.page === it.page && (it.kind ? route.kind === it.kind : true);

  return (
    <div className="no-print fixed bottom-0 left-0 right-0 bg-white border-t border-[#EAE3D2] px-1 py-2 flex justify-around z-40">
      {items.map((it) => {
        const Icon = it.icon;
        const active = isActive(it);
        return (
          <button
            key={it.key}
            onClick={() => setRoute({ page: it.page, kind: it.kind })}
            className="flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors"
          >
            <Icon size={19} color={active ? "#1a3c34" : "#A39F8F"} strokeWidth={active ? 2.4 : 2} />
            <span className="text-[9.5px] tracking-wide" style={{ color: active ? "#1a3c34" : "#A39F8F", fontWeight: active ? 600 : 500 }}>
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------
   TOP BAR
---------------------------------------------------------- */
function TopBar({ title, onBack, right }) {
  return (
    <div className="no-print sticky top-0 z-30 bg-[#FAF7F0]/95 backdrop-blur px-4 pt-5 pb-3 flex items-center justify-between border-b border-[#EAE3D2]">
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-full hover:bg-[#EFEBE1] active:scale-95 transition">
            <ArrowLeft size={20} color="#231F1A" />
          </button>
        )}
        <h1 className="ledger-num text-[19px] font-semibold text-[#1a3c34]">{title}</h1>
      </div>
      {right}
    </div>
  );
}

/* ---------------------------------------------------------
   DASHBOARD
---------------------------------------------------------- */
function Dashboard({ data, setRoute }) {
  const docs = data.documents;
  const invoices = docs.filter((d) => d.type === "invoice");
  const paid = invoices.filter((d) => d.status === "paid").reduce((s, d) => s + total(d), 0);
  const outstanding = invoices.filter((d) => d.status === "sent" || d.status === "overdue").reduce((s, d) => s + total(d), 0);
  const openQuotes = docs.filter((d) => d.type === "quote" && (d.status === "sent" || d.status === "draft")).length;

  const thisMonth = monthKey(todayISO());
  const monthExpenses = data.expenses.filter((e) => monthKey(e.date) === thisMonth).reduce((s, e) => s + Number(e.amount || 0), 0);
  const monthPaid = invoices.filter((d) => d.status === "paid" && monthKey(d.date) === thisMonth).reduce((s, d) => s + total(d), 0);
  const netThisMonth = monthPaid - monthExpenses;

  const recent = [...docs].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5);
  const upcomingJobs = [...(data.jobs || [])]
    .filter((j) => j.status === "scheduled" || j.status === "in_progress")
    .sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""))
    .slice(0, 4);

  return (
    <div>
      <div className="px-5 pt-8 pb-5">
        <p className="text-[13px] text-[#8a8578] tracking-wide">{data.business.tagline}</p>
        <h1 className="ledger-num text-[28px] font-semibold text-[#1a3c34] leading-tight">{data.business.name}</h1>
      </div>

      <div className="px-5 grid grid-cols-2 gap-3 mb-3">
        <StatCard label="Paid to date" value={`$${money(paid)}`} accent="#1a3c34" />
        <StatCard label="Outstanding" value={`$${money(outstanding)}`} accent="#B0402F" />
        <StatCard label="Open quotes" value={openQuotes} accent="#2F7A78" />
        <StatCard label="Clients" value={data.clients.length} accent="#B98A2E" />
      </div>

      <div className="px-5 mb-5">
        <div className="bg-white rounded-2xl border border-[#EAE3D2] px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#8a8578] tracking-wide mb-0.5">This month · net</p>
            <p className="ledger-num text-[18px] font-semibold" style={{ color: netThisMonth >= 0 ? "#1a3c34" : "#B0402F" }}>
              ${money(netThisMonth)}
            </p>
          </div>
          <div className="text-right text-[11px] text-[#8a8578]">
            <p>Paid in: ${money(monthPaid)}</p>
            <p>Expenses: ${money(monthExpenses)}</p>
          </div>
        </div>
      </div>

      <div className="px-5 grid grid-cols-4 gap-2 mb-7">
        <button onClick={() => setRoute({ page: "job-editor" })} className="bg-[#1a3c34] text-white rounded-2xl py-3.5 flex flex-col items-center gap-1.5 active:scale-[0.98] transition shadow-sm">
          <ClipboardList size={17} />
          <span className="text-[10.5px] font-medium">Job</span>
        </button>
        <button onClick={() => setRoute({ page: "editor", kind: "quote" })} className="bg-white border border-[#DDD4BC] text-[#1a3c34] rounded-2xl py-3.5 flex flex-col items-center gap-1.5 active:scale-[0.98] transition shadow-sm">
          <FileText size={17} />
          <span className="text-[10.5px] font-medium">Quote</span>
        </button>
        <button onClick={() => setRoute({ page: "editor", kind: "invoice" })} className="bg-white border border-[#DDD4BC] text-[#1a3c34] rounded-2xl py-3.5 flex flex-col items-center gap-1.5 active:scale-[0.98] transition shadow-sm">
          <Receipt size={17} />
          <span className="text-[10.5px] font-medium">Invoice</span>
        </button>
        <button onClick={() => setRoute({ page: "expense-editor" })} className="bg-white border border-[#DDD4BC] text-[#B98A2E] rounded-2xl py-3.5 flex flex-col items-center gap-1.5 active:scale-[0.98] transition shadow-sm">
          <Wallet size={17} />
          <span className="text-[10.5px] font-medium">Expense</span>
        </button>
      </div>

      {upcomingJobs.length > 0 && (
        <div className="px-5 mb-7">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[13px] font-semibold text-[#8a8578] tracking-wide uppercase">Upcoming Jobs</h2>
            <button onClick={() => setRoute({ page: "jobs" })} className="text-[12px] text-[#1a3c34] font-medium">See all</button>
          </div>
          <div className="flex flex-col gap-2">
            {upcomingJobs.map((job) => (
              <JobRow key={job.id} job={job} data={data} onClick={() => setRoute({ page: "job-editor", jobId: job.id })} />
            ))}
          </div>
        </div>
      )}

      <div className="px-5">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-[13px] font-semibold text-[#8a8578] tracking-wide uppercase">Recent</h2>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="Nothing recorded yet" body="Every quote and service call you log will show up here." />
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((doc) => (
              <DocRow key={doc.id} doc={doc} data={data} onClick={() => setRoute({ page: "preview", docId: doc.id })} />
            ))}
          </div>
        )}
      </div>

      <div className="px-5 mt-6 flex flex-col">
        <button onClick={() => setRoute({ page: "expenses" })} className="w-full flex items-center justify-between text-[13px] text-[#8a8578] py-2">
          <span className="flex items-center gap-1.5"><Wallet size={14} /> Expenses log</span>
          <ChevronRight size={15} />
        </button>
        <button onClick={() => setRoute({ page: "settings" })} className="w-full flex items-center justify-between text-[13px] text-[#8a8578] py-2">
          <span className="flex items-center gap-1.5"><Settings size={14} /> Business settings</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-[#EAE3D2] px-4 py-3.5">
      <p className="text-[11px] text-[#8a8578] tracking-wide mb-1">{label}</p>
      <p className="ledger-num text-[20px] font-semibold" style={{ color: accent }}>{value}</p>
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="border border-dashed border-[#D8D0BC] rounded-2xl px-5 py-8 text-center">
      <p className="text-[14px] font-medium text-[#231F1A] mb-1">{title}</p>
      <p className="text-[13px] text-[#8a8578]">{body}</p>
    </div>
  );
}

function DocRow({ doc, data, onClick }) {
  const client = data.clients.find((c) => c.id === doc.clientId);
  const meta = STATUS_META[doc.status] || STATUS_META.draft;
  const Icon = meta.icon;
  return (
    <button onClick={onClick} className="bg-white rounded-xl border border-[#EAE3D2] px-4 py-3.5 flex items-center justify-between text-left active:scale-[0.99] transition">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="ledger-num text-[13px] font-semibold text-[#1a3c34]">{docLabel(doc)}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 font-medium" style={{ color: meta.color, background: meta.bg }}>
            <Icon size={9} /> {meta.label}
          </span>
        </div>
        <p className="text-[13.5px] text-[#231F1A] truncate">{doc.clientName || client?.name || "No client"}</p>
        <p className="text-[11.5px] text-[#8a8578]">{fmtDate(doc.date)}</p>
      </div>
      <div className="text-right shrink-0 pl-3">
        <p className="ledger-num text-[15px] font-semibold text-[#231F1A]">${money(total(doc))}</p>
        <ChevronRight size={14} color="#C7BFA8" className="ml-auto mt-1" />
      </div>
    </button>
  );
}

function JobRow({ job, data, onClick }) {
  const client = data.clients.find((c) => c.id === job.clientId);
  const meta = JOB_STATUS_META[job.status] || JOB_STATUS_META.scheduled;
  const Icon = meta.icon;
  return (
    <button onClick={onClick} className="bg-white rounded-xl border border-[#EAE3D2] px-4 py-3.5 flex items-center justify-between text-left active:scale-[0.99] transition">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[13.5px] font-medium text-[#231F1A] truncate">{job.title || "Untitled job"}</span>
        </div>
        <p className="text-[12px] text-[#8a8578] truncate">{job.clientName || client?.name || "No client"}</p>
      </div>
      <div className="text-right shrink-0 pl-3">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 font-medium mb-1" style={{ color: meta.color, background: meta.bg }}>
          <Icon size={9} /> {meta.label}
        </span>
        <p className="text-[11px] text-[#8a8578]">{fmtDate(job.scheduledDate)}</p>
      </div>
    </button>
  );
}

/* ---------------------------------------------------------
   JOBS / TASKS
---------------------------------------------------------- */
function Jobs({ data, setRoute }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const jobs = (data.jobs || [])
    .filter((j) => (filter === "all" ? true : j.status === filter))
    .filter((j) => {
      const client = data.clients.find((c) => c.id === j.clientId);
      const name = (j.clientName || client?.name || "").toLowerCase();
      return !query || name.includes(query.toLowerCase()) || (j.title || "").toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));

  const statuses = ["all", "scheduled", "in_progress", "completed", "cancelled"];

  return (
    <div>
      <TopBar
        title="Jobs"
        right={
          <button onClick={() => setRoute({ page: "job-editor" })} className="bg-[#1a3c34] text-white p-2 rounded-full active:scale-95 transition">
            <Plus size={17} />
          </button>
        }
      />
      <div className="px-5 pt-4">
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39F8F]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search jobs" className="w-full bg-white border border-[#EAE3D2] rounded-xl pl-9 pr-3 py-2.5 text-[14px] outline-none focus:border-[#1a3c34]" />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-5 px-5">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap border transition"
              style={filter === s ? { background: "#1a3c34", color: "white", borderColor: "#1a3c34" } : { background: "white", color: "#8a8578", borderColor: "#EAE3D2" }}
            >
              {s === "all" ? "All" : JOB_STATUS_META[s]?.label}
            </button>
          ))}
        </div>

        {jobs.length === 0 ? (
          <EmptyState title="No jobs yet" body="Log a job when you schedule a call — turn it into a quote or invoice once it's done." />
        ) : (
          <div className="flex flex-col gap-2 pb-4">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} data={data} onClick={() => setRoute({ page: "job-editor", jobId: job.id })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JobEditor({ data, setData, jobId, setRoute, flash }) {
  const existing = jobId ? data.jobs.find((j) => j.id === jobId) : null;

  const [clientId, setClientId] = useState(existing?.clientId || "");
  const [clientName, setClientName] = useState(existing?.clientName || "");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [title, setTitle] = useState(existing?.title || "");
  const [scheduledDate, setScheduledDate] = useState(existing?.scheduledDate || todayISO());
  const [location, setLocation] = useState(existing?.location || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [status, setStatus] = useState(existing?.status || "scheduled");

  const canSave = title.trim() && (clientId || clientName.trim());

  const save = () => {
    let finalClientId = clientId;
    let workingData = data;

    if (!clientId && clientName.trim()) {
      const newClient = { id: uid(), name: clientName.trim(), phone: newClientPhone.trim(), email: newClientEmail.trim(), address: "" };
      workingData = { ...workingData, clients: [...workingData.clients, newClient] };
      finalClientId = newClient.id;
    }

    if (existing) {
      const updated = { ...existing, clientId: finalClientId, clientName: clientName.trim() || undefined, title: title.trim(), scheduledDate, location: location.trim(), notes: notes.trim(), status };
      setData({ ...workingData, jobs: workingData.jobs.map((j) => (j.id === existing.id ? updated : j)) });
      flash("Job updated");
    } else {
      const newJob = {
        id: uid(),
        clientId: finalClientId,
        clientName: clientName.trim() || undefined,
        title: title.trim(),
        scheduledDate,
        location: location.trim(),
        notes: notes.trim(),
        status,
        createdAt: new Date().toISOString(),
      };
      setData({ ...workingData, jobs: [...workingData.jobs, newJob] });
      flash("Job added");
    }
    setRoute({ page: "jobs" });
  };

  const remove = () => {
    if (!window.confirm("Delete this job?")) return;
    setData({ ...data, jobs: data.jobs.filter((j) => j.id !== existing.id) });
    setRoute({ page: "jobs" });
  };

  const createQuoteFromJob = () => setRoute({ page: "editor", kind: "quote", fromJobId: existing.id });
  const createInvoiceFromJob = () => setRoute({ page: "editor", kind: "invoice", fromJobId: existing.id });

  return (
    <div>
      <TopBar title={existing ? "Edit Job" : "New Job"} onBack={() => setRoute({ page: "jobs" })} />
      <div className="px-5 pt-4 flex flex-col gap-3 pb-8">
        <div>
          <FieldLabel>Job title</FieldLabel>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rainbird diagnostics" className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" />
        </div>

        <div>
          <FieldLabel>Client</FieldLabel>
          {data.clients.length > 0 && (
            <select value={clientId} onChange={(e) => { setClientId(e.target.value); setClientName(""); }} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34] mb-2">
              <option value="">Select existing client…</option>
              {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {!clientId && (
            <div>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Or type a new client name" className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" />
              {clientName.trim() && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="Phone (optional)" className="bg-white border border-[#EAE3D2] rounded-xl px-3 py-2.5 text-[13.5px] outline-none focus:border-[#1a3c34]" />
                  <input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="Email (optional)" className="bg-white border border-[#EAE3D2] rounded-xl px-3 py-2.5 text-[13.5px] outline-none focus:border-[#1a3c34]" />
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <FieldLabel>Scheduled date</FieldLabel>
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" />
        </div>

        <div>
          <FieldLabel>Location</FieldLabel>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Belle Mer House, Tar Bay" className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" />
        </div>

        <div>
          <FieldLabel>Status</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(JOB_STATUS_META).map(([key, m]) => (
              <button key={key} onClick={() => setStatus(key)} className="px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition flex items-center gap-1" style={status === key ? { background: "#1a3c34", color: "white", borderColor: "#1a3c34" } : { background: "white", color: "#8a8578", borderColor: "#EAE3D2" }}>
                <m.icon size={11} /> {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Notes (optional)</FieldLabel>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What's needed, parts to bring, access info…" className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14px] outline-none focus:border-[#1a3c34] resize-none" />
        </div>

        <button onClick={save} disabled={!canSave} className="mt-2 w-full bg-[#1a3c34] disabled:bg-[#C7BFA8] text-white rounded-xl py-3.5 text-[15px] font-medium active:scale-[0.99] transition">
          {existing ? "Save changes" : "Add job"}
        </button>

        {existing && (
          <>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button onClick={createQuoteFromJob} className="border border-[#DDD4BC] text-[#1a3c34] rounded-xl py-3 text-[13.5px] font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition">
                <FileText size={14} /> Make quote
              </button>
              <button onClick={createInvoiceFromJob} className="border border-[#DDD4BC] text-[#1a3c34] rounded-xl py-3 text-[13.5px] font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition">
                <Receipt size={14} /> Make invoice
              </button>
            </div>
            <button onClick={remove} className="flex items-center justify-center gap-1.5 text-[#B0402F] text-[13px] py-2">
              <Trash2 size={13} /> Delete job
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   DOC LIST
---------------------------------------------------------- */
function DocList({ data, kind, setRoute }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const docs = data.documents
    .filter((d) => d.type === kind)
    .filter((d) => (filter === "all" ? true : d.status === filter))
    .filter((d) => {
      const client = data.clients.find((c) => c.id === d.clientId);
      const name = (d.clientName || client?.name || "").toLowerCase();
      return !query || name.includes(query.toLowerCase()) || docLabel(d).toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const statuses = kind === "invoice" ? ["all", "draft", "sent", "paid", "overdue"] : ["all", "draft", "sent", "accepted", "expired"];

  return (
    <div>
      <TopBar
        title={kind === "invoice" ? "Invoices" : "Quotes"}
        right={
          <button onClick={() => setRoute({ page: "editor", kind })} className="bg-[#1a3c34] text-white p-2 rounded-full active:scale-95 transition">
            <Plus size={17} />
          </button>
        }
      />
      <div className="px-5 pt-4">
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39F8F]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${kind === "invoice" ? "invoices" : "quotes"}`}
            className="w-full bg-white border border-[#EAE3D2] rounded-xl pl-9 pr-3 py-2.5 text-[14px] outline-none focus:border-[#1a3c34]"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-5 px-5">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap border transition"
              style={filter === s ? { background: "#1a3c34", color: "white", borderColor: "#1a3c34" } : { background: "white", color: "#8a8578", borderColor: "#EAE3D2" }}
            >
              {s === "all" ? "All" : STATUS_META[s]?.label}
            </button>
          ))}
        </div>

        {docs.length === 0 ? (
          <EmptyState title={`No ${kind === "invoice" ? "invoices" : "quotes"} yet`} body={`Tap + to create your first ${kind}.`} />
        ) : (
          <div className="flex flex-col gap-2 pb-4">
            {docs.map((doc) => (
              <DocRow key={doc.id} doc={doc} data={data} onClick={() => setRoute({ page: "preview", docId: doc.id })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   EDITOR
---------------------------------------------------------- */
function Editor({ data, setData, docId, kind, fromQuoteId, fromJobId, setRoute, flash }) {
  const existing = docId ? data.documents.find((d) => d.id === docId) : null;
  const seedFromQuote = fromQuoteId ? data.documents.find((d) => d.id === fromQuoteId) : null;
  const seedFromJob = fromJobId ? data.jobs.find((j) => j.id === fromJobId) : null;
  const effectiveKind = existing?.type || kind || "invoice";
  const isNew = !existing;

  const [clientId, setClientId] = useState(existing?.clientId || seedFromQuote?.clientId || seedFromJob?.clientId || "");
  const [clientName, setClientName] = useState(existing?.clientName || seedFromQuote?.clientName || seedFromJob?.clientName || "");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  // Date auto-fills to today for new documents and keeps ticking forward
  // if the tab stays open past midnight; existing documents keep their date.
  const [date, setDate] = useState(existing?.date || todayISO());
  useEffect(() => {
    if (!isNew) return;
    const iv = setInterval(() => setDate((d) => (d === existing?.date ? d : todayISO())), 60000);
    return () => clearInterval(iv);
  }, [isNew]);

  const [serviceLocation, setServiceLocation] = useState(existing?.serviceLocation || seedFromQuote?.serviceLocation || seedFromJob?.location || "");
  const [notes, setNotes] = useState(existing?.notes || seedFromQuote?.notes || seedFromJob?.notes || "");
  const [validDays, setValidDays] = useState(existing?.validDays || 14);
  const [items, setItems] = useState(
    existing?.items ||
      seedFromQuote?.items ||
      (seedFromJob ? [{ id: uid(), desc: seedFromJob.title || "Service Call", amount: "", type: "labor" }] : [{ id: uid(), desc: "", amount: "", type: "labor" }])
  );

  const addItem = (type = "labor") => setItems([...items, { id: uid(), desc: "", amount: "", type }]);
  const updateItem = (id, field, val) => setItems(items.map((it) => (it.id === id ? { ...it, [field]: val } : it)));
  const removeItem = (id) => setItems(items.filter((it) => it.id !== id));

  const sum = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const laborSum = items.filter((it) => it.type !== "parts").reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const partsSum = items.filter((it) => it.type === "parts").reduce((s, it) => s + (Number(it.amount) || 0), 0);

  const canSave = (clientId || clientName.trim()) && items.some((it) => it.desc.trim() && Number(it.amount) > 0);

  const handleSave = () => {
    let finalClientId = clientId;
    let workingData = data;

    if (!clientId && clientName.trim()) {
      const newClient = { id: uid(), name: clientName.trim(), phone: newClientPhone.trim(), email: newClientEmail.trim(), address: "" };
      workingData = { ...workingData, clients: [...workingData.clients, newClient] };
      finalClientId = newClient.id;
    }

    const cleanItems = items
      .filter((it) => it.desc.trim() && Number(it.amount) >= 0)
      .map((it) => ({ id: it.id, desc: it.desc.trim(), amount: Number(it.amount) || 0, type: it.type === "parts" ? "parts" : "labor" }));

    if (existing) {
      const updatedDoc = {
        ...existing,
        clientId: finalClientId,
        clientName: clientName.trim() || undefined,
        date,
        serviceLocation: serviceLocation.trim(),
        notes: notes.trim(),
        items: cleanItems,
        validDays: effectiveKind === "quote" ? Number(validDays) : undefined,
      };
      setData({ ...workingData, documents: workingData.documents.map((d) => (d.id === existing.id ? updatedDoc : d)) });
      flash("Changes saved");
      setRoute({ page: "preview", docId: existing.id });
      return;
    }

    const numberField = effectiveKind === "invoice" ? "nextInvoiceNumber" : "nextQuoteNumber";
    const number = workingData.settings[numberField];
    const newDoc = {
      id: uid(),
      type: effectiveKind,
      number,
      clientId: finalClientId,
      clientName: clientName.trim() || undefined,
      date: todayISO(),
      serviceLocation: serviceLocation.trim(),
      notes: notes.trim(),
      items: cleanItems,
      status: "draft",
      createdAt: new Date().toISOString(),
      validDays: effectiveKind === "quote" ? Number(validDays) : undefined,
      convertedFromQuoteId: fromQuoteId || undefined,
      convertedFromJobId: fromJobId || undefined,
    };

    const nextData = {
      ...workingData,
      documents: [...workingData.documents, newDoc],
      settings: { ...workingData.settings, [numberField]: number + 1 },
    };

    setData(nextData);
    flash(effectiveKind === "invoice" ? "Invoice created" : "Quote created");
    setRoute({ page: "preview", docId: newDoc.id });
  };

  return (
    <div>
      <TopBar
        title={existing ? `Edit ${effectiveKind === "invoice" ? "Invoice" : "Quote"}` : `New ${effectiveKind === "invoice" ? "Invoice" : "Quote"}`}
        onBack={() => setRoute(existing ? { page: "preview", docId: existing.id } : { page: "dashboard" })}
      />

      <div className="px-5 pt-4 pb-32">
        <FieldLabel>Bill to</FieldLabel>
        {data.clients.length > 0 && (
          <select
            value={clientId}
            onChange={(e) => { setClientId(e.target.value); setClientName(""); }}
            className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34] mb-2"
          >
            <option value="">Select existing client…</option>
            {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {!clientId && (
          <div className="mb-2">
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Or type a new client name"
              className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]"
            />
            {clientName.trim() && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="Phone (optional)" className="bg-white border border-[#EAE3D2] rounded-xl px-3 py-2.5 text-[13.5px] outline-none focus:border-[#1a3c34]" />
                <input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="Email (optional)" className="bg-white border border-[#EAE3D2] rounded-xl px-3 py-2.5 text-[13.5px] outline-none focus:border-[#1a3c34]" />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <FieldLabel>Date {isNew && <span className="normal-case font-normal text-[#B98A2E]">· auto-set to today</span>}</FieldLabel>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" />
          </div>
          {effectiveKind === "quote" && (
            <div>
              <FieldLabel>Valid for (days)</FieldLabel>
              <input type="number" value={validDays} onChange={(e) => setValidDays(e.target.value)} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" />
            </div>
          )}
        </div>

        <div className="mt-3">
          <FieldLabel>Service location</FieldLabel>
          <input value={serviceLocation} onChange={(e) => setServiceLocation(e.target.value)} placeholder="e.g. Belle Mer House, Tar Bay" className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" />
        </div>

        {/* Line items — split Labor vs Parts */}
        <div className="mt-5">
          <FieldLabel>Items</FieldLabel>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {data.settings.quickItems.map((q) => (
              <button
                key={q.label}
                onClick={() => setItems([...items, { id: uid(), desc: q.label, amount: "", type: q.type }])}
                className="text-[11.5px] px-2.5 py-1 rounded-full bg-white border border-[#EAE3D2] text-[#8a8578] active:scale-95 transition flex items-center gap-1"
              >
                {q.type === "parts" ? <Wrench size={10} /> : <Hammer size={10} />} {q.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {items.map((it) => (
              <div key={it.id} className="bg-white border border-[#EAE3D2] rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <input
                    value={it.desc}
                    onChange={(e) => updateItem(it.id, "desc", e.target.value)}
                    placeholder="Description"
                    className="flex-1 min-w-0 text-[14px] outline-none"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[13px] text-[#8a8578]">$</span>
                    <input
                      value={it.amount}
                      onChange={(e) => updateItem(it.id, "amount", e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="w-16 text-[14px] outline-none text-right ledger-num font-medium"
                    />
                  </div>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(it.id)} className="p-1 text-[#C7BFA8] hover:text-[#B0402F]">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 mt-2">
                  <TypeToggle active={it.type !== "parts"} label="Labor" icon={Hammer} onClick={() => updateItem(it.id, "type", "labor")} />
                  <TypeToggle active={it.type === "parts"} label="Parts" icon={Wrench} onClick={() => updateItem(it.id, "type", "parts")} />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-2">
            <button onClick={() => addItem("labor")} className="text-[13px] text-[#1a3c34] font-medium flex items-center gap-1 py-1.5"><Plus size={14} /> Labor line</button>
            <button onClick={() => addItem("parts")} className="text-[13px] text-[#B98A2E] font-medium flex items-center gap-1 py-1.5"><Plus size={14} /> Parts line</button>
          </div>

          <div className="mt-3 px-1 flex flex-col gap-1">
            <div className="flex justify-between text-[12.5px] text-[#8a8578]">
              <span className="flex items-center gap-1"><Hammer size={11} /> Labor</span>
              <span className="ledger-num">${money(laborSum)}</span>
            </div>
            <div className="flex justify-between text-[12.5px] text-[#8a8578]">
              <span className="flex items-center gap-1"><Wrench size={11} /> Parts</span>
              <span className="ledger-num">${money(partsSum)}</span>
            </div>
            <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-[#EAE3D2]">
              <span className="text-[13px] text-[#8a8578]">Total</span>
              <span className="ledger-num text-[19px] font-semibold text-[#1a3c34]">${money(sum)}</span>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <FieldLabel>Notes (optional)</FieldLabel>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Terms, warranty info, parts used…" className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14px] outline-none focus:border-[#1a3c34] resize-none" />
        </div>
      </div>

      <div className="no-print fixed bottom-0 left-0 right-0 bg-[#FAF7F0] border-t border-[#EAE3D2] px-5 py-3.5">
        <button disabled={!canSave} onClick={handleSave} className="w-full bg-[#1a3c34] disabled:bg-[#C7BFA8] text-white rounded-xl py-3.5 text-[15px] font-medium active:scale-[0.99] transition">
          {existing ? "Save changes" : `Create ${effectiveKind === "invoice" ? "invoice" : "quote"}`}
        </button>
      </div>
    </div>
  );
}

function TypeToggle({ active, label, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition"
      style={active ? { background: "#1a3c34", color: "white" } : { background: "#F0EBDD", color: "#8a8578" }}
    >
      <Icon size={10} /> {label}
    </button>
  );
}

function FieldLabel({ children }) {
  return <p className="text-[11.5px] font-semibold text-[#8a8578] tracking-wide uppercase mb-1.5">{children}</p>;
}

/* ---------------------------------------------------------
   PREVIEW + SHARE
---------------------------------------------------------- */
function Preview({ data, setData, docId, setRoute, flash }) {
  const doc = data.documents.find((d) => d.id === docId);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  if (!doc) return null;

  const client = data.clients.find((c) => c.id === doc.clientId);
  const clientName = doc.clientName || client?.name || "Client";
  const clientPhone = client?.phone || "";
  const clientEmail = client?.email || "";
  const sum = total(doc);
  const labor = laborTotal(doc);
  const parts = partsTotal(doc);
  const showSplit = labor > 0 && parts > 0;
  const isQuote = doc.type === "quote";
  const meta = STATUS_META[doc.status] || STATUS_META.draft;

  const shareText = useMemo(() => {
    const lines = [];
    lines.push(`${isQuote ? "QUOTE" : "INVOICE"} ${docLabel(doc)}`);
    lines.push(`${data.business.name} — ${data.business.tagline}`);
    lines.push("");
    lines.push(`Bill to: ${clientName}`);
    if (doc.serviceLocation) lines.push(`Location: ${doc.serviceLocation}`);
    lines.push(`Date: ${fmtDate(doc.date)}`);
    if (isQuote && doc.validDays) lines.push(`Valid for ${doc.validDays} days`);
    lines.push("");
    (doc.items || []).forEach((it) => lines.push(`• ${it.desc} — $${money(it.amount)}`));
    if (showSplit) {
      lines.push("");
      lines.push(`Labor: $${money(labor)}   Parts: $${money(parts)}`);
    }
    lines.push("");
    lines.push(`TOTAL: $${money(sum)}`);
    if (doc.notes) { lines.push(""); lines.push(doc.notes); }
    if (data.business.phone) lines.push(`\n${data.business.name} · ${data.business.phone}`);
    return lines.join("\n");
  }, [doc, data]);

  const shareWhatsApp = () => {
    const phoneDigits = toWaPhone(clientPhone);
    const base = phoneDigits ? `https://wa.me/${phoneDigits}` : "https://wa.me/";
    openExternal(`${base}?text=${encodeURIComponent(shareText)}`);
  };

  const shareEmail = () => {
    const subject = `${isQuote ? "Quote" : "Invoice"} ${docLabel(doc)} from ${data.business.name}`;
    openExternal(`mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`);
  };

  const [manualCopyText, setManualCopyText] = useState(null);

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${isQuote ? "Quote" : "Invoice"} ${docLabel(doc)}`,
          text: shareText,
        });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return; // person cancelled the share sheet
        // fall through to clipboard fallback below
      }
    }
    const ok = await copyToClipboard(shareText);
    flash(ok ? "Copied — paste it into any app" : "Couldn't share automatically");
    if (!ok) setManualCopyText(shareText);
  };

  const copyText = async () => {
    const ok = await copyToClipboard(shareText);
    if (ok) flash("Copied to clipboard");
    else setManualCopyText(shareText);
  };

  const setStatus = (status) => {
    setData({ ...data, documents: data.documents.map((d) => (d.id === doc.id ? { ...d, status } : d)) });
    setShowStatusMenu(false);
    flash(`Marked as ${STATUS_META[status].label}`);
  };

  const deleteDoc = () => {
    if (!window.confirm(`Delete ${docLabel(doc)}? This can't be undone.`)) return;
    setData({ ...data, documents: data.documents.filter((d) => d.id !== doc.id) });
    setRoute({ page: "list", kind: doc.type });
  };

  const convertToInvoice = () => setRoute({ page: "editor", kind: "invoice", fromQuoteId: doc.id });

  const statusOptions = isQuote ? ["draft", "sent", "accepted", "declined", "expired"] : ["draft", "sent", "paid", "overdue"];

  return (
    <div className="min-h-screen bg-[#EFEAE0]">
      <TopBar
        title={isQuote ? "Quote" : "Invoice"}
        onBack={() => setRoute({ page: "list", kind: doc.type })}
        right={
          <button onClick={() => setRoute({ page: "editor", kind: doc.type, docId: doc.id })} className="p-2 rounded-full hover:bg-[#EFEBE1]">
            <Pencil size={17} color="#1a3c34" />
          </button>
        }
      />

      <div className="no-print px-5 pt-4 relative">
        <button onClick={() => setShowStatusMenu((s) => !s)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium" style={{ color: meta.color, background: meta.bg }}>
          <meta.icon size={12} /> {meta.label} <ChevronRight size={12} className="rotate-90" />
        </button>
        {showStatusMenu && (
          <div className="absolute z-20 left-5 mt-1.5 bg-white rounded-xl border border-[#EAE3D2] shadow-lg overflow-hidden">
            {statusOptions.map((s) => (
              <button key={s} onClick={() => setStatus(s)} className="block w-full text-left px-4 py-2.5 text-[13.5px] hover:bg-[#FAF7F0]" style={{ color: STATUS_META[s].color }}>
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 pt-4 pb-6">
        <div className="print-area bg-white rounded-2xl shadow-sm overflow-hidden relative" style={{ border: "1px solid #E5DFD0" }}>
          <div className="absolute top-0 left-0 right-0 h-2" style={{ backgroundImage: "radial-gradient(circle, #EFEAE0 2.5px, transparent 2.5px)", backgroundSize: "14px 10px", backgroundPosition: "center top" }} />
          <div className="p-6 pt-7">
            <div className="flex justify-between items-start mb-6">
              <h2 className="ledger-num text-[24px] font-semibold text-[#1a3c34] leading-none">{isQuote ? "QUOTE" : "INVOICE"}</h2>
              <div className="text-right text-[11.5px] text-[#8a8578] leading-relaxed">
                <p className="ledger-num font-semibold text-[13px] text-[#231F1A]">{docLabel(doc)}</p>
                <p>{fmtDate(doc.date)}</p>
                {isQuote && doc.validDays && <p>Valid {doc.validDays} days</p>}
              </div>
            </div>

            <div className="h-[2px] bg-[#1a3c34] mb-5" />

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-[10px] font-semibold text-[#8a8578] tracking-wide uppercase mb-1">From</p>
                <p className="ledger-num text-[14px] font-semibold text-[#1a3c34]">{data.business.name}</p>
                <p className="text-[12px] text-[#8a8578]">{data.business.tagline}</p>
                {data.business.phone && <p className="text-[12px] text-[#8a8578]">{data.business.phone}</p>}
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#8a8578] tracking-wide uppercase mb-1">{isQuote ? "Prepared for" : "Bill to"}</p>
                <p className="ledger-num text-[14px] font-semibold text-[#1a3c34]">{clientName}</p>
                {clientPhone && <p className="text-[12px] text-[#8a8578]">{clientPhone}</p>}
              </div>
            </div>

            {doc.serviceLocation && (
              <div className="mb-5">
                <p className="text-[10px] font-semibold text-[#8a8578] tracking-wide uppercase mb-1">Service Location</p>
                <p className="text-[13.5px] text-[#231F1A] flex items-center gap-1"><MapPin size={12} color="#8a8578" /> {doc.serviceLocation}</p>
              </div>
            )}

            <div className="rounded-lg overflow-hidden border border-[#EAE3D2] mb-4">
              <div className="bg-[#1a3c34] text-white text-[10.5px] font-semibold tracking-wide uppercase px-3.5 py-2 flex justify-between">
                <span>Description</span>
                <span>Amount</span>
              </div>
              {(doc.items || []).map((it, i) => (
                <div key={it.id || i} className="px-3.5 py-2.5 flex justify-between items-center text-[13.5px]" style={{ borderTop: i > 0 ? "1px solid #F0EBDD" : "none" }}>
                  <span className="text-[#231F1A] pr-3 flex items-center gap-1.5">
                    {it.type === "parts" ? <Wrench size={11} color="#B98A2E" /> : <Hammer size={11} color="#8a8578" />}
                    {it.desc}
                  </span>
                  <span className="ledger-num font-medium text-[#231F1A] shrink-0">${money(it.amount)}</span>
                </div>
              ))}
            </div>

            {showSplit && (
              <div className="flex justify-between text-[12px] text-[#8a8578] mb-2 px-1">
                <span>Labor: ${money(labor)}</span>
                <span>Parts: ${money(parts)}</span>
              </div>
            )}

            <div className="flex justify-between items-center border-t-2 border-[#1a3c34] pt-3">
              <span className="text-[13px] font-semibold text-[#231F1A]">{isQuote ? "ESTIMATED TOTAL" : "TOTAL DUE"}</span>
              <span className="ledger-num text-[21px] font-bold text-[#1a3c34]">${money(sum)}</span>
            </div>

            {doc.notes && <p className="text-[12px] text-[#8a8578] mt-4 whitespace-pre-wrap">{doc.notes}</p>}

            <p className="text-[11px] text-[#A39F8F] mt-5">
              {isQuote ? "This quote is an estimate and may change once work begins." : "Payment due upon receipt. Thank you for your business!"}
            </p>
          </div>
        </div>
      </div>

      <div className="no-print px-5 flex flex-col gap-2 pb-8">
        <button onClick={shareNative} className="bg-[#1a3c34] text-white rounded-xl py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition text-[14.5px] font-medium">
          <Share2 size={16} /> Share
        </button>
        <div className="grid grid-cols-2 gap-2">
          <ActionBtn icon={Share2} label="WhatsApp" onClick={shareWhatsApp} color="#1FA855" />
          <ActionBtn icon={Mail} label="Email" onClick={shareEmail} color="#2F7A78" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ActionBtn icon={Printer} label="Print / Save PDF" onClick={() => window.print()} color="#1a3c34" />
          <ActionBtn icon={Copy} label="Copy text" onClick={copyText} color="#B98A2E" />
        </div>

        {manualCopyText && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setManualCopyText(null)}>
            <div className="bg-white rounded-t-2xl w-full p-5" onClick={(e) => e.stopPropagation()}>
              <p className="text-[13px] font-semibold text-[#231F1A] mb-2">Couldn't copy automatically — select the text below and copy it manually:</p>
              <textarea
                readOnly
                value={manualCopyText}
                onFocus={(e) => e.target.select()}
                className="w-full h-40 bg-[#FAF7F0] border border-[#EAE3D2] rounded-xl p-3 text-[12.5px] outline-none"
              />
              <button onClick={() => setManualCopyText(null)} className="mt-3 w-full bg-[#1a3c34] text-white rounded-xl py-3 text-[14px] font-medium">Done</button>
            </div>
          </div>
        )}

        {isQuote && doc.status === "accepted" && !doc.convertedToInvoiceId && (
          <button onClick={convertToInvoice} className="mt-1 flex items-center justify-center gap-2 bg-[#1a3c34] text-white rounded-xl py-3 text-[14px] font-medium active:scale-[0.99] transition">
            <ArrowRightLeft size={15} /> Convert to invoice
          </button>
        )}

        <button onClick={deleteDoc} className="mt-2 flex items-center justify-center gap-1.5 text-[#B0402F] text-[13px] py-2">
          <Trash2 size={13} /> Delete {isQuote ? "quote" : "invoice"}
        </button>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, color }) {
  return (
    <button onClick={onClick} className="bg-white border border-[#EAE3D2] rounded-xl py-3 flex items-center justify-center gap-2 active:scale-[0.98] transition text-[13.5px] font-medium" style={{ color }}>
      <Icon size={15} /> {label}
    </button>
  );
}

/* ---------------------------------------------------------
   CLIENTS
---------------------------------------------------------- */
function Clients({ data, setRoute }) {
  const [query, setQuery] = useState("");
  const list = data.clients.filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <TopBar
        title="Clients"
        right={
          <button onClick={() => setRoute({ page: "client-editor" })} className="bg-[#1a3c34] text-white p-2 rounded-full active:scale-95 transition">
            <Plus size={17} />
          </button>
        }
      />
      <div className="px-5 pt-4">
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39F8F]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients" className="w-full bg-white border border-[#EAE3D2] rounded-xl pl-9 pr-3 py-2.5 text-[14px] outline-none focus:border-[#1a3c34]" />
        </div>

        {list.length === 0 ? (
          <EmptyState title="No clients yet" body="Add a client to start billing them faster." />
        ) : (
          <div className="flex flex-col gap-2 pb-4">
            {list.map((c) => {
              const clientDocs = data.documents.filter((d) => d.clientId === c.id);
              const outstanding = clientDocs.filter((d) => d.type === "invoice" && (d.status === "sent" || d.status === "overdue")).reduce((s, d) => s + total(d), 0);
              return (
                <button key={c.id} onClick={() => setRoute({ page: "client-editor", clientId: c.id })} className="bg-white rounded-xl border border-[#EAE3D2] px-4 py-3.5 flex items-center justify-between text-left active:scale-[0.99] transition">
                  <div>
                    <p className="text-[14.5px] font-medium text-[#231F1A]">{c.name}</p>
                    <p className="text-[12px] text-[#8a8578]">{c.phone || c.email || "No contact info"} · {clientDocs.length} doc{clientDocs.length === 1 ? "" : "s"}</p>
                  </div>
                  {outstanding > 0 && <span className="ledger-num text-[13px] font-semibold text-[#B0402F]">${money(outstanding)}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientEditor({ data, setData, clientId, setRoute, flash }) {
  const existing = clientId ? data.clients.find((c) => c.id === clientId) : null;
  const [name, setName] = useState(existing?.name || "");
  const [phone, setPhone] = useState(existing?.phone || "");
  const [email, setEmail] = useState(existing?.email || "");
  const [address, setAddress] = useState(existing?.address || "");

  const save = () => {
    if (!name.trim()) return;
    if (existing) {
      setData({ ...data, clients: data.clients.map((c) => (c.id === existing.id ? { ...c, name: name.trim(), phone, email, address } : c)) });
      flash("Client updated");
    } else {
      setData({ ...data, clients: [...data.clients, { id: uid(), name: name.trim(), phone, email, address }] });
      flash("Client added");
    }
    setRoute({ page: "clients" });
  };

  const remove = () => {
    if (!window.confirm(`Remove ${existing.name}? Their past invoices stay on record.`)) return;
    setData({ ...data, clients: data.clients.filter((c) => c.id !== existing.id) });
    setRoute({ page: "clients" });
  };

  return (
    <div>
      <TopBar title={existing ? "Edit Client" : "New Client"} onBack={() => setRoute({ page: "clients" })} />
      <div className="px-5 pt-4 flex flex-col gap-3 pb-8">
        <div><FieldLabel>Name</FieldLabel><input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" /></div>
        <div><FieldLabel>Phone</FieldLabel><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="For WhatsApp sharing" className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" /></div>
        <div><FieldLabel>Email</FieldLabel><input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" /></div>
        <div><FieldLabel>Address (optional)</FieldLabel><input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" /></div>

        <button onClick={save} disabled={!name.trim()} className="mt-2 w-full bg-[#1a3c34] disabled:bg-[#C7BFA8] text-white rounded-xl py-3.5 text-[15px] font-medium active:scale-[0.99] transition">
          {existing ? "Save changes" : "Add client"}
        </button>
        {existing && (
          <button onClick={remove} className="flex items-center justify-center gap-1.5 text-[#B0402F] text-[13px] py-2">
            <Trash2 size={13} /> Remove client
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   EXPENSES
---------------------------------------------------------- */
function Expenses({ data, setRoute }) {
  const [query, setQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState(monthKey(todayISO()));

  const months = useMemo(() => {
    const set = new Set(data.expenses.map((e) => monthKey(e.date)));
    set.add(monthKey(todayISO()));
    return Array.from(set).sort().reverse();
  }, [data.expenses]);

  const list = data.expenses
    .filter((e) => monthKey(e.date) === monthFilter)
    .filter((e) => !query || e.category.toLowerCase().includes(query.toLowerCase()) || (e.description || "").toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const monthTotal = list.reduce((s, e) => s + Number(e.amount || 0), 0);

  const byCategory = useMemo(() => {
    const map = {};
    list.forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [list]);

  const monthLabel = (mk) => {
    const [y, m] = mk.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <div>
      <TopBar
        title="Expenses"
        right={
          <button onClick={() => setRoute({ page: "expense-editor" })} className="bg-[#1a3c34] text-white p-2 rounded-full active:scale-95 transition">
            <Plus size={17} />
          </button>
        }
      />
      <div className="px-5 pt-4">
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#1a3c34] mb-3 w-full">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>

        <div className="bg-white rounded-2xl border border-[#EAE3D2] px-4 py-3.5 mb-3">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[11px] text-[#8a8578] tracking-wide">Total this month</p>
            <p className="ledger-num text-[19px] font-semibold text-[#B98A2E]">${money(monthTotal)}</p>
          </div>
          {byCategory.length > 0 && (
            <div className="flex flex-col gap-1 pt-2 border-t border-[#F0EBDD]">
              {byCategory.map(([cat, amt]) => (
                <div key={cat} className="flex justify-between text-[12px] text-[#8a8578]">
                  <span>{cat}</span>
                  <span className="ledger-num">${money(amt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39F8F]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search expenses" className="w-full bg-white border border-[#EAE3D2] rounded-xl pl-9 pr-3 py-2.5 text-[14px] outline-none focus:border-[#1a3c34]" />
        </div>

        {list.length === 0 ? (
          <EmptyState title="No expenses logged" body="Track fuel, parts, and materials here to see your real profit." />
        ) : (
          <div className="flex flex-col gap-2 pb-4">
            {list.map((e) => (
              <button key={e.id} onClick={() => setRoute({ page: "expense-editor", expenseId: e.id })} className="bg-white rounded-xl border border-[#EAE3D2] px-4 py-3 flex items-center justify-between text-left active:scale-[0.99] transition">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-[#231F1A] truncate">{e.description || e.category}</p>
                  <p className="text-[11.5px] text-[#8a8578]">{e.category} · {fmtDate(e.date)}</p>
                </div>
                <span className="ledger-num text-[14px] font-semibold text-[#B98A2E] shrink-0 pl-3">${money(e.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExpenseEditor({ data, setData, expenseId, setRoute, flash }) {
  const existing = expenseId ? data.expenses.find((e) => e.id === expenseId) : null;
  const [date, setDate] = useState(existing?.date || todayISO());
  const [category, setCategory] = useState(existing?.category || data.settings.expenseCategories[0]);
  const [description, setDescription] = useState(existing?.description || "");
  const [amount, setAmount] = useState(existing?.amount || "");

  const canSave = category && Number(amount) > 0;

  const save = () => {
    if (!canSave) return;
    if (existing) {
      setData({ ...data, expenses: data.expenses.map((e) => (e.id === existing.id ? { ...e, date, category, description: description.trim(), amount: Number(amount) } : e)) });
      flash("Expense updated");
    } else {
      setData({ ...data, expenses: [...data.expenses, { id: uid(), date, category, description: description.trim(), amount: Number(amount) }] });
      flash("Expense logged");
    }
    setRoute({ page: "expenses" });
  };

  const remove = () => {
    if (!window.confirm("Delete this expense?")) return;
    setData({ ...data, expenses: data.expenses.filter((e) => e.id !== existing.id) });
    setRoute({ page: "expenses" });
  };

  return (
    <div>
      <TopBar title={existing ? "Edit Expense" : "Log Expense"} onBack={() => setRoute({ page: "expenses" })} />
      <div className="px-5 pt-4 flex flex-col gap-3 pb-8">
        <div>
          <FieldLabel>Category</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {data.settings.expenseCategories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className="px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition" style={category === c ? { background: "#1a3c34", color: "white", borderColor: "#1a3c34" } : { background: "white", color: "#8a8578", borderColor: "#EAE3D2" }}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Date</FieldLabel>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" />
        </div>
        <div>
          <FieldLabel>Amount</FieldLabel>
          <div className="flex items-center bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 focus-within:border-[#1a3c34]">
            <span className="text-[14.5px] text-[#8a8578] mr-1">$</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" className="flex-1 text-[14.5px] outline-none ledger-num" />
          </div>
        </div>
        <div>
          <FieldLabel>Note (optional)</FieldLabel>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Fuel for Tar Bay job, Rainbird valve" className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" />
        </div>

        <button onClick={save} disabled={!canSave} className="mt-2 w-full bg-[#1a3c34] disabled:bg-[#C7BFA8] text-white rounded-xl py-3.5 text-[15px] font-medium active:scale-[0.99] transition">
          {existing ? "Save changes" : "Log expense"}
        </button>
        {existing && (
          <button onClick={remove} className="flex items-center justify-center gap-1.5 text-[#B0402F] text-[13px] py-2">
            <Trash2 size={13} /> Delete expense
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SETTINGS
---------------------------------------------------------- */
function SettingsPage({ data, setData, setRoute, flash }) {
  const [name, setName] = useState(data.business.name);
  const [tagline, setTagline] = useState(data.business.tagline);
  const [phone, setPhone] = useState(data.business.phone);
  const [email, setEmail] = useState(data.business.email);
  const [nextInv, setNextInv] = useState(data.settings.nextInvoiceNumber);

  const save = () => {
    setData({
      ...data,
      business: { ...data.business, name, tagline, phone, email },
      settings: { ...data.settings, nextInvoiceNumber: Number(nextInv) || data.settings.nextInvoiceNumber },
    });
    flash("Settings saved");
    setRoute({ page: "dashboard" });
  };

  return (
    <div>
      <TopBar title="Business Settings" onBack={() => setRoute({ page: "dashboard" })} />
      <div className="px-5 pt-4 flex flex-col gap-3 pb-8">
        <div><FieldLabel>Business / your name</FieldLabel><input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" /></div>
        <div><FieldLabel>Tagline / role</FieldLabel><input value={tagline} onChange={(e) => setTagline(e.target.value)} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" /></div>
        <div><FieldLabel>Phone</FieldLabel><input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" /></div>
        <div><FieldLabel>Email</FieldLabel><input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34]" /></div>
        <div>
          <FieldLabel>Next invoice number</FieldLabel>
          <input type="number" value={nextInv} onChange={(e) => setNextInv(e.target.value)} className="w-full bg-white border border-[#EAE3D2] rounded-xl px-3.5 py-3 text-[14.5px] outline-none focus:border-[#1a3c34] ledger-num" />
          <p className="text-[11.5px] text-[#8a8578] mt-1">Currently set to continue at #{String(data.settings.nextInvoiceNumber).padStart(3, "0")}.</p>
        </div>

        <button onClick={save} className="mt-2 w-full bg-[#1a3c34] text-white rounded-xl py-3.5 text-[15px] font-medium active:scale-[0.99] transition">
          Save settings
        </button>
      </div>
    </div>
  );
}
