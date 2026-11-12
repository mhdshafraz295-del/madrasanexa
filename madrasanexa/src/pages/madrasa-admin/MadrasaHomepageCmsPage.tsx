import React, { useEffect, useState } from 'react';
import {
  apiGetMadrasaHomepageProfile,
  apiUpdateMadrasaHomepageProfile,
  apiGenerateMadrasaHomepageSummary,
  apiPublishMadrasaHomepageProfile,
  apiUnpublishMadrasaHomepageProfile,
  apiBroadcastMadrasaNotice,
  apiUploadMadrasaHeroImage,
  apiRemoveMadrasaHeroImage,
  apiUploadMadrasaLogo,
  apiRemoveMadrasaLogo,
  apiUploadMadrasaPoster,
  apiRemoveMadrasaPoster,
  apiUploadMadrasaEventImages,
} from '../../services/api';
import type {
  MadrasaProfileData,
  MadrasaProfileEvent,
  EventAlbumImage,
  MadrasaProfileNotice,
  CurriculumPayload,
  StaffSectionConfig,
} from '../../services/api';
import { CurriculumManagerTab } from '../../components/portal-cms/CurriculumManagerTab';
import { StaffManagerTab } from '../../components/portal-cms/StaffManagerTab';
import {
  Globe,
  Save,
  Sparkles,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Calendar,
  BellRing,
  Phone,
  Mail,
  MapPin,
  Building2,
  Upload,
  Image as ImageIcon,
  X,
  Loader2,
  Palette,
  Pencil,
  ArrowLeft,
  ArrowRight,
  Star,
  Images,
  RefreshCw,
  Users,
} from 'lucide-react';
import { ThemeCustomizerTab } from '../../components/portal-cms/ThemeCustomizerTab';

