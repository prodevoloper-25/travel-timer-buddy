
import { useEffect, useState, useRef } from "react";
import useSound from "use-sound";
import { Button } from "@/components/ui/button";
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
import { motion, AnimatePresence } from "framer-motion";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const Index = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const destinationMarker = useRef<L.Marker | null>(null);
  const watchId = useRef<number | null>(null);
  
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);
  const [destination, setDestination] = useState<{lat: number; lng: number} | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isAlarming, setIsAlarming] = useState(false);
  
  const { toast } = useToast();
  const [playAlarm] = useSound('/alarm.mp3', { volume: 1 });

  // Custom icon for markers
  const createIcon = (color: string) => {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white;"></div>`,
      iconSize: [16, 16],
    });
  };

  useEffect(() => {
    if (mapRef.current && !map.current) {
      // Initialize map
      map.current = L.map(mapRef.current).setView([51.5074, -0.1278], 13);
      
      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map.current);

      // Add click listener for setting destination
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

      // Get current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setCurrentLocation(pos);
            map.current?.setView([pos.lat, pos.lng], 13);

            if (marker.current) {
              marker.current.remove();
            }

            marker.current = L.marker([pos.lat, pos.lng], {
              icon: createIcon('#3B82F6')
            }).addTo(map.current!);
          },
          () => {
            toast({
              title: "Error",
              description: "Unable to get your location",
              variant: "destructive",
            });
          }
        );
      }
    }

    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      if (map.current) {
        map.current.remove();
      }
    };
  }, [toast, isMonitoring]);

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

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentLocation(pos);
        
        if (marker.current) {
          marker.current.setLatLng([pos.lat, pos.lng]);
        }

        if (destination) {
          const dist = calculateDistance(pos, destination);
          setDistance(dist / 1000); // Convert to kilometers

          if (dist <= 1000 && !isAlarming) { // 1000 meters = 1 km
            setIsAlarming(true);
            playAlarm();
          }
        }
      },
      () => {
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
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    if (destinationMarker.current) {
      destinationMarker.current.remove();
    }
    setDestination(null);
    setDistance(null);
    toast({
      title: "Alarm Stopped",
      description: "Have a great day!",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative w-full h-screen">
        {/* Map Container */}
        <div ref={mapRef} className="w-full h-full" />
        
        {/* Control Panel */}
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md"
          >
            <Card className="backdrop-blur-md bg-white/90 shadow-lg border-0">
              <CardHeader className="space-y-1">
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
                    ? "Tap the map to set your destination"
                    : isMonitoring
                    ? "We'll wake you up when you're close"
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
                    onClick={stopAlarm}
                  >
                    Cancel
                  </Button>
                </CardFooter>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;
