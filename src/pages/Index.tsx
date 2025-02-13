import { useEffect, useState, useRef } from "react";
import useSound from "use-sound";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const Index = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const destinationMarker = useRef<L.Marker | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const watchId = useRef<number | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);
  const [destination, setDestination] = useState<{lat: number; lng: number} | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isAlarming, setIsAlarming] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const { toast } = useToast();
  const [playAlarm, { stop: stopAlarmSound }] = useSound('/alarm.mp3', { 
    volume: 1.0,
    interrupt: true,
    loop: true
  });

  const createIcon = (color: string) => {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white;"></div>`,
      iconSize: [16, 16],
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      let searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.toLowerCase())}`;
      if (currentLocation) {
        const delta = 0.9; // roughly 100km
        const viewbox = [
          currentLocation.lng - delta,
          currentLocation.lat - delta,
          currentLocation.lng + delta,
          currentLocation.lat + delta
        ].join(',');
        searchUrl += `&viewbox=${viewbox}&bounded=1`;
      }

      const response = await fetch(searchUrl);
      const data = await response.json();
      
      if (data && data[0]) {
        const { lat, lon } = data[0];
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        
        map.current?.setView([latNum, lonNum], 13);
        setDestination({ lat: latNum, lng: lonNum });
        
        if (destinationMarker.current) {
          destinationMarker.current.remove();
        }
        
        destinationMarker.current = L.marker([latNum, lonNum], {
          icon: createIcon('#22C55E')
        }).addTo(map.current!);
        
        setSearchQuery("");
        setSearchResults([]);
      } else {
        toast({
          title: "Location not found",
          description: "Please try a different search term",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Search failed",
        description: "Unable to search for location",
        variant: "destructive",
      });
    }
  };

  const handleSearchInput = async (value: string) => {
    const searchValue = value.toLowerCase();
    setSearchQuery(value);
    if (searchValue.length < 3) {
      setSearchResults([]);
      return;
    }

    try {
      let searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchValue)}`;
      if (currentLocation) {
        const delta = 0.9; // roughly 100km
        const viewbox = [
          currentLocation.lng - delta,
          currentLocation.lat - delta,
          currentLocation.lng + delta,
          currentLocation.lat + delta
        ].join(',');
        searchUrl += `&viewbox=${viewbox}&bounded=1`;
      }

      const response = await fetch(searchUrl);
      const data = await response.json();
      
      if (currentLocation) {
        data.sort((a: any, b: any) => {
          const distA = calculateDistance(currentLocation, { lat: parseFloat(a.lat), lng: parseFloat(a.lon) });
          const distB = calculateDistance(currentLocation, { lat: parseFloat(b.lat), lng: parseFloat(b.lon) });
          return distA - distB;
        });
      }
      
      setSearchResults(data.slice(0, 5)); // Limit to 5 closest results
    } catch (error) {
      console.error('Failed to fetch search suggestions:', error);
    }
  };

  const calculateDistance = (pos1: {lat: number; lng: number}, pos2: {lat: number; lng: number}) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = pos1.lat * Math.PI/180;
    const φ2 = pos2.lat * Math.PI/180;
    const Δφ = (pos2.lat - pos1.lat) * Math.PI/180;
    const Δλ = (pos2.lng - pos1.lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  const updateCurrentLocation = (position: GeolocationPosition) => {
    const pos = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
    setCurrentLocation(pos);
    
    if (!map.current) return;

    // Update or create the marker
    if (marker.current) {
      marker.current.setLatLng([pos.lat, pos.lng]);
    } else {
      marker.current = L.marker([pos.lat, pos.lng], {
        icon: createIcon('#3B82F6')
      }).addTo(map.current);
    }

    // Update or create the accuracy circle
    if (circle.current) {
      circle.current.setLatLng([pos.lat, pos.lng]);
    } else {
      circle.current = L.circle([pos.lat, pos.lng], {
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.1,
        radius: 1000 // 1km radius
      }).addTo(map.current);
    }

    // Center map on current location
    map.current.setView([pos.lat, pos.lng], map.current.getZoom());
  };

  const startMonitoring = () => {
    if (!destination) {
      toast({
        title: "No destination set",
        description: "Please select a destination on the map first",
        variant: "destructive",
      });
      return;
    }

    setIsMonitoring(true);
    toast({
      title: "Alarm Set",
      description: "We'll wake you up when you're close to your destination",
    });

    // Clear any existing watch
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
    }

    // Make sure destination marker is visible
    if (!destinationMarker.current && destination) {
      destinationMarker.current = L.marker([destination.lat, destination.lng], {
        icon: createIcon('#22C55E')
      }).addTo(map.current!);
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        updateCurrentLocation(position);

        if (destination) {
          const dist = calculateDistance(
            { lat: position.coords.latitude, lng: position.coords.longitude },
            destination
          );
          setDistance(dist / 1000); // Convert to kilometers

          if (dist <= 1000 && !isAlarming) { // 1000 meters = 1 km
            setIsAlarming(true);
            playAlarm(); // This will now loop the alarm sound
            toast({
              title: "Destination Reached!",
              description: "You are within 1km of your destination",
            });
          }
        }
      },
      (error) => {
        toast({
          title: "Error",
          description: "Unable to track your location",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      }
    );
  };

  const stopAlarm = () => {
    setIsAlarming(false);
    setIsMonitoring(false);
    stopAlarmSound(); // Stop the alarm sound
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    setDistance(null);
    toast({
      title: "Alarm Stopped",
      description: "Have a great day!",
    });
  };

  const cancelMonitoring = () => {
    setIsMonitoring(false);
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setDistance(null);
    toast({
      title: "Monitoring Cancelled",
      description: "Destination remains set",
    });
  };

  useEffect(() => {
    if (mapRef.current && !map.current) {
      map.current = L.map(mapRef.current).setView([51.5074, -0.1278], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map.current);

      map.current.on('click', (e: L.LeafletMouseEvent) => {
        if (!isMonitoring) {
          const newDest = { lat: e.latlng.lat, lng: e.latlng.lng };
          setDestination(newDest);

          if (destinationMarker.current) {
            destinationMarker.current.remove();
          }

          destinationMarker.current = L.marker(e.latlng, {
            icon: createIcon('#22C55E')
          }).addTo(map.current!);
        }
      });

      if (!navigator.geolocation) {
        toast({
          title: "Geolocation not supported",
          description: "Your browser doesn't support location services. Please use the search feature instead.",
          variant: "destructive",
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        updateCurrentLocation,
        (error) => {
          let errorMessage = "Unable to get your location. ";
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += "Please enable location services in your browser settings.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage += "Location request timed out.";
              break;
            default:
              errorMessage += "An unknown error occurred.";
          }
          
          toast({
            title: "Location Error",
            description: errorMessage,
            variant: "destructive",
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }

    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      if (map.current) {
        if (marker.current) marker.current.remove();
        if (destinationMarker.current) destinationMarker.current.remove();
        if (circle.current) circle.current.remove();
        map.current.remove();
        map.current = null;
      }
    };
  }, [toast]);  // Removed isMonitoring from dependencies as it was causing marker issues

  return (
    <div className="min-h-screen bg-gray-50 relative p-4">
      <div className="absolute inset-0 z-0" style={{ height: "calc(100vh - 200px)" }}>
        <div ref={mapRef} className="w-full h-full rounded-lg shadow-lg" />
      </div>
      
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md z-10">
        <Card className="backdrop-blur-md bg-white/90 shadow-lg border-0">
          <CardHeader className="space-y-1">
            <div className="relative">
              <form onSubmit={handleSearch} className="flex gap-2 mb-2">
                <Input
                  type="text"
                  placeholder="Search for a location..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="secondary">Search</Button>
              </form>
              {searchResults.length > 0 && (
                <div className="absolute w-full bg-white shadow-lg rounded-md mt-1 z-50">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setSearchQuery(result.display_name);
                        const latNum = parseFloat(result.lat);
                        const lonNum = parseFloat(result.lon);
                        map.current?.setView([latNum, lonNum], 13);
                        setDestination({ lat: latNum, lng: lonNum });
                        if (destinationMarker.current) {
                          destinationMarker.current.remove();
                        }
                        destinationMarker.current = L.marker([latNum, lonNum], {
                          icon: createIcon('#22C55E')
                        }).addTo(map.current!);
                        setSearchResults([]);
                      }}
                    >
                      {result.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white">
                {isMonitoring ? "Active" : "Ready"}
              </Badge>
              {distance !== null && (
                <Badge variant="outline" className="bg-white">
                  {distance.toFixed(1)} km away
                </Badge>
              )}
            </div>
            <CardTitle className="text-2xl">Travel Timer</CardTitle>
            <CardDescription>
              {!destination
                ? "Search or tap the map to set your destination"
                : isMonitoring
                ? `${distance ? distance.toFixed(1) + " km" : "Calculating..."} from destination`
                : "Ready to start monitoring?"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isAlarming ? (
              <Button
                variant="destructive"
                className="w-full text-lg py-6"
                onClick={stopAlarm}
              >
                Stop Alarm
              </Button>
            ) : (
              <Button
                variant="default"
                className="w-full text-lg py-6"
                onClick={startMonitoring}
                disabled={!destination || isMonitoring}
              >
                {isMonitoring ? "Monitoring..." : "Set Alarm"}
              </Button>
            )}
          </CardContent>
          {isMonitoring && (
            <CardFooter>
              <Button
                variant="ghost"
                className="w-full"
                onClick={cancelMonitoring}
              >
                Cancel
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Index;
