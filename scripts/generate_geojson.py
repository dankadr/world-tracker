#!/usr/bin/env python3
"""
Download and process Japan prefectures & Australia states GeoJSON data
from Natural Earth admin-1 boundaries, then simplify and output.
"""
import json
import urllib.request
import ssl
import sys

# Natural Earth Admin-1 States Provinces (simplified, 10m)
NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson"

def download_natural_earth():
    """Download Natural Earth admin-1 data."""
    print("Downloading Natural Earth admin-1 data (~30MB)...", file=sys.stderr)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(NE_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120, context=ctx) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    print(f"Downloaded {len(data['features'])} features", file=sys.stderr)
    return data

def simplify_coords(coords, tolerance=0.01):
    """Simple Douglas-Peucker-like coordinate reduction."""
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        # Single coordinate pair - round to 3 decimal places
        return [round(c, 3) for c in coords]
    if isinstance(coords[0], list) and isinstance(coords[0][0], (int, float)):
        # List of coordinate pairs - simplify
        if len(coords) <= 4:
            return [[round(c, 3) for c in pt] for pt in coords]
        # Keep every Nth point for simplification
        n = max(1, len(coords) // max(50, len(coords) // 3))
        simplified = []
        for i, pt in enumerate(coords):
            if i == 0 or i == len(coords) - 1 or i % n == 0:
                simplified.append([round(c, 3) for c in pt])
        return simplified
    # Nested arrays (MultiPolygon rings)
    return [simplify_coords(ring, tolerance) for ring in coords]

def extract_country(ne_data, adm0_a3, valid_ids=None, name_map=None):
    """Extract and simplify features for a given country using adm0_a3 code."""
    features = []
    for f in ne_data["features"]:
        props = f.get("properties", {})
        if props.get("adm0_a3") != adm0_a3:
            continue
        
        region_name = props.get("name", "Unknown")
        region_id = props.get("iso_3166_2", props.get("code_local", region_name))
        # Clean up ID (remove country prefix like "JP-" or "AU-")
        if "-" in region_id:
            region_id = region_id.split("-")[-1]
        
        # Skip features not in the valid set (if specified)
        if valid_ids and region_id not in valid_ids:
            continue
        
        if name_map and region_name in name_map:
            region_name = name_map[region_name]
        
        geom = f.get("geometry", {})
        simplified_geom = {
            "type": geom["type"],
            "coordinates": simplify_coords(geom["coordinates"])
        }
        
        features.append({
            "type": "Feature",
            "properties": {
                "id": region_id,
                "name": region_name
            },
            "geometry": simplified_geom
        })
    
    return {"type": "FeatureCollection", "features": features}

def dedupe_features(geojson):
    """Keep only first feature per id."""
    seen = set()
    deduped = []
    for f in geojson["features"]:
        fid = f["properties"]["id"]
        if fid not in seen:
            seen.add(fid)
            deduped.append(f)
    return {"type": "FeatureCollection", "features": deduped}

def main():
    ne_data = download_natural_earth()
    
    # --- Japan ---
    print("Extracting Japan prefectures...", file=sys.stderr)
    japan = extract_country(ne_data, "JPN")
    print(f"  Found {len(japan['features'])} prefectures", file=sys.stderr)
    
    with open("src/data/japan.json", "w") as f:
        json.dump(japan, f, separators=(",", ":"))
    japan_size = len(json.dumps(japan, separators=(",", ":")))
    print(f"  Wrote src/data/japan.json ({japan_size/1024:.0f}KB)", file=sys.stderr)
    
    # --- Australia (only the 8 main states/territories) ---
    AUSTRALIA_IDS = {"NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT", "ACT"}
    print("Extracting Australia states...", file=sys.stderr)
    australia = extract_country(ne_data, "AUS", valid_ids=AUSTRALIA_IDS)
    australia = dedupe_features(australia)
    print(f"  Found {len(australia['features'])} states/territories", file=sys.stderr)
    
    with open("src/data/australia.json", "w") as f:
        json.dump(australia, f, separators=(",", ":"))
    aus_size = len(json.dumps(australia, separators=(",", ":")))
    print(f"  Wrote src/data/australia.json ({aus_size/1024:.0f}KB)", file=sys.stderr)
    
    print("Done!", file=sys.stderr)

if __name__ == "__main__":
    main()