export const MadrasaHomepageCmsPage: React.FC = () => {
  const [profile, setProfile] = useState<MadrasaProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'hero' | 'about' | 'syllabus' | 'staff' | 'events' | 'notices' | 'theme'>('hero');

  // Form Fields
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [mission, setMission] = useState('');
  const [vision, setVision] = useState('');
  const [syllabusInfo, setSyllabusInfo] = useState('');
  const [rulesAndRegulations, setRulesAndRegulations] = useState('');
  const [curriculum, setCurriculum] = useState<CurriculumPayload | null>(null);
  const [staffConfig, setStaffConfig] = useState<StaffSectionConfig | null>(null);
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [address, setAddress] = useState('');
  const [events, setEvents] = useState<MadrasaProfileEvent[]>([]);
  const [notices, setNotices] = useState<MadrasaProfileNotice[]>([]);

  // Event Modal & Album State
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventLoc, setNewEventLoc] = useState('');
  const [newEventPublished, setNewEventPublished] = useState<boolean>(true);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<MadrasaProfileEvent | null>(null);
  const [albumImages, setAlbumImages] = useState<EventAlbumImage[]>([]);
  const [uploadingAlbum, setUploadingAlbum] = useState<boolean>(false);
  const [albumFeedback, setAlbumFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Notice Modal & Poster State
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');
  const [newNoticePriority, setNewNoticePriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [noticePosterFileId, setNoticePosterFileId] = useState<string | null>(null);
  const [noticePosterUrl, setNoticePosterUrl] = useState<string | null>(null);
  const [uploadingNoticePoster, setUploadingNoticePoster] = useState<boolean>(false);
  const [noticePosterFeedback, setNoticePosterFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDeleteNoticePosterModal, setShowDeleteNoticePosterModal] = useState<boolean>(false);

  // Broadcast Modal State
  const [confirmBroadcastNotice, setConfirmBroadcastNotice] = useState<MadrasaProfileNotice | null>(null);

  // Logo & Hero Image State
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);
  const [logoFeedback, setLogoFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDeleteLogoModal, setShowDeleteLogoModal] = useState<boolean>(false);

  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [uploadingHeroImage, setUploadingHeroImage] = useState<boolean>(false);
  const [heroImageFeedback, setHeroImageFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDeleteHeroModal, setShowDeleteHeroModal] = useState<boolean>(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await apiGetMadrasaHomepageProfile();
      setProfile(data);
      setHeroTitle(data.heroTitle || '');
      setHeroSubtitle(data.heroSubtitle || '');
      setLogoUrl(data.madrasa?.logoUrl || null);
      setHeroImageUrl(data.heroImageUrl || null);
      setIntroduction(data.introduction || '');
      setMission(data.mission || '');
      setVision(data.vision || '');
      setSyllabusInfo(data.syllabusInfo || '');
      setRulesAndRegulations(data.rulesAndRegulations || '');
      setCurriculum(data.curriculumJson || null);
      setStaffConfig(data.staffJson || null);
      setContactPhone(data.contactPhone || '');
      setContactEmail(data.contactEmail || '');
      setAddress(data.address || '');
      setEvents(data.eventsJson || []);
      setNotices(data.noticesJson || []);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load madrasa portal profile.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setLogoFeedback({ type: 'error', message: 'Logo file size must be less than 5MB.' });
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setLogoFeedback({ type: 'error', message: 'Please upload a valid JPG, PNG, or WebP image.' });
      return;
    }
    setUploadingLogo(true);
    setLogoFeedback(null);
    try {
      const res = await apiUploadMadrasaLogo(file);
      setLogoUrl(res.logoUrl);
      setLogoFeedback({ type: 'success', message: 'Institution logo updated successfully.' });
      if (profile) {
        setProfile({
          ...profile,
          madrasa: {
            ...profile.madrasa,
            logoUrl: res.logoUrl,
            logoFileId: res.fileId,
          },
        });
      }
    } catch (err: any) {
      setLogoFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to upload institution logo.',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    setLogoFeedback(null);
    setShowDeleteLogoModal(false);
    try {
      await apiRemoveMadrasaLogo();
      setLogoUrl(null);
      setLogoFeedback({ type: 'success', message: 'Institution logo removed successfully.' });
      if (profile) {
        setProfile({
          ...profile,
          madrasa: {
            ...profile.madrasa,
            logoUrl: null,
            logoFileId: null,
          },
        });
      }
    } catch (err: any) {
      setLogoFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to remove institution logo.',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleHeroImageFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setHeroImageFeedback({ type: 'error', message: 'Hero background image must be less than 5MB.' });
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setHeroImageFeedback({ type: 'error', message: 'Please upload a valid JPG, PNG, or WebP image.' });
      return;
    }
    setUploadingHeroImage(true);
    setHeroImageFeedback(null);
    try {
      const res = await apiUploadMadrasaHeroImage(file);
      setHeroImageUrl(res.heroImageUrl);
      setHeroImageFeedback({ type: 'success', message: 'Hero background image updated successfully.' });
      if (profile) {
        setProfile({
          ...profile,
          heroImageUrl: res.heroImageUrl,
          heroImageFileId: res.heroImageFileId,
        });
      }
    } catch (err: any) {
      setHeroImageFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to upload hero background image.',
      });
    } finally {
      setUploadingHeroImage(false);
    }
  };

  const handleRemoveHeroImage = async () => {
    setUploadingHeroImage(true);
    setHeroImageFeedback(null);
    setShowDeleteHeroModal(false);
    try {
      await apiRemoveMadrasaHeroImage();
      setHeroImageUrl(null);
      setHeroImageFeedback({ type: 'success', message: 'Hero background image removed successfully.' });
      if (profile) {
        setProfile({
          ...profile,
          heroImageUrl: null,
          heroImageFileId: null,
        });
      }
    } catch (err: any) {
      setHeroImageFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to remove hero background image.',
      });
    } finally {
      setUploadingHeroImage(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveDraft = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await apiUpdateMadrasaHomepageProfile({
        heroTitle,
        heroSubtitle,
        introduction,
        mission,
        vision,
        syllabusInfo,
        rulesAndRegulations,
        curriculumJson: curriculum,
        staffJson: staffConfig,
        contactPhone,
        contactEmail,
        address,
        eventsJson: events,
        noticesJson: notices,
      });
      setProfile(updated);
      setStaffConfig(updated.staffJson || staffConfig);
      setFeedback({ type: 'success', message: 'Madrasa portal draft saved successfully.' });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save changes.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCurriculum = async (updatedCurriculum: CurriculumPayload) => {
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await apiUpdateMadrasaHomepageProfile({
        curriculumJson: updatedCurriculum,
        syllabusInfo,
        rulesAndRegulations,
      });
      setProfile(updated);
      setCurriculum(updated.curriculumJson || updatedCurriculum);
      setFeedback({ type: 'success', message: 'Curriculum structure saved successfully.' });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save curriculum changes.'
      });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSummary = async () => {
    setGenerating(true);
    setFeedback(null);
    try {
      // First save current inputs so generator uses latest data
      await apiUpdateMadrasaHomepageProfile({
        heroTitle,
        heroSubtitle,
        introduction,
        mission,
        vision,
        syllabusInfo,
        rulesAndRegulations,
        curriculumJson: curriculum,
        contactPhone,
        contactEmail,
        address,
        eventsJson: events,
        noticesJson: notices,
      });

      const updated = await apiGenerateMadrasaHomepageSummary();
      setProfile(updated);
      setFeedback({
        type: 'success',
        message: 'Deterministic institutional summary generated and saved successfully.'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to generate institutional summary.'
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!profile) return;
    setPublishing(true);
    setFeedback(null);
    try {
      let updated: MadrasaProfileData;
      if (profile.isPublished) {
        updated = await apiUnpublishMadrasaHomepageProfile();
        setFeedback({
          type: 'success',
          message: 'Madrasa portal has been unpublished and reverted to draft mode.'
        });
      } else {
        // Save first before publishing
        await apiUpdateMadrasaHomepageProfile({
          heroTitle,
          heroSubtitle,
          introduction,
          mission,
          vision,
          syllabusInfo,
          rulesAndRegulations,
          contactPhone,
          contactEmail,
          address,
          eventsJson: events,
          noticesJson: notices,
        });
        updated = await apiPublishMadrasaHomepageProfile();
        setFeedback({
          type: 'success',
          message: 'Madrasa portal is now published and live to the public!'
        });
      }
      setProfile(updated);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Publication action failed.'
      });
    } finally {
      setPublishing(false);
    }
  };

  // Open Event Modal for Add
  const handleOpenAddEvent = () => {
    setEditingEventId(null);
    setNewEventTitle('');
    setNewEventDate(new Date().toISOString().slice(0, 10));
    setNewEventDesc('');
    setNewEventLoc('');
    setNewEventPublished(true);
    setAlbumImages([]);
    setAlbumFeedback(null);
    setShowEventModal(true);
  };

  // Open Event Modal for Edit
  const handleOpenEditEvent = (ev: MadrasaProfileEvent) => {
    setEditingEventId(ev.id);
    setNewEventTitle(ev.title);
    setNewEventDate(ev.date);
    setNewEventDesc(ev.description || '');
    setNewEventLoc(ev.location || '');
    setNewEventPublished(ev.isPublished !== false);
    setAlbumFeedback(null);

    // Normalize images: either multi-image or legacy single poster
    let imgs: EventAlbumImage[] = [];
    if (Array.isArray(ev.images) && ev.images.length > 0) {
      imgs = ev.images.map((img, idx) => ({
        id: img.id || `img-${idx}`,
        fileId: img.fileId || null,
        url: img.url || null,
        caption: img.caption || null,
        isCover: !!img.isCover,
        sortOrder: typeof img.sortOrder === 'number' ? img.sortOrder : idx,
      }));
    } else if (ev.coverUrl || ev.posterUrl || ev.coverFileId || ev.posterFileId) {
      imgs = [
        {
          id: `img-legacy-${ev.coverFileId || ev.posterFileId || 'cover'}`,
          fileId: ev.coverFileId || ev.posterFileId || null,
          url: ev.coverUrl || ev.posterUrl || null,
          caption: null,
          isCover: true,
          sortOrder: 0,
        },
      ];
    }

    if (imgs.length > 0 && !imgs.some((i) => i.isCover)) {
      imgs[0].isCover = true;
    }

    setAlbumImages(imgs);
    setShowEventModal(true);
  };

  // Upload multiple or single files to event album (Max 5 images per album)
  const handleUploadAlbumFiles = async (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const availableSlots = 5 - albumImages.length;
    if (availableSlots <= 0) {
      setAlbumFeedback({
        type: 'error',
        message: 'This album has reached the maximum limit of 5 images. Remove an image to upload another.',
      });
      return;
    }

    if (files.length > availableSlots) {
      setAlbumFeedback({
        type: 'error',
        message: `You can only add up to ${availableSlots} more image${availableSlots > 1 ? 's' : ''}. Maximum 5 images per album.`,
      });
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    for (const f of files) {
      if (!allowed.includes(f.type)) {
        setAlbumFeedback({
          type: 'error',
          message: `File "${f.name}" has an unsupported format. Supported formats are JPG, PNG, and WebP.`,
        });
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setAlbumFeedback({
          type: 'error',
          message: `File "${f.name}" exceeds the 5 MB limit. Each image must be under 5 MB.`,
        });
        return;
      }
    }

    setUploadingAlbum(true);
    setAlbumFeedback(null);
    try {
      const uploadResults = await apiUploadMadrasaEventImages(files);
      const newImages: EventAlbumImage[] = uploadResults.map((res, idx) => ({
        id: `img-${Date.now()}-${idx}`,
        fileId: res.fileId,
        url: res.posterUrl,
        caption: null,
        isCover: albumImages.length === 0 && idx === 0,
        sortOrder: albumImages.length + idx,
      }));

      const merged = [...albumImages, ...newImages];
      if (merged.length > 0 && !merged.some((i) => i.isCover)) {
        merged[0].isCover = true;
      }
      setAlbumImages(merged);
      setAlbumFeedback({
        type: 'success',
        message: `${newImages.length} image${newImages.length > 1 ? 's' : ''} uploaded successfully.`,
      });
    } catch (err: any) {
      setAlbumFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to upload image(s). Please try again.',
      });
    } finally {
      setUploadingAlbum(false);
    }
  };

  // Replace single image in album
  const handleReplaceAlbumImage = async (index: number, file: File) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setAlbumFeedback({
        type: 'error',
        message: 'Supported formats are JPG, PNG, and WebP.',
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAlbumFeedback({
        type: 'error',
        message: 'Replacement image must be smaller than 5 MB.',
      });
      return;
    }

    setUploadingAlbum(true);
    setAlbumFeedback(null);
    try {
      const res = await apiUploadMadrasaPoster(file);
      setAlbumImages((prev) =>
        prev.map((img, idx) =>
          idx === index
            ? {
                ...img,
                fileId: res.fileId,
                url: res.posterUrl,
              }
            : img
        )
      );
      setAlbumFeedback({ type: 'success', message: 'Image replaced successfully.' });
    } catch (err: any) {
      setAlbumFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to replace image.',
      });
    } finally {
      setUploadingAlbum(false);
    }
  };

  // Select Cover Image
  const handleSetCover = (index: number) => {
    setAlbumImages((prev) =>
      prev.map((img, idx) => ({
        ...img,
        isCover: idx === index,
      }))
    );
  };

  // Remove individual image from album
  const handleRemoveAlbumImage = (index: number) => {
    const updated = albumImages.filter((_, idx) => idx !== index);
    if (updated.length > 0 && !updated.some((i) => i.isCover)) {
      updated[0].isCover = true;
    }
    const reordered = updated.map((img, idx) => ({
      ...img,
      sortOrder: idx,
    }));
    setAlbumImages(reordered);
    setAlbumFeedback({ type: 'success', message: 'Image removed from album.' });
  };

  // Reorder album images (move left / move right)
  const handleMoveImage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= albumImages.length) return;

    const copy = [...albumImages];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const reordered = copy.map((img, idx) => ({
      ...img,
      sortOrder: idx,
    }));
    setAlbumImages(reordered);
  };

  // Save Event (Add or Edit)
  const handleSaveEvent = () => {
    if (!newEventTitle.trim() || !newEventDate.trim()) {
      alert('Event title and date are required.');
      return;
    }

    const coverImg = albumImages.find((i) => i.isCover) || albumImages[0] || null;
    const coverFileId = coverImg?.fileId || null;
    const coverUrl = coverImg?.url || null;

    const eventPayload: MadrasaProfileEvent = {
      id: editingEventId || `ev-${Date.now()}`,
      title: newEventTitle.trim(),
      date: newEventDate.trim(),
      description: newEventDesc.trim() || undefined,
      location: newEventLoc.trim() || undefined,
      isPublished: newEventPublished,
      // Backward compatibility aliases for single-poster consumers
      posterFileId: coverFileId,
      posterUrl: coverUrl,
      // Multi-image album fields
      coverFileId,
      coverUrl,
      images: albumImages,
      photoCount: albumImages.length,
    };

    if (editingEventId) {
      setEvents(events.map((e) => (e.id === editingEventId ? eventPayload : e)));
    } else {
      setEvents([...events, eventPayload]);
    }

    setShowEventModal(false);
    setEditingEventId(null);
  };


  // Open Notice Modal for Add
  const handleOpenAddNotice = () => {
    setEditingNoticeId(null);
    setNewNoticeTitle('');
    setNewNoticeContent('');
    setNewNoticePriority('NORMAL');
    setNoticePosterFileId(null);
    setNoticePosterUrl(null);
    setNoticePosterFeedback(null);
    setShowNoticeModal(true);
  };

  // Open Notice Modal for Edit
  const handleOpenEditNotice = (nt: MadrasaProfileNotice) => {
    setEditingNoticeId(nt.id);
    setNewNoticeTitle(nt.title);
    setNewNoticeContent(nt.content);
    setNewNoticePriority(nt.priority);
    setNoticePosterFileId(nt.posterFileId || null);
    setNoticePosterUrl(nt.posterUrl || null);
    setNoticePosterFeedback(null);
    setShowNoticeModal(true);
  };

  // Upload/Replace Poster for Notice
  const handleNoticePosterFile = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setNoticePosterFeedback({ type: 'error', message: 'Poster image must be smaller than 5 MB.' });
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setNoticePosterFeedback({ type: 'error', message: 'Supported formats are JPG, PNG, and WebP.' });
      return;
    }

    setUploadingNoticePoster(true);
    setNoticePosterFeedback(null);
    try {
      const res = await apiUploadMadrasaPoster(file);
      setNoticePosterFileId(res.fileId);
      setNoticePosterUrl(res.posterUrl);
      setNoticePosterFeedback({ type: 'success', message: 'Poster uploaded successfully.' });
    } catch (err: any) {
      setNoticePosterFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to upload notice poster.',
      });
    } finally {
      setUploadingNoticePoster(false);
    }
  };

  // Delete Poster for Notice
  const handleConfirmDeleteNoticePoster = async () => {
    setShowDeleteNoticePosterModal(false);
    if (!noticePosterFileId) {
      setNoticePosterUrl(null);
      return;
    }

    setUploadingNoticePoster(true);
    setNoticePosterFeedback(null);
    try {
      await apiRemoveMadrasaPoster(noticePosterFileId);
      setNoticePosterFileId(null);
      setNoticePosterUrl(null);
      setNoticePosterFeedback({ type: 'success', message: 'Poster removed.' });
    } catch (err: any) {
      setNoticePosterFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to remove poster from storage.',
      });
      setNoticePosterFileId(null);
      setNoticePosterUrl(null);
    } finally {
      setUploadingNoticePoster(false);
    }
  };

  // Save Notice (Add or Edit)
  const handleSaveNotice = () => {
    if (!newNoticeTitle.trim() || !newNoticeContent.trim()) {
      alert('Notice title and content are required.');
      return;
    }

    if (editingNoticeId) {
      setNotices(
        notices.map((n) =>
          n.id === editingNoticeId
            ? {
                ...n,
                title: newNoticeTitle.trim(),
                content: newNoticeContent.trim(),
                priority: newNoticePriority,
                posterFileId: noticePosterFileId || null,
                posterUrl: noticePosterUrl || null,
              }
            : n
        )
      );
    } else {
      const newNotice: MadrasaProfileNotice = {
        id: `nt-${Date.now()}`,
        title: newNoticeTitle.trim(),
        content: newNoticeContent.trim(),
        postedAt: new Date().toISOString().split('T')[0],
        priority: newNoticePriority,
        isPublished: true,
        posterFileId: noticePosterFileId || null,
        posterUrl: noticePosterUrl || null,
      };
      setNotices([newNotice, ...notices]);
    }

    setShowNoticeModal(false);
    setEditingNoticeId(null);
  };

  const handleRemoveNotice = (id: string) => {
    setNotices(notices.filter((n) => n.id !== id));
  };

  const handleBroadcastNotice = async () => {
    if (!confirmBroadcastNotice) return;
    const noticeId = confirmBroadcastNotice.id;
    setBroadcastingId(noticeId);
    setConfirmBroadcastNotice(null);
    setFeedback(null);
    try {
      // First save notices to DB so backend finds it
      await apiUpdateMadrasaHomepageProfile({ noticesJson: notices });
      const result = await apiBroadcastMadrasaNotice(noticeId);
      setFeedback({
        type: 'success',
        message: `Notice "${result.noticeTitle}" broadcast queued for ${result.recipientsQueued} guardian contact channels (${result.totalEligibleStudents} eligible students).`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Notice broadcast failed.'
      });
    } finally {
      setBroadcastingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">Loading portal configuration...</p>
      </div>
    );
  }

  const publicUrl = profile?.madrasa?.slug ? `/madrasa/${profile.madrasa.slug}` : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 font-sans">
      {/* Top Banner / Status Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <Globe className="w-6 h-6 shrink-0 text-emerald-700" />
              <span>Public Madrasa Homepage & Portal</span>
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                profile?.isPublished
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {profile?.isPublished ? 'Live & Published' : 'Draft (Unpublished)'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure your institutional public website at{' '}
            <span className="font-mono text-emerald-800 font-semibold break-all">{publicUrl}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview Public Portal</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveDraft}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            type="button"
            disabled={publishing}
            onClick={handleTogglePublish}
            className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 ${
              profile?.isPublished
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {publishing
                ? 'Processing...'
                : profile?.isPublished
                ? 'Unpublish (Draft Mode)'
                : 'Publish to Public'}
            </span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start space-x-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex overflow-x-auto space-x-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('hero')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors shrink-0 ${
            activeTab === 'hero'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Hero & Contact Info
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors shrink-0 ${
            activeTab === 'about'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          About & Mission / Vision
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('syllabus')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors shrink-0 ${
            activeTab === 'syllabus'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Syllabus & Rules
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors shrink-0 flex items-center space-x-1.5 ${
            activeTab === 'staff'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff & Faculty</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors shrink-0 flex items-center space-x-1.5 ${
            activeTab === 'events'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Events</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-800">
            {events.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notices')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors shrink-0 flex items-center space-x-1.5 ${
            activeTab === 'notices'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Notices & Broadcast</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-800">
            {notices.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('theme')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors shrink-0 flex items-center space-x-1.5 ${
            activeTab === 'theme'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Theme & Appearance</span>
        </button>
      </div>

      {/* Tab 1: Hero & Contact Info */}
      {activeTab === 'hero' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Hero Section & Branding</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize your institution branding, homepage banner image, and header greeting.
            </p>
          </div>

          {/* Section A: Institution Logo */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <span>Institution Logo</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prominently featured in your public portal navbar, admissions desks, and official records.
                </p>
              </div>
              <div className="text-[11px] font-medium text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 w-fit">
                Recommended: Square (PNG, JPG, WebP), max 5MB
              </div>
            </div>

            {logoFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between ${
                  logoFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {logoFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{logoFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLogoFeedback(null)}
                  className="text-slate-400 hover:text-slate-600 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
              {/* Logo Preview */}
              <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Institution Logo"
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-emerald-700 flex items-center justify-center text-white font-bold text-xl shadow-sm">
                    {profile?.madrasa?.initials || profile?.madrasa?.name?.slice(0, 2).toUpperCase() || 'MN'}
                  </div>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                  </div>
                )}
              </div>

              {/* Actions & Dropzone */}
              <div className="flex-1 w-full space-y-2">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handleLogoFile(e.dataTransfer.files[0]);
                  }}
                  className="flex flex-wrap items-center gap-3"
                >
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{logoUrl ? 'Replace Logo' : 'Upload Logo'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploadingLogo}
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleLogoFile(e.target.files[0]);
                      }}
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => setShowDeleteLogoModal(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Logo</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Drag and drop a logo here or click to browse. Supported formats: JPG, PNG, WebP (max 5MB).
                </p>
              </div>
            </div>
          </div>

          {/* Section B: Hero Background Image */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-700" />
                  <span>Hero Background Image</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Featured photographic banner displayed behind the main header of your public homepage.
                </p>
              </div>
              <div className="text-[11px] font-medium text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 w-fit">
                Recommended: 16:9 ratio (1920×1080), max 5MB
              </div>
            </div>

            {heroImageFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between ${
                  heroImageFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {heroImageFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{heroImageFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setHeroImageFeedback(null)}
                  className="text-slate-400 hover:text-slate-600 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 16:9 Aspect Ratio Live Preview Card */}
            <div className="relative w-full aspect-[16/9] max-h-64 rounded-2xl overflow-hidden border border-slate-300 bg-slate-900 shadow-inner flex flex-col justify-end p-5 sm:p-6 text-white group">
              {heroImageUrl ? (
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                  style={{ backgroundImage: `url(${heroImageUrl})` }}
                />
              ) : null}
              {/* Overlay simulation */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/60 to-emerald-950/40" />

              <div className="relative z-10 space-y-1">
                <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">
                  Live Hero Preview
                </span>
                <h4 className="text-sm sm:text-base font-bold text-white line-clamp-1">
                  {heroTitle || `Welcome to ${profile?.madrasa?.name || 'Institution'}`}
                </h4>
                <p className="text-xs text-slate-300 line-clamp-1 max-w-lg">
                  {heroSubtitle || 'Dedicated to traditional Islamic education and scholarly excellence.'}
                </p>
              </div>

              {uploadingHeroImage && (
                <div className="absolute inset-0 z-20 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                  <p className="text-xs font-medium text-emerald-300">Processing & uploading hero image...</p>
                </div>
              )}
            </div>

            {/* Upload & Actions */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) handleHeroImageFile(e.dataTransfer.files[0]);
              }}
              className="flex flex-wrap items-center gap-3 pt-1"
            >
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50">
                <Upload className="w-3.5 h-3.5" />
                <span>{heroImageUrl ? 'Replace Hero Image' : 'Upload Hero Image'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingHeroImage}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleHeroImageFile(e.target.files[0]);
                  }}
                />
              </label>

              {heroImageUrl && (
                <button
                  type="button"
                  disabled={uploadingHeroImage}
                  onClick={() => setShowDeleteHeroModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Hero Image</span>
                </button>
              )}

              <span className="text-[11px] text-slate-500">
                Drag and drop your 16:9 banner here or browse. Max 5MB (JPG, PNG, WebP).
              </span>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Hero Title
              </label>
              <input
                type="text"
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                placeholder="e.g. Welcome to Al-Huda Islamic Academy"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Hero Subtitle / Tagline
              </label>
              <textarea
                rows={3}
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                placeholder="e.g. Dedicated to traditional Islamic education and scholarly excellence."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Official Contact Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Contact Phone
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Contact Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="info@madrasa.edu"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Campus Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Mosque Road, Colombo, Sri Lanka"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: About, Mission & Vision */}
      {activeTab === 'about' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Institutional Profile</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Explain your madrasa's history, foundation, mission, and guiding vision.
              </p>
            </div>

            <button
              type="button"
              disabled={generating}
              onClick={handleGenerateSummary}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>{generating ? 'Compiling Summary...' : 'Auto-Generate Summary'}</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Institutional Introduction
              </label>
              <textarea
                rows={4}
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                placeholder="Brief narrative introducing your madrasa, heritage, and values."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Mission Statement
                </label>
                <textarea
                  rows={4}
                  value={mission}
                  onChange={(e) => setMission(e.target.value)}
                  placeholder="What is your core mission for students and society?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Vision Statement
                </label>
                <textarea
                  rows={4}
                  value={vision}
                  onChange={(e) => setVision(e.target.value)}
                  placeholder="Where do you aspire to lead your students in the future?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed"
                />
              </div>
            </div>

            {profile?.generatedSummary && (
              <div className="mt-6 p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-emerald-900">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Deterministic Institutional Summary (Compiled by Rule-Based Engine)</span>
                  </span>
                  {profile.summaryGeneratedAt && (
                    <span className="text-[11px] text-emerald-700 font-medium">
                      Generated: {new Date(profile.summaryGeneratedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                  {profile.generatedSummary}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Syllabus & Rules */}
      {activeTab === 'syllabus' && (
        <CurriculumManagerTab
          curriculum={curriculum}
          syllabusInfo={syllabusInfo}
          rulesAndRegulations={rulesAndRegulations}
          onUpdateSyllabusInfo={setSyllabusInfo}
          onUpdateRules={setRulesAndRegulations}
          onSaveCurriculum={handleSaveCurriculum}
          saving={saving}
        />
      )}

      {/* Tab 4: Upcoming Events */}
      {/* Tab 4: Upcoming Events & Photo Albums */}
      {activeTab === 'events' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Upcoming Events & Photo Albums
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Feature institutional ceremonies, academic milestones, and student gallery albums on your portal.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddEvent}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-sm shrink-0 w-full sm:w-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Event / Album</span>
            </button>
          </div>

          {events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((ev) => {
                const coverUrl = ev.coverUrl || ev.posterUrl || (ev.images && ev.images[0]?.url);
                const count = ev.images && ev.images.length > 0 ? ev.images.length : (coverUrl ? 1 : 0);
                return (
                  <div
                    key={ev.id}
                    className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50/50 gap-4 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 w-full sm:w-auto">
                      {coverUrl ? (
                        <div className="relative shrink-0">
                          <img
                            src={coverUrl}
                            alt={ev.title}
                            className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-xs"
                          />
                          <span className="absolute -bottom-1 -right-1 bg-[#0B3028] text-[#D8B66A] text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-[#D8B66A]/30 flex items-center gap-0.5 shadow-xs">
                            <Images className="w-2.5 h-2.5" />
                            {count}
                          </span>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="text-[11px] font-semibold text-emerald-700 font-mono">
                            {ev.date}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                            {count} {count === 1 ? 'photo' : 'photos'}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                              ev.isPublished !== false
                                ? 'bg-emerald-100/70 text-emerald-800 border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                          >
                            {ev.isPublished !== false ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 truncate">{ev.title}</h4>
                        {ev.description && (
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{ev.description}</p>
                        )}
                        {ev.location && (
                          <p className="text-[11px] text-slate-400 flex items-center space-x-1 pt-0.5 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{ev.location}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => handleOpenEditEvent(ev)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 hover:text-emerald-700 transition-colors rounded-lg hover:bg-emerald-50 border border-slate-200 sm:border-transparent cursor-pointer"
                        title="Edit Event & Album"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="sm:hidden font-medium">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteEvent(ev)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 transition-colors rounded-lg hover:bg-rose-50 border border-rose-200 sm:border-transparent cursor-pointer"
                        title="Delete Event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="sm:hidden font-medium">Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 mb-3">No events added yet. Click "Add Event" to create your first event.</p>
              <button
                type="button"
                onClick={handleOpenAddEvent}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add First Event</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Public Notices & Guardian Broadcast */}
      {activeTab === 'notices' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Public Notices & Guardian Broadcast</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Publish announcements on your portal and dispatch instant SMS / Email notifications to enrolled student guardians.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddNotice}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-sm shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Notice</span>
            </button>
          </div>

          {notices.length > 0 ? (
            <div className="space-y-4">
              {notices.map((nt) => (
                <div
                  key={nt.id}
                  className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    nt.priority === 'URGENT' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4 max-w-2xl min-w-0">
                    {nt.posterUrl && (
                      <img
                        src={nt.posterUrl}
                        alt={nt.title}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200 shadow-xs"
                      />
                    )}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-mono text-slate-400">{nt.postedAt}</span>
                        {nt.priority === 'URGENT' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Urgent
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{nt.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line line-clamp-3">
                        {nt.content}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      disabled={broadcastingId === nt.id}
                      onClick={() => setConfirmBroadcastNotice(nt)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors disabled:opacity-50"
                      title="Send notice to all registered student guardians via SMS and Email"
                    >
                      <Send className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{broadcastingId === nt.id ? 'Queuing Broadcast...' : 'Broadcast to Guardians'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditNotice(nt)}
                      className="p-1.5 text-slate-400 hover:text-emerald-700 transition-colors rounded-lg hover:bg-emerald-50"
                      title="Edit Notice"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveNotice(nt.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50"
                      title="Delete Notice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
              <BellRing className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No notices created yet. Click "Create Notice" to publish your first update.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Staff & Faculty */}
      {activeTab === 'staff' && (
        <StaffManagerTab
          staffConfig={staffConfig}
          onChange={(newConfig) => setStaffConfig(newConfig)}
          disabled={saving}
        />
      )}

      {/* Tab 6: Theme & Appearance */}
      {activeTab === 'theme' && (
        <ThemeCustomizerTab
          institutionName={profile?.madrasa?.name || 'Madrasa Institution'}
          institutionLogoUrl={logoUrl || profile?.madrasa?.logoUrl || null}
          heroImageUrl={heroImageUrl || profile?.heroImageUrl || null}
        />
      )}

      {/* Add / Edit Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingEventId ? 'Edit Event Album' : 'Create Event Album'}
              </h3>
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="e.g. Annual Hifz Graduation Ceremony"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Location / Venue
                  </label>
                  <input
                    type="text"
                    value={newEventLoc}
                    onChange={(e) => setNewEventLoc(e.target.value)}
                    placeholder="e.g. Main Auditorium"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  placeholder="Details of the event program."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Event Publish / Draft Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Publish Event to Public Portal
                  </span>
                  <span className="text-[11px] text-slate-500">
                    When enabled, this event and its photo album appear on the public college portal.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={newEventPublished}
                    onChange={(e) => setNewEventPublished(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ms-2 text-xs font-semibold text-slate-700">
                    {newEventPublished ? 'Published' : 'Draft'}
                  </span>
                </label>
              </div>

              {/* Event Album Images Section (Max 5 Images) */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700">
                      Album Images (Max 5)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Upload up to 5 photos. Select any photo as cover or reorder with arrows.
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      albumImages.length >= 5
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {albumImages.length}/5 Images
                  </span>
                </div>

                {albumFeedback && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center justify-between ${
                      albumFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    <span>{albumFeedback.message}</span>
                    <button
                      type="button"
                      onClick={() => setAlbumFeedback(null)}
                      className="text-slate-400 hover:text-slate-600 ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Uploaded Images Grid */}
                {albumImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                    {albumImages.map((img, idx) => (
                      <div
                        key={img.id || `img-${idx}`}
                        className={`relative group rounded-xl overflow-hidden border bg-slate-100 aspect-square shadow-2xs flex flex-col justify-between transition-all ${
                          img.isCover
                            ? 'border-emerald-600 ring-2 ring-emerald-600/30'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {img.url ? (
                          <img
                            src={img.url}
                            alt={`Album image ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}

                        {/* Top Badge: Cover indicator or Set as Cover button */}
                        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                          {img.isCover ? (
                            <span className="pointer-events-auto bg-[#075E46] text-[#F7F6F0] text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 border border-[#D8B66A]/40">
                              <Star className="w-2.5 h-2.5 fill-[#D8B66A] text-[#D8B66A]" />
                              Cover
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetCover(idx)}
                              className="pointer-events-auto bg-black/60 hover:bg-[#075E46] text-white text-[10px] font-medium px-2 py-0.5 rounded-md transition-colors backdrop-blur-xs"
                              title="Set as album cover"
                            >
                              Make Cover
                            </button>
                          )}
                          <span className="bg-black/60 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                            #{idx + 1}
                          </span>
                        </div>

                        {/* Bottom Actions Bar */}
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between bg-black/70 backdrop-blur-xs rounded-lg p-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0 || uploadingAlbum}
                              onClick={() => handleMoveImage(idx, 'left')}
                              className="p-1 rounded text-white hover:bg-white/20 disabled:opacity-30 transition-colors"
                              title="Move left"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === albumImages.length - 1 || uploadingAlbum}
                              onClick={() => handleMoveImage(idx, 'right')}
                              className="p-1 rounded text-white hover:bg-white/20 disabled:opacity-30 transition-colors"
                              title="Move right"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <label
                              title="Replace this image"
                              className="p-1 rounded text-white hover:bg-white/20 cursor-pointer transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                disabled={uploadingAlbum}
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleReplaceAlbumImage(idx, e.target.files[0]);
                                  }
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              disabled={uploadingAlbum}
                              onClick={() => handleRemoveAlbumImage(idx)}
                              className="p-1 rounded text-rose-300 hover:text-white hover:bg-rose-600 transition-colors"
                              title="Remove image"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload / Dropzone area */}
                {albumImages.length < 5 ? (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files) handleUploadAlbumFiles(e.dataTransfer.files);
                    }}
                    className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-4 text-center transition-colors bg-slate-50/50"
                  >
                    <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-colors mb-1">
                      {uploadingAlbum ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {uploadingAlbum
                          ? 'Optimizing & Uploading...'
                          : `Select Photos (${5 - albumImages.length} remaining)`}
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadingAlbum}
                        onChange={(e) => {
                          if (e.target.files) handleUploadAlbumFiles(e.target.files);
                        }}
                      />
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Drag & drop multiple images or click to select. Max 5MB each (JPG, PNG, WebP).
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Album reached the maximum of 5 images. You can replace or remove individual photos above.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors text-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEvent}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-sm text-center cursor-pointer"
              >
                {editingEventId ? 'Save Changes' : 'Add Event & Album'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Event Confirmation Modal */}
      {confirmDeleteEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Event</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete the event <strong>"{confirmDeleteEvent.title}"</strong> and its album photos?
            </p>
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors text-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setEvents(events.filter((e) => e.id !== confirmDeleteEvent.id));
                  setConfirmDeleteEvent(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm text-center cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Notice Modal */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingNoticeId ? 'Edit Notice' : 'Create Public Notice'}
              </h3>
              <button
                type="button"
                onClick={() => setShowNoticeModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Notice Title *
                </label>
                <input
                  type="text"
                  value={newNoticeTitle}
                  onChange={(e) => setNewNoticeTitle(e.target.value)}
                  placeholder="e.g. Ramadan Schedule Adjustment"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  value={newNoticePriority}
                  onChange={(e) => setNewNoticePriority(e.target.value as 'NORMAL' | 'URGENT')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                >
                  <option value="NORMAL">Normal Priority</option>
                  <option value="URGENT">Urgent Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Content / Announcement *
                </label>
                <textarea
                  rows={4}
                  value={newNoticeContent}
                  onChange={(e) => setNewNoticeContent(e.target.value)}
                  placeholder="Detailed text of the announcement."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Notice Poster Section */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Notice Poster / Graphic (Optional)
                </label>
                {noticePosterFeedback && (
                  <div
                    className={`p-2 rounded-xl text-xs flex items-center justify-between mb-2 ${
                      noticePosterFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    <span>{noticePosterFeedback.message}</span>
                    <button
                      type="button"
                      onClick={() => setNoticePosterFeedback(null)}
                      className="text-slate-400 hover:text-slate-600 ml-2"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {noticePosterUrl ? (
                  <div className="space-y-2">
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img
                        src={noticePosterUrl}
                        alt="Notice Poster Preview"
                        className="w-full h-full object-cover"
                      />
                      {uploadingNoticePoster && (
                        <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Replace Poster</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploadingNoticePoster}
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleNoticePosterFile(e.target.files[0]);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={uploadingNoticePoster}
                        onClick={() => setShowDeleteNoticePosterModal(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Poster</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleNoticePosterFile(e.dataTransfer.files[0]);
                    }}
                    className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-4 text-center transition-colors bg-slate-50/50"
                  >
                    <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-colors mb-1">
                      {uploadingNoticePoster ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{uploadingNoticePoster ? 'Uploading...' : 'Upload Poster'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadingNoticePoster}
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleNoticePosterFile(e.target.files[0]);
                        }}
                      />
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Drag & drop or click. Recommended: 16:9 ratio, max 5MB (JPG, PNG, WebP).
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNoticeModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNotice}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-sm"
              >
                {editingNoticeId ? 'Save Changes' : 'Add Notice'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Confirmation Modal: Remove Notice Poster */}
      {showDeleteNoticePosterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Remove Notice Poster?</h3>
                <p className="text-xs text-slate-500">The notice card will render in clean text format.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this poster? This action removes the image file from storage.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={uploadingNoticePoster}
                onClick={() => setShowDeleteNoticePosterModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={uploadingNoticePoster}
                onClick={handleConfirmDeleteNoticePoster}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {uploadingNoticePoster ? 'Removing...' : 'Yes, Remove Poster'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Confirmation Modal */}
      {confirmBroadcastNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
              <Send className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Broadcast Notice to Guardians?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will queue communication jobs in the background to send "
                <span className="font-semibold text-slate-800">{confirmBroadcastNotice.title}</span>"
                via SMS and Email to the eligible guardians of all active students in your madrasa.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100">
              <p className="font-semibold text-slate-800 mb-1">Notification Safeguards:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-500">
                <li>Strict tenant isolation (only your madrasa's guardians)</li>
                <li>Deduplication keys prevent double sending</li>
                <li>Audit activity logged automatically</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmBroadcastNotice(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBroadcastNotice}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-sm"
              >
                Confirm & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Remove Logo */}
      {showDeleteLogoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Remove Institution Logo?</h3>
                <p className="text-xs text-slate-500">This will revert to the default letter monogram.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your public portal and documents will use the institution initials until a new logo is uploaded.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={uploadingLogo}
                onClick={() => setShowDeleteLogoModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={uploadingLogo}
                onClick={handleRemoveLogo}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {uploadingLogo ? 'Removing...' : 'Yes, Remove Logo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Remove Hero Image */}
      {showDeleteHeroModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Remove Hero Image?</h3>
                <p className="text-xs text-slate-500">Reverts to the default navy gradient background.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              The public homepage hero section will immediately display the default dark gradient fallback.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={uploadingHeroImage}
                onClick={() => setShowDeleteHeroModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={uploadingHeroImage}
                onClick={handleRemoveHeroImage}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {uploadingHeroImage ? 'Removing...' : 'Yes, Remove Image'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MadrasaHomepageCmsPage;
