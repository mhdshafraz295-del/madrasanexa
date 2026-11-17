import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Search,
  Plus,
  Edit2,
  QrCode,
  RotateCw,
  Ban,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Printer,
  Download,
  Building,
  Layers,
  Users,
  X,
} from 'lucide-react';
import {
  listClassrooms,
  createClassroom,
  updateClassroom,
  regenerateClassroomQr,
  revokeClassroomQr,
  activateClassroom,
  getClassroomQrPrintData,
  type ClassroomItem,
} from '../../services/classroom.service';

const STATIC_VENUE_PLAQUE_NOTICE =
  'Static Venue Plaque Notice: Classroom QR codes verify venue and schedule alignment within the approved timetable window. Static QR codes do not certify biometric physical presence or continuous attendance.';

export const ClassroomQrManagementTab: React.FC = () => {
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Classroom Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<ClassroomItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formRoomNumber, setFormRoomNumber] = useState('');
  const [formBuilding, setFormBuilding] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formCapacity, setFormCapacity] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Plaque Preview / Print Modal
  const [previewClassroom, setPreviewClassroom] = useState<ClassroomItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Regenerate Confirmation Modal
  const [confirmRegenClassroom, setConfirmRegenClassroom] = useState<ClassroomItem | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Revoke Confirmation Modal
  const [confirmRevokeClassroom, setConfirmRevokeClassroom] = useState<ClassroomItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchClassrooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const activeParam =
        statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined;

      const data = await listClassrooms({
        search: search.trim() || undefined,
        isActive: activeParam,
        page,
        pageSize,
      });

      setClassrooms(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load classrooms.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, pageSize]);

  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchClassrooms();
  };

  const handleOpenCreateModal = () => {
    setEditingClassroom(null);
    setFormName('');
    setFormRoomNumber('');
    setFormBuilding('');
    setFormFloor('');
    setFormCapacity('');
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (room: ClassroomItem) => {
    setEditingClassroom(room);
    setFormName(room.name);
    setFormRoomNumber(room.roomNumber);
    setFormBuilding(room.building || '');
    setFormFloor(room.floor || '');
    setFormCapacity(room.capacity ? String(room.capacity) : '');
    setFormNotes(room.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formRoomNumber.trim()) {
      setFormError('Classroom name and room number are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const payload = {
        name: formName.trim(),
        roomNumber: formRoomNumber.trim(),
        building: formBuilding.trim() || undefined,
        floor: formFloor.trim() || undefined,
        capacity: formCapacity ? parseInt(formCapacity, 10) : undefined,
        notes: formNotes.trim() || undefined,
      };

      if (editingClassroom) {
        await updateClassroom(editingClassroom.id, payload);
      } else {
        await createClassroom(payload);
      }

      setIsModalOpen(false);
      fetchClassrooms();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err.message || 'Failed to save classroom.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview Plaque
  const handleOpenPreview = async (room: ClassroomItem) => {
    setPreviewClassroom(room);
    setIsLoadingQr(true);
    setQrDataUrl(null);

    try {
      const printData = await getClassroomQrPrintData(room.id);
      const url = await QRCode.toDataURL(printData.qrPayload, {
        width: 320,
        margin: 2,
        color: {
          dark: '#08483A',
          light: '#FFFFFF',
        },
      });
      setQrDataUrl(url);
    } catch (err: any) {
      console.error('Failed to generate QR preview:', err);
    } finally {
      setIsLoadingQr(false);
    }
  };

  // Download QR Plaque
  const handleDownloadQr = () => {
    if (!qrDataUrl || !previewClassroom) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR-Plaque-${previewClassroom.roomNumber}-${previewClassroom.name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print A4
  const handlePrintPlaque = () => {
    if (!previewClassroom || !qrDataUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Venue Plaque - ${previewClassroom.roomNumber} ${previewClassroom.name}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              color: #0F172A;
              margin: 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 90vh;
              text-align: center;
            }
            .plaque-box {
              border: 3px solid #08483A;
              border-radius: 20px;
              padding: 40px 30px;
              max-width: 580px;
              width: 100%;
              box-sizing: border-box;
            }
            .badge {
              display: inline-block;
              background-color: #E6F7F3;
              color: #08483A;
              font-size: 14px;
              font-weight: 700;
              padding: 6px 16px;
              border-radius: 9999px;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 20px;
            }
            .room-number {
              font-size: 42px;
              font-weight: 800;
              color: #08483A;
              margin: 0;
            }
            .room-name {
              font-size: 24px;
              font-weight: 600;
              color: #334155;
              margin: 6px 0 16px 0;
            }
            .meta {
              font-size: 14px;
              color: #64748B;
              margin-bottom: 24px;
            }
            .qr-wrapper {
              margin: 10px 0 20px 0;
            }
            .qr-wrapper img {
              width: 240px;
              height: 240px;
              border: 1px solid #E2E8F0;
              border-radius: 12px;
              padding: 8px;
            }
            .token-box {
              background: #F8FAFC;
              border: 1px solid #E2E8F0;
              border-radius: 8px;
              padding: 8px 14px;
              font-family: monospace;
              font-size: 13px;
              color: #475569;
              display: inline-block;
              margin-bottom: 24px;
            }
            .disclaimer {
              font-size: 10px;
              color: #94A3B8;
              line-height: 1.4;
              border-top: 1px dashed #CBD5E1;
              padding-top: 16px;
              margin-top: 12px;
            }
          </style>
        </head>
        <body>
          <div class="plaque-box">
            <div class="badge">MadrasaNexa Classroom Venue Plaque</div>
            <h1 class="room-number">Room ${previewClassroom.roomNumber}</h1>
            <h2 class="room-name">${previewClassroom.name}</h2>
            <div class="meta">
              ${previewClassroom.building ? `<span>Building: ${previewClassroom.building}</span> &bull; ` : ''}
              ${previewClassroom.floor ? `<span>Floor: ${previewClassroom.floor}</span> &bull; ` : ''}
              ${previewClassroom.capacity ? `<span>Capacity: ${previewClassroom.capacity}</span>` : ''}
            </div>
            <div class="qr-wrapper">
              <img src="${qrDataUrl}" alt="Classroom QR Code" />
            </div>
            <div class="token-box">
              Manual Plaque Code: <strong>${previewClassroom.roomToken}</strong>
            </div>
            <div class="disclaimer">
              ${STATIC_VENUE_PLAQUE_NOTICE}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Regenerate QR Token
  const handleRegenerateQr = async () => {
    if (!confirmRegenClassroom) return;
    try {
      setIsRegenerating(true);
      await regenerateClassroomQr(confirmRegenClassroom.id);
      setConfirmRegenClassroom(null);
      fetchClassrooms();
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Failed to regenerate QR code.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Revoke QR Token / Deactivate Room
  const handleRevokeQr = async () => {
    if (!confirmRevokeClassroom) return;
    try {
      setIsRevoking(true);
      await revokeClassroomQr(confirmRevokeClassroom.id);
      setConfirmRevokeClassroom(null);
      fetchClassrooms();
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Failed to revoke QR code.');
    } finally {
      setIsRevoking(false);
    }
  };

  // Reactivate Classroom
  const handleActivateClassroom = async (room: ClassroomItem) => {
    try {
      await activateClassroom(room.id);
      fetchClassrooms();
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Failed to activate classroom.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Actions Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#5B6B7F] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search room name, number, building..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#E7E9EE] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#37C6A3] transition"
          />
        </form>

        {/* Filter & Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex bg-[#F8FAFC] p-1 rounded-xl border border-[#E7E9EE] text-xs">
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-[#08483A] shadow-xs'
                  : 'text-[#5B6B7F] hover:text-[#0F172A]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setStatusFilter('ACTIVE');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-white text-[#08483A] shadow-xs'
                  : 'text-[#5B6B7F] hover:text-[#0F172A]'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => {
                setStatusFilter('INACTIVE');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                statusFilter === 'INACTIVE'
                  ? 'bg-white text-red-600 shadow-xs'
                  : 'text-[#5B6B7F] hover:text-[#0F172A]'
              }`}
            >
              Revoked
            </button>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#37C6A3] hover:bg-[#30b594] text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Classroom</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Classroom Table */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E7E9EE] bg-[#F8FAFC] text-[11px] font-bold text-[#5B6B7F] uppercase tracking-wider">
                <th className="py-3.5 px-4">Room & Name</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4">Capacity</th>
                <th className="py-3.5 px-4">Active Sessions</th>
                <th className="py-3.5 px-4">QR Plaque Status</th>
                <th className="py-3.5 px-4">Room Token</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E9EE] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#5B6B7F]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#37C6A3] mb-2" />
                    <span>Loading classrooms...</span>
                  </td>
                </tr>
              ) : classrooms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#5B6B7F]">
                    No classrooms found matching the criteria.
                  </td>
                </tr>
              ) : (
                classrooms.map((room) => (
                  <tr key={room.id} className="hover:bg-[#F8FAFC]/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#E6F7F3] text-[#08483A] font-bold flex items-center justify-center shrink-0">
                          {room.roomNumber}
                        </div>
                        <div>
                          <span className="font-bold text-[#0F172A] block">{room.name}</span>
                          {room.notes && (
                            <span className="text-[11px] text-[#5B6B7F] truncate max-w-[180px] block">
                              {room.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-[#5B6B7F]">
                      <div className="space-y-0.5">
                        {room.building && (
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-[#5B6B7F]" />
                            <span>{room.building}</span>
                          </div>
                        )}
                        {room.floor && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Layers className="w-3.5 h-3.5 text-[#5B6B7F]" />
                            <span>Floor: {room.floor}</span>
                          </div>
                        )}
                        {!room.building && !room.floor && (
                          <span className="italic text-[#94A3B8]">Main Campus</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {room.capacity ? (
                        <div className="flex items-center gap-1 text-[#0F172A] font-medium">
                          <Users className="w-3.5 h-3.5 text-[#5B6B7F]" />
                          <span>{room.capacity} students</span>
                        </div>
                      ) : (
                        <span className="text-[#94A3B8] italic">Unspecified</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium text-[11px]">
                        {room.assignedScheduleCount ?? 0} sessions
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {room.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E6F7F3] text-[#08483A] border border-[#37C6A3]/30">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#37C6A3]" />
                          <span>QR Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                          <Ban className="w-3.5 h-3.5 text-red-500" />
                          <span>QR Revoked</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200 text-slate-700">
                        {room.roomToken}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        {/* Preview Plaque */}
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(room)}
                          title="Preview & Print Plaque"
                          className="p-1.5 text-[#08483A] hover:bg-[#E6F7F3] rounded-lg transition"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>

                        {/* Regenerate Token */}
                        <button
                          type="button"
                          onClick={() => setConfirmRegenClassroom(room)}
                          title="Regenerate QR Token"
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>

                        {/* Revoke / Activate */}
                        {room.isActive ? (
                          <button
                            type="button"
                            onClick={() => setConfirmRevokeClassroom(room)}
                            title="Revoke QR Access"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleActivateClassroom(room)}
                            title="Reactivate Classroom"
                            className="p-1.5 text-[#37C6A3] hover:bg-[#E6F7F3] rounded-lg transition"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(room)}
                          title="Edit Classroom Details"
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E7E9EE] text-xs text-[#5B6B7F]">
            <div>
              Showing {classrooms.length} of {total} classrooms
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-[#E7E9EE] rounded-lg disabled:opacity-50 hover:bg-slate-50 transition"
              >
                Previous
              </button>
              <span className="px-2 font-bold text-[#0F172A]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 bg-white border border-[#E7E9EE] rounded-lg disabled:opacity-50 hover:bg-slate-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Classroom Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E6F7F3] text-[#08483A] flex items-center justify-center font-bold">
                  <Building className="w-5 h-5 text-[#08483A]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {editingClassroom ? 'Edit Classroom' : 'Add New Classroom'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Physical venue & permanent check-in plaque
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Room Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formRoomNumber}
                    onChange={(e) => setFormRoomNumber(e.target.value)}
                    placeholder="e.g. 101, A-02"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#37C6A3]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Capacity (Seats)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    placeholder="e.g. 30"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#37C6A3]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Classroom Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Main Hall A, Hifz Room 1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#37C6A3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Building
                  </label>
                  <input
                    type="text"
                    value={formBuilding}
                    onChange={(e) => setFormBuilding(e.target.value)}
                    placeholder="e.g. Block A"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#37C6A3]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Floor
                  </label>
                  <input
                    type="text"
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    placeholder="e.g. 1st Floor"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#37C6A3]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Equipped with projector and whiteboard"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#37C6A3]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#08483A] hover:bg-[#06382d] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingClassroom ? 'Save Changes' : 'Create Classroom'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plaque Preview & Print Modal */}
      {previewClassroom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#08483A]" />
                <h3 className="font-bold text-slate-900 text-sm">Venue QR Plaque Preview</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewClassroom(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 text-center space-y-4">
              <div
                ref={printAreaRef}
                className="border-2 border-[#08483A] rounded-2xl p-6 bg-white max-w-sm mx-auto shadow-sm"
              >
                <span className="inline-block bg-[#E6F7F3] text-[#08483A] font-bold text-[10px] uppercase tracking-wider px-3 py-1 rounded-full mb-3">
                  MadrasaNexa Classroom Venue Plaque
                </span>
                <h2 className="text-2xl font-extrabold text-[#08483A]">
                  Room {previewClassroom.roomNumber}
                </h2>
                <h3 className="text-sm font-semibold text-slate-700">{previewClassroom.name}</h3>

                <p className="text-xs text-slate-500 mt-1">
                  {previewClassroom.building && <span>Building: {previewClassroom.building} &bull; </span>}
                  {previewClassroom.floor && <span>Floor: {previewClassroom.floor}</span>}
                </p>

                <div className="my-4 flex justify-center">
                  {isLoadingQr ? (
                    <div className="w-48 h-48 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
                    </div>
                  ) : qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Classroom QR Plaque"
                      className="w-48 h-48 border border-slate-200 rounded-xl p-2 bg-white"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-red-50 text-red-600 text-xs">
                      Failed to render QR
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-3 text-xs font-mono text-slate-700 inline-block mb-3">
                  Plaque Code: <strong>{previewClassroom.roomToken}</strong>
                </div>

                <p className="text-[10px] text-slate-400 border-t border-dashed border-slate-200 pt-3 leading-relaxed">
                  {STATIC_VENUE_PLAQUE_NOTICE}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  disabled={!qrDataUrl}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>Download Image</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintPlaque}
                  disabled={!qrDataUrl}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#08483A] hover:bg-[#06382d] text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print A4 Plaque</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Confirmation Modal */}
      {confirmRegenClassroom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <RotateCw className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-sm">Regenerate QR Plaque Token?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Regenerating the token for <strong>Room {confirmRegenClassroom.roomNumber} ({confirmRegenClassroom.name})</strong> will immediately invalidate the current plaque QR code. Any physical prints in the classroom will no longer work for teacher check-in until replaced.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRegenClassroom(null)}
                disabled={isRegenerating}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRegenerateQr}
                disabled={isRegenerating}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Regenerate & Invalidate Old</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {confirmRevokeClassroom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <Ban className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-sm">Revoke QR & Deactivate Classroom?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Revoking QR access for <strong>Room {confirmRevokeClassroom.roomNumber}</strong> will soft-deactivate the classroom. Teachers attempting to scan this classroom plaque will receive an explicit notification that QR access has been revoked.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRevokeClassroom(null)}
                disabled={isRevoking}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeQr}
                disabled={isRevoking}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {isRevoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Revoke Access</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
