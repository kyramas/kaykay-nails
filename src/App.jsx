import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Plus, X, Trash2, Pencil, Phone, MessageCircle, ChevronRight,
  ChevronLeft, Search, ListChecks, CalendarDays, Sparkles, Users,
  RefreshCw, Check, Download, AlertTriangle,
} from "lucide-react";
import { supabase } from "./supabaseClient";

/* ---------- design tokens ---------- */
const BG = "#181215";
const SURFACE = "#221A1E";
const SURFACE_2 = "#2B2125";
const BORDER = "#3A2C31";
const TEXT = "#F4EAE6";
const TEXT_DIM = "#AD949B";
const ACCENT = "#C9738C";
const NAV_INACTIVE = "#E4D3D8";

const CATEGORY_COLORS = {
  Extensions: "#E2562E",
  "Fill/Overlay": "#4C9A6B",
  Manicure: "#4A7FB5",
  "Nail Art": "#8B5FBF",
  "Add-ons": "#D6883F",
  "Removal/Repair": "#B7A23B",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_COLORS);

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Georgia, serif";
const SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

/* ---------- database helpers ----------
   Client/service data and seed values now live in Supabase (see
   supabase-setup.sql) rather than being hardcoded here. These helpers
   translate between this app's camelCase shape and Postgres's
   snake_case columns, and report errors instead of failing silently. */
function apptFromRow(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    serviceIds: row.service_ids || [],
    date: row.date,
    time: row.time,
    notes: row.notes || "",
  };
}
function apptToRow(appt) {
  return {
    id: appt.id,
    client_id: appt.clientId,
    service_ids: appt.serviceIds,
    date: appt.date,
    time: appt.time,
    notes: appt.notes || "",
  };
}

async function fetchAllData() {
  const [clientsRes, servicesRes, apptsRes] = await Promise.all([
    supabase.from("clients").select("*"),
    supabase.from("services").select("*"),
    supabase.from("appointments").select("*"),
  ]);
  if (clientsRes.error) throw clientsRes.error;
  if (servicesRes.error) throw servicesRes.error;
  if (apptsRes.error) throw apptsRes.error;
  return {
    clients: clientsRes.data || [],
    services: servicesRes.data || [],
    appointments: (apptsRes.data || []).map(apptFromRow),
  };
}

