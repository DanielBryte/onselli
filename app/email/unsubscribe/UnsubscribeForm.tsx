'use client';

import { useState } from 'react';

export default function UnsubscribeForm({ token }: { token: string }) {
  const [message, setMessage] = useState('');
  async function unsubscribe() {
    const response = await fetch('/api/email/unsubscribe?token=' + encodeURIComponent(token), { method: 'POST' });
    const data = await response.json();
    setMessage(response.ok ? 'You have been unsubscribed from this creator’s marketing emails.' : data.error || 'Could not process the request.');
  }
  return message ? <p role="status">{message}</p> : <button className="button button--primary" onClick={() => void unsubscribe()} disabled={!token}>Confirm unsubscribe</button>;
}
