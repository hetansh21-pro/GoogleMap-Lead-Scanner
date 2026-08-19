import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Phone,
  Mail,
  Globe,
  Star,
  Search,
  Filter,
  Copy,
  Check,
  Send,
  ExternalLink,
  Info,
  Database
} from 'lucide-react';

export default function LeadsTable({ leads = [], onExportExcel, onExportCSV, onExportJSON, onSendSingleN8n }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'no-website' | 'has-phone' | 'has-email'
  const [copiedId, setCopiedId] = useState(null);
  const [selectedLeadModal, setSelectedLeadModal] = useState(null);

  const handleCopyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      (lead.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.category || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'no-website') return !lead.hasWebsite;
    if (filterType === 'has-phone') return lead.phone && lead.phone !== 'Not Listed';
    if (filterType === 'has-email') return lead.email && lead.email !== 'Not Listed';

    return true;
  });

  return (
    <div className="minimal-card p-5 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-100 text-sm tracking-tight flex items-center gap-2">
              Captured Leads
              <span className="text-xs bg-zinc-800 text-zinc-300 font-mono px-2 py-0.5 rounded border border-zinc-700 font-medium">
                {filteredLeads.length} / {leads.length} Verified
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">Extracted phone numbers, emails & business data</p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              disabled={leads.length === 0}
              className="px-3.5 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 stroke-[2.5]" />
              Export Excel (.xlsx)
            </button>
          )}
          <button
            onClick={onExportCSV}
            disabled={leads.length === 0}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium text-xs rounded-lg border border-zinc-800 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={onExportJSON}
            disabled={leads.length === 0}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium text-xs rounded-lg border border-zinc-800 transition font-mono disabled:opacity-40 disabled:cursor-not-allowed"
          >
            JSON
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search leads by name, phone, email, location..."
            className="w-full bg-zinc-950 text-zinc-100 text-xs rounded-lg pl-9 pr-3 py-2 border border-zinc-800 focus:border-zinc-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto text-xs no-scrollbar">
          <Filter className="w-3.5 h-3.5 text-zinc-500 mr-1 shrink-0" />
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-md border transition text-xs whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold'
                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            All Leads
          </button>
          <button
            onClick={() => setFilterType('no-website')}
            className={`px-2.5 py-1 rounded-md border transition text-xs whitespace-nowrap ${
              filterType === 'no-website'
                ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold'
                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            No Website
          </button>
          <button
            onClick={() => setFilterType('has-phone')}
            className={`px-2.5 py-1 rounded-md border transition text-xs whitespace-nowrap ${
              filterType === 'has-phone'
                ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold'
                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            Phone Available
          </button>
          <button
            onClick={() => setFilterType('has-email')}
            className={`px-2.5 py-1 rounded-md border transition text-xs whitespace-nowrap ${
              filterType === 'has-email'
                ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold'
                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            Email Available
          </button>
        </div>
      </div>

      {/* Leads Table Container */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-900 text-zinc-400 font-medium text-[11px] border-b border-zinc-800">
            <tr>
              <th className="py-2.5 px-3.5">Business Name</th>
              <th className="py-2.5 px-3.5">Phone Number</th>
              <th className="py-2.5 px-3.5">Email Address</th>
              <th className="py-2.5 px-3.5">Website</th>
              <th className="py-2.5 px-3.5">Rating</th>
              <th className="py-2.5 px-3.5">Address</th>
              <th className="py-2.5 px-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-sans">
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-500">
                  <div className="space-y-1">
                    <p className="font-medium text-zinc-300 text-xs">No leads captured yet</p>
                    <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">Select target area & category above and click "Start Lead Scanner".</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                const hasPhone = lead.phone && lead.phone !== 'Not Listed';
                const hasEmail = lead.email && lead.email !== 'Not Listed';

                return (
                  <tr key={lead.id} className="hover:bg-zinc-900/60 transition duration-100">
                    {/* Business Name */}
                    <td className="py-3 px-3.5 font-semibold text-zinc-100 max-w-[190px] truncate">
                      <div className="truncate text-xs">{lead.name}</div>
                      <span className="text-[10px] text-zinc-400 font-mono block font-normal">{lead.category}</span>
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-3.5">
                      {hasPhone ? (
                        <div className="flex items-center gap-1.5 font-mono text-zinc-100 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{lead.phone}</span>
                          <button
                            onClick={() => handleCopyText(lead.phone, `phone_${lead.id}`)}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-200 transition"
                            title="Copy Phone"
                          >
                            {copiedId === `phone_${lead.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-zinc-600 italic text-[11px]">Not Listed</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="py-3 px-3.5">
                      {hasEmail ? (
                        <div className="flex items-center gap-1.5 font-mono text-zinc-200">
                          <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{lead.email}</span>
                          <button
                            onClick={() => handleCopyText(lead.email, `email_${lead.id}`)}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-200 transition"
                            title="Copy Email"
                          >
                            {copiedId === `email_${lead.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-zinc-600 italic text-[11px]">Not Listed</span>
                      )}
                    </td>

                    {/* Website Status */}
                    <td className="py-3 px-3.5">
                      {!lead.hasWebsite ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                          <Globe className="w-3 h-3 text-zinc-400" />
                          NO WEBSITE
                        </span>
                      ) : (
                        <a
                          href={lead.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-600"
                        >
                          <Globe className="w-3 h-3 text-zinc-400" />
                          Website
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </td>

                    {/* Rating */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-1 font-semibold text-zinc-200">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{lead.rating || 'N/A'}</span>
                        <span className="text-[10px] text-zinc-500 font-normal">({lead.reviews || 0})</span>
                      </div>
                    </td>

                    {/* Address */}
                    <td className="py-3 px-3.5 text-zinc-400 max-w-[170px] truncate text-[11px]">
                      {lead.address}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedLeadModal(lead)}
                          className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 transition"
                          title="View Details"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        {onSendSingleN8n && (
                          <button
                            onClick={() => onSendSingleN8n(lead)}
                            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 transition"
                            title="Push Lead to n8n Webhook"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-zinc-100 text-base">{selectedLeadModal.name}</h3>
                <p className="text-xs text-zinc-400 font-mono">{selectedLeadModal.category}</p>
              </div>
              <button
                onClick={() => setSelectedLeadModal(null)}
                className="text-zinc-400 hover:text-white text-xs px-2.5 py-1 bg-zinc-800 rounded border border-zinc-700"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs text-zinc-300">
              <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-400">Phone Number:</span>
                <span className="font-mono text-zinc-100 font-bold">{selectedLeadModal.phone}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-400">Email Address:</span>
                <span className="font-mono text-zinc-200">{selectedLeadModal.email}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-400">Website Status:</span>
                <span>{selectedLeadModal.hasWebsite ? selectedLeadModal.websiteUrl : 'No Website'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-400">Address:</span>
                <span className="text-right max-w-[240px] truncate">{selectedLeadModal.address}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-400">Rating & Reviews:</span>
                <span>⭐ {selectedLeadModal.rating} ({selectedLeadModal.reviews} reviews)</span>
              </div>
              {selectedLeadModal.openingHours && selectedLeadModal.openingHours !== 'Not Listed' && (
                <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-lg border border-zinc-850">
                  <span className="text-zinc-400">Opening Hours:</span>
                  <span>{selectedLeadModal.openingHours}</span>
                </div>
              )}
              {selectedLeadModal.priceRange && selectedLeadModal.priceRange !== 'N/A' && (
                <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-lg border border-zinc-850">
                  <span className="text-zinc-400">Price Range:</span>
                  <span className="font-mono text-zinc-200">{selectedLeadModal.priceRange}</span>
                </div>
              )}
              {selectedLeadModal.plusCode && selectedLeadModal.plusCode !== 'N/A' && (
                <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-lg border border-zinc-850">
                  <span className="text-zinc-400">Plus Code:</span>
                  <span className="font-mono text-zinc-300">{selectedLeadModal.plusCode}</span>
                </div>
              )}
              {selectedLeadModal.placeUrl && (
                <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-lg border border-zinc-850">
                  <span className="text-zinc-400">Google Maps:</span>
                  <a href={selectedLeadModal.placeUrl} target="_blank" rel="noreferrer" className="text-emerald-400 underline hover:text-emerald-300 flex items-center gap-1">
                    Open in Maps <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

