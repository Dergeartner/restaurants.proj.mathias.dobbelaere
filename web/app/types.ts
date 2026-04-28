export type Restaurant = {
  name: string;
  kategorie: string;
  adresse: string;
  stadtteil: string;
  cuisine: string;
  website: string;
  telefon: string;
  lat: number;
  lon: number;
  hat_website: boolean;
  lead_score: 1 | 2 | 3;
  auf_lieferando: boolean;
};

export type DataPayload = {
  generated_at: string;
  lieferando_partners_total: number;
  lieferando_snapshot_date: string;
  restaurants: Restaurant[];
};

export type PreisVergleichItem = {
  restaurant: string;
  gericht: string;
  preis_eigenseite: number;
  preis_lieferando: number;
};

export type PreisVergleichPayload = {
  stichtag: string;
  stichprobe_groesse: number;
  vergleiche: PreisVergleichItem[];
};

export type Gericht = {
  gericht: string;
  preis: number;
  kategorie: string;
};

export type SpeisekartenRestaurant = {
  name: string;
  website: string;
  speisekarten_url: string | null;
  anzahl_gerichte: number;
  gerichte: Gericht[];
  fehler?: string | null;
};

export type SpeisekartenPayload = {
  generated_at: string;
  model: string;
  anzahl_restaurants: number;
  restaurants: SpeisekartenRestaurant[];
};
