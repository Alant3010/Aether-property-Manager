import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
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
  Shield,
  Settings,
} from 'lucide-react';
import './style.css';

const SUPABASE_URL = 'https://ygejzdvgjvgjahtwejiw.supabase.co';
const SUPABASE_ANON_KEY =
  'sbpublishable-8mbHm2pcEtZN-GzNCrPwL5Qfw7w5fqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_EMAILS = [
  'alan8943131461@gmail.com',
  'gtvhospitality@gmail.com',
];

const PERMISSION_KEYS = {
  calendar: 'calendar',
  propertyBookingEntry: 'propertyBookingEntry',
  editEntry: 'editEntry',
  cancelEntry: 'cancelEntry',
  upcomingBookingsEdit: 'upcomingBookingsEdit',
  propertyAddition: 'propertyAddition',
  propertyEdit: 'propertyEdit',
  propertyDelete: 'propertyDelete',
  addUsers: 'addUsers',
  deleteUsers: 'deleteUsers',
  export: 'export',
};

const defaultPermissions = {
  [PERMISSION_KEYS.calendar]: true,
  [PERMISSION_KEYS.propertyBookingEntry]: true,
  [PERMISSION_KEYS.editEntry]: true,
  [PERMISSION_KEYS.cancelEntry]: true,
  [PERMISSION_KEYS.upcomingBookingsEdit]: true,
  [PERMISSION_KEYS.propertyAddition]: true,
  [PERMISSION_KEYS.propertyEdit]: true,
  [PERMISSION_KEYS.propertyDelete]: true,
  [PERMISSION_KEYS.addUsers]: true,
  [PERMISSION_KEYS.deleteUsers]: true,
  [PERMISSION_KEYS.export]: true,
};

