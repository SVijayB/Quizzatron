
import { useState, useEffect } from "react";
import { Heart, Linkedin, Mail, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchDevInfo } from "@/services/devService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const DevInfo = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const { data: developers = [], isLoading, error } = useQuery({
    queryKey: ['devInfo'],
    queryFn: fetchDevInfo,
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: open, // Only fetch when dialog is opened
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load developer information",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 rounded-full bg-violet-700 hover:bg-violet-800 border-none text-white shadow-lg hover:shadow-xl transition-all h-12 w-12 z-50"
          aria-label="Developer Information"
        >
          <Heart className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[750px] md:max-w-[850px] bg-gradient-to-b from-[#252046] to-[#1B1735] border-[#3A2F6D] rounded-xl shadow-[0px_0px_20px_rgba(72,57,185,0.3)] transition-all duration-300">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-4 text-white tracking-wide">
            Meet the Team<span className="text-[#7A6EEB]">.</span>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="grid place-items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7A6EEB]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
            {developers.map((dev, index) => (
              <Card key={index} className="overflow-hidden bg-[#2C2754]/50 backdrop-blur-lg border border-[#45397D] rounded-xl hover:shadow-[0_0_15px_rgba(122,110,235,0.3)] transition-all duration-300 transform hover:-translate-y-1">
                <CardContent className="p-5">
                  <div className="flex gap-5 items-start">
                    <Avatar className="h-16 w-16 border-2 border-[#7A6EEB]/40 shadow-md ring-2 ring-[#7A6EEB]/20">
                      <AvatarImage src={dev.image} alt={dev.name} />
                      <AvatarFallback className="bg-[#7A6EEB]/30 text-white">
                        {dev.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">{dev.name}</h3>
                      <p className="text-sm text-gray-300 mt-1">{dev.desc}</p>

                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 rounded-full bg-[#3A2F6D]/80 border-[#7A6EEB]/50 text-[#D1C8FF] hover:bg-[#7A6EEB]/70 hover:text-white transition-all duration-300"
                          onClick={() => window.open(dev.linkedin, '_blank')}
                        >
                          <Linkedin className="h-4 w-4 mr-1" />
                          LinkedIn
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 rounded-full bg-[#3A2F6D]/80 border-[#7A6EEB]/50 text-[#D1C8FF] hover:bg-[#7A6EEB]/70 hover:text-white transition-all duration-300"
                          onClick={() => window.open(`mailto:${dev.email}`, '_blank')}
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Email
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>

    </Dialog>
  );
};

export default DevInfo;
