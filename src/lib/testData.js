import { latLngToCell } from "h3-js";

// Generate some test H3 data for debugging
export function generateTestH3Data(resolution = 8) {
  // Sample locations around major US cities
  const locations = [
    { lat: 40.7128, lng: -74.0060, name: "NYC" },      // New York
    { lat: 34.0522, lng: -118.2437, name: "LA" },      // Los Angeles  
    { lat: 41.8781, lng: -87.6298, name: "Chicago" },  // Chicago
    { lat: 29.7604, lng: -95.3698, name: "Houston" },  // Houston
    { lat: 39.9526, lng: -75.1652, name: "Philly" },   // Philadelphia
  ];

  return locations.map((loc, i) => ({
    h3: latLngToCell(loc.lat, loc.lng, resolution),
    sum: Math.floor(Math.random() * 20) - 10, // Random value between -10 and 10
    count: Math.floor(Math.random() * 5) + 1,
  }));
}