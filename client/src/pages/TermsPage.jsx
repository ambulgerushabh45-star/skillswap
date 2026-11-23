// client/src/pages/TermsPage.jsx
// Terms of Service template with community safety standards.

import { Link } from 'react-router-dom';
import { SITE_NAME, CONTACT_EMAIL } from '@/config/site';
import { FileText, AlertTriangle, Users } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Disclaimer Banner */}
      <div className="mb-8 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm">
          <p className="font-semibold mb-1">Developer Notice &amp; Legal Disclaimer</p>
          <p>
            This document is a plain-language template. The owner must review, adapt, and seek legal guidance
            prior to public launch. This template does not constitute formal legal advice.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 shadow-sm space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 text-indigo-600 font-semibold text-sm mb-2">
            <FileText className="h-4 w-4" />
            <span>Community Guidelines &amp; Terms</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Terms of Service for {SITE_NAME}</h1>
          <p className="text-xs text-slate-500 mt-1">Last Updated: November 2026</p>
        </div>

        {/* Safety Box */}
        <div className="p-4 sm:p-5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-indigo-900">
            <Users className="h-4 w-4 text-indigo-700" />
            <span>Safety Advice for Meeting Strangers</span>
          </div>
          <p className="text-xs sm:text-sm text-indigo-800 leading-relaxed">
            {SITE_NAME} does not verify background checks or criminal histories of users.
            When arranging in-person skill swaps or attending events:
          </p>
          <ul className="list-disc pl-5 text-xs sm:text-sm text-indigo-800 space-y-1">
            <li><strong>Meet in Public:</strong> Always hold initial swap sessions in populated public spaces like libraries, coffee shops, or community centers.</li>
            <li><strong>Inform Others:</strong> Tell a friend or family member where you are going, who you are meeting, and when you expect to finish.</li>
            <li><strong>Protect Private Information:</strong> Do not share personal financial details, home addresses, or private sensitive info with matches.</li>
            <li><strong>Trust Your Instincts:</strong> If a situation or interaction feels uncomfortable, leave immediately and report the user.</li>
          </ul>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">1. Acceptable Use Policy</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            By accessing {SITE_NAME}, you agree to uphold respectful, safe community conduct. You may not:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1.5">
            <li>Harass, stalk, abuse, intimidate, or discriminate against other members.</li>
            <li>Post spam, unsolicited promotional messages, fraudulent offers, or malicious links.</li>
            <li>Upload copyrighted material, obscene imagery, or unlawful content.</li>
            <li>Attempt to circumvent security measures, exploit APIs, or access unauthorized data.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">2. User-Generated Content &amp; Reviews</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            You retain ownership of the content you publish (profiles, skill descriptions, event details).
            You grant {SITE_NAME} a limited license to display and distribute this content solely for platform operations.
            Reviews must be honest reflections of completed skill exchanges. Fake or retaliatory reviews violate these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">3. Disclaimer of Warranties</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {SITE_NAME} is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any kind.
            We do not guarantee the teaching skill, quality, accuracy, safety, or reliability of any user or exchange.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">4. Account Termination</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            We reserve the right to suspend or terminate accounts that breach these terms.
            You may also delete your account at any time via your profile settings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">5. Contact</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            For questions or abuse reports, reach out to us at:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 font-medium hover:underline">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </section>

        <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
          <Link to="/" className="text-indigo-600 hover:underline">
            &larr; Return to Home
          </Link>
          <Link to="/privacy" className="text-indigo-600 hover:underline">
            Privacy Policy &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

