import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Setup mock Leaflet methods and spies
const mockSetView = vi.fn().mockReturnThis();
const mockFitBounds = vi.fn().mockReturnThis();
const mockInvalidateSize = vi.fn();
const mockRemove = vi.fn();
const mockAddTo = vi.fn().mockReturnThis();
const mockClearLayers = vi.fn();
const mockBindPopup = vi.fn().mockReturnThis();

const mockLayerGroupInstance = {
  addTo: mockAddTo,
  clearLayers: mockClearLayers,
};

const mockMapInstance = {
  setView: mockSetView,
  fitBounds: mockFitBounds,
  invalidateSize: mockInvalidateSize,
  remove: mockRemove,
};

const mockMarkerInstance = {
  bindPopup: mockBindPopup,
  addTo: mockAddTo,
};

const mockMapConstructor = vi.fn(() => mockMapInstance);
const mockLayerGroupConstructor = vi.fn(() => mockLayerGroupInstance);
const mockMarkerConstructor = vi.fn(() => mockMarkerInstance);
const mockTileLayerConstructor = vi.fn(() => ({ addTo: mockAddTo }));
const mockLatLngBounds = vi.fn(() => ({}));

vi.mock('leaflet', () => {
  return {
    default: {
      map: (...args) => mockMapConstructor(...args),
      layerGroup: (...args) => mockLayerGroupConstructor(...args),
      marker: (...args) => mockMarkerConstructor(...args),
      tileLayer: (...args) => mockTileLayerConstructor(...args),
      latLngBounds: (...args) => mockLatLngBounds(...args),
      Icon: {
        Default: {
          prototype: {},
          mergeOptions: vi.fn(),
        },
      },
    },
  };
});

import MapView from '@/components/MapView';

describe('MapView component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes map once and configures OpenStreetMap tile layer', () => {
    render(<MapView events={[]} />);

    expect(mockMapConstructor).toHaveBeenCalledTimes(1);
    expect(mockTileLayerConstructor).toHaveBeenCalledWith(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.objectContaining({
        attribution: expect.stringContaining('OpenStreetMap'),
      })
    );
  });

  it('adds markers only for events with valid coordinates', () => {
    const events = [
      { id: '1', title: 'Valid Event 1', lat: 12.9716, lng: 77.5946 },
      { id: '2', title: 'Valid Event 2', lat: 12.975, lng: 77.6 },
      { id: '3', title: 'No Coords Event', lat: null, lng: null },
      { id: '4', title: 'Invalid Lat Event', lat: 150, lng: 77.5946 }, // Out of bounds
    ];

    render(<MapView events={events} />);

    // Marker should be created only for the 2 valid events
    expect(mockMarkerConstructor).toHaveBeenCalledTimes(2);
    expect(mockMarkerConstructor).toHaveBeenCalledWith([12.9716, 77.5946]);
    expect(mockMarkerConstructor).toHaveBeenCalledWith([12.975, 77.6]);
  });

  it('updates markers on prop change without recreating map instance', () => {
    const initialEvents = [
      { id: '1', title: 'Event 1', lat: 12.9716, lng: 77.5946 },
    ];
    const updatedEvents = [
      { id: '1', title: 'Event 1', lat: 12.9716, lng: 77.5946 },
      { id: '2', title: 'Event 2', lat: 13.0, lng: 77.6 },
    ];

    const { rerender } = render(<MapView events={initialEvents} />);
    expect(mockMapConstructor).toHaveBeenCalledTimes(1);
    expect(mockMarkerConstructor).toHaveBeenCalledTimes(1);

    // Rerender with updated events
    rerender(<MapView events={updatedEvents} />);

    // Map instance is NOT re-created
    expect(mockMapConstructor).toHaveBeenCalledTimes(1);
    // Layers are cleared and new markers added
    expect(mockClearLayers).toHaveBeenCalledTimes(2); // Initial mount + update
    expect(mockMarkerConstructor).toHaveBeenCalledTimes(3); // 1 + 2
  });

  it('removes map on unmount to prevent leaks and re-initialization errors', () => {
    const { unmount } = render(<MapView events={[]} />);
    expect(mockRemove).not.toHaveBeenCalled();

    unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('renders event text as plain text in popups, preventing XSS injection', () => {
    const xssTitle = '<img src=x onerror=alert("hacked") />';
    const xssLocation = '<script>window.pwned=true</script>';

    const events = [
      {
        id: 'xss-event',
        title: xssTitle,
        location: xssLocation,
        dateTime: '2026-10-28T14:00:00.000Z',
        lat: 12.9716,
        lng: 77.5946,
      },
    ];

    render(<MapView events={events} />);

    expect(mockBindPopup).toHaveBeenCalledTimes(1);
    const popupContent = mockBindPopup.mock.calls[0][0];

    // popupContent is a DOM Node
    expect(popupContent).toBeInstanceOf(HTMLElement);

    // Verify no <img> or <script> elements exist inside the container
    expect(popupContent.querySelector('img')).toBeNull();
    expect(popupContent.querySelector('script')).toBeNull();

    // Verify the raw text content contains the escaped string safely
    expect(popupContent.textContent).toContain(xssTitle);
    expect(popupContent.textContent).toContain(xssLocation);
  });

  it('renders Cancelled and Full badges in popup when applicable', () => {
    const events = [
      {
        id: 'cancelled-event',
        title: 'Cancelled Meetup',
        cancelled: true,
        lat: 12.9716,
        lng: 77.5946,
      },
      {
        id: 'full-event',
        title: 'Full Meetup',
        isFull: true,
        lat: 13.0,
        lng: 77.6,
      },
    ];

    render(<MapView events={events} />);

    expect(mockBindPopup).toHaveBeenCalledTimes(2);

    const cancelledPopup = mockBindPopup.mock.calls[0][0];
    expect(cancelledPopup.textContent).toContain('Cancelled');

    const fullPopup = mockBindPopup.mock.calls[1][0];
    expect(fullPopup.textContent).toContain('Full');
  });
});

