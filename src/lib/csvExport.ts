/**
 * Shared CSV export utility for leads
 */

function escapeCSVField(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportLeadsToCSV(leads: Array<Record<string, any>>, filename: string) {
  if (leads.length === 0) return;

  const headers = [
    'First Name', 'Last Name', 'Full Name', 'Title', 'Company', 'Email',
    'Phone', 'LinkedIn', 'Website', 'City', 'State', 'Country',
    'Industry', 'Employee Count',
  ];

  const rows = leads.map((lead) => {
    // Support both apollo_leads format and signal_leads format
    const firstName = lead.first_name || (lead.contact_name || '').split(/\s+/)[0] || '';
    const lastName = lead.last_name || (lead.contact_name || '').split(/\s+/).slice(1).join(' ') || '';
    const fullName = lead.contact_name || `${firstName} ${lastName}`.trim();

    return [
      firstName,
      lastName,
      fullName,
      lead.title || '',
      lead.company_name || lead.company || '',
      lead.email || '',
      lead.phone || '',
      lead.linkedin_url || lead.linkedin_profile_url || lead.linkedin || '',
      lead.website || lead.company_domain || lead.domain || '',
      lead.city || '',
      lead.state || '',
      lead.country || '',
      lead.industry || '',
      lead.employee_count || '',
    ].map(escapeCSVField);
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
