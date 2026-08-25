const SUPABASE_URL = 'https://dthftdrsmvnwrtxohitn.supabase.co';

// Returns only the list of already-booked appointment times for one date -
// no membership_id, name, or any other customer detail. Used by the public
// booking form (no login) to block double-bookings, without needing the
// browser to be able to read the appointments table directly.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Server is not configured (missing SUPABASE_SERVICE_ROLE_KEY).' });
    return;
  }

  const date = (req.body || {}).date;
  if (!date) {
    res.status(400).json({ error: 'Missing date.' });
    return;
  }

  const headers = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    const aptRes = await fetch(
      `${SUPABASE_URL}/rest/v1/appointments?appointment_date=eq.${encodeURIComponent(date)}&status=neq.Cancelled&select=appointment_time`,
      { headers }
    );
    if (!aptRes.ok) throw new Error('appointments lookup failed');
    const rows = await aptRes.json();

    res.status(200).json({ bookedTimes: rows.map(r => r.appointment_time) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
