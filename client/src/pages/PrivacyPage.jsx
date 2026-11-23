// client/src/pages/PrivacyPage.jsx
// Privacy Policy template true to SkillSwap's actual data model and services.

import { Link } from 'react-router-dom';
import { SITE_NAME, CONTACT_EMAIL } from '@/config/site';
import { Shield, AlertTriangle } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Disclaimer Banner */}
      <div className="mb-8 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm">
          <p className="font-semibold mb-1">Developer Notice &amp; Legal Disclaimer</p>
          <p>
            This document is a plain-language template reflecting how {SITE_NAME} handles user data.
            The owner must review and customize this policy prior to commercial launch. This template does not constitute formal legal advice.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 shadow-sm space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 text-indigo-600 font-semibold text-sm mb-2">
            <Shield className="h-4 w-4" />
            <span>Privacy Policy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Privacy Policy for {SITE_NAME}</h1>
          <p className="text-xs text-slate-500 mt-1">Last Updated: November 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">1. Data We Collect</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {SITE_NAME} collects only the information necessary to facilitate peer skill exchanges:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1.5">
            <li><strong>Account Details:</strong> Your name, email address, and a secure bcrypt password hash (passwords are never stored in plaintext).</li>
            <li><strong>Profile Information:</strong> Bio, skills you teach and learn, proficiency levels, and optional profile photo (avatar).</li>
            <li><strong>Location Data:</strong> Approximate coordinates from address searches. Other users see only an approximate rounded distance (e.g., &ldquo;within 5 km&rdquo;) &mdash; exact coordinates are never shown to peers.</li>
            <li><strong>Platform Activity:</strong> Direct messages exchanged during active matches, peer reviews and ratings, event hosting, and attendance RSVPs.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">2. How We Use Your Data</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            We use your data solely to operate the platform: matching you with compatible skill partners, delivering notifications regarding connection requests and events, and maintaining community trust through reviews.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">3. Third-Party Services</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            We share data only with service providers required to power {SITE_NAME}:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1.5">
            <li><strong>OpenStreetMap / Nominatim:</strong> Used to geocode addresses and display interactive community maps.</li>
            <li><strong>Google OAuth:</strong> If you choose to log in with Google, Google provides your verified email and name.</li>
            <li><strong>Email Provider (Resend):</strong> If email notifications are active, Resend delivers transactional notices without including chat contents.</li>
            <li><strong>Hosting &amp; Database Providers:</strong> Cloud infrastructure (such as Render and MongoDB Atlas) hosts our encrypted database and application runtime.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">4. Cookies and Tracking</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            We use strictly <strong>one necessary session cookie</strong> (<code>skillswap_session</code>) to keep you securely signed in. We do not use third-party analytics trackers, advertising cookies, or cross-site fingerprinting.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">5. Data Retention and Self-Service Deletion</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            You maintain full ownership of your data. You may delete your account at any time via the Danger Zone in your Profile Setup page.
            Account deletion immediately cascades and removes your skills, messages, matches, reviews, hosted events, RSVPs, and uploaded avatars. Backups may retain encrypted snapshots for a limited operational window before deletion.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">6. Contact and Your Rights</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            If you have questions about your privacy rights or wish to exercise data rights, contact us at:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 font-medium hover:underline">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </section>

        <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
          <Link to="/" className="text-indigo-600 hover:underline">
            &larr; Return to Home
          </Link>
          <Link to="/terms" className="text-indigo-600 hover:underline">
            Terms of Service &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

