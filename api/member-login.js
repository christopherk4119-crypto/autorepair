const SUPABASE_URL = 'https://dthftdrsmvnwrtxohitn.supabase.co';

function isRenewalOverdue(renewalDateStr) {
  if (!renewalDateStr) return false;
  const renewal = new Date(renewalDateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return renewal < today;
}

// Advance a renewal date by one year at a time until it's no longer in the
// past (handles a member who hasn't logged in for more than one cycle)
function catchUpRenewalDate(renewalDateStr) {
  const renewal = new Date(renewalDateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (renewal < today) {
    renewal.setFullYear(renewal.getFullYear() + 1);
  }
  return renewal.toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Server is not configured (missing SUPABASE_SERVICE_ROLE_KEY).' });
    return;
  }

  const rawEmail = (req.body || {}).email;
  const rawMembershipId = (req.body || {}).membershipId;
  if (!rawEmail || !rawMembershipId) {
    res.status(400).json({ error: 'Missing email or membership ID.' });
    return;
  }
  const email = String(rawEmail).trim().toLowerCase();
  const membershipId = String(rawMembershipId).trim().toUpperCase();

  const headers = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    const memberRes = await fetch(
      `${SUPABASE_URL}/rest/v1/members?email=eq.${encodeURIComponent(email)}&membership_id=eq.${encodeURIComponent(membershipId)}&select=*`,
      { headers }
    );
    if (!memberRes.ok) throw new Error('members lookup failed');
    const members = await memberRes.json();

    if (!members || members.length !== 1) {
      res.status(404).json({ error: 'Membership not found. Please check your email and membership ID.' });
      return;
    }
    const member = members[0];

    // If the renewal date has passed, treat it as a renewal: wipe usage and
    // roll the renewal date forward to the next un-expired anniversary.
    // Done here (server-side, service-role key) because this is a write and
    // members have no real login session for RLS to authorize it under.
    let justRenewed = false;
    if (isRenewalOverdue(member.renewal_date)) {
      const newRenewal = catchUpRenewalDate(member.renewal_date);
      const deleteRes = await fetch(
        `${SUPABASE_URL}/rest/v1/benefits_used?membership_id=eq.${encodeURIComponent(membershipId)}`,
        { method: 'DELETE', headers }
      );
      if (!deleteRes.ok) throw new Error('benefit usage reset failed');
      const renewRes = await fetch(
        `${SUPABASE_URL}/rest/v1/members?membership_id=eq.${encodeURIComponent(membershipId)}`,
        { method: 'PATCH', headers, body: JSON.stringify({ renewal_date: newRenewal }) }
      );
      if (!renewRes.ok) throw new Error('renewal date update failed');
      member.renewal_date = newRenewal;
      justRenewed = true;
    }

    const [benefitsRes, historyRes, appointmentsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/benefits_used?membership_id=eq.${encodeURIComponent(membershipId)}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/service_history?membership_id=eq.${encodeURIComponent(membershipId)}&select=*&order=service_date.desc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/appointments?membership_id=eq.${encodeURIComponent(membershipId)}&select=*&order=appointment_date.desc`, { headers })
    ]);
    if (!benefitsRes.ok || !historyRes.ok || !appointmentsRes.ok) throw new Error('related data lookup failed');

    const benefits = await benefitsRes.json();
    const history = await historyRes.json();
    const appointments = await appointmentsRes.json();

    res.status(200).json({ member, benefits, history, appointments, justRenewed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
