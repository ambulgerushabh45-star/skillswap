import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddressSearch from '@/components/AddressSearch';
import * as apiModule from '@/lib/api';

describe('AddressSearch component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders input and disables search button when query is shorter than 3 characters', () => {
    render(<AddressSearch onSelect={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Cubbon Park/i);
    const button = screen.getByRole('button', { name: /search address/i });

    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: 'ab' } });
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(button).not.toBeDisabled();
  });

  it('triggers geocoding search on button click and renders results', async () => {
    const onSelect = vi.fn();
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      results: [
        {
          label: 'Cubbon Park, Bengaluru, Karnataka, India',
          latitude: 12.976312345,
          longitude: 77.592912345,
        },
      ],
    });

    render(<AddressSearch onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/Cubbon Park/i);
    const button = screen.getByRole('button', { name: /search address/i });

    fireEvent.change(input, { target: { value: 'Cubbon Park' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(apiModule.apiFetch).toHaveBeenCalledWith(
        '/api/geocode?q=Cubbon%20Park'
      );
    });

    const resultItem = await screen.findByText(
      /Cubbon Park, Bengaluru, Karnataka, India/
    );
    expect(resultItem).toBeInTheDocument();

    fireEvent.click(resultItem);

    expect(onSelect).toHaveBeenCalledWith({
      label: 'Cubbon Park, Bengaluru, Karnataka, India',
      latitude: 12.976312,
      longitude: 77.592912,
    });
  });

  it('triggers geocoding search on Enter key press', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      results: [
        {
          label: 'MG Road, Bengaluru',
          latitude: 12.9755,
          longitude: 77.6067,
        },
      ],
    });

    render(<AddressSearch onSelect={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Cubbon Park/i);
    fireEvent.change(input, { target: { value: 'MG Road' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(apiModule.apiFetch).toHaveBeenCalledWith('/api/geocode?q=MG%20Road');
    });

    expect(await screen.findByText(/MG Road, Bengaluru/)).toBeInTheDocument();
  });

  it('ignores stale response when a subsequent search has been fired', async () => {
    let resolveFirst;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const apiSpy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() =>
        Promise.resolve({
          results: [
            {
              label: 'Indiranagar 100ft Road',
              latitude: 12.9719,
              longitude: 77.6412,
            },
          ],
        })
      );

    render(<AddressSearch onSelect={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Cubbon Park/i);
    const button = screen.getByRole('button', { name: /search address/i });

    // First search
    fireEvent.change(input, { target: { value: 'Koramangala' } });
    fireEvent.click(button);

    // Second search via Enter key while first is in flight
    fireEvent.change(input, { target: { value: 'Indiranagar' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Now resolve first search
    resolveFirst({
      results: [
        {
          label: 'Koramangala 4th Block',
          latitude: 12.9345,
          longitude: 77.6265,
        },
      ],
    });

    // Should only show results from the second search
    expect(await screen.findByText(/Indiranagar 100ft Road/)).toBeInTheDocument();
    expect(screen.queryByText(/Koramangala 4th Block/)).not.toBeInTheDocument();
  });

  it('displays error banner when geocoding API fails', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockRejectedValue(
      new apiModule.ApiError('Nominatim rate limit reached', 429)
    );

    render(<AddressSearch onSelect={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Cubbon Park/i);
    const button = screen.getByRole('button', { name: /search address/i });

    fireEvent.change(input, { target: { value: 'Jayanagar' } });
    fireEvent.click(button);

    expect(
      await screen.findByText(/Nominatim rate limit reached/)
    ).toBeInTheDocument();
  });

  it('renders OpenStreetMap attribution link', () => {
    render(<AddressSearch onSelect={vi.fn()} />);

    const link = screen.getByRole('link', {
      name: /OpenStreetMap contributors/i,
    });
    expect(link).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright'
    );
  });

  it('renders selected location confirmation and handles clear', () => {
    const onClear = vi.fn();
    render(
      <AddressSearch
        onSelect={vi.fn()}
        onClear={onClear}
        selectedLabel="Whitefield, Bengaluru"
        clearButtonText="Remove my location"
      />
    );

    expect(screen.getByText(/Location set:/i)).toBeInTheDocument();
    expect(screen.getByText(/Whitefield, Bengaluru/i)).toBeInTheDocument();

    const clearButton = screen.getByRole('button', { name: /remove my location/i });
    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
