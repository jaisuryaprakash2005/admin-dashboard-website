import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Check, Crosshair, MapPin, Search, X, Loader2 } from 'lucide-react';
import Modal from './Modal.jsx';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

mapboxgl.accessToken = MAPBOX_TOKEN;

const STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

export default function LocationPickerModal({
  isOpen,
  onClose,
  onSelectLocation,
  initialAddress = '',
  initialLocality = '',
  initialCity = '',
  initialLat = null,
  initialLng = null,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const searchContainerRef = useRef(null);

  const [activeStyle, setActiveStyle] = useState('streets');
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live autocomplete search as user types
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          q
        )}.json?access_token=${MAPBOX_TOKEN}&country=IN&limit=5`;
        const res = await fetch(url);
        const data = await res.json();
        setSearchResults(data.features || []);
      } catch (err) {
        console.warn('[MapboxPicker] Autocomplete error:', err.message);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Resolved details
  const [coords, setCoords] = useState({ lat: 13.0827, lng: 80.2707 }); // Default: Chennai
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [resolvedLocality, setResolvedLocality] = useState('');
  const [resolvedCity, setResolvedCity] = useState('');
  const [resolvedPostalCode, setResolvedPostalCode] = useState('');

  // ── Reverse geocode using Mapbox Geocoding API ─────────────────────────────
  const reverseGeocode = async (lng, lat) => {
    setLoadingGeo(true);
    setCoords({ lat, lng });

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&country=IN`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Mapbox reverse geocode failed');
      const data = await res.json();

      if (data.features && data.features.length > 0) {
        const primary = data.features[0];
        const ctx = primary.context || [];

        // 1. Postal Code (PIN code)
        const postObj = ctx.find((c) => c.id.startsWith('postcode'));
        const postalCode = postObj ? postObj.text : '';

        // 2. Locality / Suburb / Neighborhood
        const locObj =
          ctx.find((c) => c.id.startsWith('locality')) ||
          ctx.find((c) => c.id.startsWith('neighborhood')) ||
          ctx.find((c) => c.id.startsWith('subdistrict'));
        const locality = locObj ? locObj.text : '';

        // 3. City / Place
        const placeObj =
          ctx.find((c) => c.id.startsWith('place')) ||
          ctx.find((c) => c.id.startsWith('district'));
        const city = placeObj ? placeObj.text : '';

        // 4. Street Address
        let cleanAddress = primary.place_name || '';
        if (cleanAddress.includes(',')) {
          // Take first 3 parts of place_name for clean address
          const parts = cleanAddress.split(',').map((s) => s.trim());
          cleanAddress = parts.slice(0, 3).join(', ');
        }

        setResolvedAddress(cleanAddress);
        setResolvedLocality(locality);
        setResolvedCity(city);
        setResolvedPostalCode(postalCode);
      } else {
        // Fallback to nominatim if mapbox had no match
        await fallbackReverseGeocode(lat, lng);
      }
    } catch (err) {
      console.warn('[MapboxPicker] Reverse geocode error:', err.message);
      await fallbackReverseGeocode(lat, lng);
    } finally {
      setLoadingGeo(false);
    }
  };

  const fallbackReverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const addr = data.address || {};

      const city =
        addr.city ||
        addr.town ||
        addr.municipality ||
        addr.city_district ||
        addr.county ||
        '';
      let locality =
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.subdistrict ||
        '';
      locality = locality.replace(/^Zone\s+\d+\s+/i, '').replace(/^Ward\s+\d+\s+/i, '').trim();

      const postalMatch = (addr.postcode || '').match(/\b\d{6}\b/);
      const postalCode = postalMatch ? postalMatch[0] : '';

      const parts = (data.display_name || '').split(',').map((s) => s.trim());
      const cleanAddress = parts.slice(0, 3).join(', ');

      setResolvedAddress(cleanAddress || data.display_name || '');
      setResolvedLocality(locality);
      setResolvedCity(city);
      setResolvedPostalCode(postalCode);
    } catch (e) {
      console.warn('[MapboxPicker] Fallback geocode error:', e.message);
    }
  };

  // ── Initialize Mapbox map on modal open ────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setSearchResults([]);
      setSearchQuery('');
      return;
    }

    setSearchResults([]);
    setSearchQuery('');

    const hasInitialCoords =
      initialLat != null &&
      initialLng != null &&
      !isNaN(Number(initialLat)) &&
      !isNaN(Number(initialLng));

    let defaultLng = hasInitialCoords ? Number(initialLng) : 80.2707;
    let defaultLat = hasInitialCoords ? Number(initialLat) : 13.0827;

    setCoords({ lat: defaultLat, lng: defaultLng });
    if (initialAddress) setResolvedAddress(initialAddress);
    if (initialCity) setResolvedCity(initialCity);

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // 1. Create Mapbox Map
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: STYLES[activeStyle],
        center: [defaultLng, defaultLat],
        zoom: hasInitialCoords ? 15.5 : 14,
        attributionControl: false,
      });
      mapRef.current = map;

      // 2. Navigation controls (zoom + compass)
      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

      // 3. Add Draggable Pin Marker
      const marker = new mapboxgl.Marker({
        draggable: true,
        color: '#EA4335', // Google / ProBridge Red
      })
        .setLngLat([defaultLng, defaultLat])
        .addTo(map);
      markerRef.current = marker;

      // Marker drag event
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        reverseGeocode(lngLat.lng, lngLat.lat);
      });

      // Map click event
      map.on('click', (e) => {
        setSearchResults([]);
        marker.setLngLat(e.lngLat);
        reverseGeocode(e.lngLat.lng, e.lngLat.lat);
      });

      map.on('load', async () => {
        map.resize();
        const addressQuery = [initialAddress, initialLocality, initialCity]
          .filter(Boolean)
          .join(', ')
          .trim();

        if (addressQuery) {
          // Locate and pin on map based on property address
          await searchAndFly(addressQuery, map, marker, false);
        } else if (hasInitialCoords) {
          map.flyTo({ center: [defaultLng, defaultLat], zoom: 15.5 });
          marker.setLngLat([defaultLng, defaultLat]);
          reverseGeocode(defaultLng, defaultLat);
        } else {
          reverseGeocode(defaultLng, defaultLat);
        }
      });
    }, 120);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isOpen]);

  // ── Switch Map Style (Streets vs Satellite) ────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(STYLES[activeStyle]);
  }, [activeStyle]);

  // ── Search & Fly using Mapbox Places API ───────────────────────────────────
  const searchAndFly = async (queryText, targetMap, targetMarker, showDropdown = false) => {
    if (!queryText.trim()) return;
    setSearching(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        queryText
      )}.json?access_token=${MAPBOX_TOKEN}&country=IN&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      const features = data.features || [];
      if (showDropdown) {
        setSearchResults(features);
      } else {
        setSearchResults([]);
      }

      if (features.length > 0) {
        const [lng, lat] = features[0].center;
        const map = targetMap || mapRef.current;
        const marker = targetMarker || markerRef.current;

        if (map && marker) {
          map.flyTo({ center: [lng, lat], zoom: 16, essential: true });
          marker.setLngLat([lng, lat]);
          reverseGeocode(lng, lat);
        }
      }
    } catch (err) {
      console.warn('[MapboxPicker] Search error:', err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (feature) => {
    setSearchResults([]);
    setSearchQuery(feature.place_name.split(',').slice(0, 2).join(', '));
    const [lng, lat] = feature.center;

    if (mapRef.current && markerRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 16, essential: true });
      markerRef.current.setLngLat([lng, lat]);
      reverseGeocode(lng, lat);
    }
  };

  // ── Locate Me (Browser Geolocation) ────────────────────────────────────────
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapRef.current && markerRef.current) {
          mapRef.current.flyTo({ center: [longitude, latitude], zoom: 16, essential: true });
          markerRef.current.setLngLat([longitude, latitude]);
          reverseGeocode(longitude, latitude);
        }
      },
      () => {
        alert('Could not access your location. Please check browser permissions.');
        setLoadingGeo(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // ── Confirm & Transfer data to form ────────────────────────────────────────
  const handleConfirm = () => {
    if (!resolvedAddress) {
      alert('Please click on the map to pin a location first.');
      return;
    }
    onSelectLocation?.({
      address: resolvedAddress,
      locality: resolvedLocality,
      city: resolvedCity,
      postalCode: resolvedPostalCode,
      lat: coords.lat,
      lng: coords.lng,
    });
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <Modal wide title="📍 Pin Location on Mapbox" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ── Top controls (Search, Locate Me, Layer Switcher) ──────────────── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative', zIndex: 100 }}>
          <div ref={searchContainerRef} style={{ position: 'relative', flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0 12px',
                background: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                width: '100%',
              }}
            >
              <Search size={16} color="var(--muted)" style={{ flexShrink: 0 }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchResults.length > 0) {
                      handleSelectSearchResult(searchResults[0]);
                    } else {
                      searchAndFly(searchQuery, null, null, false);
                    }
                  } else if (e.key === 'Escape') {
                    setSearchResults([]);
                  }
                }}
                placeholder="Search area, landmark, or street with Mapbox (e.g. OMR Chennai, Indiranagar)..."
                style={{
                  border: 0,
                  padding: '9px 0',
                  outline: 'none',
                  flex: 1,
                  width: '100%',
                  fontSize: 13,
                  background: 'transparent',
                }}
              />
              {searching && <Loader2 size={16} className="spin" color="var(--accent)" style={{ flexShrink: 0 }} />}
              {searchQuery && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  title="Clear search"
                  style={{ padding: 4, flexShrink: 0 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
                  zIndex: 1000,
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                {searchResults.map((feature, idx) => (
                  <div
                    key={feature.id || idx}
                    onClick={() => handleSelectSearchResult(feature)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: idx === searchResults.length - 1 ? 'none' : '1px solid #f1f5f9',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
                  >
                    <MapPin size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <span style={{ color: 'var(--text)', lineHeight: 1.3, flex: 1 }}>{feature.place_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => {
              if (searchResults.length > 0) {
                handleSelectSearchResult(searchResults[0]);
              } else {
                searchAndFly(searchQuery, null, null, false);
              }
            }}
            disabled={!searchQuery.trim() || searching}
            title="Search with Mapbox"
            style={{ flexShrink: 0 }}
          >
            Search
          </button>

          {/* Locate Me */}
          <button
            type="button"
            className="btn"
            onClick={handleLocateMe}
            title="Find My Current Location"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Crosshair size={16} color="var(--accent)" />
            <span>Locate Me</span>
          </button>

          {/* Map Style Switcher */}
          <div className="seg" style={{ marginLeft: 0 }}>
            <button
              type="button"
              className={activeStyle === 'streets' ? 'on' : ''}
              onClick={() => setActiveStyle('streets')}
              title="Mapbox Streets"
            >
              Streets
            </button>
            <button
              type="button"
              className={activeStyle === 'satellite' ? 'on' : ''}
              onClick={() => setActiveStyle('satellite')}
              title="Mapbox Satellite"
            >
              Satellite
            </button>
          </div>
        </div>

        {/* ── Mapbox Map Container ─────────────────────────────────────────── */}
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div
            ref={mapContainerRef}
            style={{
              height: 380,
              width: '100%',
              backgroundColor: '#e2e8f0',
            }}
          />

          {/* Helper hint pill */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              zIndex: 10,
              background: 'rgba(15, 23, 42, 0.85)',
              color: '#fff',
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              pointerEvents: 'none',
            }}
          >
            <MapPin size={13} color="#f87171" />
            <span>Click map or drag the pin to set exact location</span>
          </div>

          {/* Loading indicator */}
          {loadingGeo && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 60,
                zIndex: 10,
                background: '#fff',
                color: 'var(--accent)',
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <Loader2 size={13} className="spin" />
              <span>Fetching address with Mapbox…</span>
            </div>
          )}
        </div>

        {/* ── Pinned Location Details Card ─────────────────────────────────── */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={16} color="#EA4335" />
              Pinned Location Details
            </span>
            <small style={{ color: 'var(--muted)' }}>
              Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
            </small>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, display: 'block', marginBottom: 3 }}>
              Resolved Address (will automatically fill the Address field):
            </label>
            <input
              value={resolvedAddress}
              onChange={(e) => setResolvedAddress(e.target.value)}
              placeholder="Click anywhere on the map above to pin location..."
              style={{
                fontSize: 13,
                fontWeight: 500,
                background: '#fafbfd',
                borderColor: '#cbd5e1',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>City:</span>
              <strong style={{ fontSize: 13, color: resolvedCity ? 'var(--text)' : 'var(--muted)' }}>
                {resolvedCity || '—'}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Locality:</span>
              <strong style={{ fontSize: 13, color: resolvedLocality ? 'var(--text)' : 'var(--muted)' }}>
                {resolvedLocality || '—'}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>PIN Code:</span>
              <strong style={{ fontSize: 13, color: resolvedPostalCode ? 'var(--text)' : 'var(--muted)' }}>
                {resolvedPostalCode || '—'}
              </strong>
            </div>
          </div>
        </div>

        {/* ── Modal Footer Buttons ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!resolvedAddress.trim() || loadingGeo}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Check size={16} />
            <span>Confirm & Fill Address</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