function formatDate(date) {
  if (!date) return '';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function datesOverlap(a1, a2, b1, b2) {
  if (!a1 || !a2 || !b1 || !b2) return false;
  return new Date(a1) <= new Date(b2) && new Date(b1) <= new Date(a2);
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function isDateInsideBooking(dateValue, booking) {
  const date = new Date(`${dateValue}T00:00:00`);
  return date >= new Date(`${booking.checkin}T00:00:00`) && date < new Date(`${booking.checkout}T00:00:00`);
}

function ToggleSwitch({ label, checked, onChange, disabled }) {
  return (
    <label className="toggleRow">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

const emptyBooking = {
  propertyid: '',
  guestname: '',
  phone: '',
  source: 'Direct',
  checkin: '',
  checkout: '',
  amount: '',
  numberofguests: '',
  advancepaid: '',
  paymentmode: 'Cash',
  balanceamount: '',
  notes: '',
};

export default function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeView, setActiveView] = useState('calendar');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [query, setQuery] = useState('');
  const [filterProperty, setFilterProperty] = useState('all');

  const [newPropertyName, setNewPropertyName] = useState('');
  const [editingPropertyId, setEditingPropertyId] = useState('');
  const [editingPropertyName, setEditingPropertyName] = useState('');

  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [selectedCalendarPropertyId, setSelectedCalendarPropertyId] = useState('');
  const [bookingForm, setBookingForm] = useState(emptyBooking);
  const [editingBookingId, setEditingBookingId] = useState('');
  const [expandedPropertyId, setExpandedPropertyId] = useState('');
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'user',
  });
  const [userPermissions, setUserPermissions] = useState({
    calendar: true,
    propertyBookingEntry: true,
    editEntry: true,
    cancelEntry: true,
    upcomingBookingsEdit: true,
    propertyAddition: true,
    propertyEdit: true,
    propertyDelete: true,
    addUsers: false,
    deleteUsers: false,
    export: true,
  });
  const [editingUserId, setEditingUserId] = useState('');

  const isAdmin = ADMIN_EMAILS.includes(session?.user?.email);

  const notice = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 4500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const propertyResult = await supabase.from('properties').select('*').order('name');
      const bookingResult = await supabase.from('bookings').select('*').order('checkin');

      if (propertyResult.error) throw propertyResult.error;
      if (bookingResult.error) throw bookingResult.error;

      const propertyData = propertyResult.data || [];
      const bookingData = bookingResult.data || [];

      setProperties(propertyData);
      setBookings(bookingData);

      if (propertyData.length > 0) {
        setBookingForm((old) => ({
          ...old,
          propertyid: old.propertyid || propertyData[0].id,
        }));
        setSelectedCalendarPropertyId((old) => old || propertyData[0].id);
      }

      const savedUsers = JSON.parse(localStorage.getItem('gtv_users') || '[]');
      setUsers(savedUsers);
    } catch (err) {
      console.error(err);
      notice('Database loading failed. Check Supabase SQL tables and internet connection.');
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

  useEffect(() => {
    if (properties.length > 0 && !bookingForm.propertyid) {
      setBookingForm((prev) => ({ ...prev, propertyid: properties[0].id }));
      setSelectedCalendarPropertyId((prev) => prev || properties[0].id);
    }
  }, [properties, bookingForm.propertyid]);

  const login = async () => {
    if (!email || !password) return notice('Enter email and password.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return notice(error.message);
    } catch (err) {
      console.error(err);
      notice('Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const signUp = async () => {
    if (!email || !password) return notice('Enter email and password.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return notice(error.message);
      notice('Account created. Confirm email if needed, then login.');
    } catch (err) {
      console.error(err);
      notice('Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const selectedProperty = properties.find((p) => p.id === bookingForm.propertyid);

  const conflicts = useMemo(() => {
    return bookings.filter(
      (b) =>
        b.id !== editingBookingId &&
        b.propertyid === bookingForm.propertyid &&
        datesOverlap(bookingForm.checkin, bookingForm.checkout, b.checkin, b.checkout)
    );
  }, [bookings, bookingForm.propertyid, bookingForm.checkin, bookingForm.checkout, editingBookingId]);

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => filterProperty === 'all' || b.propertyid === filterProperty)
      .filter((b) => {
        const propertyName = properties.find((p) => p.id === b.propertyid)?.name || '';
        return (
          b.guestname?.toLowerCase().includes(query.toLowerCase()) ||
          b.phone?.toLowerCase().includes(query.toLowerCase()) ||
          b.source?.toLowerCase().includes(query.toLowerCase()) ||
          propertyName.toLowerCase().includes(query.toLowerCase()) ||
          b.notes?.toLowerCase().includes(query.toLowerCase()) ||
          b.paymentmode?.toLowerCase().includes(query.toLowerCase())
        );
      })
      .sort((a, b) => new Date(a.checkin) - new Date(b.checkin));
  }, [bookings, properties, query, filterProperty]);

  const upcomingBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bookings
      .filter((b) => new Date(`${b.checkout}T00:00:00`) >= today)
      .sort((a, b) => new Date(a.checkin) - new Date(b.checkin));
  }, [bookings]);

  const buildCalendarDays = (propertyId) => {
    const [yearText, monthText] = calendarMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText) - 1;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let i = 0; i < firstDay.getDay(); i += 1) {
      days.push({ type: 'blank', id: `blank-${propertyId}-${i}` });
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const value = toDateInput(new Date(year, month, day));
      const dayBookings = bookings.filter(
        (b) => b.propertyid === propertyId && isDateInsideBooking(value, b)
      );
      days.push({ type: 'day', id: `${propertyId}-${value}`, day, bookings: dayBookings });
    }

    return days;
  };

  const updatePermissionsForUser = (key, value) => {
    setUserPermissions((prev) => ({ ...prev, [key]: value }));
  };

  const addProperty = async () => {
    if (!isAdmin) return notice('Admin only.');
    const name = newPropertyName.trim();
    if (!name) return notice('Enter property name.');

    const { error } = await supabase.from('properties').insert([{ name }]);
    if (error) return notice(error.message);

    setNewPropertyName('');
    await loadData();
    notice('Property added.');
  };

  const updateProperty = async () => {
    if (!isAdmin) return notice('Admin only.');
    const name = editingPropertyName.trim();
    if (!name) return notice('Property name cannot be empty.');

    const { error } = await supabase
      .from('properties')
      .update({ name })
      .eq('id', editingPropertyId);

    if (error) return notice(error.message);

    setEditingPropertyId('');
    setEditingPropertyName('');
    await loadData();
    notice('Property updated.');
  };

  const deleteProperty = async (id) => {
    if (!isAdmin) return notice('Admin only.');
    if (bookings.some((b) => b.propertyid === id)) {
      return notice("Delete this property's bookings first, then delete the property.");
    }

    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) return notice(error.message);

    await loadData();
    notice('Property deleted.');
  };

  const startEditBooking = (booking) => {
    setEditingBookingId(booking.id);
    setBookingForm({
      propertyid: booking.propertyid,
      guestname: booking.guestname || '',
      phone: booking.phone || '',
      source: booking.source || 'Direct',
      checkin: booking.checkin || '',
      checkout: booking.checkout || '',
      amount: booking.amount || '',
      numberofguests: booking.numberofguests || '',
      advancepaid: booking.advancepaid || '',
      paymentmode: booking.paymentmode || 'Cash',
      balanceamount: booking.balanceamount || '',
      notes: booking.notes || '',
    });
    setActiveView('bookings');
    notice('Editing booking. Update details and press Save.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditBooking = () => {
    setEditingBookingId('');
    setBookingForm({ ...emptyBooking, propertyid: properties[0]?.id || '' });
    notice('Booking edit cancelled.');
  };

  const addBooking = async () => {
    if (!bookingForm.propertyid) return notice('Select a property.');
    if (!bookingForm.guestname || !bookingForm.checkin || !bookingForm.checkout) {
      return notice('Enter guest name, check-in date and check-out date.');
    }
    if (new Date(bookingForm.checkin) >= new Date(bookingForm.checkout)) {
      return notice('Check-out must be after check-in.');
    }
    if (conflicts.length > 0) return notice('Date already booked for this property.');

    let error;
    if (editingBookingId) {
      const result = await supabase.from('bookings').update({ ...bookingForm }).eq('id', editingBookingId);
      error = result.error;
    } else {
      const result = await supabase.from('bookings').insert([
        {
          ...bookingForm,
          createdby: session?.user?.id || null,
        },
      ]);
      error = result.error;
    }

    if (error) return notice(error.message);

    setEditingBookingId('');
    setBookingForm({ ...emptyBooking, propertyid: properties[0]?.id || '' });
    await loadData();
    notice(editingBookingId ? 'Booking updated.' : 'Booking saved.');
  };

  const deleteBooking = async (id) => {
    if (!isAdmin) return notice('Admin only.');
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) return notice(error.message);
    await loadData();
    notice('Booking deleted.');
  };

  const addStaffUser = async () => {
    if (!isAdmin) return notice('Admin only.');
    if (!staffEmail || !staffPassword) return notice('Enter staff email and password.');

    const { error } = await supabase.auth.signUp({
      email: staffEmail,
      password: staffPassword,
    });
    if (error) return notice(error.message);

    setStaffEmail('');
    setStaffPassword('');
    notice('Staff login created. Confirm email if required.');
  };

  const createUser = () => {
    if (!isAdmin) return notice('Admin only.');
    if (!newUser.email || !newUser.password) return notice('Enter email and password.');

    const user = {
      id: Date.now(),
      email: newUser.email,
      role: newUser.role,
      permissions: { ...userPermissions },
    };

    const nextUsers = [...users, user];
    setUsers(nextUsers);
    localStorage.setItem('gtv_users', JSON.stringify(nextUsers));

    if (newUser.role === 'admin') {
      notice('New admin created with selected permissions.');
    } else {
      notice('New user created with selected permissions.');
    }

    setNewUser({ email: '', password: '', role: 'user' });
    setEditingUserId('');
  };

  const updateUserRole = (id, role) => {
    const nextUsers = users.map((u) => (u.id === id ? { ...u, role } : u));
    setUsers(nextUsers);
    localStorage.setItem('gtv_users', JSON.stringify(nextUsers));
    notice(role === 'admin' ? 'User promoted to admin.' : 'User changed to normal user.');
  };

  const deleteUser = (id) => {
    if (!isAdmin) return notice('Admin only.');
    const nextUsers = users.filter((u) => u.id !== id);
    setUsers(nextUsers);
    localStorage.setItem('gtv_users', JSON.stringify(nextUsers));
    notice('User deleted.');
  };

  const exportCSV = () => {
    if (!isAdmin && !userPermissions.export) return notice('Export not allowed.');
    const header = [
      'Property',
      'Guest',
      'Phone',
      'Source',
      'Check In',
      'Check Out',
      'Total Amount',
      'Number of Guests',
      'Advance Paid',
      'Payment Mode',
      'Balance Amount',
      'Notes',
    ];
    const rows = bookings.map((b) => {
      const property = properties.find((p) => p.id === b.propertyid)?.name || b.propertyid;
      return [
        property,
        b.guestname,
        b.phone,
        b.source,
        b.checkin,
        b.checkout,
        b.amount,
        b.numberofguests,
        b.advancepaid,
        b.paymentmode,
        b.balanceamount,
        b.notes,
      ];
    });

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'property-bookings.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!session) {
    return (
      <div className="loginPage">
        <div className="loginBox">
          <div className="loginHeader">
            <div className="iconBox">
              <Lock size={30} />
            </div>
            <div>
              <h1>GTV Hospitality</h1>
              <p>Cloud login powered by Supabase</p>
            </div>
          </div>

          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />

          {message && <div className="notice">{message}</div>}

          <button className="primaryBtn" onClick={login} disabled={loading}>
            {loading ? 'Please wait...' : 'Login'}
          </button>

          <button className="secondaryBtn" onClick={signUp} disabled={loading}>
            {authMode === 'login' ? 'Create Account' : 'Login'}
          </button>

          <button
            className="secondaryBtn"
            onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
          >
            {authMode === 'login' ? 'Create first admin account' : 'Already have account? Login'}
          </button>
        </div>
      </div>
    );
  }

  const activePropertyId = selectedCalendarPropertyId || properties[0]?.id || '';

  return (
    <div className="app">
      <header>
        <div>
          <h1>GTV Hospitality</h1>
          <p>Logged in as {session.user.email}</p>
        </div>

        <nav>
          <button className={activeView === 'calendar' ? 'active' : ''} onClick={() => setActiveView('calendar')}>
            Calendar
          </button>
          <button className={activeView === 'bookings' ? 'active' : ''} onClick={() => setActiveView('bookings')}>
            Bookings
          </button>
          <button className={activeView === 'properties' ? 'active' : ''} onClick={() => setActiveView('properties')}>
            Properties
          </button>
          <button className={activeView === 'users' ? 'active' : ''} onClick={() => setActiveView('users')}>
            Users
          </button>
          {isAdmin && (
            <button className={activeView === 'admin' ? 'active' : ''} onClick={() => setActiveView('admin')}>
              Admin
            </button>
          )}
          <button onClick={exportCSV}>
            <Download size={15} /> Export
          </button>
          <button className="dangerSoft" onClick={logout}>
            <LogOut size={15} /> Logout
          </button>
        </nav>
      </header>

      {message && <div className="topNotice">{message}</div>}
      {loading && <div className="topNotice">Loading...</div>}

      <section className="stats">
        <div>
          <Building2 />
          <span>Properties</span>
          <b>{properties.length}</b>
        </div>
        <div>
          <CalendarDays />
          <span>Bookings</span>
          <b>{bookings.length}</b>
        </div>
        <div>
          <CheckCircle2 />
          <span>Upcoming</span>
          <b>{upcomingBookings.length}</b>
        </div>
      </section>

      <section className="card compactCard">
        <h2>Upcoming Bookings</h2>
        {upcomingBookings.length === 0 ? (
          <div className="empty smallEmpty">No upcoming bookings.</div>
        ) : (
          <div className="upcomingScroll">
            {upcomingBookings.map((b) => {
              const p = properties.find((x) => x.id === b.propertyid);
              return (
                <div className="miniBookingRow" key={b.id}>
                  <b>{b.guestname}</b>
                  <span>{p?.name || 'Deleted property'}</span>
                  <span>{formatDate(b.checkin)} to {formatDate(b.checkout)}</span>
                  <span>Total: {b.amount || '-'}</span>
                  <span>Advance: {b.advancepaid || '-'}</span>
                  <span>Balance: {b.balanceamount || '-'}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {activeView === 'admin' && isAdmin && (
        <section className="card">
          <h2><Shield size={18} /> Admin Panel</h2>

          <div className="adminGrid">
            <div className="card innerCard">
              <h3><Settings size={16} /> Permission Toggles</h3>
              <ToggleSwitch label="Calendar" checked={userPermissions.calendar} onChange={(v) => updatePermissionsForUser('calendar', v)} disabled={!isAdmin} />
              <ToggleSwitch label="Property booking entry" checked={userPermissions.propertyBookingEntry} onChange={(v) => updatePermissionsForUser('propertyBookingEntry', v)} disabled={!isAdmin} />
              <ToggleSwitch label="Edit entry" checked={userPermissions.editEntry} onChange={(v) => updatePermissionsForUser('editEntry', v)} disabled={!isAdmin} />
              <ToggleSwitch label="Cancel entry" checked={userPermissions.cancelEntry} onChange={(v) => updatePermissionsForUser('cancelEntry', v)} disabled={!isAdmin} />
              <ToggleSwitch label="Upcoming bookings edit" checked={userPermissions.upcomingBookingsEdit} onChange={(v) => updatePermissionsForUser('upcomingBookingsEdit', v)} disabled={!isAdmin} />
              <ToggleSwitch label="Property addition" checked={userPermissions.propertyAddition} onChange={(v) => updatePermissionsForUser('propertyAddition', v)} disabled={!isAdmin} />
              <ToggleSwitch label="Property edit" checked={userPermissions.propertyEdit} onChange={(v) => updatePermissionsForUser('propertyEdit', v)} disabled={!isAdmin} />
              <ToggleSwitch label="Property delete" checked={userPermissions.propertyDelete} onChange={(v) => updatePermissionsForUser('propertyDelete', v)} disabled={!isAdmin} />
              <ToggleSwitch label="Add users" checked={userPermissions.addUsers} onChange={(v) => updatePermissionsForUser('addUsers', v)} disabled={!isAdmin} />
              <ToggleSwitch label="Delete users" checked={userPermissions.deleteUsers} onChange={(v) => updatePermissionsForUser('deleteUsers', v)} disabled={!isAdmin} />
              <ToggleSwitch label="Export" checked={userPermissions.export} onChange={(v) => updatePermissionsForUser('export', v)} disabled={!isAdmin} />
            </div>

            <div className="card innerCard">
              <h3><UserPlus size={16} /> Create New User / Admin</h3>

              <label>Email</label>
              <input
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="email@example.com"
              />

              <label>Password</label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Password"
              />

              <label>Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>

              <button className="primaryBtn" onClick={createUser}>
                Create {newUser.role === 'admin' ? 'Admin' : 'User'}
              </button>

              <div className="hintBox">
                Admin users get the same access as you. Normal users only get the enabled options.
              </div>
            </div>
          </div>

          <div className="card innerCard">
            <h3>Created Users</h3>
            {users.length === 0 ? (
              <div className="empty">No local users created yet.</div>
            ) : (
              users.map((u) => (
                <div className="listItem" key={u.id}>
                  <div>
                    <b>{u.email}</b>
                    <p>Role: {u.role}</p>
                  </div>
                  <div className="actionButtons">
                    <button onClick={() => updateUserRole(u.id, 'admin')}>Admin</button>
                    <button onClick={() => updateUserRole(u.id, 'user')}>User</button>
                    <button className="dangerSoft" onClick={() => deleteUser(u.id)}>
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {activeView === 'calendar' && (
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
                  <button
                    key={p.id}
                    className={activePropertyId === p.id ? 'selectedProperty' : ''}
                    onClick={() => setSelectedCalendarPropertyId(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="calendarBox">
                <h3>{properties.find((p) => p.id === activePropertyId)?.name}</h3>
                <div className="weekdays">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="daysGrid">
                  {buildCalendarDays(activePropertyId).map((day) =>
                    day.type === 'blank' ? (
                      <div key={day.id} className="day blank"></div>
                    ) : (
                      <div key={day.id} className="day">
                        <b>{day.day}</b>
                        {day.bookings.map((b) => (
                          <div className="bookingChip" key={b.id}>
                            {b.guestname}
                          </div>
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

      {activeView === 'properties' && (
        <section className="card">
          <h2>Manage Properties</h2>

          {isAdmin && (
            <div className="inlineForm">
              <input
                placeholder="New property name"
                value={newPropertyName}
                onChange={(e) => setNewPropertyName(e.target.value)}
              />
              <button className="primaryBtn" onClick={addProperty}>
                Add Property
              </button>
            </div>
          )}

          <div className="gridList">
            {properties.map((p) => (
              <div className="listItem" key={p.id}>
                {editingPropertyId === p.id ? (
                  <>
                    <input
                      value={editingPropertyName}
                      onChange={(e) => setEditingPropertyName(e.target.value)}
                    />
                    <button onClick={updateProperty}>Save</button>
                    <button onClick={() => setEditingPropertyId('')}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div className="propertyDetailsBlock">
                      <div className="propertyTitleRow">
                        <b>{p.name}</b>
                        <p>{bookings.filter((b) => b.propertyid === p.id).length} bookings</p>
                      </div>
                      <button onClick={() => setExpandedPropertyId(expandedPropertyId === p.id ? '' : p.id)}>
                        {expandedPropertyId === p.id ? 'Hide' : 'Show'} property bookings
                      </button>
                      {expandedPropertyId === p.id && (
                        <div className="propertyBookingList">
                          {bookings.filter((b) => b.propertyid === p.id).length === 0 ? (
                            <p className="mutedSmall">No bookings for this property.</p>
                          ) : (
                            bookings
                              .filter((b) => b.propertyid === p.id)
                              .sort((a, b) => new Date(a.checkin) - new Date(b.checkin))
                              .map((booking) => (
                                <div className="propertyBookingMini" key={booking.id}>
                                  <span>{formatDate(booking.checkin)} to {formatDate(booking.checkout)}</span>
                                  <b>{booking.guestname}</b>
                                </div>
                              ))
                          )}
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="actionButtons">
                        <button
                          onClick={() => {
                            setEditingPropertyId(p.id);
                            setEditingPropertyName(p.name);
                          }}
                        >
                          Edit
                        </button>
                        <button className="dangerSoft" onClick={() => deleteProperty(p.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeView === 'users' && (
        <section className="card">
          <h2>Add Staff Login</h2>

          {isAdmin ? (
            <>
              <div className="inlineForm">
                <input
                  placeholder="Staff email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                />
                <input
                  placeholder="Staff password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                />
                <button className="primaryBtn" onClick={addStaffUser}>
                  <UserPlus size={15} /> Add Staff
                </button>
              </div>

              <div className="adminHint">
                Use the Admin tab to create local admin/user permissions.
              </div>
            </>
          ) : (
            <div className="empty">Only admins can add staff logins.</div>
          )}
        </section>
      )}

      {activeView === 'bookings' && (
        <section className="twoCol">
          <div className="card">
            <h2>{editingBookingId ? 'Edit Booking' : 'Add Booking'}</h2>

            <label>Property</label>
            <select
              value={bookingForm.propertyid}
              onChange={(e) => setBookingForm({ ...bookingForm, propertyid: e.target.value })}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <label>Guest Name</label>
            <input
              value={bookingForm.guestname}
              onChange={(e) => setBookingForm({ ...bookingForm, guestname: e.target.value })}
              placeholder="Guest name"
            />

            <label>Phone</label>
            <input
              value={bookingForm.phone}
              onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
              placeholder="Phone number"
            />

            <label>Number of Guests</label>
            <input
              value={bookingForm.numberofguests}
              onChange={(e) => setBookingForm({ ...bookingForm, numberofguests: e.target.value })}
              placeholder="Eg: 4"
            />

            <label>Booking Source</label>
            <select
              value={bookingForm.source}
              onChange={(e) => setBookingForm({ ...bookingForm, source: e.target.value })}
            >
              {['Direct', 'Airbnb', 'MakeMyTrip', 'Booking.com', 'Other'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <label>Check-in</label>
            <input
              type="date"
              value={bookingForm.checkin}
              onChange={(e) => setBookingForm({ ...bookingForm, checkin: e.target.value })}
            />

            <label>Check-out</label>
            <input
              type="date"
              value={bookingForm.checkout}
              onChange={(e) => setBookingForm({ ...bookingForm, checkout: e.target.value })}
            />

            <label>Total Amount</label>
            <input
              value={bookingForm.amount}
              onChange={(e) => setBookingForm({ ...bookingForm, amount: e.target.value })}
              placeholder="Total amount"
            />

            <label>Advance Paid</label>
            <input
              value={bookingForm.advancepaid}
              onChange={(e) => setBookingForm({ ...bookingForm, advancepaid: e.target.value })}
              placeholder="Advance paid"
            />

            <label>Payment Mode</label>
            <select
              value={bookingForm.paymentmode}
              onChange={(e) => setBookingForm({ ...bookingForm, paymentmode: e.target.value })}
            >
              {['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <label>Balance Amount</label>
            <input
              value={bookingForm.balanceamount}
              onChange={(e) => setBookingForm({ ...bookingForm, balanceamount: e.target.value })}
              placeholder="Balance amount"
            />

            <label>Notes</label>
            <textarea
              value={bookingForm.notes}
              onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
              placeholder="Notes"
            />

            {conflicts.length > 0 && (
              <div className="errorBox">
                <AlertTriangle size={18} /> Date already booked.
                {conflicts.map((c) => (
                  <p key={c.id}>
                    {c.guestname} — {formatDate(c.checkin)} to {formatDate(c.checkout)}
                  </p>
                ))}
              </div>
            )}

            {conflicts.length === 0 && bookingForm.checkin && bookingForm.checkout && selectedProperty && (
              <div className="successBox">
                <CheckCircle2 size={18} /> Dates available.
              </div>
            )}

            <button className="primaryBtn" onClick={addBooking}>
              {editingBookingId ? 'Update Booking' : 'Save Booking'}
            </button>

            {editingBookingId && (
              <button className="secondaryBtn" onClick={cancelEditBooking}>
                Cancel Edit
              </button>
            )}
          </div>

          <div className="card">
            <div className="sectionHeader">
              <h2>Bookings</h2>
              <input
                placeholder="Search bookings"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <select value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)}>
              <option value="all">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {filteredBookings.length === 0 ? (
              <div className="empty">No bookings found.</div>
            ) : (
              filteredBookings.map((b) => {
                const p = properties.find((x) => x.id === b.propertyid);
                return (
                  <div className="listItem" key={b.id}>
                    <div>
                      <b>{b.guestname}</b>
                      <p>{p?.name || 'Deleted property'}</p>
                      <p>{formatDate(b.checkin)} to {formatDate(b.checkout)}</p>
                      <p>Phone: {b.phone || '-'}</p>
                      <p>Guests: {b.numberofguests || '-'}</p>
                      <p>Total: {b.amount || '-'}</p>
                      <p>Advance: {b.advancepaid || '-'}</p>
                      <p>Payment: {b.paymentmode || '-'}</p>
                      <p>Balance: {b.balanceamount || '-'}</p>
                      <p>Notes: {b.notes || '-'}</p>
                    </div>
                    <div className="actionButtons">
                      <button onClick={() => startEditBooking(b)}>Edit</button>
                      {isAdmin && (
                        <button className="dangerSoft" onClick={() => deleteBooking(b.id)}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
