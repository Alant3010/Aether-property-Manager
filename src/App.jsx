
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  Lock,
  LogOut,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import "./style.css";

const SUPABASE_URL = "https://ygejzdvgjvgjahtwejiw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mbHm2pcEtZN-GzNCrPwL5Q_fw7w5fqU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatDate(date) {
  if (!date) return "";
  return new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function datesOverlap(a1, a2, b1, b2) {
  if (!a1 || !a2 || !b1 || !b2) return false;
  return new Date(a1) < new Date(b2) && new Date(b1) < new Date(a2);
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function isDateInsideBooking(dateValue, booking) {
  const date = new Date(dateValue);
  return date >= new Date(booking.check_in) && date < new Date(booking.check_out);
}

const emptyBooking = {
  property_id: "",
  guest_name: "",
  phone: "",
  source: "Direct",
  check_in: "",
  check_out: "",
  amount: "",
  number_of_guests: "",
  advance_paid: "",
  payment_mode: "Cash",
  balance_amount: "",
  notes: "",
};

export default function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [activeView, setActiveView] = useState("calendar");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [query, setQuery] = useState("");
  const [filterProperty, setFilterProperty] = useState("all");

  const [newPropertyName, setNewPropertyName] = useState("");
  const [editingPropertyId, setEditingPropertyId] = useState("");
  const [editingPropertyName, setEditingPropertyName] = useState("");

  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  });
  const [selectedCalendarPropertyId, setSelectedCalendarPropertyId] = useState("");

  const [bookingForm, setBookingForm] = useState(emptyBooking);

  const notice = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 4500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const propertyResult = await supabase.from("properties").select("*").order("name");
      const bookingResult = await supabase.from("bookings").select("*").order("check_in");

      if (propertyResult.error) throw propertyResult.error;
      if (bookingResult.error) throw bookingResult.error;

      const propertyData = propertyResult.data || [];
      const bookingData = bookingResult.data || [];

      setProperties(propertyData);
      setBookings(bookingData);

      if (propertyData.length > 0) {
        setBookingForm((old) => ({ ...old, property_id: old.property_id || propertyData[0].id }));
        setSelectedCalendarPropertyId((old) => old || propertyData[0].id);
      }
    } catch (err) {
      console.error(err);
      notice("Database loading failed. Check Supabase SQL tables and internet connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadData();
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) loadData();
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const login = async () => {
    if (!email || !password) return notice("Enter email and password.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return notice(error.message);
    } catch (err) {
      console.error(err);
      notice("Login failed. Open the deployed app link, not the Supabase backend link.");
    } finally {
      setLoading(false);
    }
  };

  const signUp = async () => {
    if (!email || !password) return notice("Enter email and password.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return notice(error.message);
      notice("Account created. If email confirmation is enabled, confirm email first, then login.");
    } catch (err) {
      console.error(err);
      notice("Signup failed. Open the deployed app link, not the Supabase backend link.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const selectedProperty = properties.find((p) => p.id === bookingForm.property_id);

  const conflicts = useMemo(() => {
    return bookings.filter(
      (b) =>
        b.property_id === bookingForm.property_id &&
        datesOverlap(bookingForm.check_in, bookingForm.check_out, b.check_in, b.check_out)
    );
  }, [bookings, bookingForm.property_id, bookingForm.check_in, bookingForm.check_out]);

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => filterProperty === "all" || b.property_id === filterProperty)
      .filter((b) => {
        const propertyName = properties.find((p) => p.id === b.property_id)?.name || "";
        return `${b.guest_name} ${b.phone} ${b.source} ${propertyName} ${b.notes} ${b.payment_mode}`
          .toLowerCase()
          .includes(query.toLowerCase());
      })
      .sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
  }, [bookings, properties, query, filterProperty]);

  const buildCalendarDays = (propertyId) => {
    const [yearText, monthText] = calendarMonth.split("-");
    const year = Number(yearText);
    const month = Number(monthText) - 1;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ type: "blank", id: `blank-${propertyId}-${i}` });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const value = toDateInput(new Date(year, month, day));
      const dayBookings = bookings.filter(
        (b) => b.property_id === propertyId && isDateInsideBooking(value, b)
      );
      days.push({ type: "day", id: `${propertyId}-${value}`, day, bookings: dayBookings });
    }

    return days;
  };

  const addProperty = async () => {
    const name = newPropertyName.trim();
    if (!name) return notice("Enter property name.");
    const { error } = await supabase.from("properties").insert({ name });
    if (error) return notice(error.message);
    setNewPropertyName("");
    await loadData();
    notice("Property added.");
  };

  const updateProperty = async () => {
    const name = editingPropertyName.trim();
    if (!name) return notice("Property name cannot be empty.");
    const { error } = await supabase.from("properties").update({ name }).eq("id", editingPropertyId);
    if (error) return notice(error.message);
    setEditingPropertyId("");
    setEditingPropertyName("");
    await loadData();
    notice("Property updated.");
  };

  const deleteProperty = async (id) => {
    if (bookings.some((b) => b.property_id === id)) {
      return notice("Delete this property's bookings first, then delete the property.");
    }
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) return notice(error.message);
    await loadData();
    notice("Property deleted.");
  };

  const addBooking = async () => {
    if (!bookingForm.property_id) return notice("Select a property.");
    if (!bookingForm.guest_name || !bookingForm.check_in || !bookingForm.check_out) {
      return notice("Enter guest name, check-in date and check-out date.");
    }
    if (new Date(bookingForm.check_in) >= new Date(bookingForm.check_out)) {
      return notice("Check-out must be after check-in.");
    }
    if (conflicts.length > 0) {
      return notice("Date already booked for this property. Existing booking is shown below.");
    }

    const { error } = await supabase.from("bookings").insert({
      ...bookingForm,
      created_by: session?.user?.id || null,
    });

    if (error) return notice(error.message);

    setBookingForm({
      ...emptyBooking,
      property_id: properties[0]?.id || "",
    });
    await loadData();
    notice("Booking saved.");
  };

  const deleteBooking = async (id) => {
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) return notice(error.message);
    await loadData();
    notice("Booking deleted.");
  };

  const addStaffUser = async () => {
    if (!staffEmail || !staffPassword) return notice("Enter staff email and password.");
    const { error } = await supabase.auth.signUp({ email: staffEmail, password: staffPassword });
    if (error) return notice(error.message);
    setStaffEmail("");
    setStaffPassword("");
    notice("Staff login created. Confirm email if Supabase requires it.");
  };

  const exportCSV = () => {
    const header = [
      "Property",
      "Guest",
      "Phone",
      "Source",
      "Check In",
      "Check Out",
      "Total Amount",
      "Number of Guests",
      "Advance Paid",
      "Payment Mode",
      "Balance Amount",
      "Notes",
    ];

    const rows = bookings.map((b) => {
      const property = properties.find((p) => p.id === b.property_id)?.name || b.property_id;
      return [
        property,
        b.guest_name,
        b.phone,
        b.source,
        b.check_in,
        b.check_out,
        b.amount,
        b.number_of_guests,
        b.advance_paid,
        b.payment_mode,
        b.balance_amount,
        b.notes,
      ];
    });

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
      .join(String.fromCharCode(10));

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "property-bookings.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!session) {
    return (
      <div className="loginPage">
        <div className="loginBox">
          <div className="loginHeader">
            <div className="iconBox"><Lock size={30} /></div>
            <div>
              <h1>Aether Property Manager</h1>
              <p>Cloud login powered by Supabase</p>
            </div>
          </div>

          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />

          {message && <div className="notice">{message}</div>}

          <button className="primaryBtn" onClick={authMode === "login" ? login : signUp} disabled={loading}>
            {loading ? "Please wait..." : authMode === "login" ? "Login" : "Create Account"}
          </button>

          <button className="secondaryBtn" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>
            {authMode === "login" ? "Create first admin account" : "Already have account? Login"}
          </button>
        </div>
      </div>
    );
  }

  const activePropertyId = selectedCalendarPropertyId || properties[0]?.id;

  return (
    <div className="app">
      <header>
        <div>
          <h1>Aether Property Manager</h1>
          <p>Logged in as {session.user.email}</p>
        </div>
        <nav>
          <button className={activeView === "calendar" ? "active" : ""} onClick={() => setActiveView("calendar")}>Calendar</button>
          <button className={activeView === "bookings" ? "active" : ""} onClick={() => setActiveView("bookings")}>Bookings</button>
          <button className={activeView === "properties" ? "active" : ""} onClick={() => setActiveView("properties")}>Properties</button>
          <button className={activeView === "users" ? "active" : ""} onClick={() => setActiveView("users")}>Users</button>
          <button onClick={exportCSV}><Download size={15} /> Export</button>
          <button className="dangerSoft" onClick={logout}><LogOut size={15} /> Logout</button>
        </nav>
      </header>

      {message && <div className="topNotice">{message}</div>}
      {loading && <div className="topNotice">Loading...</div>}

      <section className="stats">
        <div><Building2 /><span>Properties</span><b>{properties.length}</b></div>
        <div><CalendarDays /><span>Bookings</span><b>{bookings.length}</b></div>
        <div><CheckCircle2 /><span>Upcoming</span><b>{bookings.filter((b) => new Date(b.check_out) >= new Date()).length}</b></div>
      </section>

      {activeView === "calendar" && (
        <section className="card">
          <div className="sectionHeader">
            <div>
              <h2>Booking Calendar</h2>
              <p>Scroll properties vertically and select one property calendar.</p>
            </div>
            <input type="month" value={calendarMonth} onChange={(e) => setCalendarMonth(e.target.value)} />
          </div>

          {properties.length === 0 ? (
            <div className="empty">No properties added yet. Add a property first.</div>
          ) : (
            <div className="calendarLayout">
              <div className="propertyScroll">
                {properties.map((p) => (
                  <button key={p.id} className={activePropertyId === p.id ? "selectedProperty" : ""} onClick={() => setSelectedCalendarPropertyId(p.id)}>
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="calendarBox">
                <h3>{properties.find((p) => p.id === activePropertyId)?.name}</h3>
                <div className="week">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d}>{d}</span>)}</div>
                <div className="days">
                  {buildCalendarDays(activePropertyId).map((day) =>
                    day.type === "blank" ? (
                      <div key={day.id} className="day blank"></div>
                    ) : (
                      <div key={day.id} className="day">
                        <b>{day.day}</b>
                        {day.bookings.map((b) => (
                          <div className="bookingChip" key={b.id}>{b.guest_name}</div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeView === "properties" && (
        <section className="card">
          <h2>Manage Properties</h2>
          <div className="inlineForm">
            <input placeholder="New property name" value={newPropertyName} onChange={(e) => setNewPropertyName(e.target.value)} />
            <button className="primaryBtn" onClick={addProperty}>Add Property</button>
          </div>

          <div className="gridList">
            {properties.map((p) => (
              <div className="listItem" key={p.id}>
                {editingPropertyId === p.id ? (
                  <>
                    <input value={editingPropertyName} onChange={(e) => setEditingPropertyName(e.target.value)} />
                    <button onClick={updateProperty}>Save</button>
                    <button onClick={() => setEditingPropertyId("")}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div>
                      <b>{p.name}</b>
                      <p>{bookings.filter((b) => b.property_id === p.id).length} booking(s)</p>
                    </div>
                    <div>
                      <button onClick={() => { setEditingPropertyId(p.id); setEditingPropertyName(p.name); }}>Edit</button>
                      <button className="dangerSoft" onClick={() => deleteProperty(p.id)}><Trash2 size={15} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeView === "users" && (
        <section className="card">
          <h2>Add Staff Login</h2>
          <div className="inlineForm">
            <input placeholder="Staff email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} />
            <input placeholder="Staff password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} />
            <button className="primaryBtn" onClick={addStaffUser}><UserPlus size={15} /> Add Staff</button>
          </div>
        </section>
      )}

      {activeView === "bookings" && (
        <section className="twoCol">
          <div className="card">
            <h2>Add Booking</h2>

            <label>Property</label>
            <select value={bookingForm.property_id} onChange={(e) => setBookingForm({ ...bookingForm, property_id: e.target.value })}>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <label>Guest Name</label>
            <input value={bookingForm.guest_name} onChange={(e) => setBookingForm({ ...bookingForm, guest_name: e.target.value })} placeholder="Guest name" />

            <label>Phone</label>
            <input value={bookingForm.phone} onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })} placeholder="Phone number" />

            <label>Number of Guests</label>
            <input value={bookingForm.number_of_guests} onChange={(e) => setBookingForm({ ...bookingForm, number_of_guests: e.target.value })} placeholder="Eg: 4" />

            <label>Booking Source</label>
            <select value={bookingForm.source} onChange={(e) => setBookingForm({ ...bookingForm, source: e.target.value })}>
              {["Direct", "Airbnb", "MakeMyTrip", "Booking.com", "Other"].map((s) => <option key={s}>{s}</option>)}
            </select>

            <label>Check-in</label>
            <input type="date" value={bookingForm.check_in} onChange={(e) => setBookingForm({ ...bookingForm, check_in: e.target.value })} />

            <label>Check-out</label>
            <input type="date" value={bookingForm.check_out} onChange={(e) => setBookingForm({ ...bookingForm, check_out: e.target.value })} />

            <label>Total Amount</label>
            <input value={bookingForm.amount} onChange={(e) => setBookingForm({ ...bookingForm, amount: e.target.value })} placeholder="₹ total" />

            <label>Advance Paid</label>
            <input value={bookingForm.advance_paid} onChange={(e) => setBookingForm({ ...bookingForm, advance_paid: e.target.value })} placeholder="₹ advance paid" />

            <label>Payment Mode</label>
            <select value={bookingForm.payment_mode} onChange={(e) => setBookingForm({ ...bookingForm, payment_mode: e.target.value })}>
              {["Cash", "UPI", "Bank Transfer", "Card", "Other"].map((s) => <option key={s}>{s}</option>)}
            </select>

            <label>Balance Amount</label>
            <input value={bookingForm.balance_amount} onChange={(e) => setBookingForm({ ...bookingForm, balance_amount: e.target.value })} placeholder="₹ balance" />

            <label>Notes</label>
            <textarea value={bookingForm.notes} onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })} placeholder="Notes" />

            {conflicts.length > 0 && (
              <div className="errorBox">
                <AlertTriangle size={18} /> Date already booked.
                {conflicts.map((c) => <p key={c.id}>{c.guest_name}: {formatDate(c.check_in)} to {formatDate(c.check_out)}</p>)}
              </div>
            )}

            {conflicts.length === 0 && bookingForm.check_in && bookingForm.check_out && selectedProperty && (
              <div className="successBox"><CheckCircle2 size={18} /> Dates available.</div>
            )}

            <button className="primaryBtn" onClick={addBooking}>Save Booking</button>
          </div>

          <div className="card">
            <div className="sectionHeader">
              <h2>Bookings</h2>
              <input placeholder="Search bookings" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            <select value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)}>
              <option value="all">All properties</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            {filteredBookings.length === 0 ? <div className="empty">No bookings found.</div> : filteredBookings.map((b) => {
              const p = properties.find((x) => x.id === b.property_id);
              return (
                <div className="listItem" key={b.id}>
                  <div>
                    <b>{b.guest_name}</b>
                    <p>{p?.name || "Deleted property"} • {b.source}</p>
                    <p>{formatDate(b.check_in)} to {formatDate(b.check_out)}</p>
                    <p>Phone: {b.phone || "-"}</p>
                    <p>Guests: {b.number_of_guests || "-"}</p>
                    <p>Total: {b.amount ? "₹" + b.amount : "-"}</p>
                    <p>Advance: {b.advance_paid ? "₹" + b.advance_paid : "-"}</p>
                    <p>Payment: {b.payment_mode || "-"}</p>
                    <p>Balance: {b.balance_amount ? "₹" + b.balance_amount : "-"}</p>
                    {b.notes && <p>Notes: {b.notes}</p>}
                  </div>
                  <button className="dangerSoft" onClick={() => deleteBooking(b.id)}><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
