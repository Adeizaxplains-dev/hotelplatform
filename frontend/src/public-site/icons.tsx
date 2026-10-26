import {
  Accessibility, BedDouble, Baby, Bath, BellRing, Bed, Briefcase, Building2, BrushCleaning, Car, CarFront, Check, Clock, Coffee, ConciergeBell,
  CookingPot, CupSoda, DoorClosed, Dumbbell, Flower2, Heart, Laptop, Leaf, Lock, MapPin, Moon, Music, Plane, Refrigerator, ShieldCheck, ShowerHead,
  Shirt, Snowflake, Sofa, Sparkles, Star, Sun, Sunrise, TreePalm, Tv, Users, Utensils, WashingMachine, Waves, Wifi, Wind, Wine, Zap, type LucideIcon,
} from "lucide-react";

/** Only the icons the catalogue offers are bundled (importing the whole library would add hundreds of KB). */
const ICONS: Record<string, LucideIcon> = {
  Accessibility, Baby, Bath, Bed, BedDouble, BellRing, Briefcase, Building2, BrushCleaning, Car, CarFront, Check, Clock, Coffee, ConciergeBell, CookingPot, CupSoda,
  DoorClosed, Dumbbell, Flower2, Heart, Laptop, Leaf, Lock, MapPin, Moon, Music, Plane, Refrigerator, ShieldCheck, ShowerHead, Shirt, Snowflake, Sofa, Sparkles,
  Star, Sun, Sunrise, TreePalm, Tv, Users, Utensils, WashingMachine, Waves, Wifi, Wind, Wine, Zap,
};

export function NamedIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" />;
}

const PATHS: Record<string, string> = {
  facebook: "M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.5V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z",
  instagram: "M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3Zm0 1.8A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7h-9ZM12 7.7a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6Zm0 1.8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm4.7-3.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
  x: "M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z",
  youtube: "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z",
  tiktok: "M16.6 3h-3v11.6a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9a5.6 5.6 0 1 0 4.8 5.6V8.9a6.6 6.6 0 0 0 3.8 1.2V7.1a3.8 3.8 0 0 1-3.8-4.1Z",
};

export function SocialIcon({ name, className }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}
