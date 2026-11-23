// client/src/pages/ProfileSetupPage.jsx
// Complete user profile setup with bio, location, geocoding, skills trading, and avatar upload

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  User,
  MapPin,
  Plus,
  X,
  Sparkles,
  BookOpen,
  GraduationCap,
  CheckCircle,
  AlertCircle,
  Upload,
  Trash2,
  Loader2,
} from 'lucide-react';
import AddressSearch from '@/components/AddressSearch';

export default function ProfileSetupPage() {
  const { user: authUser, refresh: refreshAuth, logout } = useAuth();
  const navigate = useNavigate();

  // Basic Profile Info
  const [userName, setUserName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationLabel, setLocationLabel] = useState(null);

  // Auth & Notification settings
  const [authMethod, setAuthMethod] = useState('password');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [initialEmailNotifications, setInitialEmailNotifications] = useState(true);

  // Account Deletion Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Avatar Upload States
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const fileInputRef = useRef(null);

  // Skills Lists
  const [teachSkills, setTeachSkills] = useState([]);
  const [learnSkills, setLearnSkills] = useState([]);

  // Input Controls
  const [teachInput, setTeachInput] = useState('');
  const [teachProficiency, setTeachProficiency] = useState('Intermediate');
  const [learnInput, setLearnInput] = useState('');

  // Available skills suggestions from DB
  const [dbSkills, setDbSkills] = useState([]);

  // Page States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch initial profile & skills suggestions
  useEffect(() => {
    async function loadData() {
      try {
        const [skillsData, profileData] = await Promise.all([
          apiFetch('/api/skills').catch(() => ({ skills: [] })),
          apiFetch('/api/user/profile').catch(() => null),
        ]);

        if (skillsData?.skills) {
          setDbSkills(skillsData.skills);
        }

        const u = profileData?.user;
        if (u) {
          if (u.name) setUserName(u.name);
          setBio(u.bio || '');
          setLocation(u.location || '');
          setAvatarUrl(u.avatarUrl || '');
          setAuthMethod(u.authMethod || 'password');
          const en = u.emailNotifications !== false;
          setEmailNotifications(en);
          setInitialEmailNotifications(en);
          if (typeof u.latitude === 'number' && typeof u.longitude === 'number') {
            setLatitude(u.latitude);
            setLongitude(u.longitude);
            setLocationLabel(
              u.location || `${u.latitude.toFixed(4)}, ${u.longitude.toFixed(4)}`
            );
          }

          if (u.skillsTeach) {
            setTeachSkills(
              u.skillsTeach.map((st) => ({
                name: st.skill?.name || st.name,
                proficiency: st.proficiency || 'Intermediate',
              }))
            );
          }

          if (u.skillsLearn) {
            setLearnSkills(
              u.skillsLearn.map((sl) => ({
                name: sl.skill?.name || sl.name,
              }))
            );
          }
        } else if (authUser?.name) {
          setUserName(authUser.name);
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
      } finally {
        setLoading(false);
      }
    }

    void Promise.resolve().then(() => loadData());
  }, [authUser]);

  // Handle Avatar File Selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation: allowed MIME types
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setAvatarError('Invalid image type. Please select a JPG, PNG, or WebP image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Client-side validation: 2 MB limit
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('File too large. Maximum size is 2 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    void handleUploadAvatar(file);
  };

  // Upload Avatar
  const handleUploadAvatar = async (file) => {
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const data = await apiFetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      });

      // RACE CONDITION FIX: Immediately update page state and navbar auth session
      if (data?.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        void refreshAuth();
      }
    } catch (err) {
      setAvatarError(err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove Avatar
  const handleRemoveAvatar = async () => {
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      await apiFetch('/api/user/avatar', {
        method: 'DELETE',
      });

      // RACE CONDITION FIX: Immediately clear page state and refresh navbar auth session
      setAvatarUrl('');
      void refreshAuth();
    } catch (err) {
      setAvatarError(err.message || 'Failed to remove avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle Location Geocode Selection & Removal
  const handleSelectLocation = (result) => {
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setLocationLabel(result.label);
    if (!location.trim()) {
      setLocation(result.label);
    }
  };

  const handleRemoveLocation = () => {
    setLatitude(null);
    setLongitude(null);
    setLocationLabel(null);
  };

  // Add a Teach Skill Badge
  const addTeachSkill = (skillName) => {
    const trimmed = skillName.trim();
    if (!trimmed) return;
    if (teachSkills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      return; // prevent duplicate
    }
    setTeachSkills([
      ...teachSkills,
      { name: trimmed, proficiency: teachProficiency },
    ]);
    setTeachInput('');
  };

  // Remove a Teach Skill Badge
  const removeTeachSkill = (index) => {
    setTeachSkills(teachSkills.filter((_, i) => i !== index));
  };

  // Add a Learn Skill Badge
  const addLearnSkill = (skillName) => {
    const trimmed = skillName.trim();
    if (!trimmed) return;
    if (learnSkills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      return; // prevent duplicate
    }
    setLearnSkills([...learnSkills, { name: trimmed }]);
    setLearnInput('');
  };

  // Remove a Learn Skill Badge
  const removeLearnSkill = (index) => {
    setLearnSkills(learnSkills.filter((_, i) => i !== index));
  };

  // Handle Form Submit
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        bio: bio.trim() || null,
        location: location.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        latitude,
        longitude,
        skillsTeach: teachSkills,
        skillsLearn: learnSkills,
      };

      if (emailNotifications !== initialEmailNotifications) {
        payload.emailNotifications = emailNotifications;
      }

      await apiFetch('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      // Sync updated user data with AuthContext so Navbar shows updated name/avatar
      await refreshAuth();
      setInitialEmailNotifications(emailNotifications);

      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err.message || 'An error occurred while saving your profile.');
      setSaving(false);
    }
  };

  // Handle Account Deletion
  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const body = {
        confirm: deleteConfirmText,
        ...(authMethod !== 'google' ? { password: deletePassword } : {}),
      };

      await apiFetch('/api/user/account', {
        method: 'DELETE',
        body: JSON.stringify(body),
      });

      setShowDeleteModal(false);
      await logout();
      navigate('/', {
        state: { notice: 'Your account has been permanently deleted.' },
        replace: true,
      });
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete account. Please check your credentials.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mr-2" />
        Loading profile...
      </div>
    );
  }

  return (
    <div className="max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col flex-1">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <User className="h-6 w-6 text-indigo-600" />
          Set Up Your SkillSwap Profile
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Tell the local community about yourself and what skills you want to trade.
        </p>
      </div>

      <Card className="border-slate-200 shadow-md bg-white">
        <form onSubmit={handleSaveProfile}>
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-lg text-slate-900">Basic Information</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Your location helps us find local skill matches and meetups near you.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-md bg-green-50 border border-green-200 flex items-center gap-2 text-xs text-green-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Profile Photo / Avatar Section */}
            <div className="pb-5 border-b border-slate-100">
              <label className="text-xs font-medium text-slate-700 block mb-2">
                Profile Photo
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-slate-200 shadow-sm shrink-0">
                  <AvatarImage src={avatarUrl || undefined} alt={userName || 'Profile'} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-2xl font-bold">
                    {userName ? (
                      userName.charAt(0).toUpperCase()
                    ) : (
                      <User className="h-8 w-8" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-2 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingAvatar}
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-1.5 text-xs text-slate-700 border-slate-300 h-9"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                      ) : (
                        <Upload className="h-3.5 w-3.5 text-indigo-600" />
                      )}
                      <span>{uploadingAvatar ? 'Uploading...' : 'Upload photo'}</span>
                    </Button>

                    {avatarUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={uploadingAvatar}
                        onClick={handleRemoveAvatar}
                        className="gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-9"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove photo</span>
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-slate-500">
                    JPG, PNG or WebP, up to 2 MB. Your photo is resized and stripped of hidden metadata.
                  </p>

                  {avatarError && (
                    <div className="p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{avatarError}</span>
                    </div>
                  )}

                  {/* Secondary URL link input */}
                  <div className="pt-1">
                    <label className="text-[11px] font-medium text-slate-500 mb-1 block">
                      Or use an image link:
                    </label>
                    <Input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={avatarUrl.startsWith('/api/avatars/') ? '' : avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bio & Location Inputs */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-indigo-600" />
                  City / Neighborhood Location
                </label>
                <Input
                  placeholder="e.g. San Francisco, CA or Downtown Boston"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="text-xs"
                />
              </div>

              {/* My Location (Geocoding & Rounded Distance) */}
              <div>
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1 mb-1.5">
                  <MapPin className="h-3.5 w-3.5 text-indigo-600" />
                  My Location (for match distances)
                </label>
                <AddressSearch
                  onSelect={handleSelectLocation}
                  onClear={handleRemoveLocation}
                  selectedLabel={locationLabel}
                  placeholder="e.g. Koramangala, Bengaluru"
                  label="Search your area or city"
                  privacyNotice="Only a rounded distance is shown to others. Your exact coordinates are never shared."
                  clearButtonText="Remove my location"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">
                  Short Bio & Learning Goals
                </label>
                <Textarea
                  placeholder="Share a little bit about yourself, your background, and why you want to swap skills..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="h-24 text-xs"
                />
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Section: Skills I Can Teach */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900 text-base">Skills I Can Teach</h3>
              </div>
              <p className="text-slate-500 text-xs mb-3">
                Add topics you are confident sharing with others (e.g. JavaScript, Guitar, Photography).
              </p>

              {/* Tag Input Controls */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <Input
                  placeholder="Enter skill to teach..."
                  value={teachInput}
                  onChange={(e) => setTeachInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTeachSkill(teachInput);
                    }
                  }}
                  className="flex-1 text-xs"
                />
                <Select
                  value={teachProficiency}
                  onValueChange={(val) => setTeachProficiency(val)}
                >
                  <SelectTrigger className="w-full sm:w-36 text-xs h-9">
                    <SelectValue placeholder="Proficiency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                    <SelectItem value="Expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() => addTeachSkill(teachInput)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-4 shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>

              {/* Suggested Quick Add Badges */}
              {dbSkills.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-1.5">Quick Suggestions:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {dbSkills.slice(0, 5).map((sk) => (
                      <button
                        key={sk.name}
                        type="button"
                        onClick={() => addTeachSkill(sk.name)}
                        className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                      >
                        + {sk.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Display Teach Skill Badges */}
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[50px]">
                {teachSkills.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">
                    No teaching skills added yet.
                  </span>
                ) : (
                  teachSkills.map((item, idx) => (
                    <Badge
                      key={idx}
                      className="bg-indigo-600 text-white gap-1.5 py-1 px-2.5 text-xs font-normal"
                    >
                      <span>{item.name}</span>
                      <span className="bg-indigo-700 text-indigo-100 text-[10px] px-1 rounded">
                        {item.proficiency}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTeachSkill(idx)}
                        className="hover:text-red-200 transition-colors"
                        aria-label={`Remove ${item.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Section: Skills I Want to Learn */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900 text-base">Skills I Want to Learn</h3>
              </div>
              <p className="text-slate-500 text-xs mb-3">
                Add skills you wish to learn or practice with a partner.
              </p>

              {/* Tag Input Controls */}
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Enter skill to learn..."
                  value={learnInput}
                  onChange={(e) => setLearnInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addLearnSkill(learnInput);
                    }
                  }}
                  className="flex-1 text-xs"
                />
                <Button
                  type="button"
                  onClick={() => addLearnSkill(learnInput)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-4 shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>

              {/* Suggested Quick Add Badges */}
              {dbSkills.length > 5 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-1.5">Quick Suggestions:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {dbSkills.slice(5, 10).map((sk) => (
                      <button
                        key={sk.name}
                        type="button"
                        onClick={() => addLearnSkill(sk.name)}
                        className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                      >
                        + {sk.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Display Learn Skill Badges */}
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[50px]">
                {learnSkills.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">
                    No learn skills added yet.
                  </span>
                ) : (
                  learnSkills.map((item, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="bg-slate-200 text-slate-800 gap-1.5 py-1 px-2.5 text-xs font-normal hover:bg-slate-300"
                    >
                      <span>{item.name}</span>
                      <button
                        type="button"
                        onClick={() => removeLearnSkill(idx)}
                        className="hover:text-red-600 transition-colors"
                        aria-label={`Remove ${item.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="pt-6 border-t border-slate-100">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">
                    Email me about new requests and cancelled events
                  </span>
                  <p className="text-xs text-slate-500">
                    Receive email notifications for connection requests and important schedule updates.
                  </p>
                </div>
              </label>
            </div>
          </CardContent>

          <CardFooter className="border-t border-slate-100 flex justify-between py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="text-xs text-slate-600 border-slate-300"
            >
              Skip for Now
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 px-6 text-xs h-9"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {saving ? 'Saving Profile...' : 'Save & Find Matches'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Danger Zone: Account Deletion */}
      <div className="mt-8 border border-red-200 rounded-xl bg-red-50/50 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-red-900">Delete my account</h3>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              Permanently delete your SkillSwap profile, skills, matches, messages, reviews, and events.
              This action cannot be undone.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteError(null);
              setDeleteConfirmText('');
              setDeletePassword('');
            }}
            className="bg-red-600 hover:bg-red-700 text-white shrink-0 text-xs h-9"
          >
            Delete my account
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog / Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <h3 id="delete-dialog-title" className="text-lg font-bold text-slate-900">
                Delete Account Permanently
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This action is <strong>irreversible</strong>. Everything associated with your account will be permanently deleted: your skills, matches, messages, ratings &amp; reviews given and received, hosted events and RSVPs, and uploaded avatars.
            </p>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                {deleteError}
              </div>
            )}

            {authMethod !== 'google' && (
              <div>
                <label className="text-xs font-medium text-slate-700">
                  Confirm your password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-700">
                To confirm, type <span className="font-bold text-red-600">DELETE</span> below:
              </label>
              <Input
                type="text"
                placeholder="DELETE"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={
                  deleting ||
                  deleteConfirmText !== 'DELETE' ||
                  (authMethod !== 'google' && !deletePassword)
                }
                className="bg-red-600 hover:bg-red-700 text-white text-xs"
              >
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

