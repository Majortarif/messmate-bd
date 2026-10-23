"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MapPin = { id: string; lat: number; lng: number; title: string; subtitle?: string; href?: string };
type Point = { lat: number; lng: number };
type Leaflet = typeof import("leaflet");

/** Dhaka city centre, used when nothing else is known. */
export const DHAKA_CENTER: [number, number] = [23.7808, 90.3792];

// Leaflet's default marker images don't survive bundling; an HTML pin themes better anyway.
const pinIcon = (L: Leaflet) =>
  L.divIcon({ className: "mm-pin", html: "<span></span>", iconSize: [26, 34], iconAnchor: [13, 32], popupAnchor: [0, -30] });

/**
 * OpenStreetMap via Leaflet (loaded only in the browser).
 * - `pins`: markers with a small popup; `onOpen(href)` handles the popup link.
 * - `picker`: click or drag to set one point (listing location).
 */
export function GeoMap({
  pins = [],
  center,
  zoom = 13,
  picker,
  onOpen,
  label,
  className,
}: {
  pins?: MapPin[];
  center?: [number, number] | null;
  zoom?: number;
  picker?: { value: Point | null; onChange: (value: Point) => void };
  onOpen?: (href: string) => void;
  label: string;
  className?: string;
}) {
  const t = useTranslations("community.map");
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const lib = useRef<Leaflet | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const pickMarker = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  // keep the newest callbacks without re-creating the map
  const onChange = useRef(picker?.onChange);
  const openRef = useRef(onOpen);
  useEffect(() => {
    onChange.current = picker?.onChange;
    openRef.current = onOpen;
  });

  // create the map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !box.current || map.current) return;
      lib.current = L;
      const m = L.map(box.current, { scrollWheelZoom: false, zoomControl: true }).setView(center ?? DHAKA_CENTER, zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      }).addTo(m);
      layer.current = L.layerGroup().addTo(m);
      if (picker) {
        m.on("click", (e) => onChange.current?.({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) }));
      }
      map.current = m;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // the map is created once; later prop changes are applied by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pins
  useEffect(() => {
    const L = lib.current;
    const m = map.current;
    if (!ready || !L || !m || !layer.current) return;
    layer.current.clearLayers();
    for (const pin of pins) {
      const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon(L), title: pin.title, keyboard: true });
      const popup = document.createElement("div");
      const title = document.createElement("p");
      title.className = "mm-popup-title";
      title.textContent = pin.title;
      popup.append(title);
      if (pin.subtitle) {
        const sub = document.createElement("p");
        sub.className = "mm-popup-sub";
        sub.textContent = pin.subtitle;
        popup.append(sub);
      }
      if (pin.href) {
        const link = document.createElement("a");
        link.href = pin.href;
        link.className = "mm-popup-link";
        link.textContent = t("open");
        link.addEventListener("click", (e) => {
          if (!openRef.current) return;
          e.preventDefault();
          openRef.current(pin.href!);
        });
        popup.append(link);
      }
      marker.bindPopup(popup).addTo(layer.current);
    }
    if (pins.length > 1) m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [32, 32], maxZoom: 15 });
    else if (pins.length === 1) m.setView([pins[0].lat, pins[0].lng], Math.max(zoom, 15));
  }, [pins, ready, zoom, t]);

  // picker marker follows the value
  const value = picker?.value ?? null;
  useEffect(() => {
    const L = lib.current;
    const m = map.current;
    if (!ready || !L || !m || !picker) return;
    if (!value) {
      pickMarker.current?.remove();
      pickMarker.current = null;
      return;
    }
    if (!pickMarker.current) {
      pickMarker.current = L.marker([value.lat, value.lng], { icon: pinIcon(L), draggable: true, keyboard: true }).addTo(m);
      pickMarker.current.on("dragend", () => {
        const p = pickMarker.current!.getLatLng();
        onChange.current?.({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) });
      });
    } else {
      pickMarker.current.setLatLng([value.lat, value.lng]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, value?.lat, value?.lng]);

  // re-centre when the chosen area changes (picker forms)
  useEffect(() => {
    if (ready && center && map.current && !value) map.current.setView(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, center?.[0], center?.[1]]);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const point = { lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) };
        onChange.current?.(point);
        map.current?.setView([point.lat, point.lng], 16);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className={cn("mm-map relative isolate overflow-hidden rounded-2xl border bg-muted", className)}>
      <div ref={box} className="size-full" role="region" aria-label={label} />
      {!ready && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{t("loading")}</p>}
      {picker && (
        <Button type="button" size="sm" variant="secondary" className="absolute right-2 top-2 z-[500] shadow" onClick={locate} disabled={locating}>
          <LocateFixed className="size-4" aria-hidden="true" />
          {t("myLocation")}
        </Button>
      )}
    </div>
  );
}
