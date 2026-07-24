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

// "confirmed" = guest is currently checked in (stay is happening today)
// "upcoming"  = stay hasn't started yet
// "past"      = stay has already ended
function getBookingStatus(booking) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkIn = new Date(booking.check_in + "T00:00:00");
  const checkOut = new Date(booking.check_out + "T00:00:00");
  if (today >= checkIn && today < checkOut) return "confirmed";
  if (checkIn > today) return "upcoming";
  return "past";
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

const CATEGORIES = [
  { key: "can_view_calendar", label: "Calendar" },
  { key: "can_add_booking", label: "Property Booking Entry" },
  { key: "can_edit_booking", label: "Edit the Entry" },
  { key: "can_cancel_booking", label: "Cancel the Entry" },
  { key: "can_edit_upcoming", label: "Upcoming Bookings Edit" },
  { key: "can_add_property", label: "Property Addition" },
  { key: "can_edit_property", label: "Property Edit" },
  { key: "can_delete_property", label: "Property Delete" },
  { key: "can_add_user", label: "Add Users" },
  { key: "can_delete_user", label: "Delete Users" },
  { key: "can_export", label: "Export" },
];

function emptyPermissionSet(defaultValue) {
  const obj = {};
  CATEGORIES.forEach((c) => (obj[c.key] = defaultValue));
  return obj;
}

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
  const [newStaffPermissions, setNewStaffPermissions] = useState(() => emptyPermissionSet(false));
  const [newStaffIsAdmin, setNewStaffIsAdmin] = useState(false);
  const [newStaffPropertyIds, setNewStaffPropertyIds] = useState([]);

  const [myProfile, setMyProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [allProfiles, setAllProfiles] = useState([]);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  });
  const [selectedCalendarPropertyId, setSelectedCalendarPropertyId] = useState("");

  const [bookingForm, setBookingForm] = useState(emptyBooking);
  const [editingBookingId, setEditingBookingId] = useState("");
  const [expandedPropertyId, setExpandedPropertyId] = useState("");

  const notice = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 4500);
  };

  const can = (key) => {
    if (!myProfile) return false;
    if (myProfile.is_super_admin || myProfile.is_admin) return true;
    return !!myProfile[key];
  };
  const isAdmin = !!(myProfile && (myProfile.is_admin || myProfile.is_super_admin));
  const isSuperAdmin = !!(myProfile && myProfile.is_super_admin);
  const allowedPropertyIds = myProfile?.allowed_property_ids || [];
  const canSeeProperty = (propertyId) => isAdmin || allowedPropertyIds.includes(propertyId);

  const loadProfile = async (userId) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (error) {
        console.error(error);
        notice("Could not load your permissions. Contact an admin.");
        setMyProfile(null);
        return;
      }
      if (data.is_disabled) {
        notice("Your access has been disabled. Contact an admin.");
        await supabase.auth.signOut();
        setSession(null);
        setMyProfile(null);
        return;
      }
      setMyProfile(data);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadProfiles = async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("email");
    if (error) return notice(error.message);
    setAllProfiles(data || []);
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
      if (data.session) {
        loadData();
        loadProfile(data.session.user.id);
      } else {
        setProfileLoading(false);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadData();
        loadProfile(newSession.user.id);
      } else {
        setMyProfile(null);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!myProfile) return;
    if ((myProfile.can_add_user || myProfile.can_delete_user || isAdmin) && activeView === "users") {
      loadProfiles();
    }
  }, [myProfile, activeView]);

  useEffect(() => {
    if (!myProfile) return;
    const viewAllowed = {
      calendar: can("can_view_calendar"),
      bookings: can("can_add_booking") || can("can_edit_booking") || can("can_cancel_booking") || can("can_edit_upcoming"),
      properties: can("can_add_property") || can("can_edit_property") || can("can_delete_property"),
      users: can("can_add_user") || can("can_delete_user"),
    };
    if (!viewAllowed[activeView]) {
      const firstAllowed = Object.keys(viewAllowed).find((v) => viewAllowed[v]);
      if (firstAllowed) setActiveView(firstAllowed);
    }
  }, [myProfile]);

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

  const visibleProperties = useMemo(
    () => (isAdmin ? properties : properties.filter((p) => allowedPropertyIds.includes(p.id))),
    [properties, isAdmin, allowedPropertyIds.join(",")]
  );

  const visibleBookings = useMemo(
    () => (isAdmin ? bookings : bookings.filter((b) => allowedPropertyIds.includes(b.property_id))),
    [bookings, isAdmin, allowedPropertyIds.join(",")]
  );

  const conflicts = useMemo(() => {
    return bookings.filter(
      (b) =>
        b.id !== editingBookingId &&
        b.property_id === bookingForm.property_id &&
        datesOverlap(bookingForm.check_in, bookingForm.check_out, b.check_in, b.check_out)
    );
  }, [bookings, bookingForm.property_id, bookingForm.check_in, bookingForm.check_out, editingBookingId]);

  const filteredBookings = useMemo(() => {
    return visibleBookings
      .filter((b) => filterProperty === "all" || b.property_id === filterProperty)
      .filter((b) => {
        const propertyName = properties.find((p) => p.id === b.property_id)?.name || "";
        return `${b.guest_name} ${b.phone} ${b.source} ${propertyName} ${b.notes} ${b.payment_mode}`
          .toLowerCase()
          .includes(query.toLowerCase());
      })
      .sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
  }, [visibleBookings, properties, query, filterProperty]);

  const upcomingBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return visibleBookings
      .filter((b) => new Date(b.check_out + "T00:00:00") >= today)
      .sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
  }, [visibleBookings]);

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


  const startEditBooking = (booking) => {
    setEditingBookingId(booking.id);
    setBookingForm({
      property_id: booking.property_id || "",
      guest_name: booking.guest_name || "",
      phone: booking.phone || "",
      source: booking.source || "Direct",
      check_in: booking.check_in || "",
      check_out: booking.check_out || "",
      amount: booking.amount || "",
      number_of_guests: booking.number_of_guests || "",
      advance_paid: booking.advance_paid || "",
      payment_mode: booking.payment_mode || "Cash",
      balance_amount: booking.balance_amount || "",
      notes: booking.notes || "",
    });
    setActiveView("bookings");
    notice("Editing booking. Update details and press Update Booking.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditBooking = () => {
    setEditingBookingId("");
    const defaultPropertyId = isAdmin
      ? properties[0]?.id || ""
      : properties.find((p) => (myProfile?.allowed_property_ids || []).includes(p.id))?.id || "";
    setBookingForm({
      ...emptyBooking,
      property_id: defaultPropertyId,
    });
    notice("Booking edit cancelled.");
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

    let error;

    if (editingBookingId) {
      const result = await supabase
        .from("bookings")
        .update({
          ...bookingForm,
        })
        .eq("id", editingBookingId);
      error = result.error;
    } else {
      const result = await supabase.from("bookings").insert({
        ...bookingForm,
        created_by: session?.user?.id || null,
      });
      error = result.error;
    }

    if (error) return notice(error.message);

    setEditingBookingId("");
    const nextDefaultPropertyId = isAdmin
      ? properties[0]?.id || ""
      : properties.find((p) => (myProfile?.allowed_property_ids || []).includes(p.id))?.id || "";
    setBookingForm({
      ...emptyBooking,
      property_id: nextDefaultPropertyId,
    });
    await loadData();
    notice(editingBookingId ? "Booking updated." : "Booking saved.");
  };

  const deleteBooking = async (id) => {
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) return notice(error.message);
    await loadData();
    notice("Booking deleted.");
  };

  const addStaffUser = async () => {
    if (!staffEmail || !staffPassword) return notice("Enter staff email and password.");
    setLoading(true);
    const adminSession = session;
    try {
      const { data, error } = await supabase.auth.signUp({ email: staffEmail, password: staffPassword });
      if (error) return notice(error.message);

      // signUp swaps the browser session to the new user; restore the admin's session.
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      const newUserId = data?.user?.id;
      if (newUserId) {
        const permissionValues = {};
        CATEGORIES.forEach((c) => (permissionValues[c.key] = newStaffIsAdmin ? true : !!newStaffPermissions[c.key]));
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: newUserId,
          email: staffEmail,
          is_admin: newStaffIsAdmin,
          is_super_admin: false,
          is_disabled: false,
          allowed_property_ids: newStaffIsAdmin ? properties.map((p) => p.id) : newStaffPropertyIds,
          ...permissionValues,
        });
        if (profileError) notice("User created, but saving permissions failed: " + profileError.message);
        else notice("Staff account created with the selected permissions.");
      } else {
        notice("Staff account created. Confirm their email if required, then set permissions once they appear in the Users list.");
      }

      setStaffEmail("");
      setStaffPassword("");
      setNewStaffPermissions(emptyPermissionSet(false));
      setNewStaffIsAdmin(false);
      setNewStaffPropertyIds([]);
      await loadProfiles();
    } catch (err) {
      console.error(err);
      notice("Failed to create staff user.");
    } finally {
      setLoading(false);
    }
  };

  const updateProfilePermission = async (profileId, key, value) => {
    const { error } = await supabase.from("profiles").update({ [key]: value }).eq("id", profileId);
    if (error) return notice(error.message);
    await loadProfiles();
  };

  const updateProfileAdmin = async (profileId, value) => {
    const updates = { is_admin: value };
    if (value) {
      CATEGORIES.forEach((c) => (updates[c.key] = true));
      updates.allowed_property_ids = properties.map((p) => p.id);
    }
    const { error } = await supabase.from("profiles").update(updates).eq("id", profileId);
    if (error) return notice(error.message);
    await loadProfiles();
  };

  const toggleProfileProperty = async (profile, propertyId, value) => {
    const current = profile.allowed_property_ids || [];
    const next = value ? [...new Set([...current, propertyId])] : current.filter((id) => id !== propertyId);
    const { error } = await supabase.from("profiles").update({ allowed_property_ids: next }).eq("id", profile.id);
    if (error) return notice(error.message);
    await loadProfiles();
  };

  const setUserDisabled = async (profileId, disabled) => {
    const { error } = await supabase.from("profiles").update({ is_disabled: disabled }).eq("id", profileId);
    if (error) return notice(error.message);
    await loadProfiles();
    notice(
      disabled
        ? "User access disabled — they can no longer use the app. Full account deletion needs a backend service-role function."
        : "User access re-enabled."
    );
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

    const rows = visibleBookings.map((b) => {
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
<h1>HostTerra</h1>
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

  const activePropertyId = selectedCalendarPropertyId || visibleProperties[0]?.id;

  return (
    <div className="app">
      <header>
        <div>
<h1>HostTerra</h1>
          <p>Logged in as {session.user.email}</p>
        </div>
        <nav>
          {can("can_view_calendar") && (
            <button className={activeView === "calendar" ? "active" : ""} onClick={() => setActiveView("calendar")}>Calendar</button>
          )}
          {(can("can_add_booking") || can("can_edit_booking") || can("can_cancel_booking") || can("can_edit_upcoming")) && (
            <button className={activeView === "bookings" ? "active" : ""} onClick={() => setActiveView("bookings")}>Bookings</button>
          )}
          {(can("can_add_property") || can("can_edit_property") || can("can_delete_property")) && (
            <button className={activeView === "properties" ? "active" : ""} onClick={() => setActiveView("properties")}>Properties</button>
          )}
          {(can("can_add_user") || can("can_delete_user")) && (
            <button className={activeView === "users" ? "active" : ""} onClick={() => setActiveView("users")}>Users</button>
          )}
          {can("can_export") && <button onClick={exportCSV}><Download size={15} /> Export</button>}
          <button className="dangerSoft" onClick={logout}><LogOut size={15} /> Logout</button>
        </nav>
      </header>

      {message && <div className="topNotice">{message}</div>}
      {(loading || profileLoading) && <div className="topNotice">Loading...</div>}
      {!profileLoading && !myProfile && (
        <div className="topNotice">No permissions profile found for your account. Ask a super admin to check the Users list.</div>
      )}

      <section className="stats">
        <div><Building2 /><span>Properties</span><b>{properties.length}</b></div>
        <div><CalendarDays /><span>Bookings</span><b>{bookings.length}</b></div>
        <div><CheckCircle2 /><span>Upcoming</span><b>{upcomingBookings.length}</b></div>
      </section>

      <section className="card compactCard">
        <h2>Upcoming Bookings</h2>
        {upcomingBookings.length === 0 ? (
          <div className="empty smallEmpty">No upcoming bookings.</div>
        ) : (
          <div className="upcomingScroll">
            {upcomingBookings.map((b) => {
              const p = properties.find((x) => x.id === b.property_id);
              return (
                <div className="miniBookingRow" key={b.id}>
                  <span className={`statusBadge status-${getBookingStatus(b)}`}>{getBookingStatus(b)}</span>
                  <b>{b.guest_name}</b>
                  <span>{p?.name || "Deleted property"}</span>
                  <span>{formatDate(b.check_in)} to {formatDate(b.check_out)}</span>
                  <span>Total: {b.amount ? "₹" + b.amount : "-"}</span>
                  <span>Advance: {b.advance_paid ? "₹" + b.advance_paid : "-"}</span>
                  <span>Balance: {b.balance_amount ? "₹" + b.balance_amount : "-"}</span>
                  {can("can_edit_upcoming") && (
                    <button onClick={() => startEditBooking(b)}>Edit</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {activeView === "calendar" && can("can_view_calendar") && (
        <section className="card">
          <div className="sectionHeader">
            <div>
              <h2>Booking Calendar</h2>
              <p>Scroll properties vertically and select one property calendar.</p>
            </div>
            <input type="month" value={calendarMonth} onChange={(e) => setCalendarMonth(e.target.value)} />
          </div>

          {visibleProperties.length === 0 ? (
            <div className="empty">
              {properties.length === 0 ? "No properties added yet. Add a property first." : "You don't have access to any properties yet. Ask an admin to enable one."}
            </div>
          ) : (
            <div className="calendarLayout">
              <div className="propertyScroll">
                {visibleProperties.map((p) => (
                  <button key={p.id} className={activePropertyId === p.id ? "selectedProperty" : ""} onClick={() => setSelectedCalendarPropertyId(p.id)}>
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="calendarBox">
                <h3>{properties.find((p) => p.id === activePropertyId)?.name}</h3>
                <div className="calendarLegend">
                  <span className="legendDot status-confirmed"></span> Confirmed (checked in)
                  <span className="legendDot status-upcoming"></span> Upcoming
                  <span className="legendDot status-past"></span> Past
                </div>
                <div className="week">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d}>{d}</span>)}</div>
                <div className="days">
                  {buildCalendarDays(activePropertyId).map((day) =>
                    day.type === "blank" ? (
                      <div key={day.id} className="day blank"></div>
                    ) : (
                      <div key={day.id} className="day">
                        <b>{day.day}</b>
                        {day.bookings.map((b) => (
                          <div className={`bookingChip status-${getBookingStatus(b)}`} key={b.id}>{b.guest_name}</div>
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
          {can("can_add_property") && (
            <div className="inlineForm">
              <input placeholder="New property name" value={newPropertyName} onChange={(e) => setNewPropertyName(e.target.value)} />
              <button className="primaryBtn" onClick={addProperty}>Add Property</button>
            </div>
          )}

          <div className="gridList">
            {visibleProperties.map((p) => (
              <div className="listItem" key={p.id}>
                {editingPropertyId === p.id ? (
                  <>
                    <input value={editingPropertyName} onChange={(e) => setEditingPropertyName(e.target.value)} />
                    <button onClick={updateProperty}>Save</button>
                    <button onClick={() => setEditingPropertyId("")}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div className="propertyDetailsBlock">
                      <div className="propertyTitleRow">
                        <div>
                          <b>{p.name}</b>
                          <p>{bookings.filter((b) => b.property_id === p.id).length} booking(s)</p>
                        </div>
                        <button
                          className="arrowBtn"
                          onClick={() => setExpandedPropertyId(expandedPropertyId === p.id ? "" : p.id)}
                          title="Show property bookings"
                        >
                          {expandedPropertyId === p.id ? "▲" : "▼"}
                        </button>
                      </div>

                      {expandedPropertyId === p.id && (
                        <div className="propertyBookingList">
                          {bookings.filter((b) => b.property_id === p.id).length === 0 ? (
                            <p className="mutedSmall">No bookings for this property.</p>
                          ) : (
                            bookings
                              .filter((b) => b.property_id === p.id)
                              .sort((a, b) => new Date(a.check_in) - new Date(b.check_in))
                              .map((booking) => (
                                <div className="propertyBookingMini" key={booking.id}>
                                  <span>{formatDate(booking.check_in)} to {formatDate(booking.check_out)}</span>
                                  <b>{booking.guest_name}</b>
                                </div>
                              ))
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      {can("can_edit_property") && (
                        <button onClick={() => { setEditingPropertyId(p.id); setEditingPropertyName(p.name); }}>Edit</button>
                      )}
                      {can("can_delete_property") && (
                        <button className="dangerSoft" onClick={() => deleteProperty(p.id)}><Trash2 size={15} /></button>
                      )}
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
          {can("can_add_user") && (
            <>
              <h2>Add Staff Login</h2>
              <div className="inlineForm">
                <input placeholder="Staff email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} />
                <input placeholder="Staff password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} />
              </div>

              <div className="permissionCard" style={{ marginTop: 12 }}>
                <label className="permissionAdminRow">
                  <input
                    type="checkbox"
                    checked={newStaffIsAdmin}
                    onChange={(e) => setNewStaffIsAdmin(e.target.checked)}
                  />
                  <b>Make Admin (turns on every category below)</b>
                </label>

                <div className="permissionGrid" style={{ opacity: newStaffIsAdmin ? 0.5 : 1 }}>
                  {CATEGORIES.map((c) => (
                    <label key={c.key} className="permissionItem">
                      <input
                        type="checkbox"
                        disabled={newStaffIsAdmin}
                        checked={newStaffIsAdmin || !!newStaffPermissions[c.key]}
                        onChange={(e) =>
                          setNewStaffPermissions((old) => ({ ...old, [c.key]: e.target.checked }))
                        }
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="permissionCard" style={{ marginTop: 12 }}>
                <div className="permissionAdminRow" style={{ border: "none", marginBottom: 8, paddingBottom: 0 }}>
                  <b>Properties this user can access</b>
                </div>
                {properties.length === 0 ? (
                  <p className="mutedSmall">No properties added yet.</p>
                ) : (
                  <div className="permissionGrid" style={{ opacity: newStaffIsAdmin ? 0.5 : 1 }}>
                    {properties.map((p) => (
                      <label key={p.id} className="permissionItem">
                        <input
                          type="checkbox"
                          disabled={newStaffIsAdmin}
                          checked={newStaffIsAdmin || newStaffPropertyIds.includes(p.id)}
                          onChange={(e) =>
                            setNewStaffPropertyIds((old) =>
                              e.target.checked ? [...old, p.id] : old.filter((id) => id !== p.id)
                            )
                          }
                        />
                        <span>{p.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                {newStaffIsAdmin && <p className="mutedSmall">Admins automatically get every property.</p>}
              </div>

              <button className="primaryBtn" onClick={addStaffUser} style={{ marginTop: 12 }}>
                <UserPlus size={15} /> Add Staff
              </button>
            </>
          )}

          {(isAdmin || can("can_delete_user")) && (
            <>
              <h2 style={{ marginTop: 24 }}>Existing Users</h2>
              <div className="gridList">
                {allProfiles.map((p) => (
                  <div className="listItem" key={p.id}>
                    <div className="propertyDetailsBlock">
                      <div className="propertyTitleRow">
                        <div>
                          <b>{p.email}</b>
                          <p>
                            {p.is_super_admin ? "Super Admin" : p.is_admin ? "Admin" : "Staff"}
                            {p.is_disabled ? " • Disabled" : ""}
                          </p>
                        </div>
                        {p.is_super_admin ? (
                          <Lock size={16} title="Super admins always have full access" />
                        ) : (
                          can("can_delete_user") && (
                            <button
                              className="dangerSoft"
                              onClick={() => setUserDisabled(p.id, !p.is_disabled)}
                            >
                              <Trash2 size={15} /> {p.is_disabled ? "Enable" : "Disable"}
                            </button>
                          )
                        )}
                      </div>

                      {!p.is_super_admin && isAdmin && (
                        <div className="permissionCard">
                          <label className="permissionAdminRow">
                            <input
                              type="checkbox"
                              checked={!!p.is_admin}
                              onChange={(e) => updateProfileAdmin(p.id, e.target.checked)}
                            />
                            <b>Admin (full access)</b>
                          </label>
                          <div className="permissionGrid" style={{ opacity: p.is_admin ? 0.5 : 1 }}>
                            {CATEGORIES.map((c) => (
                              <label key={c.key} className="permissionItem">
                                <input
                                  type="checkbox"
                                  disabled={p.is_admin}
                                  checked={p.is_admin || !!p[c.key]}
                                  onChange={(e) => updateProfilePermission(p.id, c.key, e.target.checked)}
                                />
                                <span>{c.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {!p.is_super_admin && isAdmin && (
                        <div className="permissionCard">
                          <div className="permissionAdminRow" style={{ border: "none", marginBottom: 8, paddingBottom: 0 }}>
                            <b>Properties {p.email} can access</b>
                          </div>
                          {properties.length === 0 ? (
                            <p className="mutedSmall">No properties added yet.</p>
                          ) : (
                            <div className="permissionGrid" style={{ opacity: p.is_admin ? 0.5 : 1 }}>
                              {properties.map((prop) => (
                                <label key={prop.id} className="permissionItem">
                                  <input
                                    type="checkbox"
                                    disabled={p.is_admin}
                                    checked={p.is_admin || (p.allowed_property_ids || []).includes(prop.id)}
                                    onChange={(e) => toggleProfileProperty(p, prop.id, e.target.checked)}
                                  />
                                  <span>{prop.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {p.is_admin && <p className="mutedSmall">Admins automatically get every property.</p>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {activeView === "bookings" && (
        <section className="twoCol">
          {((editingBookingId && can("can_edit_booking")) || (!editingBookingId && can("can_add_booking"))) ? (
          <div className="card">
            <h2>{editingBookingId ? "Edit Booking" : "Add Booking"}</h2>

            <div className="formGrid">
              <div className="formField">
                <label>Property</label>
                <select value={bookingForm.property_id} onChange={(e) => setBookingForm({ ...bookingForm, property_id: e.target.value })}>
                  {visibleProperties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="formField">
                <label>Guest Name</label>
                <input value={bookingForm.guest_name} onChange={(e) => setBookingForm({ ...bookingForm, guest_name: e.target.value })} placeholder="Guest name" />
              </div>

              <div className="formField">
                <label>Phone</label>
                <input value={bookingForm.phone} onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })} placeholder="Phone number" />
              </div>

              <div className="formField">
                <label>Number of Guests</label>
                <input value={bookingForm.number_of_guests} onChange={(e) => setBookingForm({ ...bookingForm, number_of_guests: e.target.value })} placeholder="Eg: 4" />
              </div>

              <div className="formField">
                <label>Booking Source</label>
                <select value={bookingForm.source} onChange={(e) => setBookingForm({ ...bookingForm, source: e.target.value })}>
                  {["Direct", "Airbnb", "MakeMyTrip", "Booking.com", "Other"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="formField">
                <label>Check-in</label>
                <input type="date" value={bookingForm.check_in} onChange={(e) => setBookingForm({ ...bookingForm, check_in: e.target.value })} />
              </div>

              <div className="formField">
                <label>Check-out</label>
                <input type="date" value={bookingForm.check_out} onChange={(e) => setBookingForm({ ...bookingForm, check_out: e.target.value })} />
              </div>

              <div className="formField">
                <label>Total Amount</label>
                <input value={bookingForm.amount} onChange={(e) => setBookingForm({ ...bookingForm, amount: e.target.value })} placeholder="₹ total" />
              </div>

              <div className="formField">
                <label>Advance Paid</label>
                <input value={bookingForm.advance_paid} onChange={(e) => setBookingForm({ ...bookingForm, advance_paid: e.target.value })} placeholder="₹ advance paid" />
              </div>

              <div className="formField">
                <label>Payment Mode</label>
                <select value={bookingForm.payment_mode} onChange={(e) => setBookingForm({ ...bookingForm, payment_mode: e.target.value })}>
                  {["Cash", "UPI", "Bank Transfer", "Card", "Other"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="formField">
                <label>Balance Amount</label>
                <input value={bookingForm.balance_amount} onChange={(e) => setBookingForm({ ...bookingForm, balance_amount: e.target.value })} placeholder="₹ balance" />
              </div>

              <div className="formField formFieldWide">
                <label>Notes</label>
                <textarea value={bookingForm.notes} onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })} placeholder="Notes" />
              </div>
            </div>

            {conflicts.length > 0 && (
              <div className="errorBox">
                <AlertTriangle size={18} /> Date already booked.
                {conflicts.map((c) => <p key={c.id}>{c.guest_name}: {formatDate(c.check_in)} to {formatDate(c.check_out)}</p>)}
              </div>
            )}

            {conflicts.length === 0 && bookingForm.check_in && bookingForm.check_out && selectedProperty && (
              <div className="successBox"><CheckCircle2 size={18} /> Dates available.</div>
            )}

            <button className="primaryBtn" onClick={addBooking}>
              {editingBookingId ? "Update Booking" : "Save Booking"}
            </button>

            {editingBookingId && (
              <button className="secondaryBtn" onClick={cancelEditBooking}>
                Cancel Edit
              </button>
            )}
          </div>
          ) : (
            <div className="card">
              <div className="empty">You don't have permission to {editingBookingId ? "edit" : "add"} bookings.</div>
            </div>
          )}

          <div className="card">
            <div className="sectionHeader">
              <h2>Bookings</h2>
              <input placeholder="Search bookings" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            <select value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)}>
              <option value="all">All properties</option>
              {visibleProperties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            {filteredBookings.length === 0 ? <div className="empty">No bookings found.</div> : filteredBookings.map((b) => {
              const p = properties.find((x) => x.id === b.property_id);
              return (
                <div className="listItem" key={b.id}>
                  <div>
                    <span className={`statusBadge status-${getBookingStatus(b)}`}>{getBookingStatus(b)}</span>
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
                  <div className="actionButtons">
                    {can("can_edit_booking") && <button onClick={() => startEditBooking(b)}>Edit</button>}
                    {can("can_cancel_booking") && (
                      <button className="dangerSoft" onClick={() => deleteBooking(b.id)}><Trash2 size={15} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
