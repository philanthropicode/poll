import React from "react";

export default function PricingComparison() {
  const features = [
    {
      feature: "Spaces included",
      community: "1 personal/community space",
      organization: "1 organizational space with logo/name",
      institutional: "Unlimited spaces, branded environment",
    },
    {
      feature: "Active polls",
      community: "Up to 3 active polls",
      organization: "Unlimited",
      institutional: "Unlimited",
    },
    {
      feature: "Votes per public poll",
      community: "Up to 50",
      organization: "Unlimited",
      institutional: "Unlimited",
    },
    {
      feature: "Poll creation rate",
      community: "1 per week per member",
      organization: "Unlimited",
      institutional: "Unlimited",
    },
    {
      feature: "Poll duration limit",
      community: "Up to 1 month",
      organization: "Up to 3 months",
      institutional: "Configurable",
    },
    {
      feature: "Private polls",
      community: "—",
      organization: "✔️",
      institutional: "✔️",
    },
    {
      feature: "Role & group permissions",
      community: "Basic (creator/voter)",
      organization: "Full role-based",
      institutional: "Advanced + SSO",
    },
    {
      feature: "Location-based eligibility",
      community: "City/State/Country",
      organization: "Neighborhood → Country",
      institutional: "Address → Region (fine-grained)",
    },
    {
      feature: "Exports & analytics",
      community: "Basic summaries",
      organization: "CSV/JSON exports",
      institutional: "Advanced dashboards + cohort insights",
    },
    {
      feature: "API access",
      community: "—",
      organization: "Webhook (beta)",
      institutional: "Full API access",
    },
    {
      feature: "Opt-out of platform insights",
      community: "—",
      organization: "Add-on (+$99/mo)",
      institutional: "Add-on included",
    },
    {
      feature: "Support",
      community: "Community forums",
      organization: "Email support (48h)",
      institutional: "Priority onboarding & 24h response",
    },
  ];

  return (
    <div className="mt-10 overflow-x-auto">
      <h2 className="text-lg font-medium mb-3">Compare Plans</h2>
      <table className="min-w-full border text-sm text-gray-700">
        <thead className="bg-gray-100 text-gray-800">
          <tr>
            <th className="px-3 py-2 text-left font-semibold border-r">Feature</th>
            <th className="px-3 py-2 text-left font-semibold border-r">Community</th>
            <th className="px-3 py-2 text-left font-semibold border-r">Organization</th>
            <th className="px-3 py-2 text-left font-semibold">Institutional</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f, idx) => (
            <tr
              key={idx}
              className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              <td className="px-3 py-2 border-r font-medium text-gray-800">
                {f.feature}
              </td>
              <td className="px-3 py-2 border-r">{f.community}</td>
              <td className="px-3 py-2 border-r">{f.organization}</td>
              <td className="px-3 py-2">{f.institutional}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
