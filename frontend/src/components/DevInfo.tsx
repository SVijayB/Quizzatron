import { useState } from "react";
import { Heart, Linkedin, Mail, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import * as DialogPrimitive from "@radix-ui/react-dialog";

// Hardcoded developer information
const developers = [
  {
    "name": "Vijay Balaji S",
    "desc": "Your average CS Engineer, commits at 3 AM and cries himself to sleep.",
    "email": "svijayb.dev@gmail.com",
    "linkedin": "https://www.linkedin.com/in/svijayb/",
    "image": "/dev_imgs/vijay.jpeg",
  },
  {
    "name": "Aravindh Manavalan",
    "desc": "meow",
    "email": "aravindh1628@gmail.com",
    "linkedin": "https://www.linkedin.com/in/aravindh-manavalan/",
    "image": "/dev_imgs/aravindh.jpeg",
  },
  {
    "name": "Akshay Ravi",
    "desc": "UwU 👉🏻👈🏻",
    "email": "akshayravi13@gmail.com",
    "linkedin": "https://www.linkedin.com/in/akshayravi13/",
    "image": "/dev_imgs/akshay.jpeg",
  },
  {
    "name": "Hariharan sureshkumar",
    "desc": "slay 💅",
    "email": "harisureshkumar1910@gmail.com",
    "linkedin": "https://www.linkedin.com/in/hariharan-sureshkumar-4994a2254/",
    "image": "/dev_imgs/hari.jpeg",
  },
];

const DevInfo = () => {
  const [open, setOpen] = useState(false);
  
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
      <DialogContent className="sm:max-w-[750px] md:max-w-[850px] bg-gradient-to-b from-[#1a1a2e] to-[#1a1a2e] border-[#4f3ed0]/40 rounded-xl shadow-[0px_0px_20px_rgba(139,92,246,0.3)] transition-all duration-300">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-4 text-white tracking-wide">
            Meet the Team<span className="text-[#8b5cf6]">.</span>
          </DialogTitle>
        </DialogHeader>
        
        {/* Custom close button styling to make it white */}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm text-white opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
          {developers.map((dev, index) => (
            <Card key={index} className="overflow-hidden bg-[#4f3ed0]/20 backdrop-blur-lg border border-[#8b5cf6]/30 rounded-xl hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all duration-300 transform hover:-translate-y-1">
              <CardContent className="p-5">
                <div className="flex gap-5 items-start">
                  <Avatar className="h-16 w-16 border-2 border-[#8b5cf6]/40 shadow-md ring-2 ring-[#8b5cf6]/20">
                    <AvatarImage src={dev.image} alt={dev.name} />
                    <AvatarFallback className="bg-[#4f3ed0]/30 text-white">
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
                        className="h-8 px-3 rounded-full bg-[#4f3ed0]/30 border-[#8b5cf6]/50 text-[#d1c8ff] hover:bg-[#8b5cf6]/70 hover:text-white transition-all duration-300"
                        onClick={() => window.open(dev.linkedin, '_blank')}
                      >
                        <Linkedin className="h-4 w-4 mr-1" />
                        LinkedIn
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 rounded-full bg-[#4f3ed0]/30 border-[#8b5cf6]/50 text-[#d1c8ff] hover:bg-[#8b5cf6]/70 hover:text-white transition-all duration-300"
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
      </DialogContent>
    </Dialog>
  );
};

export default DevInfo;
