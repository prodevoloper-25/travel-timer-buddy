
import { useEffect, useState, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";
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

const Index = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const destinationMarker = useRef<google.maps.Marker | null>(null);
  const watchId = useRef<number | null>(null);
  
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);
  const [destination, setDestination] = useState<{lat: number; lng: number} | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isAlarming, setIsAlarming] = useState(false);
  
  const { toast } = useToast();
  const [playAlarm] = useSound('/alarm.mp3', { volume: 1 });

  useEffect(() => {
    // Initialize Google Maps
    const loader = new Loader({
      apiKey: "YOUR_GOOGLE_MAPS_API_KEY",
      version: "weekly",
      libraries: ["places", "geometry"]
    });

    loader.load().then(() => {
      if (mapRef.current) {
        map.current = new google.maps.Map(mapRef.current, {
          center: { lat: 51.5074, lng: -0.1278 },
          zoom: 13,
          styles: [
            {
              featureType: "all",
              elementType: "labels.text.fill",
              stylers: [{ color: "#000000" }]
            },
            {
              featureType: "all",
              elementType: "labels.text.stroke",
              stylers: [{ visibility: "on" }, { color: "#ffffff" }, { weight: 2 }]
            }
          ],
          disableDefaultUI: true,
          zoomControl: true,
        });

        // Add click listener for setting destination
        map.current.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!isMonitoring && e.latLng) {
            setDestination({
              lat: e.latLng.lat(),
              lng: e.latLng.lng()
            });

            if (destinationMarker.current) {
              destinationMarker.current.setMap(null);
            }

            destinationMarker.current = new google.maps.Marker({
              position: e.latLng,
              map: map.current,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#22C55E",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
              animation: google.maps.Animation.DROP,
            });
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
              map.current?.setCenter(pos);

              if (marker.current) {
                marker.current.setMap(null);
              }

              marker.current = new google.maps.Marker({
                position: pos,
                map: map.current,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: "#3B82F6",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                },
              });
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
    });

    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [toast]);

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
          marker.current.setPosition(pos);
        }

        if (destination) {
          const dist = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(pos.lat, pos.lng),
            new google.maps.LatLng(destination.lat, destination.lng)
          );
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
      destinationMarker.current.setMap(null);
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
