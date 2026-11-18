import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  getPublicAlumni,
  submitPublicAlumni,
  type AcademicStatus,
  type QualificationEntry,
} from '../../services/scholar-alumni.service';

export const PublicAlumniRegistrationPage: React.FC = () => {
  const { madrasaCode } = useParams<{ madrasaCode: string }>();
  const [madrasa, setMadrasa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Photo Framing State & Raw Image reference
  const [photoFraming, setPhotoFraming] = useState<'top' | 'center' | 'contain'>('top');
  const rawImageRef = React.useRef<HTMLImageElement | null>(null);

  const [qualifications, setQualifications] = useState<QualificationEntry[]>([
    { degree: '', university: '', year: '' },
  ]);

  const handleQualificationChange = (index: number, field: 'degree' | 'university' | 'year', value: string) => {
    setQualifications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddQualification = () => {
    setQualifications((prev) => [...prev, { degree: '', university: '', year: '' }]);
  };

  const handleRemoveQualification = (index: number) => {
    setQualifications((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const [formData, setFormData] = useState({
    fullName: '',
    photoUrl: '',
    batchYear: '',
    classOrDivision: '',
    academicStatus: 'UNDERGRADUATE' as AcademicStatus,
    customStatusLabel: '',
    qualification: '',
    university: '',
    facultyOrDepartment: '',
    currentRole: '',
    cityCountry: '',
    bio: '',
    email: '',
    phone: '',
    linkedinUrl: '',
    showContactPublicly: false,
    availableForMentorship: true,
  });

  useEffect(() => {
    if (!madrasaCode) return;
    setLoading(true);
    getPublicAlumni(madrasaCode)
      .then((res) => {
        setMadrasa(res.madrasa);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Madrasa not found.');
      })
      .finally(() => setLoading(false));
  }, [madrasaCode]);

  const processAndSetFramedPhoto = (img: HTMLImageElement, framing: 'top' | 'center' | 'contain') => {
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = img.width;
    const h = img.height;

    if (framing === 'contain') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      const scale = Math.min(size / w, size / h);
      const dw = Math.round(w * scale);
      const dh = Math.round(h * scale);
      const dx = Math.round((size - dw) / 2);
      const dy = Math.round((size - dh) / 2);
      ctx.drawImage(img, dx, dy, dw, dh);
    } else if (framing === 'center') {
      const minDim = Math.min(w, h);
      const sx = Math.round((w - minDim) / 2);
      const sy = Math.round((h - minDim) / 2);
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
    } else {
      // 'top' - Top / Face Focus
      if (h >= w) {
        // Portrait: anchor to top square where head/face is
        ctx.drawImage(img, 0, 0, w, w, 0, 0, size, size);
      } else {
        // Landscape: center horizontally, anchor to top
        const sx = Math.round((w - h) / 2);
        ctx.drawImage(img, sx, 0, h, h, 0, 0, size, size);
      }
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setFormData((prev) => ({ ...prev, photoUrl: dataUrl }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        rawImageRef.current = img;
        processAndSetFramedPhoto(img, photoFraming);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFramingChange = (newFraming: 'top' | 'center' | 'contain') => {
    setPhotoFraming(newFraming);
    if (rawImageRef.current) {
      processAndSetFramedPhoto(rawImageRef.current, newFraming);
    } else if (formData.photoUrl) {
      const img = new Image();
      img.onload = () => {
        rawImageRef.current = img;
        processAndSetFramedPhoto(img, newFraming);
      };
      img.src = formData.photoUrl;
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!madrasaCode) return;

    const validQuals = qualifications.filter((q) => q.degree.trim() || q.university.trim());
    if (
      !formData.fullName.trim() ||
      !formData.batchYear.trim() ||
      validQuals.length === 0 ||
      !validQuals[0].degree.trim() ||
      !validQuals[0].university.trim()
    ) {
      setSubmitError('Please complete all required fields (Name, Batch Year, and at least one Degree / University pair).');
      return;
    }

    const payloadToSubmit = {
      ...formData,
      customStatusLabel: formData.academicStatus === 'OTHER' ? (formData.customStatusLabel?.trim() || null) : null,
      qualification: validQuals[0].degree.trim(),
      university: validQuals[0].university.trim(),
      qualificationsList: validQuals,
    };

    try {
      setSubmitting(true);
      setSubmitError(null);
      await submitPublicAlumni(madrasaCode, payloadToSubmit);
      setSubmitSuccess(true);
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || err.message || 'Failed to submit profile.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6F1] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#85845C] mb-3" />
        <p className="text-xs text-[#666666] font-medium">Loading institution details...</p>
      </div>
    );
  }

  if (error || !madrasa) {
    return (
      <div className="min-h-screen bg-[#F7F6F1] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#E5E5DF] p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-serif font-bold text-[#252525]">Institution Not Found</h2>
          <p className="text-xs text-[#666666]">{error || 'Invalid madrasa code or URL.'}</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 bg-[#252525] text-white rounded-xl text-xs font-semibold"
          >
            Return to MadrasaNexa Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F1] text-[#252525] py-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          to={`/madrasa/${madrasa.slug || madrasaCode}`}
          className="inline-flex items-center gap-1.5 text-xs text-[#666666] hover:text-[#252525] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {madrasa.name} Portal</span>
        </Link>

        {/* Header Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E5E5DF] shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            {madrasa.logoUrl ? (
              <img
                src={madrasa.logoUrl}
                alt={madrasa.name}
                className="w-12 h-12 object-contain rounded-xl border border-[#E5E5DF] bg-white p-1"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#85845C] text-white font-serif font-bold flex items-center justify-center text-lg">
                <GraduationCap className="w-6 h-6" />
              </div>
            )}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#85845C] block">
                Official Scholar Directory
              </span>
              <h1 className="font-serif font-bold text-xl sm:text-2xl text-[#252525]">
                {madrasa.name}
              </h1>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-[#666666] leading-relaxed">
            Welcome to the Madrasa Undergraduate & Alumni Hub registration. Please share your higher education
            journey, university degree, and accomplishments to inspire junior students and stay connected with your alma mater.
          </p>
        </div>

        {/* Main Submission Form */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E5E5DF] shadow-sm">
          {submitSuccess ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="font-serif font-bold text-xl text-[#252525]">
                Profile Submitted Successfully!
              </h2>
              <p className="text-xs sm:text-sm text-[#666666] max-w-md mx-auto leading-relaxed">
                JazakAllah Khair! Your academic submission has been safely recorded and will be verified by the
                madrasa administration before publishing to the alumni directory.
              </p>
              <div className="pt-4 flex justify-center gap-3">
                <Link
                  to={`/madrasa/${madrasa.slug || madrasaCode}`}
                  className="px-5 py-2.5 bg-[#85845C] text-white font-semibold text-xs rounded-xl hover:opacity-95 transition"
                >
                  Visit Madrasa Website
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-5 text-xs">
              {submitError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                  {submitError}
                </div>
              )}

              {/* Photo Upload & Live Framing Preview */}
              <div className="p-4 sm:p-5 bg-[#F5F5F1] rounded-2xl border border-[#E5E5DF] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block font-semibold text-[#252525] text-xs">
                      Profile Photograph (Optional)
                    </label>
                    <p className="text-[11px] text-[#666666]">
                      High-clarity avatar (crisp 512px). Portrait photos are automatically anchored to the face.
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#85845C] file:text-white hover:file:opacity-90 cursor-pointer"
                  />
                </div>

                {formData.photoUrl ? (
                  <div className="pt-2 border-t border-[#E5E5DF] space-y-3">
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Live Circular Card Preview */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-emerald-300 ring-4 ring-emerald-50 shadow-sm shrink-0 bg-white flex items-center justify-center">
                          <img
                            src={formData.photoUrl}
                            alt="Circular Avatar Preview"
                            className="w-full h-full object-cover object-top"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block mb-0.5">
                            Circular Card Preview
                          </span>
                          <p className="text-[10px] text-[#666666]">Live website appearance</p>
                        </div>
                      </div>

                      {/* Square Full Preview */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#E5E5DF] shadow-2xs shrink-0 bg-white flex items-center justify-center">
                          <img
                            src={formData.photoUrl}
                            alt="Square Preview"
                            className="w-full h-full object-cover object-top"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-[#252525] bg-white border border-[#E5E5DF] px-2 py-0.5 rounded-full inline-block mb-0.5">
                            Square Preview
                          </span>
                          <p className="text-[10px] text-[#666666]">512x512 canvas</p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Framing Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                      <span className="text-[11px] font-semibold text-[#252525] shrink-0">
                        Framing Focus:
                      </span>
                      <div className="inline-flex rounded-xl p-0.5 bg-[#E5E5DF]/70 border border-[#E5E5DF] text-xs">
                        <button
                          type="button"
                          onClick={() => handleFramingChange('top')}
                          className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                            photoFraming === 'top'
                              ? 'bg-[#85845C] text-white shadow-xs'
                              : 'text-[#252525] hover:text-black'
                          }`}
                        >
                          Top / Face Focus
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFramingChange('center')}
                          className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                            photoFraming === 'center'
                              ? 'bg-[#85845C] text-white shadow-xs'
                              : 'text-[#252525] hover:text-black'
                          }`}
                        >
                          Center
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFramingChange('contain')}
                          className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                            photoFraming === 'contain'
                              ? 'bg-[#85845C] text-white shadow-xs'
                              : 'text-[#252525] hover:text-black'
                          }`}
                        >
                          Fit Full Image
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pt-1 text-[#666666]">
                    <div className="w-12 h-12 rounded-full bg-white border border-[#E5E5DF] text-[#85845C] flex items-center justify-center shrink-0">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <span className="text-xs">No photograph selected yet.</span>
                  </div>
                )}
              </div>

              {/* Name & Batch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#252525] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Mohamed Safras"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#252525] mb-1">Batch Year *</label>
                  <input
                    type="text"
                    required
                    value={formData.batchYear}
                    onChange={(e) => setFormData({ ...formData, batchYear: e.target.value })}
                    placeholder="e.g. 2021"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                  />
                </div>
              </div>

              {/* Class & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#252525] mb-1">Class / Division</label>
                  <input
                    type="text"
                    value={formData.classOrDivision}
                    onChange={(e) => setFormData({ ...formData, classOrDivision: e.target.value })}
                    placeholder="e.g. Alim Final Year / Hifz"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#252525] mb-1">Academic Status</label>
                  <select
                    value={formData.academicStatus}
                    onChange={(e) => setFormData({ ...formData, academicStatus: e.target.value as AcademicStatus })}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden"
                  >
                    <option value="UNDERGRADUATE">Undergraduate</option>
                    <option value="GRADUATE">Graduate</option>
                    <option value="POSTGRADUATE">Postgraduate</option>
                    <option value="WORKING_SCHOLAR">Working Scholar</option>
                    <option value="HAFIL">Hafil</option>
                    <option value="AL_AALIM">Al Aalim</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                {formData.academicStatus === 'OTHER' && (
                  <div className="sm:col-span-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <label className="block font-semibold text-[#252525] mb-1 text-xs">
                      Specify Position / Status *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customStatusLabel || ''}
                      onChange={(e) => setFormData({ ...formData, customStatusLabel: e.target.value })}
                      placeholder="e.g., Businessman, Imam, Entrepreneur, Lecturer..."
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                    />
                  </div>
                )}
              </div>

              {/* Dynamic Qualifications List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-[#252525] text-xs">
                    Degrees & Universities *
                  </label>
                  <span className="text-[10px] text-[#666666]">Add undergraduate, graduate or alim degrees</span>
                </div>
                <div className="space-y-2.5">
                  {qualifications.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 items-end"
                    >
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#666666] mb-1">
                          Degree / Qualification *
                        </label>
                        <input
                          type="text"
                          required={index === 0}
                          value={item.degree}
                          onChange={(e) => handleQualificationChange(index, 'degree', e.target.value)}
                          placeholder="e.g. Alim / B.A. (Hons)"
                          className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#666666] mb-1">
                          University / Institution *
                        </label>
                        <input
                          type="text"
                          required={index === 0}
                          value={item.university}
                          onChange={(e) => handleQualificationChange(index, 'university', e.target.value)}
                          placeholder="e.g. South Eastern University"
                          className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-1.5">
                        <div className="flex-1 min-w-0">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#666666] mb-1">
                            Year
                          </label>
                          <input
                            type="text"
                            value={item.year || ''}
                            onChange={(e) => handleQualificationChange(index, 'year', e.target.value)}
                            placeholder="e.g. 2024"
                            className="w-full px-2.5 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden"
                          />
                        </div>
                        {qualifications.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQualification(index)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer self-end mb-0.5 shrink-0"
                            title="Remove degree"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddQualification}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-xl transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Another Degree / University</span>
                </button>
              </div>

              {/* Current Role & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#252525] mb-1">Current Role / Job Title</label>
                  <input
                    type="text"
                    value={formData.currentRole}
                    onChange={(e) => setFormData({ ...formData, currentRole: e.target.value })}
                    placeholder="e.g. Final Year Undergraduate / Lecturer"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#252525] mb-1">City & Country</label>
                  <input
                    type="text"
                    value={formData.cityCountry}
                    onChange={(e) => setFormData({ ...formData, cityCountry: e.target.value })}
                    placeholder="e.g. Oluvil, Sri Lanka"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block font-semibold text-[#252525] mb-1">
                  Academic Journey & Personal Bio
                </label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Share a short summary of your studies, research interests, or aspirations..."
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden"
                />
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#252525] mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="scholar@example.com"
                    className="w-full px-3.5 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#252525] mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+94 77 ..."
                    className="w-full px-3.5 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#252525] mb-1">LinkedIn Profile</label>
                  <input
                    type="url"
                    value={formData.linkedinUrl}
                    onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full px-3.5 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2 pt-3 border-t border-[#E5E5DF]">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.availableForMentorship}
                    onChange={(e) => setFormData({ ...formData, availableForMentorship: e.target.checked })}
                    className="rounded text-[#85845C]"
                  />
                  <span className="text-[#252525] font-medium">
                    I am willing to mentor younger madrasa students entering university
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showContactPublicly}
                    onChange={(e) => setFormData({ ...formData, showContactPublicly: e.target.checked })}
                    className="rounded text-[#85845C]"
                  />
                  <span className="text-[#666666]">
                    Allow my contact email/phone to be shown publicly on the directory
                  </span>
                </label>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-[#E5E5DF]">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#85845C] hover:bg-[#706f4e] text-white font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Profile...</span>
                    </>
                  ) : (
                    <span>Submit Profile for Verification</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicAlumniRegistrationPage;
