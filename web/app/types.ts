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
  quellen_urls?: string[];
  fehler?: string | null;
};

export type SpeisekartenPayload = {
  generated_at: string;
  model: string;
  anzahl_restaurants: number;
  restaurants: SpeisekartenRestaurant[];
};

export type ImpressumRestaurant = {
  name: string;
  website: string;
  impressum_url: string | null;
  inhaber_name: string | null;
  geschaeftsform: string | null;
  geschaeftsfuehrer: string | null;
  adresse: string | null;
  telefon: string | null;
  email: string | null;
  handelsregister: string | null;
  ust_id: string | null;
  verantwortlich_inhaltlich: string | null;
  fehler?: string | null;
};

export type ImpressumPayload = {
  generated_at: string;
  model: string;
  anzahl_restaurants: number;
  restaurants: ImpressumRestaurant[];
};
