import React from "react";
import PricingComparison from "../components/PricingComparison";

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Pricing</h1>
      <p className="text-gray-700 text-sm">
        Start free. Grow into organizational collaboration with advanced controls, analytics,
        and governance. Individuals always participate for free; organizations pay for
        <em> control</em>, <em>insight</em>, and <em>identity</em>.
      </p>

      {/* Plans */}
      <div className="grid gap-4">
        {/* Community (Free) */}
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">Community</h2>
            <div className="text-right">
              <div className="text-xl font-semibold">$0</div>
              <div className="text-xs text-gray-500">forever free</div>
            </div>
          </div>
          <p className="text-gray-700 text-sm">
            For individuals, small groups, and public experiments. Build momentum and learn
            what your community values.
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
            <li>1 personal/community space</li>
            <li>Up to <strong>3 active polls</strong> at a time</li>
            <li>
              Public polls capped at <strong>up to 50 votes</strong> each (configurable cap
              within 20–50)
            </li>
            <li>
              Members can create <strong>1 new poll/week</strong> (per member)
            </li>
            <li>Poll deadlines up to <strong>1 month</strong></li>
            <li>Public results view + basic analytics</li>
            <li>Location filters (city/state/country) for eligibility on public polls</li>
          </ul>
          <a
            href="/signup"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Get Started Free
          </a>
        </div>

        {/* Organization */}
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">Organization</h2>
            <div className="text-right">
              <div className="text-xl font-semibold">$49</div>
              <div className="text-xs text-gray-500">per month</div>
            </div>
          </div>
          <p className="text-gray-700 text-sm">
            For teams, nonprofits, and startups ready to align priorities and budgets
            democratically in their own space.
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
            <li><strong>Dedicated organizational space</strong> with logo/name</li>
            <li>Unlimited member invites &amp; co-admins</li>
            <li>
              <strong>Unlimited submissions on public polls</strong> published by your org
            </li>
            <li>Private or public polls; org-only visibility options</li>
            <li>
              Role-based permissions (admins, creators, voters) and group-level access
            </li>
            <li>
              Voting restrictions by membership, groups, or <strong>location</strong> (address,
              neighborhood, city, state, country)
            </li>
            <li>CSV/JSON exports; basic org analytics</li>
            <li>API webhook for results notifications (beta)</li>
          </ul>
          <div className="text-gray-600 text-xs">
            <strong>Note:</strong> Opting out of platform-level aggregate insights is available
            as a paid add-on.
          </div>
          <div className="flex gap-3">
            <a
              href="/request-pilot"
              className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Request Pilot
            </a>
            <a
              href="/contact"
              className="inline-block rounded-lg border px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Talk to Us
            </a>
          </div>
        </div>

        {/* Institutional */}
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">Institutional</h2>
            <div className="text-right">
              <div className="text-xl font-semibold">$249</div>
              <div className="text-xs text-gray-500">per month</div>
            </div>
          </div>
          <p className="text-gray-700 text-sm">
            For municipalities, universities, and enterprises embedding collaborative
            governance and compliance at scale.
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
            <li>Everything in Organization, plus:</li>
            <li>Custom domain &amp; branding</li>
            <li>SSO (SAML/OIDC) and advanced role mapping</li>
            <li>Advanced analytics dashboards &amp; cohort insights</li>
            <li>
              Fine-grained geographic &amp; demographic eligibility filters (where lawful)
            </li>
            <li>Full API access &amp; integrations</li>
            <li>Priority onboarding &amp; support</li>
            <li>
              <strong>Privacy Add-On:</strong> bar platform aggregation/insights on your data
              (+$99/mo)
            </li>
          </ul>
          <a
            href="/contact"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Contact Sales
          </a>
        </div>
      </div>

      {/* Add-Ons */}
      <div className="rounded-2xl border p-4 space-y-3">
        <h2 className="text-lg font-medium">Add-Ons</h2>
        <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
          <li>
            <strong>Privacy Add-On</strong> (Org &amp; Institutional): Bar platform from
            gleaning aggregate insights on your org’s data — <strong>+$99/mo</strong>.
          </li>
          <li>
            <strong>Extra Concurrent Polls</strong>: $10 per additional active poll beyond
            plan limits.
          </li>
          <li>
            <strong>Extended Insights</strong>: Tailored reporting &amp; visualizations —
            <strong> $49/mo</strong>.
          </li>
          <li>
            <strong>Facilitation &amp; Rollout</strong>: Hands-on setup, design, and analysis
            support (contact us).
          </li>
        </ul>
      </div>

      {/* FAQ / Notes */}
      <div className="rounded-2xl border p-4 space-y-3">
        <h2 className="text-lg font-medium">Notes &amp; FAQs</h2>
        <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
          <li>
            <strong>Public vs. Private:</strong> Community plan results are public; Org/Institutional
            can run private polls with member-only results.
          </li>
          <li>
            <strong>Eligibility &amp; Location:</strong> You can restrict voting to members,
            groups, or specific locations (address, neighborhood, city, state, country).
            Additional demographic filters are available on Institutional, where lawful.
          </li>
          <li>
            <strong>Rate Limits:</strong> Free plan caps are designed to encourage thoughtful
            polls. Upgrade for higher throughput and unlimited public submissions.
          </li>
          <li>
            <strong>Data Ownership:</strong> You own your poll content and raw responses. We
            use aggregated, anonymized insights to improve the platform unless you purchase
            the Privacy Add-On.
          </li>
        </ul>
      </div>

      {/* CTA Footer */}
      <div className="rounded-2xl border p-4 space-y-2">
        <h2 className="text-lg font-medium">Ready to begin?</h2>
        <p className="text-gray-700 text-sm">
          Create a free space to start learning what your people value most. Upgrade when
          you’re ready to scale participation, permissions, and insights.
        </p>
        <div className="flex gap-3">
          <a
            href="/signup"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Get Started Free
          </a>
          <a
            href="/request-pilot"
            className="inline-block rounded-lg border px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Request an Org Pilot
          </a>
        </div>
      </div>
      <PricingComparison />
    </div>
  );
}
