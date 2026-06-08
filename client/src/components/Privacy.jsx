// Plain-language privacy policy. Update CONTACT_EMAIL to your preferred address.
export const CONTACT_EMAIL = "sierrmar@gmail.com";

export default function Privacy() {
  return (
    <div className="privacy">
      <h2>Privacy Policy</h2>
      <p className="muted">Last updated: June 2026</p>

      <p>
        The Mood Grid is a personal mood tracker. We keep this simple and we keep
        your data private. Here's exactly what that means.
      </p>

      <h3>What we collect</h3>
      <ul>
        <li>Your <strong>name</strong> and <strong>email</strong> (to sign you in).</li>
        <li>
          The <strong>moods, habits, and notes</strong> you choose to log each day.
        </li>
      </ul>

      <h3>Why we collect it</h3>
      <p>
        Solely to show you your own grid, streaks, and trends over time. That's the
        whole point of the app.
      </p>

      <h3>What we do NOT do</h3>
      <ul>
        <li>We never sell your data.</li>
        <li>We don't share it with advertisers or third parties.</li>
        <li>We don't use your notes or moods for anything beyond your own dashboard.</li>
      </ul>

      <h3>How it's stored</h3>
      <p>
        Your data is stored in a secure database. Your password is encrypted
        (hashed) and is never visible to anyone — not even the app owner.
      </p>

      <h3>Your control</h3>
      <p>
        You can permanently delete your account and all of your data at any time
        from <strong>Settings → Delete account</strong>. This cannot be undone.
      </p>

      <h3>Contact</h3>
      <p>
        Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </div>
  );
}
