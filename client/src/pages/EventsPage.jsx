// client/src/pages/EventsPage.jsx
// Events feed and interactive Leaflet map with full P3.5 host controls and capacity states

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar as CalendarIcon,
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Map,
  Grid,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import MapView from '@/components/MapView';
import EventDialog from '@/components/EventDialog';
import { apiFetch, ApiError } from '@/lib/api';
import { formatDistance } from '@/lib/geo';
import { formatEventDateTime } from '@/lib/events';

export default function EventsPage() {
  const { status } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('upcoming');
  const [viewMode, setViewMode] = useState('grid');
  const [rsvpLoadingId, setRsvpLoadingId] = useState(null);
  const [cardErrors, setCardErrors] = useState({});

  // Dialog state: { open: boolean, event: object | null }
  const [dialogState, setDialogState] = useState({ open: false, event: null });

  // Load initial events
  const loadEvents = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch('/api/events');
      setEvents(data?.events || []);
      setPagination(data?.pagination || null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load events. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Load next page
  const handleLoadMore = async () => {
    if (!pagination?.hasNextPage || loadingMore) return;
    setLoadingMore(true);

    try {
      const nextPage = (pagination.page || 1) + 1;
      const data = await apiFetch(`/api/events?page=${nextPage}`);
      if (data?.events) {
        setEvents((prev) => [...prev, ...data.events]);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Error loading more events:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // RSVP toggle handler
  const handleRsvpToggle = async (eventId) => {
    if (status !== 'authenticated') {
      navigate('/auth');
      return;
    }

    setRsvpLoadingId(eventId);
    setCardErrors((prev) => ({ ...prev, [eventId]: null }));

    try {
      await apiFetch(`/api/events/${eventId}/rsvp`, {
        method: 'POST',
      });
      // Refresh event list to ensure attendee count and status match server truth
      await loadEvents();
    } catch (err) {
      if (err instanceof ApiError) {
        setCardErrors((prev) => ({ ...prev, [eventId]: err.message }));
        // If 409 Conflict (e.g. event full or cancelled), reload list to show true state
        if (err.status === 409) {
          loadEvents();
        }
      } else {
        setCardErrors((prev) => ({
          ...prev,
          [eventId]: 'Failed to update RSVP. Please try again.',
        }));
      }
    } finally {
      setRsvpLoadingId(null);
    }
  };

  const handleOpenCreateDialog = () => {
    if (status !== 'authenticated') {
      navigate('/auth');
      return;
    }
    setDialogState({ open: true, event: null });
  };

  const handleEditClick = (event) => {
    setDialogState({ open: true, event });
  };

  // Filter events based on active tab
  const filteredEvents = events.filter((e) => {
    if (activeTab === 'my-events') {
      return e.isGoing || e.isHost;
    }
    return true; // 'upcoming'
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
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

          <Button
            onClick={handleOpenCreateDialog}
            className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Host New Meetup Event
          </Button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadEvents}
              className="gap-1 border-red-200 bg-white hover:bg-red-50 text-red-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Tabs & View Switcher */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val)}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid grid-cols-2 w-full sm:w-auto">
              <TabsTrigger value="upcoming">
                Upcoming Meetups ({events.length})
              </TabsTrigger>
              <TabsTrigger value="my-events">
                My Events ({events.filter((e) => e.isGoing || e.isHost).length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={`gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'border-slate-300'
              }`}
            >
              <Grid className="h-4 w-4" />
              Cards
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('map')}
              className={`gap-1.5 ${
                viewMode === 'map'
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'border-slate-300'
              }`}
            >
              <Map className="h-4 w-4" />
              Map View
            </Button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
            Loading events...
          </div>
        ) : viewMode === 'map' ? (
          /* Interactive Leaflet Map View */
          <div className="space-y-6">
            <MapView events={filteredEvents} />

            <div className="grid md:grid-cols-2 gap-4">
              {filteredEvents.map((e) => (
                <div
                  key={e.id}
                  className="p-4 bg-white rounded-lg border border-slate-200 flex justify-between items-center text-xs"
                >
                  <div>
                    <strong className="text-indigo-600 text-sm block">{e.title}</strong>
                    <span className="text-slate-500">📍 {e.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {e.cancelled ? (
                      <Badge className="bg-red-100 text-red-800 border-red-200">
                        Cancelled
                      </Badge>
                    ) : (
                      <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">
                        {e.maxAttendees != null
                          ? `${e.goingCount} / ${e.maxAttendees} Going`
                          : `${e.goingCount || e.attendeeCount} Going`}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-md mx-auto">
            <CalendarIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 text-base">No Meetups Listed</h3>
            <p className="text-slate-500 text-xs mt-1 mb-4">
              Be the first to host a local study session or skill exchange!
            </p>
            <Button
              onClick={handleOpenCreateDialog}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Host an Event
            </Button>
          </div>
        ) : (
          /* Event Cards Grid */
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((e) => {
                return (
                  <Card
                    key={e.id}
                    data-testid={`event-card-${e.id}`}
                    className={`border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between ${
                      e.cancelled ? 'opacity-70 bg-slate-50 border-red-100' : ''
                    }`}
                  >
                    <div>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <Link
                            to={`/profile/${e.hostId}`}
                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                          >
                            <Avatar className="h-7 w-7 border border-slate-200">
                              <AvatarImage src={e.hostAvatar} alt={e.hostName} />
                              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                                {e.hostName ? e.hostName.charAt(0) : 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-slate-500">
                              Host: <strong className="text-slate-800">{e.hostName}</strong>
                            </span>
                          </Link>

                          <div className="flex items-center gap-1.5">
                            {e.cancelled && (
                              <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">
                                Cancelled
                              </Badge>
                            )}
                            {!e.cancelled && e.isFull && (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                                Full
                              </Badge>
                            )}
                            {e.isHost && (
                              <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">
                                Your Event
                              </Badge>
                            )}
                          </div>
                        </div>

                        <CardTitle className="text-base text-slate-900 leading-snug">
                          {e.title}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="space-y-3 text-xs pb-4">
                        <p className="text-slate-600 line-clamp-3 bg-slate-50 p-2.5 rounded border border-slate-100">
                          {e.description}
                        </p>

                        <div className="space-y-1.5 text-slate-600 pt-1">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            <span>{formatEventDateTime(e.dateTime)}</span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate">{e.location}</span>
                            {e.distanceKm !== null && e.distanceKm !== undefined && (
                              <span className="text-slate-500 font-medium shrink-0">
                                · {formatDistance(e.distanceKm)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inline card error */}
                        {cardErrors[e.id] && (
                          <div className="p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-700 flex items-center gap-1.5 mt-2">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{cardErrors[e.id]}</span>
                          </div>
                        )}
                      </CardContent>
                    </div>

                    {/* Footer with Attendee count and Action buttons */}
                    <CardFooter className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
                        <Users className="h-4 w-4 text-indigo-600" />
                        <span>
                          {e.maxAttendees != null
                            ? `${e.goingCount} / ${e.maxAttendees} going`
                            : `${e.goingCount || e.attendeeCount} Going`}
                        </span>
                      </div>

                      {/* State-driven Action Buttons */}
                      <div>
                        {e.cancelled ? (
                          <span className="text-xs text-red-600 font-medium">
                            This event has been cancelled.
                          </span>
                        ) : e.isHost ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditClick(e)}
                              className="text-xs gap-1 border-slate-300 hover:bg-slate-50"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                          </div>
                        ) : e.isGoing ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rsvpLoadingId === e.id}
                            onClick={() => handleRsvpToggle(e.id)}
                            className="gap-1.5 text-xs border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
                          >
                            {rsvpLoadingId === e.id ? (
                              'Updating...'
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                RSVP Confirmed
                              </>
                            )}
                          </Button>
                        ) : e.isFull ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={true}
                            className="gap-1.5 text-xs text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed"
                          >
                            Event full
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={rsvpLoadingId === e.id}
                            onClick={() => handleRsvpToggle(e.id)}
                            className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            {rsvpLoadingId === e.id ? (
                              'Updating...'
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5" />
                                RSVP Going
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            {/* Pagination Load More */}
            {pagination?.hasNextPage && (
              <div className="flex justify-center pt-4 pb-2">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="border-slate-300 text-slate-700"
                >
                  {loadingMore ? 'Loading more events...' : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Create / Edit Event Dialog */}
        <EventDialog
          open={dialogState.open}
          onOpenChange={(isOpen) =>
            setDialogState((prev) => ({ ...prev, open: isOpen }))
          }
          event={dialogState.event}
          onSaved={loadEvents}
        />
      </main>
    </div>
  );
}

