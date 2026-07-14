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
    if (properties.length > 0 && !bookingForm.propertyi
