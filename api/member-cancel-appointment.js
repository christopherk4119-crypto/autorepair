const SUPABASE_URL = 'https://dthftdrsmvnwrtxohitn.supabase.co';

// Cancelling requires the caller to prove they know both the member's email
// AND membership ID (the same two things the login screen requires) - not
// just a membership ID, which would let anyone cancel anyone else's
// appointment just by guessing/enumerating IDs.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Server is not configured (missing SUPABASE_SERVICE_ROLE_KEY).' });
    return;
  }

  const body = req.body || {};
  const email = body.email ? String(body.email).trim().toLowerCase() : '';
  const membershipId = body.membershipId ? String(body.membershipId).trim().toUpperCase() : '';
  const date = body.date;
  const time = body.time;

  if (!email || !membershipId || !date || !time) {
    res.status(400).json({ error: 'Missing required fields.' });
    return;
  }

  const headers = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    const memberRes = await fetch(
      `${SUPABASE_URL}/rest/v1/members?email=eq.${encodeURIComponent(email)}&membership_id=eq.${encodeURIComponent(membershipId)}&select=membership_id`,
      { headers }
    );
    if (!memberRes.ok) throw new Error('member verification failed');
    const members = await memberRes.json();

    if (!members || members.length !== 1) {
      res.status(403).json({ error: 'Could not verify membership.' });
      return;
    }

    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/appointments?membership_id=eq.${encodeURIComponent(membershipId)}&appointment_date=eq.${encodeURIComponent(date)}&appointment_time=eq.${encodeURIComponent(time)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'Cancelled' })
      }
    );
    if (!updateRes.ok) throw new Error('appointment update failed');

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
