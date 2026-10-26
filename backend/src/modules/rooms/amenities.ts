/**
 * Amenity catalogue. Defined in code (like roles and plans) so every hotel uses the same keys and the
 * public site can show the right icon. Hotels choose from these; free-text amenities are not supported.
 * `icon` is a lucide-react icon name used by the frontend.
 */
export const AMENITIES = [
  { key: "wifi", label: "Free Wi-Fi", icon: "Wifi", group: "Connectivity" },
  { key: "ac", label: "Air conditioning", icon: "Snowflake", group: "Comfort" },
  { key: "tv", label: "Smart TV", icon: "Tv", group: "Entertainment" },
  { key: "breakfast", label: "Breakfast included", icon: "Coffee", group: "Food & drink" },
  { key: "minibar", label: "Minibar", icon: "Wine", group: "Food & drink" },
  { key: "kettle", label: "Kettle & tea", icon: "CupSoda", group: "Food & drink" },
  { key: "fridge", label: "Refrigerator", icon: "Refrigerator", group: "Food & drink" },
  { key: "desk", label: "Work desk", icon: "Laptop", group: "Work" },
  { key: "safe", label: "In-room safe", icon: "Lock", group: "Safety" },
  { key: "ensuite", label: "Private bathroom", icon: "Bath", group: "Bathroom" },
  { key: "shower", label: "Rain shower", icon: "ShowerHead", group: "Bathroom" },
  { key: "bathtub", label: "Bathtub", icon: "Bath", group: "Bathroom" },
  { key: "hairdryer", label: "Hairdryer", icon: "Wind", group: "Bathroom" },
  { key: "toiletries", label: "Toiletries", icon: "Sparkles", group: "Bathroom" },
  { key: "balcony", label: "Balcony", icon: "Sunrise", group: "Space" },
  { key: "seating", label: "Seating area", icon: "Sofa", group: "Space" },
  { key: "kitchenette", label: "Kitchenette", icon: "CookingPot", group: "Space" },
  { key: "iron", label: "Iron & board", icon: "Shirt", group: "Comfort" },
  { key: "wardrobe", label: "Wardrobe", icon: "DoorClosed", group: "Comfort" },
  { key: "blackout", label: "Blackout curtains", icon: "Moon", group: "Comfort" },
  { key: "generator", label: "24h power backup", icon: "Zap", group: "Comfort" },
  { key: "parking", label: "Free parking", icon: "CarFront", group: "Services" },
  { key: "roomservice", label: "Room service", icon: "BellRing", group: "Services" },
  { key: "laundry", label: "Laundry service", icon: "WashingMachine", group: "Services" },
  { key: "airport", label: "Airport pickup", icon: "Plane", group: "Services" },
  { key: "cleaning", label: "Daily housekeeping", icon: "BrushCleaning", group: "Services" },
  { key: "accessible", label: "Accessible room", icon: "Accessibility", group: "Access" },
  { key: "seaview", label: "Sea view", icon: "Waves", group: "View" },
  { key: "cityview", label: "City view", icon: "Building2", group: "View" },
  { key: "gardenview", label: "Garden view", icon: "TreePalm", group: "View" },
] as const;

export type AmenityKey = (typeof AMENITIES)[number]["key"];
export const AMENITY_KEYS = AMENITIES.map((a) => a.key) as [AmenityKey, ...AmenityKey[]];

/** Icons a hotel can choose for facilities and "why choose us" items. */
export const FEATURE_ICONS = [
  "Waves", "Utensils", "Dumbbell", "Car", "Wifi", "Sparkles", "ShieldCheck", "Clock", "MapPin", "Heart", "Star", "Coffee",
  "Briefcase", "Users", "Music", "Flower2", "Baby", "Plane", "Zap", "Leaf", "Wine", "ConciergeBell", "Bed", "Sun",
] as const;
export type FeatureIcon = (typeof FEATURE_ICONS)[number];
