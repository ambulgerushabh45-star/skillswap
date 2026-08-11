"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import CreateEventDialog from "@/components/CreateEventDialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Calendar as CalendarIcon,
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Map,
  Grid,
} from "lucide-react";

// Dynamically import MapView client component to avoid SSR window errors
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm">
      Loading interactive map...
    </div>
  ),
});

interface EventItem {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  title: string;
  description: string;
  location: string;
  lat: number;
  lng: number;
  dateTime: string;
  attendeeCount: number;
  isGoing: boolean;
  isHost: boolean;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "my-events">("upcoming");
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [rsvpLoadingId, setRsvpLoadingId] = useState<string | null>(null);

  // Fetch events list
  const loadEvents = async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error("Error loading events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Handle RSVP Toggle button
  const handleRsvpToggle = async (eventId: string) => {
    setRsvpLoadingId(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
      });

      if (res.ok) {
        await loadEvents(); // Refresh attendee counts and status
      }
    } catch (err) {
      console.error("Error toggling RSVP:", err);
    } finally {
      setRsvpLoadingId(null);
    }
  };

  // Filter events based on active tab
  const filteredEvents = events.filter((e) => {
    if (activeTab === "my-events") {
      return e.isGoing || e.isHost;
    }
    return true; // "upcoming"
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Page Banner */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="h-6 w-6 text-indigo-600" />
              Local Skill Meetups & Events
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Join local study groups, practice circles, and skill exchange workshops nearby.
            </p>
          </div>

          <CreateEventDialog onEventCreated={loadEvents} />
        </div>

        {/* Tabs & View Switcher */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as "upcoming" | "my-events")}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid grid-cols-2 w-full sm:w-auto">
              <TabsTrigger value="upcoming">Upcoming Meetups ({events.length})</TabsTrigger>
              <TabsTrigger value="my-events">
                My Events ({events.filter((e) => e.isGoing || e.isHost).length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className={`gap-1.5 ${viewMode === "grid" ? "bg-indigo-600 hover:bg-indigo-700" : "border-slate-300"}`}
            >
              <Grid className="h-4 w-4" />
              Cards
            </Button>
            <Button
              variant={viewMode === "map" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("map")}
              className={`gap-1.5 ${viewMode === "map" ? "bg-indigo-600 hover:bg-indigo-700" : "border-slate-300"}`}
            >
              <Map className="h-4 w-4" />
              Map View
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading events...</div>
        ) : viewMode === "map" ? (
          /* Interactive Leaflet Map View */
          <div className="space-y-6">
            <MapView events={filteredEvents} />

            <div className="grid md:grid-cols-2 gap-4">
              {filteredEvents.map((e) => (
                <div key={e.id} className="p-4 bg-white rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <strong className="text-indigo-600 text-sm block">{e.title}</strong>
                    <span className="text-slate-500">📍 {e.location}</span>
                  </div>
                  <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    {e.attendeeCount} Going
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-md mx-auto">
            <CalendarIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 text-base">No Meetups Listed</h3>
            <p className="text-slate-500 text-xs mt-1">
              Be the first to host a local study session or skill exchange!
            </p>
          </div>
        ) : (
          /* Event Cards Grid */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((e) => {
              const eventDate = new Date(e.dateTime);
              return (
                <Card key={e.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 border border-slate-200">
                            <AvatarImage src={e.hostAvatar} alt={e.hostName} />
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                              {e.hostName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-slate-500">Host: <strong>{e.hostName}</strong></span>
                        </div>

                        {e.isHost && (
                          <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">Your Event</Badge>
                        )}
                      </div>

                      <CardTitle className="text-base text-slate-900 leading-snug">{e.title}</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-3 text-xs pb-4">
                      <p className="text-slate-600 line-clamp-3 bg-slate-50 p-2.5 rounded border border-slate-100">
                        {e.description}
                      </p>

                      <div className="space-y-1.5 text-slate-600 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span>
                            {eventDate.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            at {eventDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">{e.location}</span>
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  {/* Footer with Attendee count and RSVP button */}
                  <CardFooter className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
                      <Users className="h-4 w-4 text-indigo-600" />
                      <span>{e.attendeeCount} Going</span>
                    </div>

                    <Button
                      size="sm"
                      variant={e.isGoing ? "outline" : "default"}
                      disabled={rsvpLoadingId === e.id}
                      onClick={() => handleRsvpToggle(e.id)}
                      className={`gap-1.5 text-xs ${
                        e.isGoing
                          ? "border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      }`}
                    >
                      {e.isGoing ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          RSVP Confirmed
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          RSVP Going
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