/* ---------- generic helpers ---------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const money = (n) => `€${Number(n).toFixed(2)}`;
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const prettyDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
};
const prettyTime = (t) => {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${ap}`;
};
const timeToMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================ */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("bookings");
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [search, setSearch] = useState("");

  const [apptModal, setApptModal] = useState(null); // {} new, or appt object to edit
  const [detailAppt, setDetailAppt] = useState(null); // read-only detail view, opened from Calendar
  const [dayListDate, setDayListDate] = useState(null); // iso date string, shows all bookings for that day
  const [clientModal, setClientModal] = useState(null);
  const [serviceModal, setServiceModal] = useState(null);
  const [calCursor, setCalCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calView, setCalView] = useState("month");
  const [confirmState, setConfirmState] = useState(null); // { message, onConfirm }
  const [clientDetailId, setClientDetailId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const scrollRef = useRef(null);

  // Bookings are listed oldest-to-newest, so jump to the bottom whenever the
  // Bookings tab opens — that's where the newest booking sits.
  useEffect(() => {
    if (tab === "bookings" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [tab, appointments.length]);

  function askConfirm(message, onConfirm) {
    setConfirmState({ message, onConfirm });
  }

  // Any background save that fails shows a small dismissible banner rather
  // than failing silently — with a real database, network hiccups happen.
  function reportSyncError(action, error) {
    console.error(action, error);
    setSyncError(`Couldn't ${action} — check your connection. (${error.message || "unknown error"})`);
  }

  useEffect(() => {
    (async () => {
      try {
        const { clients, services, appointments } = await fetchAllData();
        setClients(clients);
        setServices(services);
        setAppointments(appointments);
      } catch (err) {
        console.error("Failed to load data", err);
        setLoadError(
          "Couldn't load your data. Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
          "are set correctly, and that supabase-setup.sql has been run."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const clientById = useCallback((id) => clients.find((c) => c.id === id), [clients]);
  const serviceById = useCallback((id) => services.find((s) => s.id === id), [services]);

  const categoryOf = useCallback(
    (appt) => {
      const first = serviceById(appt.serviceIds?.[0]);
      return first?.category || "Removal/Repair";
    },
    [serviceById]
  );

  const apptTotal = (appt) =>
    (appt.serviceIds || []).reduce((sum, id) => sum + (serviceById(id)?.price || 0), 0);
  const apptDuration = (appt) =>
    (appt.serviceIds || []).reduce((sum, id) => sum + (serviceById(id)?.duration || 0), 0);
  const apptServiceNames = (appt) =>
    (appt.serviceIds || []).map((id) => serviceById(id)?.name).filter(Boolean).join(", ");

  const sortedAppointments = useMemo(
    () =>
      [...appointments].sort((a, b) =>
        a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
      ),
    [appointments]
  );

  const filteredAppointments = useMemo(() => {
    if (!search.trim()) return sortedAppointments;
    const q = search.toLowerCase();
    return sortedAppointments.filter((a) => {
      const client = clientById(a.clientId);
      return (
        client?.name?.toLowerCase().includes(q) ||
        apptServiceNames(a).toLowerCase().includes(q)
      );
    });
  }, [sortedAppointments, search, clientById]);

  const earnings = useMemo(() => {
    const now = new Date();
    const todayIso = isoDate(now);
    const weekStart = isoDate(startOfWeek(now));
    const monthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    let today = 0, week = 0, month = 0;
    appointments.forEach((a) => {
      const total = apptTotal(a);
      if (a.date === todayIso) today += total;
      if (a.date >= weekStart) week += total;
      if (a.date.startsWith(monthPrefix)) month += total;
    });
    return { today, week, month };
  }, [appointments, services]);

  const serviceStats = useMemo(() => {
    const stats = {};
    appointments.forEach((a) => {
      (a.serviceIds || []).forEach((id) => {
        const s = serviceById(id);
        if (!s) return;
        if (!stats[id]) stats[id] = { service: s, count: 0, revenue: 0 };
        stats[id].count += 1;
        stats[id].revenue += s.price;
      });
    });
    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [appointments, services]);

  function exportBackup() {
    downloadJSON(`kaykay-nails-backup-${isoDate(new Date())}.json`, { clients, services, appointments });
  }

  function upsertAppointment(appt) {
    setAppointments((prev) => {
      const exists = prev.some((a) => a.id === appt.id);
      return exists ? prev.map((a) => (a.id === appt.id ? appt : a)) : [...prev, appt];
    });
    setApptModal(null);
    supabase.from("appointments").upsert(apptToRow(appt)).then(({ error }) => {
      if (error) reportSyncError("save that booking", error);
    });
  }
  function deleteAppointment(id) {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    supabase.from("appointments").delete().eq("id", id).then(({ error }) => {
      if (error) reportSyncError("delete that booking", error);
    });
  }
  function confirmDeleteAppointment(appt) {
    const client = clientById(appt.clientId);
    askConfirm(`Delete ${client?.name || "this"}'s booking on ${prettyDate(appt.date)}? This can't be undone.`, () =>
      deleteAppointment(appt.id)
    );
  }
  function upsertClient(client) {
    setClients((prev) => {
      const exists = prev.some((c) => c.id === client.id);
      return exists ? prev.map((c) => (c.id === client.id ? client : c)) : [...prev, client];
    });
    setClientModal(null);
    supabase.from("clients").upsert(client).then(({ error }) => {
      if (error) reportSyncError("save that client", error);
    });
  }
  function deleteClient(id) {
    setClients((prev) => prev.filter((c) => c.id !== id));
    supabase.from("clients").delete().eq("id", id).then(({ error }) => {
      if (error) reportSyncError("delete that client", error);
    });
  }
  function confirmDeleteClient(client) {
    const count = appointments.filter((a) => a.clientId === client.id).length;
    const extra = count > 0 ? ` They have ${count} booking${count === 1 ? "" : "s"} on record, which will stay but show as "Unknown."` : "";
    askConfirm(`Delete ${client.name}?${extra} This can't be undone.`, () => deleteClient(client.id));
  }
  function upsertService(service) {
    setServices((prev) => {
      const exists = prev.some((s) => s.id === service.id);
      return exists ? prev.map((s) => (s.id === service.id ? service : s)) : [...prev, service];
    });
    setServiceModal(null);
    supabase.from("services").upsert(service).then(({ error }) => {
      if (error) reportSyncError("save that service", error);
    });
  }
  function deleteService(id) {
    setServices((prev) => prev.filter((s) => s.id !== id));
    supabase.from("services").delete().eq("id", id).then(({ error }) => {
      if (error) reportSyncError("delete that service", error);
    });
  }
  function confirmDeleteService(service) {
    askConfirm(`Delete "${service.name}" from your services list? This can't be undone.`, () => deleteService(service.id));
  }

  if (loading) {
    return (
      <div style={{ background: BG, color: TEXT_DIM, fontFamily: SANS }}
        className="w-full h-full min-h-[600px] flex items-center justify-center text-sm">
        Loading Kay Kay Nails…
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ background: BG, color: TEXT, fontFamily: SANS }}
        className="w-full h-full min-h-[600px] flex flex-col items-center justify-center text-sm text-center px-8 gap-3">
        <AlertTriangle size={28} color="#E88C8C" />
        <p style={{ color: TEXT_DIM }}>{loadError}</p>
      </div>
    );
  }

  return (
    <div
      style={{ background: BG, color: TEXT, fontFamily: SANS }}
      className="relative w-full h-[100dvh] max-h-[900px] max-w-[430px] mx-auto flex flex-col overflow-hidden sm:rounded-3xl sm:border"
    >
      <style>{`
        html, body { background: #000000; margin: 0; padding: 0; }
        input, select, textarea { font-family: ${SANS}; }
        ::placeholder { color: ${TEXT_DIM}; opacity: 0.7; }
        * { box-sizing: border-box; }
      `}</style>

      <Header tab={tab} search={search} setSearch={setSearch} />

      {syncError && (
        <div style={{ background: "#3A2020", color: "#E88C8C" }} className="px-4 py-2 text-xs flex items-center justify-between gap-2">
          <span className="min-w-0">{syncError}</span>
          <button onClick={() => setSyncError(null)} className="shrink-0"><X size={13} /></button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-32 pt-3" style={{ background: BG }}>
        {tab === "bookings" && (
          <BookingsView
            appts={filteredAppointments}
            clientById={clientById}
            categoryOf={categoryOf}
            apptServiceNames={apptServiceNames}
            earnings={earnings}
            onEdit={(a) => setApptModal(a)}
            onDelete={confirmDeleteAppointment}
          />
        )}
        {tab === "calendar" && (
          <CalendarView
            cursor={calCursor}
            setCursor={setCalCursor}
            view={calView}
            setView={setCalView}
            appointments={appointments}
            clientById={clientById}
            categoryOf={categoryOf}
            apptServiceNames={apptServiceNames}
            onSelect={(a) => setDetailAppt(a)}
            onDaySelect={(iso) => setDayListDate(iso)}
          />
        )}
        {tab === "services" && (
          <ServicesView
            services={services}
            serviceStats={serviceStats}
            onAdd={() => setServiceModal({})}
            onEdit={(s) => setServiceModal(s)}
            onDelete={confirmDeleteService}
          />
        )}
        {tab === "clients" && (
          <ClientsView
            clients={clients}
            appointments={appointments}
            onAdd={() => setClientModal({})}
            onEdit={(c) => setClientModal(c)}
            onDelete={confirmDeleteClient}
            onSelectClient={(c) => setClientDetailId(c.id)}
            onExport={exportBackup}
          />
        )}
      </div>

      {(tab === "bookings" || tab === "calendar") && (
        <button
          onClick={() => setApptModal({})}
          style={{ background: ACCENT }}
          className="fixed right-5 bottom-24 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-10"
        >
          <Plus size={26} color="#1A1215" strokeWidth={2.5} />
        </button>
      )}
      {tab === "services" && (
        <button
          onClick={() => setServiceModal({})}
          style={{ background: ACCENT }}
          className="fixed right-5 bottom-24 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-10"
        >
          <Plus size={26} color="#1A1215" strokeWidth={2.5} />
        </button>
      )}
      {tab === "clients" && (
        <button
          onClick={() => setClientModal({})}
          style={{ background: ACCENT }}
          className="fixed right-5 bottom-24 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-10"
        >
          <Plus size={26} color="#1A1215" strokeWidth={2.5} />
        </button>
      )}

      <BottomNav tab={tab} setTab={setTab} />

      {apptModal && (
        <AppointmentModal
          appt={apptModal}
          clients={clients}
          services={services}
          appointments={appointments}
          onSave={upsertAppointment}
          onClose={() => setApptModal(null)}
          onAddClient={(name, phone) => {
            const c = { id: uid(), name, phone };
            setClients((prev) => [...prev, c]);
            supabase.from("clients").insert(c).then(({ error }) => {
              if (error) reportSyncError("save that new client", error);
            });
            return c;
          }}
        />
      )}
      {clientModal && (
        <ClientModal client={clientModal} clients={clients} onSave={upsertClient} onClose={() => setClientModal(null)} />
      )}
      {serviceModal && (
        <ServiceModal service={serviceModal} onSave={upsertService} onClose={() => setServiceModal(null)} />
      )}
      {detailAppt && (
        <BookingDetailModal
          appt={detailAppt}
          client={clientById(detailAppt.clientId)}
          category={categoryOf(detailAppt)}
          serviceNames={apptServiceNames(detailAppt)}
          total={apptTotal(detailAppt)}
          duration={apptDuration(detailAppt)}
          onClose={() => setDetailAppt(null)}
          onEdit={() => {
            setApptModal(detailAppt);
            setDetailAppt(null);
          }}
          onDelete={() => {
            confirmDeleteAppointment(detailAppt);
            setDetailAppt(null);
          }}
        />
      )}
      {dayListDate && (
        <DayBookingsSheet
          iso={dayListDate}
          appts={appointments
            .filter((a) => a.date === dayListDate)
            .sort((a, b) => a.time.localeCompare(b.time))}
          clientById={clientById}
          categoryOf={categoryOf}
          apptServiceNames={apptServiceNames}
          onClose={() => setDayListDate(null)}
          onSelect={(a) => {
            setDayListDate(null);
            setDetailAppt(a);
          }}
        />
      )}
      {clientDetailId && (
        <ClientDetailModal
          client={clientById(clientDetailId)}
          appointments={appointments
            .filter((a) => a.clientId === clientDetailId)
            .sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)))}
          categoryOf={categoryOf}
          apptServiceNames={apptServiceNames}
          apptTotal={apptTotal}
          onClose={() => setClientDetailId(null)}
          onSelectAppt={(a) => {
            setClientDetailId(null);
            setDetailAppt(a);
          }}
        />
      )}
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => {
            confirmState.onConfirm();
            setConfirmState(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- header ---------- */
function Header({ tab, search, setSearch }) {
  const titles = { bookings: "All Bookings", calendar: "Calendar", services: "Services", clients: "Clients" };
  const [showSearch, setShowSearch] = useState(false);
  return (
    <div style={{ background: SURFACE, borderColor: BORDER }} className="border-b px-4 pt-5 pb-3">
      <div className="flex items-center justify-between">
        <div>
          <div style={{ fontFamily: SERIF, color: ACCENT }} className="text-[11px] tracking-wide">
            Kay Kay Nails
          </div>
          <h1 style={{ fontFamily: SERIF }} className="text-2xl leading-tight">
            {titles[tab]}
          </h1>
        </div>
        {tab === "bookings" && (
          <button
            onClick={() => setShowSearch((v) => !v)}
            style={{ background: SURFACE_2 }}
            className="w-9 h-9 rounded-full flex items-center justify-center"
          >
            <Search size={16} color={TEXT_DIM} />
          </button>
        )}
      </div>
      {tab === "bookings" && showSearch && (
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search client or service…"
          style={{ background: SURFACE_2, color: TEXT, borderColor: BORDER }}
          className="mt-3 w-full text-sm rounded-xl border px-3 py-2 outline-none"
        />
      )}
    </div>
  );
}

/* ---------- bottom nav ---------- */
function BottomNav({ tab, setTab }) {
  const items = [
    { id: "bookings", label: "Bookings", icon: ListChecks },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "services", label: "Services", icon: Sparkles },
    { id: "clients", label: "Clients", icon: Users },
  ];
  return (
    <div
      style={{ background: SURFACE, borderColor: BORDER }}
      className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto border-t flex z-10"
    >
      {items.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center gap-1 py-3"
          >
            <Icon size={25} color={active ? ACCENT : NAV_INACTIVE} strokeWidth={active ? 2.4 : 2} />
            <span style={{ color: active ? ACCENT : NAV_INACTIVE }} className="text-[12px] font-semibold">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- shared bits ---------- */
function CategoryDot({ category, size = 8 }) {
  return (
    <span
      style={{ background: CATEGORY_COLORS[category] || "#888", width: size, height: size }}
      className="inline-block rounded-full shrink-0"
    />
  );
}

function IconBtn({ onClick, children, href }) {
  const cls =
    "w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform";
  if (href) {
    return (
      <a href={href} style={{ background: SURFACE_2 }} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} style={{ background: SURFACE_2 }} className={cls}>
      {children}
    </button>
  );
}

/* ---------- bookings ---------- */
function StatPill({ label, value }) {
  return (
    <div style={{ background: SURFACE, borderColor: BORDER }} className="flex-1 rounded-xl border px-2.5 py-2 text-center">
      <div style={{ color: TEXT_DIM }} className="text-[10px]">{label}</div>
      <div style={{ color: ACCENT }} className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function BookingsView({ appts, clientById, categoryOf, apptServiceNames, earnings, onEdit, onDelete }) {
  return (
    <div>
      {earnings && (
        <div className="flex gap-2 mb-4">
          <StatPill label="Today" value={money(earnings.today)} />
          <StatPill label="This week" value={money(earnings.week)} />
          <StatPill label="This month" value={money(earnings.month)} />
        </div>
      )}
      {appts.length === 0 ? (
        <EmptyState text="No bookings yet. Tap + to add the first appointment." />
      ) : (
        <div className="flex flex-col gap-2">
          {appts.map((a) => {
            const client = clientById(a.clientId);
            const cat = categoryOf(a);
            return (
              <div key={a.id} style={{ background: SURFACE, borderColor: BORDER }} className="rounded-2xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[15px] truncate">{client?.name || "Unknown"}</span>
                    </div>
                    <div style={{ color: TEXT_DIM }} className="text-xs mt-0.5">
                      {prettyDate(a.date)} · {prettyTime(a.time)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <CategoryDot category={cat} />
                      <span style={{ color: CATEGORY_COLORS[cat] }} className="text-xs font-medium truncate">
                        {apptServiceNames(a)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <IconBtn href={client?.phone ? `tel:${client.phone}` : undefined}>
                      <Phone size={14} color={TEXT_DIM} />
                    </IconBtn>
                    <IconBtn href={client?.phone ? `sms:${client.phone}` : undefined}>
                      <MessageCircle size={14} color={TEXT_DIM} />
                    </IconBtn>
                    <IconBtn onClick={() => onEdit(a)}>
                      <Pencil size={14} color={TEXT_DIM} />
                    </IconBtn>
                    <IconBtn onClick={() => onDelete(a)}>
                      <Trash2 size={14} color="#D97070" />
                    </IconBtn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- calendar ---------- */
const MAX_CHIPS_PER_DAY = 3;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(d) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}
function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function ViewToggle({ view, setView }) {
  const opts = [["day", "Day"], ["week", "Week"], ["month", "Month"]];
  return (
    <div style={{ background: SURFACE }} className="flex rounded-full p-1 mb-4">
      {opts.map(([id, label]) => {
        const active = view === id;
        return (
          <button
            key={id}
            onClick={() => setView(id)}
            style={{ background: active ? ACCENT : "transparent", color: active ? "#1A1215" : TEXT_DIM }}
            className="flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function CategoryLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-5">
      {CATEGORY_ORDER.map((cat) => (
        <div key={cat} className="flex items-center gap-1.5">
          <CategoryDot category={cat} size={8} />
          <span style={{ color: TEXT_DIM }} className="text-[10px]">{cat}</span>
        </div>
      ))}
    </div>
  );
}

function AgendaRow({ appt, client, category, serviceNames, onSelect }) {
  const color = CATEGORY_COLORS[category] || "#888";
  return (
    <button
      onClick={() => onSelect(appt)}
      style={{ background: SURFACE, borderColor: BORDER }}
      className="w-full flex items-stretch gap-2.5 rounded-xl border overflow-hidden text-left active:scale-[0.99] transition-transform"
    >
      <div style={{ background: color }} className="w-1.5 shrink-0" />
      <div className="py-2.5 pr-3 min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate">{client?.name || "—"}</span>
          <span style={{ color: TEXT_DIM }} className="text-xs shrink-0">{prettyTime(appt.time)}</span>
        </div>
        <span style={{ color }} className="text-xs font-medium truncate block mt-0.5">{serviceNames}</span>
      </div>
    </button>
  );
}

function CalendarView({ cursor, setCursor, view, setView, appointments, clientById, categoryOf, apptServiceNames, onSelect, onDaySelect }) {
  const apptsByDay = useMemo(() => {
    const map = {};
    appointments.forEach((a) => {
      (map[a.date] ||= []).push(a);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  }, [appointments]);

  function goPrev() {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    else if (view === "week") setCursor(addDays(cursor, -7));
    else setCursor(addDays(cursor, -1));
  }
  function goNext() {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    else if (view === "week") setCursor(addDays(cursor, 7));
    else setCursor(addDays(cursor, 1));
  }

  let headerLabel;
  if (view === "month") {
    headerLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } else if (view === "week") {
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    headerLabel = sameMonth
      ? `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.getDate()}, ${end.getFullYear()}`
      : `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${end.getFullYear()}`;
  } else {
    headerLabel = cursor.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  return (
    <div>
      <ViewToggle view={view} setView={setView} />

      <div className="flex items-center justify-between mb-3">
        <button onClick={goPrev} style={{ background: SURFACE }} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
          <ChevronLeft size={16} color={TEXT_DIM} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ fontFamily: SERIF }} className="text-base truncate">{headerLabel}</span>
          <button onClick={() => setCursor(new Date())} style={{ color: ACCENT }} className="text-[11px] font-semibold shrink-0">Today</button>
        </div>
        <button onClick={goNext} style={{ background: SURFACE }} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
          <ChevronRight size={16} color={TEXT_DIM} />
        </button>
      </div>

      {view === "month" && (
        <MonthGrid cursor={cursor} apptsByDay={apptsByDay} clientById={clientById} categoryOf={categoryOf} onSelect={onSelect} onDaySelect={onDaySelect} />
      )}
      {view === "week" && (
        <WeekGrid cursor={cursor} apptsByDay={apptsByDay} clientById={clientById} categoryOf={categoryOf} apptServiceNames={apptServiceNames} onSelect={onSelect} />
      )}
      {view === "day" && (
        <DayAgenda cursor={cursor} apptsByDay={apptsByDay} clientById={clientById} categoryOf={categoryOf} apptServiceNames={apptServiceNames} onSelect={onSelect} />
      )}

      <CategoryLegend />
    </div>
  );
}

function MonthGrid({ cursor, apptsByDay, clientById, categoryOf, onSelect, onDaySelect }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = isoDate(new Date());

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ color: TEXT_DIM }} className="text-[10px] py-1">{d}</div>
        ))}
      </div>
      <div
        style={{ background: BORDER }}
        className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border"
      >
        {cells.map((d, i) => {
          if (d === null) return <div key={i} style={{ background: BG }} />;
          const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
          const dayItems = apptsByDay[iso] || [];
          const visible = dayItems.slice(0, MAX_CHIPS_PER_DAY);
          const extra = dayItems.length - visible.length;
          const isToday = iso === todayIso;
          return (
            <div
              key={i}
              onClick={() => dayItems.length > 0 && onDaySelect(iso)}
              style={{ background: BG }}
              className="p-0.5 min-h-[64px] flex flex-col gap-[2px]"
            >
              <span
                style={{
                  background: isToday ? ACCENT : "transparent",
                  color: isToday ? "#1A1215" : dayItems.length ? TEXT : TEXT_DIM,
                }}
                className="text-[10px] font-semibold w-4 h-4 rounded-full flex items-center justify-center ml-0.5"
              >
                {d}
              </span>
              {visible.map((a) => {
                const client = clientById(a.clientId);
                const color = CATEGORY_COLORS[categoryOf(a)] || "#888";
                return (
                  <button
                    key={a.id}
                    onClick={(e) => { e.stopPropagation(); onSelect(a); }}
                    style={{ background: color }}
                    className="w-full text-left rounded-[4px] px-1 py-[1px] active:scale-95 transition-transform"
                  >
                    <span style={{ color: "#1A1215" }} className="text-[9px] font-semibold leading-tight block truncate">
                      {client?.name || "—"}
                    </span>
                  </button>
                );
              })}
              {extra > 0 && (
                <span style={{ color: TEXT_DIM }} className="text-[9px] pl-0.5">+{extra} more</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function WeekGrid({ cursor, apptsByDay, clientById, categoryOf, apptServiceNames, onSelect }) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const todayIso = isoDate(new Date());

  return (
    <div className="flex flex-col gap-3">
      {days.map((d) => {
        const iso = isoDate(d);
        const items = apptsByDay[iso] || [];
        const isToday = iso === todayIso;
        return (
          <div key={iso}>
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ color: isToday ? ACCENT : TEXT_DIM }} className="text-xs font-semibold">
                {WEEKDAY_LABELS[d.getDay()]} {d.getDate()}
              </span>
              {isToday && <span style={{ background: ACCENT }} className="w-1.5 h-1.5 rounded-full" />}
            </div>
            {items.length === 0 ? (
              <div style={{ color: TEXT_DIM }} className="text-xs pl-0.5 pb-1">No bookings</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {items.map((a) => (
                  <AgendaRow
                    key={a.id}
                    appt={a}
                    client={clientById(a.clientId)}
                    category={categoryOf(a)}
                    serviceNames={apptServiceNames(a)}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DayAgenda({ cursor, apptsByDay, clientById, categoryOf, apptServiceNames, onSelect }) {
  const iso = isoDate(cursor);
  const items = apptsByDay[iso] || [];
  if (items.length === 0) return <EmptyState text="No bookings this day." />;
  return (
    <div className="flex flex-col gap-2">
      {items.map((a) => (
        <AgendaRow
          key={a.id}
          appt={a}
          client={clientById(a.clientId)}
          category={categoryOf(a)}
          serviceNames={apptServiceNames(a)}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

/* ---------- booking detail ---------- */
function DetailRow({ label, value }) {
  return (
    <div className="py-2.5 border-b" style={{ borderColor: BORDER }}>
      <div style={{ color: TEXT_DIM }} className="text-[11px] mb-0.5">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function BookingDetailModal({ appt, client, category, serviceNames, total, duration, onClose, onEdit, onDelete }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        style={{ background: SURFACE, borderColor: BORDER }}
        className="w-full max-h-[88%] overflow-y-auto rounded-t-3xl border-t p-5"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CategoryDot category={category} size={10} />
            <h2 style={{ fontFamily: SERIF }} className="text-lg">{client?.name || "Booking"}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <IconBtn href={client?.phone ? `tel:${client.phone}` : undefined}><Phone size={14} color={TEXT_DIM} /></IconBtn>
            <IconBtn href={client?.phone ? `sms:${client.phone}` : undefined}><MessageCircle size={14} color={TEXT_DIM} /></IconBtn>
            <IconBtn onClick={onClose}><X size={15} color={TEXT_DIM} /></IconBtn>
          </div>
        </div>

        <div className="mt-3">
          <DetailRow label="Client" value={client?.name || "—"} />
          <DetailRow label="Phone number" value={client?.phone || "—"} />
          <DetailRow label="Service" value={<span style={{ color: CATEGORY_COLORS[category] }}>{serviceNames}</span>} />
          <DetailRow label="Date" value={prettyDate(appt.date)} />
          <DetailRow label="Start time" value={prettyTime(appt.time)} />
          <DetailRow label="Duration" value={`${duration} min`} />
          <DetailRow label="Total price" value={money(total)} />
          {appt.notes && <DetailRow label="Notes" value={appt.notes} />}
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onEdit}
            style={{ background: SURFACE_2, color: TEXT, borderColor: BORDER }}
            className="flex-1 rounded-xl border py-3 text-sm font-medium flex items-center justify-center gap-1.5"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={onDelete}
            style={{ background: "#3A2020", color: "#E88C8C" }}
            className="flex-1 rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-1.5"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
        <button
          onClick={onClose}
          style={{ background: "transparent", color: TEXT_DIM, borderColor: BORDER }}
          className="w-full mt-3 rounded-xl border py-3 text-sm font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ---------- day bookings sheet (tap a day in Month view) ---------- */
function DayBookingsSheet({ iso, appts, clientById, categoryOf, apptServiceNames, onClose, onSelect }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        style={{ background: SURFACE, borderColor: BORDER }}
        className="w-full max-h-[80%] overflow-y-auto rounded-t-3xl border-t p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: SERIF }} className="text-lg">{prettyDate(iso)}</h2>
          <button onClick={onClose} style={{ background: SURFACE_2 }} className="w-8 h-8 rounded-full flex items-center justify-center">
            <X size={15} color={TEXT_DIM} />
          </button>
        </div>

        {appts.length === 0 ? (
          <EmptyState text="No bookings this day." compact />
        ) : (
          <div className="flex flex-col gap-2">
            {appts.map((a) => (
              <AgendaRow
                key={a.id}
                appt={a}
                client={clientById(a.clientId)}
                category={categoryOf(a)}
                serviceNames={apptServiceNames(a)}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          style={{ background: SURFACE_2, color: TEXT, borderColor: BORDER }}
          className="w-full mt-4 rounded-xl border py-3 text-sm font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ---------- confirm dialog ---------- */
function ConfirmDialog({ message, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.65)" }}>
      <div style={{ background: SURFACE, borderColor: BORDER }} className="w-full max-w-[340px] rounded-2xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} color="#E88C8C" />
          <span style={{ fontFamily: SERIF }} className="text-base">Are you sure?</span>
        </div>
        <p style={{ color: TEXT_DIM }} className="text-sm mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            style={{ background: SURFACE_2, color: TEXT, borderColor: BORDER }}
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ background: "#3A2020", color: "#E88C8C" }}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- client detail ---------- */
function ClientDetailModal({ client, appointments, categoryOf, apptServiceNames, apptTotal, onClose, onSelectAppt }) {
  const totalSpent = appointments.reduce((sum, a) => sum + apptTotal(a), 0);
  return (
    <div className="fixed inset-0 z-20 flex items-end" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        style={{ background: SURFACE, borderColor: BORDER }}
        className="w-full max-h-[85%] overflow-y-auto rounded-t-3xl border-t p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: SERIF }} className="text-lg">{client?.name || "Client"}</h2>
          <button onClick={onClose} style={{ background: SURFACE_2 }} className="w-8 h-8 rounded-full flex items-center justify-center">
            <X size={15} color={TEXT_DIM} />
          </button>
        </div>

        <div className="flex gap-2 mb-5">
          <IconBtn href={client?.phone ? `tel:${client.phone}` : undefined}><Phone size={14} color={TEXT_DIM} /></IconBtn>
          <IconBtn href={client?.phone ? `sms:${client.phone}` : undefined}><MessageCircle size={14} color={TEXT_DIM} /></IconBtn>
          <span style={{ color: TEXT_DIM }} className="text-sm self-center">{client?.phone || "No phone on file"}</span>
        </div>

        <div className="flex gap-2 mb-5">
          <StatPill label="Bookings" value={appointments.length} />
          <StatPill label="Total spent" value={money(totalSpent)} />
        </div>

        <div style={{ color: TEXT_DIM }} className="text-xs font-semibold tracking-wide mb-2">BOOKING HISTORY</div>
        {appointments.length === 0 ? (
          <EmptyState text="No bookings yet for this client." compact />
        ) : (
          <div className="flex flex-col gap-2">
            {appointments.map((a) => (
              <AgendaRow
                key={a.id}
                appt={a}
                client={client}
                category={categoryOf(a)}
                serviceNames={apptServiceNames(a)}
                onSelect={onSelectAppt}
              />
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          style={{ background: SURFACE_2, color: TEXT, borderColor: BORDER }}
          className="w-full mt-4 rounded-xl border py-3 text-sm font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ---------- services ---------- */
function ServicesView({ services, serviceStats, onAdd, onEdit, onDelete }) {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: services.filter((s) => s.category === cat),
  })).filter((g) => g.items.length);

  const topServices = (serviceStats || []).slice(0, 5);

  return (
    <div className="flex flex-col gap-5">
      {topServices.length > 0 && (
        <div>
          <div style={{ color: TEXT_DIM }} className="text-xs font-semibold tracking-wide mb-2">MOST BOOKED</div>
          <div style={{ background: SURFACE, borderColor: BORDER }} className="rounded-2xl border divide-y">
            {topServices.map(({ service, count, revenue }) => (
              <div key={service.id} style={{ borderColor: BORDER }} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryDot category={service.category} />
                  <span className="text-sm font-medium truncate">{service.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span style={{ color: TEXT_DIM }} className="text-xs">{count} booking{count === 1 ? "" : "s"}</span>
                  <span style={{ color: ACCENT }} className="text-sm font-semibold">{money(revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {grouped.map(({ cat, items }) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-2">
            <CategoryDot category={cat} size={9} />
            <span style={{ color: CATEGORY_COLORS[cat] }} className="text-xs font-semibold tracking-wide">
              {cat}
            </span>
          </div>
          <div style={{ background: SURFACE, borderColor: BORDER }} className="rounded-2xl border divide-y" >
            {items.map((s) => (
              <div key={s.id} style={{ borderColor: BORDER }} className="flex items-center justify-between px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div style={{ color: TEXT_DIM }} className="text-xs">{s.duration} min</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm">{money(s.price)}</span>
                  <IconBtn onClick={() => onEdit(s)}><Pencil size={13} color={TEXT_DIM} /></IconBtn>
                  <IconBtn onClick={() => onDelete(s)}><Trash2 size={13} color="#D97070" /></IconBtn>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- clients ---------- */
function ClientsView({ clients, appointments, onAdd, onEdit, onDelete, onSelectClient, onExport }) {
  const countFor = (id) => appointments.filter((a) => a.clientId === id).length;
  return (
    <div>
      {clients.length === 0 ? (
        <EmptyState text="No clients yet. Tap + to add one." />
      ) : (
        <div style={{ background: SURFACE, borderColor: BORDER }} className="rounded-2xl border divide-y">
          {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <div key={c.id} style={{ borderColor: BORDER }} className="flex items-center justify-between px-3 py-3">
              <button onClick={() => onSelectClient(c)} className="min-w-0 text-left flex-1">
                <div className="text-sm font-medium">{c.name}</div>
                <div style={{ color: TEXT_DIM }} className="text-xs">{c.phone} · {countFor(c.id)} booking{countFor(c.id) === 1 ? "" : "s"}</div>
              </button>
              <div className="flex items-center gap-1.5 shrink-0">
                <IconBtn href={`tel:${c.phone}`}><Phone size={13} color={TEXT_DIM} /></IconBtn>
                <IconBtn onClick={() => onEdit(c)}><Pencil size={13} color={TEXT_DIM} /></IconBtn>
                <IconBtn onClick={() => onDelete(c)}><Trash2 size={13} color="#D97070" /></IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={onExport}
        style={{ background: SURFACE, borderColor: BORDER, color: TEXT_DIM }}
        className="w-full mt-4 rounded-xl border py-2.5 text-xs font-medium flex items-center justify-center gap-1.5"
      >
        <Download size={13} /> Export backup (clients, services, bookings)
      </button>
    </div>
  );
}

function EmptyState({ text, compact }) {
  return (
    <div style={{ color: TEXT_DIM }} className={`text-sm text-center ${compact ? "py-6" : "py-16"}`}>
      {text}
    </div>
  );
}

/* ---------- modal shell ---------- */
function ModalShell({ title, onClose, children, onSubmit, submitLabel = "Save" }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        style={{ background: SURFACE, borderColor: BORDER }}
        className="w-full max-h-[88%] overflow-y-auto rounded-t-3xl border-t p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: SERIF }} className="text-lg">{title}</h2>
          <button onClick={onClose} style={{ background: SURFACE_2 }} className="w-8 h-8 rounded-full flex items-center justify-center">
            <X size={15} color={TEXT_DIM} />
          </button>
        </div>
        {children}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            style={{ background: SURFACE_2, color: TEXT, borderColor: BORDER }}
            className="flex-1 rounded-xl border py-3 text-sm font-medium active:scale-[0.99] transition-transform"
          >
            Cancel
          </button>
          {onSubmit && (
            <button
              onClick={onSubmit}
              style={{ background: ACCENT, color: "#1A1215" }}
              className="flex-1 rounded-xl py-3 text-sm font-semibold active:scale-[0.99] transition-transform"
            >
              {submitLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <div style={{ color: TEXT_DIM }} className="text-xs mb-1">{label}</div>
      {children}
    </div>
  );
}
const inputStyle = { background: SURFACE_2, color: TEXT, borderColor: BORDER };
const inputCls = "w-full text-sm rounded-xl border px-3 py-2.5 outline-none";

/* ---------- appointment modal ---------- */
function AppointmentModal({ appt, clients, services, appointments, onSave, onClose, onAddClient }) {
  const isNew = !appt.id;
  const [clientId, setClientId] = useState(appt.clientId || "");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [addingClient, setAddingClient] = useState(false);
  const [clientError, setClientError] = useState("");
  const [serviceIds, setServiceIds] = useState(appt.serviceIds || []);
  const [date, setDate] = useState(appt.date || isoDate(new Date()));
  const [time, setTime] = useState(appt.time || "10:00");
  const [notes, setNotes] = useState(appt.notes || "");

  function toggleService(id) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const totalCost = serviceIds.reduce((sum, id) => sum + (services.find((s) => s.id === id)?.price || 0), 0);
  const totalDuration = serviceIds.reduce((sum, id) => sum + (services.find((s) => s.id === id)?.duration || 0), 0);

  const conflict = useMemo(() => {
    if (!date || !time || totalDuration === 0) return null;
    const start = timeToMin(time);
    const end = start + totalDuration;
    return (appointments || []).find((a) => {
      if (a.id === appt.id) return false; // ignore self when editing
      if (a.date !== date) return false;
      const aStart = timeToMin(a.time);
      const aDur = (a.serviceIds || []).reduce((sum, id) => sum + (services.find((s) => s.id === id)?.duration || 0), 0);
      return rangesOverlap(start, end, aStart, aStart + aDur);
    });
  }, [date, time, totalDuration, appointments, appt.id, services]);

  function isDuplicateName(name) {
    const n = name.trim().toLowerCase();
    return clients.find((c) => c.name.trim().toLowerCase() === n);
  }

  function handleSave() {
    let finalClientId = clientId;
    if (addingClient) {
      const trimmed = newClientName.trim();
      if (!trimmed) return;
      const dup = isDuplicateName(trimmed);
      if (dup) {
        setClientError(`"${dup.name}" is already a client — select them from the list instead.`);
        return;
      }
      const c = onAddClient(trimmed, newClientPhone.trim());
      finalClientId = c.id;
    }
    if (!finalClientId || serviceIds.length === 0 || !date || !time) return;
    onSave({ id: appt.id || uid(), clientId: finalClientId, serviceIds, date, time, notes });
  }

  return (
    <ModalShell title={isNew ? "New booking" : "Edit booking"} onClose={onClose} onSubmit={handleSave} submitLabel={isNew ? "Add booking" : "Save changes"}>
      <Field label="Client">
        {!addingClient ? (
          <>
            <select style={inputStyle} className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select a client…</option>
              {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={() => { setAddingClient(true); setClientError(""); }} style={{ color: ACCENT }} className="text-xs mt-1.5">+ New client instead</button>
          </>
        ) : (
          <>
            <input
              style={inputStyle} className={inputCls} placeholder="Client name" value={newClientName}
              onChange={(e) => { setNewClientName(e.target.value); setClientError(""); }}
            />
            <input style={inputStyle} className={inputCls + " mt-2"} placeholder="Phone number" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} />
            {clientError && <div style={{ color: "#E88C8C" }} className="text-xs mt-1.5">{clientError}</div>}
            <button onClick={() => { setAddingClient(false); setClientError(""); }} style={{ color: ACCENT }} className="text-xs mt-1.5">Choose existing client instead</button>
          </>
        )}
      </Field>

      <Field label="Services">
        <div
          style={{ borderColor: BORDER }}
          className="flex flex-wrap gap-2 max-h-[210px] overflow-y-auto border rounded-xl p-2.5"
        >
          {services.map((s) => {
            const checked = serviceIds.includes(s.id);
            const color = CATEGORY_COLORS[s.category] || ACCENT;
            return (
              <button
                key={s.id}
                onClick={() => toggleService(s.id)}
                style={{
                  background: checked ? color : SURFACE_2,
                  borderColor: checked ? color : BORDER,
                }}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 active:scale-95 transition-transform"
              >
                {!checked && <CategoryDot category={s.category} size={7} />}
                <span style={{ color: checked ? "#1A1215" : TEXT }} className="text-xs font-medium whitespace-nowrap">
                  {s.name}
                </span>
                <span style={{ color: checked ? "#1A1215" : TEXT_DIM }} className="text-[11px] whitespace-nowrap">
                  {money(s.price)}
                </span>
                {checked && <Check size={12} color="#1A1215" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        {serviceIds.length > 0 && (
          <div style={{ background: SURFACE_2, borderColor: BORDER }} className="rounded-xl border mt-3 px-3 py-2.5 flex items-center justify-between">
            <div>
              <span style={{ color: TEXT_DIM }} className="text-xs">Total duration </span>
              <span className="text-sm font-medium">{totalDuration} min</span>
            </div>
            <div>
              <span style={{ color: TEXT_DIM }} className="text-xs">Total cost </span>
              <span style={{ color: ACCENT }} className="text-sm font-semibold">{money(totalCost)}</span>
            </div>
          </div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" style={inputStyle} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Start time">
          <input type="time" style={inputStyle} className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>

      {conflict && (
        <div style={{ background: "#3A2A20", borderColor: "#6B4A2E" }} className="rounded-xl border px-3 py-2.5 mb-3 flex items-start gap-2">
          <AlertTriangle size={15} color="#E8B36E" className="shrink-0 mt-0.5" />
          <span style={{ color: "#E8B36E" }} className="text-xs">
            This overlaps {clients.find((c) => c.id === conflict.clientId)?.name || "another booking"}'s {prettyTime(conflict.time)} appointment. You can still save, just double-check the schedule.
          </span>
        </div>
      )}

      <Field label="Notes (optional)">
        <textarea style={inputStyle} className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </ModalShell>
  );
}

/* ---------- client modal ---------- */
function ClientModal({ client, clients, onSave, onClose }) {
  const [name, setName] = useState(client.name || "");
  const [phone, setPhone] = useState(client.phone || "");
  const [error, setError] = useState("");

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const dup = clients.find(
      (c) => c.id !== client.id && c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (dup) {
      setError(`A client named "${dup.name}" already exists.`);
      return;
    }
    onSave({ id: client.id || uid(), name: trimmed, phone: phone.trim() });
  }

  return (
    <ModalShell
      title={client.id ? "Edit client" : "New client"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={client.id ? "Save changes" : "Add client"}
    >
      <Field label="Name">
        <input style={inputStyle} className={inputCls} value={name} onChange={(e) => { setName(e.target.value); setError(""); }} />
      </Field>
      {error && <div style={{ color: "#E88C8C" }} className="text-xs -mt-2 mb-3">{error}</div>}
      <Field label="Phone number">
        <input style={inputStyle} className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
    </ModalShell>
  );
}

/* ---------- service modal ---------- */
function ServiceModal({ service, onSave, onClose }) {
  const [name, setName] = useState(service.name || "");
  const [duration, setDuration] = useState(service.duration ?? 30);
  const [price, setPrice] = useState(service.price ?? 0);
  const [category, setCategory] = useState(service.category || CATEGORY_ORDER[0]);
  return (
    <ModalShell
      title={service.id ? "Edit service" : "New service"}
      onClose={onClose}
      onSubmit={() =>
        name.trim() &&
        onSave({ id: service.id || uid(), name: name.trim(), duration: Number(duration), price: Number(price), category })
      }
      submitLabel={service.id ? "Save changes" : "Add service"}
    >
      <Field label="Service name">
        <input style={inputStyle} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Category">
        <select style={inputStyle} className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration (mins)">
          <input type="number" style={inputStyle} className={inputCls} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        <Field label="Price (€)">
          <input type="number" style={inputStyle} className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>
    </ModalShell>
  );
}
