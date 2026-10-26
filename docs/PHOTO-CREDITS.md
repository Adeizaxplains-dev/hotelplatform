# Representative hotel photography

The frontend uses photographs from the Unsplash image CDN as representative demo/fallback images when a hotel has not uploaded its own photography. The images are not assertions that a particular property has these exact rooms or facilities. The public gallery and administration guidance identify them as representative photography.

Image CDN sources used by `frontend/src/public-site/photoDefaults.ts`:

- https://images.unsplash.com/photo-1611892440504-42a792e24d32
- https://images.unsplash.com/photo-1582719478250-c89cae4dc85b
- https://images.unsplash.com/photo-1618773928121-c32242e63f39
- https://images.unsplash.com/photo-1566665797739-1674de7a421a
- https://images.unsplash.com/photo-1590490360182-c33d57733427
- https://images.unsplash.com/photo-1631049307264-da0ec9d70304
- https://images.unsplash.com/photo-1571896349842-33c89424de2d
- https://images.unsplash.com/photo-1566073771259-6a8506099945
- https://images.unsplash.com/photo-1517248135467-4c7edcad34c4
- https://images.unsplash.com/photo-1564501049412-61c2a3083791

Review the current terms at https://unsplash.com/license before commercial launch. Replace representative images with property-specific photographs that the hotel owns or is authorized to use. These fallback images are served remotely, so the browser needs internet access to load them.
