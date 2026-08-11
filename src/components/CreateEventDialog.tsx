"use client";

import { useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Plus, Sparkles, AlertCircle } from "lucide-react";

export default function CreateEventDialog({ onEventCreated }: { onEventCreated: () => void }) {
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [lat, setLat] = useState("42.3601");
  const [lng, setLng] = useState("-71.0589");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          dateTime,
          lat,
          lng,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create event");
        setSubmitting(false);
        return;
      }

      // Reset form & close modal
      setTitle("");
      setDescription("");
      setLocation("");
      setDateTime("");
      setOpen(false);
      onEventCreated(); // Refresh event list
    } catch (err) {
      setError("An unexpected error occurred while creating the event.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          Host New Meetup Event
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-600">
            <Sparkles className="h-5 w-5" />
            Host a Skill Swap Event
          </DialogTitle>
          <DialogDescription className="text-xs">
            Create a local meetup or study group for peers to practice skills together.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Event Title</label>
            <Input
              placeholder="e.g. JavaScript & React Coffee Study Session"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Description & Goals</label>
            <Textarea
              placeholder="What will you teach/practice during this meetup? What should attendees bring?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-20"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1 mb-1">
              <MapPin className="h-3.5 w-3.5 text-indigo-600" />
              Location Address
            </label>
            <Input
              placeholder="e.g. Central Library Cafe, Main St"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1 mb-1">
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
              Date & Time
            </label>
            <Input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              required
            />
          </div>

          {/* Simple Coordinates for Leaflet Map Placement */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Map Lat (Optional)</label>
              <Input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Map Lng (Optional)</label>
              <Input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
              {submitting ? "Publishing Event..." : "Publish Meetup Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
