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
  Database,
  MapPin
} from 'lucide-react';

export default function LeadsTable({ leads = [], onExportExcel, onExportCSV, onExportJSON, onSendSingleN8n }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [selectedLeadModal, setSelectedLeadModal] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(100);

  const handleCopyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getGoogleMapsUrl = (lead) => {
    if (lead.placeUrl && lead.placeUrl.includes('google.com/maps')) {
      return lead.placeUrl;
    }
    const query = `${lead.name} ${lead.address || ''}`.trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
    if (filterType === 'has-website') return lead.hasWebsite;
    if (filterType === 'has-phone') return lead.phone && lead.phone !== 'Not Listed';
    if (filterType === 'has-email') return lead.email && lead.email !== 'Not Listed';

    return true;
  });

  const displayedLeads = displayLimit === 'all' ? filteredLeads : filteredLeads.slice(0, Number(displayLimit) || 100);

  return (
    <div className="google-card p-4 sm:p-5 space-y-4 shadow-sm">
      {/* Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-full bg-[#e8f0fe] text-[#1a73e8] shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm tracking-tight flex items-center gap-2 flex-wrap">
              Captured Leads
              <span className="text-xs bg-gray-100 text-gray-700 font-sans px-2.5 py-0.5 rounded-full border border-gray-200 font-semibold">
                {filteredLeads.length} / {leads.length} Verified
              </span>
            </h3>
            <p className="text-[11px] text-gray-500">Extracted phone numbers, emails & business details</p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              disabled={leads.length === 0}
              className="px-4 py-1.5 google-btn-success text-xs rounded-full flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel (.xlsx)</span>
            </button>
          )}
          <button
            onClick={onExportCSV}
            disabled={leads.length === 0}
            className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-full border border-gray-200 transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-gray-600" />
            <span>CSV</span>
          </button>
          <button
            onClick={onExportJSON}
            disabled={leads.length === 0}
            className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-full border border-gray-200 transition disabled:opacity-40 cursor-pointer"
          >
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col md:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search leads by name, phone, email, address..."
            className="w-full bg-white text-gray-900 text-xs rounded-full pl-9 pr-3 py-2 border border-gray-300 focus:border-[#1a73e8] outline-none shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto text-xs no-scrollbar py-0.5">
          <Filter className="w-3.5 h-3.5 text-gray-400 mr-1 shrink-0" />
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-full border transition text-xs whitespace-nowrap cursor-pointer ${
              filterType === 'all'
                ? 'bg-[#1a73e8] text-white border-[#1a73e8] font-bold'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            All Leads
          </button>
          <button
            onClick={() => setFilterType('no-website')}
            className={`px-3 py-1 rounded-full border transition text-xs whitespace-nowrap cursor-pointer ${
              filterType === 'no-website'
                ? 'bg-[#ea4335] text-white border-[#ea4335] font-bold'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            🚫 No Website
          </button>
          <button
            onClick={() => setFilterType('has-website')}
            className={`px-3 py-1 rounded-full border transition text-xs whitespace-nowrap cursor-pointer ${
              filterType === 'has-website'
                ? 'bg-[#34a853] text-white border-[#34a853] font-bold'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            🔗 Has Website
          </button>
          <button
            onClick={() => setFilterType('has-phone')}
            className={`px-3 py-1 rounded-full border transition text-xs whitespace-nowrap cursor-pointer ${
              filterType === 'has-phone'
                ? 'bg-[#1a73e8] text-white border-[#1a73e8] font-bold'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Phone Available
          </button>
        </div>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="block md:hidden space-y-3">
        {filteredLeads.length === 0 ? (
          <div className="py-8 text-center bg-gray-50 rounded-2xl border border-gray-200 text-gray-500 text-xs">
            No leads captured yet. Start a search to see results.
          </div>
        ) : (
          displayedLeads.map((lead) => {
            const hasPhone = lead.phone && lead.phone !== 'Not Listed';
            const hasEmail = lead.email && lead.email !== 'Not Listed';
            const mapUrl = getGoogleMapsUrl(lead);

            return (
              <div
                key={`mob_${lead.id}`}
                className="p-3.5 bg-white rounded-2xl border border-gray-200 space-y-2.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm leading-tight">{lead.name}</h4>
                    <span className="text-[10px] text-gray-500 block mt-0.5">{lead.category}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 shrink-0 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{lead.rating || 'N/A'}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-[11px]">Phone:</span>
                    {hasPhone ? (
                      <div className="flex items-center gap-1.5 font-sans text-gray-900 font-semibold">
                        <a href={`tel:${lead.phone}`} className="hover:underline flex items-center gap-1 text-[#1a73e8]">
                          <Phone className="w-3 h-3" />
                          <span>{lead.phone}</span>
                        </a>
                        <button
                          onClick={() => handleCopyText(lead.phone, `mob_phone_${lead.id}`)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400"
                        >
                          {copiedId === `mob_phone_${lead.id}` ? <Check className="w-3 h-3 text-[#34a853]" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-[11px]">Not Listed</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-[11px]">Email:</span>
                    {hasEmail ? (
                      <div className="flex items-center gap-1.5 font-sans text-gray-800">
                        <a href={`mailto:${lead.email}`} className="hover:underline flex items-center gap-1 text-[#1a73e8] truncate max-w-[160px]">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </a>
                        <button
                          onClick={() => handleCopyText(lead.email, `mob_email_${lead.id}`)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400"
                        >
                          {copiedId === `mob_email_${lead.id}` ? <Check className="w-3 h-3 text-[#34a853]" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-[11px]">Not Listed</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 text-[11px] gap-1 flex-wrap">
                    {!lead.hasWebsite ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-red-50 text-[#ea4335] border border-red-200 font-semibold">
                        🚫 NO WEBSITE
                      </span>
                    ) : (
                      <a
                        href={lead.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-0.5 rounded-full text-[10px] bg-blue-50 text-[#1a73e8] border border-blue-200 font-semibold flex items-center gap-1"
                      >
                        <Globe className="w-3 h-3" />
                        Website <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}

                    <div className="flex items-center gap-1">
                      {/* Direct Google Maps Location Button */}
                      <a
                        href={mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-[#ea4335] rounded-full border border-red-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                        title="Open business location on Google Maps"
                      >
                        <MapPin className="w-3 h-3 text-[#ea4335]" />
                        <span>Open Map</span>
                      </a>

                      <button
                        onClick={() => setSelectedLeadModal(lead)}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full border border-gray-200 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Info className="w-3 h-3" /> Details
                      </button>
                      {onSendSingleN8n && (
                        <button
                          onClick={() => onSendSingleN8n(lead)}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full border border-gray-200 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3 h-3" /> n8n
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP LEADS TABLE */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 text-gray-600 font-semibold text-[11px] border-b border-gray-200">
            <tr>
              <th className="py-3 px-4">Business Name</th>
              <th className="py-3 px-4">Phone Number</th>
              <th className="py-3 px-4">Email Address</th>
              <th className="py-3 px-4">Website</th>
              <th className="py-3 px-4">Rating</th>
              <th className="py-3 px-4">Address</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-sans">
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-500">
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-800 text-xs">No leads captured yet</p>
                    <p className="text-[11px] text-gray-500 max-w-sm mx-auto">Select target area & category above and click "Search Leads".</p>
                  </div>
                </td>
              </tr>
            ) : (
              displayedLeads.map((lead) => {
                const hasPhone = lead.phone && lead.phone !== 'Not Listed';
                const hasEmail = lead.email && lead.email !== 'Not Listed';
                const mapUrl = getGoogleMapsUrl(lead);

                return (
                  <tr key={lead.id} className="hover:bg-blue-50/40 transition duration-100">
                    <td className="py-3 px-4 font-bold text-gray-900 max-w-[190px] truncate">
                      <div className="truncate text-xs">{lead.name}</div>
                      <span className="text-[10px] text-gray-500 block font-normal">{lead.category}</span>
                    </td>

                    <td className="py-3 px-4">
                      {hasPhone ? (
                        <div className="flex items-center gap-1.5 text-gray-900 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" />
                          <span>{lead.phone}</span>
                          <button
                            onClick={() => handleCopyText(lead.phone, `phone_${lead.id}`)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition"
                            title="Copy Phone"
                          >
                            {copiedId === `phone_${lead.id}` ? <Check className="w-3.5 h-3.5 text-[#34a853]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">Not Listed</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {hasEmail ? (
                        <div className="flex items-center gap-1.5 text-gray-800">
                          <Mail className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" />
                          <span className="truncate max-w-[150px]">{lead.email}</span>
                          <button
                            onClick={() => handleCopyText(lead.email, `email_${lead.id}`)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition"
                            title="Copy Email"
                          >
                            {copiedId === `email_${lead.id}` ? <Check className="w-3.5 h-3.5 text-[#34a853]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">Not Listed</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {!lead.hasWebsite ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-[#ea4335] border border-red-200">
                          <Globe className="w-3 h-3 text-[#ea4335]" />
                          NO WEBSITE
                        </span>
                      ) : (
                        <a
                          href={lead.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] bg-blue-50 text-[#1a73e8] hover:underline border border-blue-200 font-semibold"
                        >
                          <Globe className="w-3 h-3 text-[#1a73e8]" />
                          Website
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 font-semibold text-gray-800">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{lead.rating || 'N/A'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-gray-500 max-w-[170px] truncate text-[11px]">
                      {lead.address}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Direct Google Maps Location Button */}
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-[#ea4335] rounded-full border border-red-200 transition cursor-pointer flex items-center justify-center shadow-xs"
                          title="Open Business Location in Google Maps"
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#ea4335]" />
                        </a>

                        <button
                          onClick={() => setSelectedLeadModal(lead)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full border border-gray-200 transition cursor-pointer"
                          title="View Details"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        {onSendSingleN8n && (
                          <button
                            onClick={() => onSendSingleN8n(lead)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full border border-gray-200 transition cursor-pointer"
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

      {/* VIEW LIMIT CONTROLS & STATUS */}
      {filteredLeads.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1 text-xs text-gray-600 border-t border-gray-100">
          <div>
            Showing <span className="font-bold text-gray-900">{displayedLeads.length}</span> of{' '}
            <span className="font-bold text-gray-900">{filteredLeads.length}</span> verified leads
            {displayLimit !== 'all' && filteredLeads.length > displayLimit && (
              <span className="ml-1 text-[#1a73e8] font-medium hidden sm:inline">(Optimized for smooth performance)</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500">Show on screen:</span>
            {[50, 100, 250, 'all'].map((limit) => (
              <button
                key={limit}
                type="button"
                onClick={() => setDisplayLimit(limit)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                  displayLimit === limit
                    ? 'bg-[#1a73e8] text-white border-[#1a73e8]'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {limit === 'all' ? 'All' : limit}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LEAD DETAILS MODAL */}
      {selectedLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{selectedLeadModal.name}</h3>
                <p className="text-xs text-gray-500">{selectedLeadModal.category}</p>
              </div>
              <button
                onClick={() => setSelectedLeadModal(null)}
                className="text-gray-600 hover:text-gray-900 text-xs px-3 py-1 bg-gray-100 rounded-full border border-gray-200 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-700">
              <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-gray-500">Phone Number:</span>
                <span className="font-semibold text-gray-900">{selectedLeadModal.phone}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-gray-500">Email Address:</span>
                <span className="text-gray-800">{selectedLeadModal.email}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-gray-500">Website Status:</span>
                <span>{selectedLeadModal.hasWebsite ? selectedLeadModal.websiteUrl : 'No Website'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-gray-500">Address:</span>
                <span className="text-right max-w-[220px] truncate">{selectedLeadModal.address}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-gray-500">Rating:</span>
                <span>⭐ {selectedLeadModal.rating || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-red-50 rounded-xl border border-red-100">
                <span className="text-gray-600 font-semibold">Google Maps Pin:</span>
                <a
                  href={getGoogleMapsUrl(selectedLeadModal)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#ea4335] font-bold underline flex items-center gap-1"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#ea4335]" />
                  Open in Google Maps <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
