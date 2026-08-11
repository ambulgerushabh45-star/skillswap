"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { User, MapPin, Plus, X, Sparkles, BookOpen, GraduationCap, CheckCircle, AlertCircle } from "lucide-react";

interface TeachSkillItem {
  name: string;
  proficiency: string;
}

interface LearnSkillItem {
  name: string;
}

export default function ProfileSetupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Basic Profile Info
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Skills Lists
  const [teachSkills, setTeachSkills] = useState<TeachSkillItem[]>([]);
  const [learnSkills, setLearnSkills] = useState<LearnSkillItem[]>([]);

  // Input Controls
  const [teachInput, setTeachInput] = useState("");
  const [teachProficiency, setTeachProficiency] = useState("Intermediate");
  const [learnInput, setLearnInput] = useState("");

  // Available skills suggestions from DB
  const [dbSkills, setDbSkills] = useState<Array<{ name: string; category: string }>>([]);

  // Page States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch initial profile & skills suggestions
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch DB available skills
        const skillsRes = await fetch("/api/skills");
        if (skillsRes.ok) {
          const skillsData = await skillsRes.json();
          setDbSkills(skillsData.skills || []);
        }

        // Fetch User Profile
        const profileRes = await fetch("/api/user/profile");
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const u = profileData.user;
          if (u) {
            setBio(u.bio || "");
            setLocation(u.location || "");
            setAvatarUrl(u.avatarUrl || "");

            if (u.skillsTeach) {
              setTeachSkills(
                u.skillsTeach.map((st: any) => ({
                  name: st.skill.name,
                  proficiency: st.proficiency,
                }))
              );
            }

            if (u.skillsLearn) {
              setLearnSkills(
                u.skillsLearn.map((sl: any) => ({
                  name: sl.skill.name,
                }))
              );
            }
          }
        }
      } catch (err) {
        console.error("Failed to load profile data:", err);
      } finally {
        setLoading(false);
      }
    }

    if (status === "authenticated") {
      loadData();
    } else if (status === "unauthenticated") {
      router.push("/auth");
    }
  }, [status, router]);

  // Add a Teach Skill Badge
  const addTeachSkill = (skillName: string) => {
    const trimmed = skillName.trim();
    if (!trimmed) return;
    if (teachSkills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      return; // prevent duplicate
    }
    setTeachSkills([...teachSkills, { name: trimmed, proficiency: teachProficiency }]);
    setTeachInput("");
  };

  // Remove a Teach Skill Badge
  const removeTeachSkill = (index: number) => {
    setTeachSkills(teachSkills.filter((_, i) => i !== index));
  };

  // Add a Learn Skill Badge
  const addLearnSkill = (skillName: string) => {
    const trimmed = skillName.trim();
    if (!trimmed) return;
    if (learnSkills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      return; // prevent duplicate
    }
    setLearnSkills([...learnSkills, { name: trimmed }]);
    setLearnInput("");
  };

  // Remove a Learn Skill Badge
  const removeLearnSkill = (index: number) => {
    setLearnSkills(learnSkills.filter((_, i) => i !== index));
  };

  // Handle Form Submit
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio,
          location,
          avatarUrl,
          skillsTeach: teachSkills,
          skillsLearn: learnSkills,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save profile");
        setSaving(false);
        return;
      }

      setSuccess("Profile updated successfully!");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err) {
      setError("An error occurred while saving your profile.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <User className="h-6 w-6 text-indigo-600" />
            Set Up Your SkillSwap Profile
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Tell the local community about yourself and what skills you want to trade.
          </p>
        </div>

        <Card className="border-slate-200 shadow-md">
          <form onSubmit={handleSaveProfile}>
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg">Basic Information</CardTitle>
              <CardDescription className="text-xs">
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
                    className="h-24"
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

                {/* Interactive Tag Input Controls */}
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <Input
                    placeholder="Enter skill to teach..."
                    value={teachInput}
                    onChange={(e) => setTeachInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTeachSkill(teachInput);
                      }
                    }}
                    className="flex-1"
                  />
                  <Select
                    value={teachProficiency}
                    onValueChange={(val) => setTeachProficiency(val)}
                  >
                    <SelectTrigger className="w-full sm:w-36">
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
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                {/* Suggested Quick Add Badges */}
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

                {/* Display Teach Skill Badges */}
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[50px]">
                  {teachSkills.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No teaching skills added yet.</span>
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

                {/* Interactive Tag Input Controls */}
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Enter skill to learn..."
                    value={learnInput}
                    onChange={(e) => setLearnInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLearnSkill(learnInput);
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={() => addLearnSkill(learnInput)}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                {/* Suggested Quick Add Badges */}
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

                {/* Display Learn Skill Badges */}
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[50px]">
                  {learnSkills.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No learn skills added yet.</span>
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
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </CardContent>

            <CardFooter className="border-t border-slate-100 flex justify-between py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard")}
              >
                Skip for Now
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 px-6"
              >
                <Sparkles className="h-4 w-4" />
                {saving ? "Saving Profile..." : "Save & Find Matches"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
