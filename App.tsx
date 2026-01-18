import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ViewState, Project, ChatMessage, Education } from './types';
import { RESUME_DATA, PROJECTS, EDUCATION_HISTORY, CERTIFICATES, SKILL_METRICS, INTERESTS, CORE_SKILLS } from './constants';

// Initialize Gemini safely
// Use a fallback "demo_key" if the environment variable is missing (empty string)
// This prevents the SDK constructor from throwing an error, allowing the app to load in "Offline Mode"
// @ts-ignore
const apiKey = import.meta.env?.VITE_API_KEY || "demo_key"; 
const ai = new GoogleGenerativeAI(apiKey);

// --- Audio Helper Functions for Live API ---

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Theme definitions
const THEMES = [
  { name: 'NEON_CYAN', value: '0 229 255', hex: '#00e5ff' },
  { name: 'MATRIX_GRN', value: '0 255 65', hex: '#00ff41' },
  { name: 'WARN_ORNG', value: '255 145 0', hex: '#ff9100' },
  { name: 'CRIT_RED', value: '255 0 60', hex: '#ff003c' },
];

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>(ViewState.PROFILE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [currentTheme, setCurrentTheme] = useState(THEMES[0]);
  const [showSettings, setShowSettings] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
      projects: Project[];
      education: Education[];
      skills: typeof SKILL_METRICS;
  }>({ projects: [], education: [], skills: [] });

  useEffect(() => {
    // Simulate system boot up
    const timer = setTimeout(() => setIsLoaded(true), 1200); // Extended slightly for boot effect
    // Session Timer
    const interval = setInterval(() => setSessionTime((t: number) => t + 1), 1000);
    
    // Set initial theme
    document.documentElement.style.setProperty('--color-primary', currentTheme.value);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const changeTheme = (theme: typeof THEMES[0]) => {
    setCurrentTheme(theme);
    document.documentElement.style.setProperty('--color-primary', theme.value);
    setShowSettings(false);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim() === '') {
        if (activeView === ViewState.SEARCH) setActiveView(ViewState.PROFILE);
        return;
    }

    if (activeView !== ViewState.SEARCH) setActiveView(ViewState.SEARCH);

    const lowerQuery = query.toLowerCase();
    
    const projects = PROJECTS.filter(p => 
        p.title.toLowerCase().includes(lowerQuery) || 
        p.description.toLowerCase().includes(lowerQuery) ||
        p.tech.some(t => t.toLowerCase().includes(lowerQuery))
    );

    const education = EDUCATION_HISTORY.filter(edu => 
        edu.degree.toLowerCase().includes(lowerQuery) ||
        edu.school.toLowerCase().includes(lowerQuery) ||
        edu.details?.some(d => d.toLowerCase().includes(lowerQuery))
    );

    const skills = SKILL_METRICS.filter(s => 
        s.subject.toLowerCase().includes(lowerQuery)
    );

    setSearchResults({ projects, education, skills });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNavClick = (view: ViewState) => {
    if (view === activeView) return;
    setActiveView(view);
    setSearchQuery('');
  };

  const renderContent = () => {
    // Wrap content in a fade-in div for smooth transition between sections
    const content = (() => {
      switch (activeView) {
        case ViewState.PROFILE:
          return <ProfileView currentTheme={currentTheme} />;
        case ViewState.PROJECTS:
          return <ProjectsView onSelectProject={setSelectedProject} />;
        case ViewState.EDUCATION:
          return <EducationView />;
        case ViewState.SKILLS:
          return <SkillsView />;
        case ViewState.TERMINAL:
          return <TerminalView />;
        case ViewState.SEARCH:
          return <SearchResultsView 
                    results={searchResults} 
                    query={searchQuery}
                    onProjectSelect={setSelectedProject}
                    onViewChange={setActiveView}
                 />;
        default:
          return <ProfileView currentTheme={currentTheme} />;
      }
    })();

    return (
      <div key={activeView} className="animate-fadeIn w-full h-full">
        {content}
      </div>
    );
  };

  return (
    <div className="relative w-full h-screen bg-dark text-white font-display overflow-hidden selection:bg-primary selection:text-black">
      {/* 3D Interactive Background */}
      <div className="absolute inset-0 z-0">
        <NeuralBackground themeHex={currentTheme.hex} />
        {/* Static overlay for aesthetic texture */}
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
      </div>

      {/* Main Container */}
      <div className={`relative z-10 w-full h-full flex flex-col`}>
        {/* Initial Boot Skeleton */}
        {!isLoaded && (
          <div className="absolute inset-0 z-50 bg-dark flex flex-col">
            <BootSequence />
          </div>
        )}

        <div className={`flex flex-col h-full transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
          {/* Header */}
          <header className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-surface/50 backdrop-blur-sm shrink-0 gap-8">
            <div className="flex items-center gap-3 w-1/4 min-w-fit">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">deployed_code</span>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">{RESUME_DATA.name}</h1>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-primary/80 font-mono tracking-widest uppercase">System Online</p>
                  <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">:: UPTIME {formatTime(sessionTime)}</span>
                </div>
              </div>
            </div>
            
            {/* Global Search Bar */}
            <div className="flex-1 max-w-lg hidden md:block">
              <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <span className="material-symbols-outlined text-gray-500 group-focus-within:text-primary transition-colors">search</span>
                  </div>
                  <input 
                      type="text" 
                      value={searchQuery}
                      onChange={handleSearch}
                      placeholder="Search Neural Database..." 
                      className="w-full bg-black/20 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-gray-300 focus:text-white focus:bg-white/5 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder-gray-600 font-mono"
                  />
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm w-1/4 justify-end">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-full hover:bg-white/5 text-gray-400 hover:text-primary transition-colors relative"
              >
                <span className={`material-symbols-outlined ${showSettings ? 'animate-spin' : ''}`}>settings</span>
                {showSettings && (
                  <div className="absolute top-full right-0 mt-2 p-2 bg-surface border border-white/10 rounded-lg shadow-xl min-w-[150px] z-50 animate-[fadeIn_0.2s_ease-out]">
                    <p className="text-[10px] text-gray-500 font-mono mb-2 px-2 uppercase tracking-wider">Override Protocol</p>
                    {THEMES.map(theme => (
                      <button
                          key={theme.name}
                          onClick={() => changeTheme(theme)}
                          className={`w-full text-left px-2 py-1.5 text-xs font-mono rounded flex items-center gap-2 hover:bg-white/5 ${currentTheme.name === theme.name ? 'text-white' : 'text-gray-400'}`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.hex }}></span>
                        {theme.name}
                      </button>
                    ))}
                  </div>
                )}
              </button>
              <div className="h-4 w-px bg-white/10 hidden md:block"></div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono hidden sm:flex">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                AVAILABLE
              </div>
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 flex overflow-hidden relative">
            {/* Sidebar Navigation */}
            <nav className="w-20 md:w-24 border-r border-white/5 flex flex-col items-center py-8 gap-8 bg-surface/30 backdrop-blur-md z-20">
              <NavButton 
                icon="id_card" 
                label="Profile" 
                isActive={activeView === ViewState.PROFILE} 
                onClick={() => handleNavClick(ViewState.PROFILE)} 
              />
              <NavButton 
                icon="rocket_launch" 
                label="Projects" 
                isActive={activeView === ViewState.PROJECTS} 
                onClick={() => handleNavClick(ViewState.PROJECTS)} 
              />
              <NavButton 
                icon="school" 
                label="Edu" 
                isActive={activeView === ViewState.EDUCATION} 
                onClick={() => handleNavClick(ViewState.EDUCATION)} 
              />
              <NavButton 
                icon="hub" 
                label="Skills" 
                isActive={activeView === ViewState.SKILLS} 
                onClick={() => handleNavClick(ViewState.SKILLS)} 
              />
              <div className="w-8 h-px bg-white/10 my-2"></div>
              <NavButton 
                icon="terminal" 
                label="Term" 
                isActive={activeView === ViewState.TERMINAL} 
                onClick={() => handleNavClick(ViewState.TERMINAL)} 
              />
              {activeView === ViewState.SEARCH && (
                  <div className="mt-auto animate-pulse">
                      <span className="material-symbols-outlined text-primary">search</span>
                  </div>
              )}
            </nav>

            {/* Viewport */}
            <div className="flex-1 relative overflow-y-auto overflow-x-hidden p-6 md:p-12 scrollbar-hide pb-16">
              <div className="max-w-6xl mx-auto min-h-full">
                {renderContent()}
              </div>
            </div>
          </main>
          
          {/* System Telemetry Footer */}
          <SystemFooter activeView={activeView} />
        </div>
      </div>

      {/* Overlays */}
      {selectedProject && (
        <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
      )}

      {/* Neural Assistant Widget */}
      <div className="absolute bottom-10 right-6 z-40">
        <NeuralChatWidget currentThemeHex={currentTheme.hex} />
      </div>
    </div>
  );
};

// --- Skeleton Components ---

const SkeletonBlock = ({ className = "" }: { className?: string }) => (
  <div className={`rounded bg-white/5 skeleton-shimmer ${className}`}></div>
);

const BootSequence = () => {
  return (
    <div className="w-full h-full flex flex-col p-8 space-y-8 animate-pulse">
       {/* Header Skeleton */}
       <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <SkeletonBlock className="w-12 h-12 rounded-lg" />
            <div className="space-y-2">
              <SkeletonBlock className="w-48 h-6" />
              <SkeletonBlock className="w-24 h-3" />
            </div>
          </div>
          <SkeletonBlock className="w-32 h-8 rounded-full" />
       </div>

       {/* Body Skeleton */}
       <div className="flex-1 flex gap-8">
          {/* Nav Skeleton */}
          <div className="w-24 hidden md:flex flex-col gap-8 items-center border-r border-white/5 pr-4">
              {[1, 2, 3, 4, 5].map(i => (
                <SkeletonBlock key={i} className="w-12 h-12 rounded-xl" />
              ))}
          </div>

          {/* Main Content Skeleton (Profile Layout) */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-8">
             <div className="space-y-6">
                <SkeletonBlock className="w-24 h-6 rounded-full" />
                <div className="space-y-4">
                  <SkeletonBlock className="w-3/4 h-16" />
                  <SkeletonBlock className="w-1/2 h-16" />
                </div>
                <div className="space-y-3 pt-4">
                  <SkeletonBlock className="w-full h-4" />
                  <SkeletonBlock className="w-full h-4" />
                  <SkeletonBlock className="w-2/3 h-4" />
                </div>
                <div className="flex gap-4 pt-4">
                  <SkeletonBlock className="w-32 h-8 rounded-full" />
                  <SkeletonBlock className="w-32 h-8 rounded-full" />
                </div>
             </div>
             <div className="flex justify-center">
                <SkeletonBlock className="w-full max-w-md h-[350px] rounded-2xl" />
             </div>
          </div>
       </div>
    </div>
  );
};

// --- New 3D Components ---

// 1. Neural Background: 3D Particle System
const NeuralBackground = ({ themeHex }: { themeHex: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef(themeHex);

  // Update ref when prop changes to avoid re-initializing canvas loop
  useEffect(() => {
    themeRef.current = themeHex;
  }, [themeHex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles: any[] = [];
    let animationFrameId: number;
    
    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const particleCount = Math.min(Math.floor(width * height / 15000), 100); // Responsive count
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: (Math.random() - 0.5) * width,
          y: (Math.random() - 0.5) * height,
          z: Math.random() * width, // depth
          radius: Math.random() * 2,
        });
      }
    };

    const draw = () => {
      // Clear with slight fade for trails (optional, but keep clean for now)
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse follow
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      const cx = width / 2;
      const cy = height / 2;
      const focalLength = 400;

      // Hex to RGB for opacity control
      const hex = themeRef.current.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      // Sort by Z for proper layering
      particles.sort((a, b) => b.z - a.z);

      particles.forEach(p => {
        // Move particles
        p.z -= 1.0; // Move towards viewer
        
        // Loop back
        if (p.z <= 0) {
          p.z = width;
          p.x = (Math.random() - 0.5) * width;
          p.y = (Math.random() - 0.5) * height;
        }

        // Apply 3D rotation based on mouse
        // Simplified rotation logic
        const dx = p.x;
        const dy = p.y;
        
        // Project to 2D
        const scale = focalLength / (focalLength + p.z);
        const x2d = dx * scale + cx + (targetX * scale * 0.05);
        const y2d = dy * scale + cy + (targetY * scale * 0.05);

        // Draw Particle
        const alpha = Math.min(scale * scale, 1) * 0.5; // Fade in distance
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x2d, y2d, p.radius * scale, 0, Math.PI * 2);
        ctx.fill();

        // Draw Connections
        // Naive O(N^2) but fine for N=100
        for (let j = 0; j < particles.length; j++) {
            const p2 = particles[j];
            // Only connect if z is somewhat similar to avoid weird long lines across depth
            if (Math.abs(p.z - p2.z) > 200) continue;

            const scale2 = focalLength / (focalLength + p2.z);
            const x2d2 = p2.x * scale2 + cx + (targetX * scale2 * 0.05);
            const y2d2 = p2.y * scale2 + cy + (targetY * scale2 * 0.05);

            const dist = Math.hypot(x2d - x2d2, y2d - y2d2);

            if (dist < 100) {
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(1 - dist / 100) * alpha * 0.3})`;
                ctx.lineWidth = 1 * scale;
                ctx.beginPath();
                ctx.moveTo(x2d, y2d);
                ctx.lineTo(x2d2, y2d2);
                ctx.stroke();
            }
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX - width / 2;
      mouseY = e.clientY - height / 2;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    
    handleResize();
    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />;
};

// 2. Holographic Card: 3D Tilt Effect (Heavy Glare)
const HolographicCard = ({ children, active = true }: { children: React.ReactNode, active?: boolean }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !active) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate rotation (-10deg to 10deg)
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotateY = ((x - cx) / cx) * 10;
    const rotateX = ((cy - y) / cy) * 10;

    // Calculate glare position
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setRotate({ x: rotateX, y: rotateY });
    setGlare({ x: glareX, y: glareY, opacity: 1 });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
    setGlare(prev => ({ ...prev, opacity: 0 }));
  };

  return (
    <div className="perspective-1000 w-full h-full">
      <div
        ref={cardRef}
        className="relative w-full h-full transition-transform duration-100 ease-out preserve-3d"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: active ? `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(1.02, 1.02, 1.02)` : 'none',
          transformStyle: 'preserve-3d'
        }}
      >
        {children}
        
        {/* Holographic Glare Layer */}
        {active && (
          <div 
            className="absolute inset-0 pointer-events-none rounded-2xl z-50 transition-opacity duration-300 mix-blend-overlay"
            style={{
              background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 80%)`,
              opacity: glare.opacity
            }}
          />
        )}
        
        {/* Edge Highlight */}
        <div className="absolute inset-0 rounded-2xl border border-white/10 group-hover:border-primary/50 transition-colors pointer-events-none"></div>
      </div>
    </div>
  );
};

// 3. TiltCard3D: Subtle 3D Tilt for Content (No Heavy Glare)
const TiltCard3D = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    // Normalize coordinates -1 to 1
    const x = (e.clientX - left - width / 2) / (width / 2); 
    const y = (e.clientY - top - height / 2) / (height / 2);
    
    // Tilt intensity
    const tiltX = -y * 5; // Rotate around X axis
    const tiltY = x * 5;  // Rotate around Y axis

    setTransform(`perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.02, 1.02, 1.02)`);
  };

  const handleMouseLeave = () => {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
  };

  return (
    <div 
      ref={ref}
      className={`transition-transform duration-200 ease-out will-change-transform ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transform, transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  );
};


// 5. Neural Orb: 3D Canvas Animation for Assistant Button
const NeuralOrb = ({ state, themeHex }: { state: 'idle' | 'processing' | 'active', themeHex: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    let animationId: number;
    const width = 64;
    const height = 64;
    canvas.width = width;
    canvas.height = height;

    const hex = themeHex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      const cx = width / 2;
      const cy = height / 2;
      const radius = 12;
      
      // Speed multiplier based on state
      const speed = state === 'processing' ? 0.2 : 0.05;
      time += speed;

      // Core Glow
      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 20);
      glow.addColorStop(0, `rgba(255, 255, 255, 1)`);
      glow.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.8)`);
      glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();

      // 3D Rings
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
      ctx.lineWidth = 1.5;

      // Ring 1
      ctx.beginPath();
      for (let i = 0; i <= Math.PI * 2; i += 0.1) {
        const rx = Math.cos(i) * radius;
        const ry = Math.sin(i) * radius;
        
        // Rotate X
        const y2 = ry * Math.cos(time) - 0 * Math.sin(time);
        const z2 = ry * Math.sin(time) + 0 * Math.cos(time);
        
        // Project
        const scale = 100 / (100 + z2);
        ctx.lineTo(cx + rx * scale, cy + y2 * scale);
      }
      ctx.stroke();

      // Ring 2 (Orthogonal)
      ctx.beginPath();
      for (let i = 0; i <= Math.PI * 2; i += 0.1) {
        const rx = Math.cos(i) * (radius + 4);
        const ry = Math.sin(i) * (radius + 4);
        
        // Rotate Y
        const x2 = rx * Math.cos(time + 1) - 0 * Math.sin(time + 1);
        const z2 = rx * Math.sin(time + 1) + 0 * Math.cos(time + 1);
        
        // Project
        const scale = 100 / (100 + z2);
        ctx.lineTo(cx + x2 * scale, cy + ry * scale);
      }
      ctx.stroke();

       // Ring 3 (Chaotic)
      if (state === 'processing') {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          for (let i = 0; i <= Math.PI * 2; i += 0.2) {
            const rx = Math.cos(i) * (radius + 8);
            const ry = Math.sin(i) * (radius + 8);
            
            // Rotate Z
            const x2 = rx * Math.cos(time * 2) - ry * Math.sin(time * 2);
            const y2 = rx * Math.sin(time * 2) + ry * Math.cos(time * 2);
            
            ctx.lineTo(cx + x2, cy + y2);
          }
          ctx.stroke();
      }

      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [state, themeHex]);

  return <canvas ref={canvasRef} className="w-16 h-16" />;
};


// --- Sub Components ---

const SpotlightCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-surface/50 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(var(--color-primary), 0.1), transparent 40%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
};

const RevealText = ({ text, delay = 0 }: { text: string, delay?: number }) => {
    const [visibleText, setVisibleText] = useState("");
    
    useEffect(() => {
        let i = 0;
        const startDelay = setTimeout(() => {
            const interval = setInterval(() => {
                setVisibleText(text.slice(0, i + 1));
                i++;
                if (i > text.length) clearInterval(interval);
            }, 30);
            return () => clearInterval(interval);
        }, delay);
        return () => clearTimeout(startDelay);
    }, [text, delay]);
    
    return <span>{visibleText}<span className="animate-pulse text-primary">_</span></span>;
};

const TypewriterParagraph = ({ text, delay = 0, speed = 30 }: { text: string, delay?: number, speed?: number }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setStarted(true);
    }, delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let charIndex = 0;
    const intervalId = setInterval(() => {
      if (charIndex < text.length) {
        setDisplayedText(text.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, speed);
    return () => clearInterval(intervalId);
  }, [started, text, speed]);

  return (
    <p className="text-gray-300 leading-relaxed font-mono text-sm">
      {displayedText}
      {displayedText.length < text.length && started && <span className="animate-pulse text-primary inline-block w-2 h-4 align-middle bg-primary ml-1"></span>}
    </p>
  );
};

const SearchResultsView = ({ results, query, onProjectSelect, onViewChange }: { 
    results: { projects: Project[], education: Education[], skills: any[] }, 
    query: string,
    onProjectSelect: (p: Project) => void,
    onViewChange: (v: ViewState) => void
}) => {
    
    if (!query) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                <span className="material-symbols-outlined text-6xl opacity-20">search</span>
                <p className="font-mono text-sm tracking-widest">INITIATE NEURAL SEARCH PROTOCOL</p>
            </div>
        );
    }

    const hasResults = results.projects.length > 0 || results.education.length > 0 || results.skills.length > 0;

    if (!hasResults) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                <span className="material-symbols-outlined text-6xl opacity-20 text-red-500">search_off</span>
                <p className="font-mono text-sm tracking-widest uppercase">No matching entities for "{query}"</p>
                <button onClick={() => onViewChange(ViewState.PROFILE)} className="text-primary hover:underline text-xs">Return to Profile</button>
            </div>
        );
    }

    return (
        <div className="space-y-12 pb-10">
            <div className="flex items-center gap-4 mb-8">
                <span className="material-symbols-outlined text-3xl text-primary">manage_search</span>
                <h2 className="text-2xl font-bold text-white">Search Results: "{query}"</h2>
            </div>

            {/* Projects Section */}
            {results.projects.length > 0 && (
                <div className="space-y-4">
                     <div className="flex justify-between items-end border-b border-white/10 pb-2">
                        <h3 className="text-primary font-mono text-sm uppercase tracking-wider">Projects Detected</h3>
                        <span className="text-xs text-gray-500">{results.projects.length} RECORDS</span>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.projects.map((project, idx) => (
                             <div 
                                key={idx}
                                onClick={() => onProjectSelect(project)}
                                className="group bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all cursor-pointer flex items-center gap-4"
                             >
                                <div className="p-3 bg-primary/10 rounded-lg text-primary">
                                    <span className="material-symbols-outlined">deployed_code</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-white group-hover:text-primary transition-colors">{project.title}</h4>
                                    <p className="text-xs text-gray-400 font-mono mt-1">{project.type}</p>
                                </div>
                                <span className="material-symbols-outlined ml-auto text-gray-600 group-hover:text-white transition-colors">arrow_forward</span>
                             </div>
                        ))}
                     </div>
                </div>
            )}

            {/* Skills Section */}
            {results.skills.length > 0 && (
                <div className="space-y-4">
                     <div className="flex justify-between items-end border-b border-white/10 pb-2">
                        <h3 className="text-primary font-mono text-sm uppercase tracking-wider">Competencies Found</h3>
                        <span className="text-xs text-gray-500">{results.skills.length} MATCHES</span>
                     </div>
                     <div className="flex flex-wrap gap-3">
                        {results.skills.map((skill, idx) => (
                             <div key={idx} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                                <span className="text-gray-200">{skill.subject}</span>
                                <span className="text-primary/70 font-mono text-xs border-l border-white/10 pl-2 ml-1">{skill.A}%</span>
                             </div>
                        ))}
                     </div>
                </div>
            )}

            {/* Education Section */}
            {results.education.length > 0 && (
                <div className="space-y-4">
                     <div className="flex justify-between items-end border-b border-white/10 pb-2">
                        <h3 className="text-primary font-mono text-sm uppercase tracking-wider">Academic Records</h3>
                        <span className="text-xs text-gray-500">{results.education.length} ENTRIES</span>
                     </div>
                     <div className="space-y-3">
                        {results.education.map((edu, idx) => (
                             <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                 <div>
                                    <h4 className="font-bold text-white">{edu.degree}</h4>
                                    <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                                        <span className="material-symbols-outlined text-xs">school</span>
                                        {edu.school}
                                    </div>
                                 </div>
                                 <span className="px-2 py-1 bg-white/5 rounded text-xs font-mono text-primary border border-white/5 whitespace-nowrap">{edu.year}</span>
                             </div>
                        ))}
                     </div>
                </div>
            )}
        </div>
    );
};

const SystemFooter = ({ activeView }: { activeView: string }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const messages = [
    "Analyzing neural weights...",
    "Optimizing rendering pipeline...",
    "Memory integrity: 99.8%",
    "Tracking user engagement...",
    "Encrypting data packets...",
    "Handshake verified...",
    "Garbage collection pending...",
    "Updating view matrix...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      const msg = messages[Math.floor(Math.random() * messages.length)];
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] SYSTEM_EVENT: ${msg}`, ...prev].slice(0, 10));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
     setLogs(prev => [`[${new Date().toLocaleTimeString()}] VIEW_CHANGED: Loading ${activeView} module...`, ...prev].slice(0, 10));
  }, [activeView]);

  return (
    <div className="h-8 bg-black border-t border-white/10 flex items-center justify-between px-4 text-[10px] font-mono text-gray-500 uppercase z-50 shrink-0 select-none">
       <div className="flex items-center gap-4 w-1/2 overflow-hidden">
          <span className="text-primary animate-pulse">●</span>
          <div className="overflow-hidden whitespace-nowrap mask-linear-fade w-full">
            <span className="inline-block animate-[scroll-left_15s_linear_infinite] w-max">
               {logs.join("  //  ")}
            </span>
          </div>
       </div>
       <div className="flex items-center gap-6">
          <span>MEM: {Math.floor(Math.random() * 40) + 20}%</span>
          <span>LATENCY: 12ms</span>
          <span className="text-primary">SECURE_CONN_V4</span>
       </div>
    </div>
  );
};

const NavButton = ({ icon, label, isActive, onClick }: { icon: string, label: string, isActive: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`group relative flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-primary scale-110' : 'text-gray-500 hover:text-white'}`}
  >
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-primary/10 shadow-[0_0_15px_rgb(var(--color-primary)/0.3)]' : 'bg-white/5 group-hover:bg-white/10'}`}>
      <span className="material-symbols-outlined text-2xl">{icon}</span>
    </div>
    <span className="text-[10px] font-medium tracking-wide uppercase opacity-0 group-hover:opacity-100 absolute -bottom-5 transition-opacity">{label}</span>
    {isActive && <div className="absolute left-0 -ml-4 w-1 h-8 bg-primary rounded-r-full" />}
  </button>
);

const ProfileView = ({ currentTheme }: { currentTheme: any }) => (
  <div className="flex flex-col pb-12">
    {/* Hero Section */}
    <div className="min-h-[85vh] flex flex-col justify-center mb-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8 animate-[float_6s_ease-in-out_infinite]">
          <div className="space-y-2">
            <div className="inline-block px-3 py-1 rounded border border-secondary/50 text-secondary text-xs font-mono tracking-widest bg-secondary/10 mb-2">
              IDENTITY_MATRIX_LOADED
            </div>
            <h2 className="text-5xl md:text-7xl font-bold leading-tight relative">
              Creative <br/>
              <span 
                className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary glitch"
                data-text="Technologist"
              >
                Technologist
              </span>
            </h2>
            <p className="text-xl text-gray-400 font-light max-w-lg leading-relaxed">
              {RESUME_DATA.summary}
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <InfoPill icon="location_on" text={RESUME_DATA.location} onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(RESUME_DATA.location)}`, '_blank')} />
            <InfoPill 
              icon="phone" 
              text={RESUME_DATA.phone} 
              onClick={() => window.location.href = `tel:${RESUME_DATA.phone}`}
            />
            <InfoPill 
              icon="link" 
              text={RESUME_DATA.linkedin} 
              onClick={() => window.open('https://www.linkedin.com/in/anubhav-farswal', '_blank')}
            />
          </div>
        </div>

        {/* 3D Holographic Card Container */}
        <div className="h-[400px] w-full flex items-center justify-center relative z-20">
          <HolographicCard>
              <div className="glass-panel w-full h-full rounded-2xl p-8 border border-white/10 flex flex-col justify-center relative overflow-hidden bg-black/40">
                  {/* Internal Decorative Grid */}
                  <div className="absolute inset-0 grid-bg opacity-30"></div>
                  
                  <div className="absolute top-0 right-0 p-6 opacity-30 rotate-12">
                      <span className="material-symbols-outlined text-8xl text-primary">fingerprint</span>
                  </div>

                  <div className="space-y-6 relative z-10">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-800 to-black border-2 border-primary/50 flex items-center justify-center shadow-[0_0_30px_rgb(var(--color-primary)/0.2)]">
                          <span className="text-3xl font-bold text-white">AK</span>
                      </div>
                      <div>
                          <h3 className="text-3xl font-bold text-white mb-1">{RESUME_DATA.name}</h3>
                          <p className="text-primary font-mono">{RESUME_DATA.title}</p>
                      </div>
                      <div className="h-px w-full bg-gradient-to-r from-primary/50 to-transparent"></div>
                      <div className="grid grid-cols-2 gap-4 text-sm font-mono text-gray-400">
                          <div>
                              <p className="text-[10px] text-primary/70 uppercase tracking-wider mb-1">Specialization</p>
                              <p className="text-white">AI & Frontend</p>
                          </div>
                          <div>
                              <p className="text-[10px] text-primary/70 uppercase tracking-wider mb-1">Clearance</p>
                              <p className="text-white">Level 5 (Admin)</p>
                          </div>
                      </div>
                  </div>
              </div>
          </HolographicCard>
        </div>
      </div>
    </div>

    {/* About Section - Interactive Updates */}
    <div className="space-y-12 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards] delay-200">
        <div className="flex items-center gap-4">
             <div className="h-px bg-white/10 flex-grow"></div>
             <span className="text-primary font-mono text-sm tracking-widest uppercase">System Architecture // Human Node</span>
             <div className="h-px bg-white/10 flex-grow"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Left Side: Headline & Visual */}
            <TiltCard3D className="h-full min-h-[400px]">
                <SpotlightCard className="p-8 rounded-2xl group border border-white/5 bg-surface/50 h-full flex flex-col justify-center relative overflow-hidden">
                     {/* Background Decoration - Animated */}
                    <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-20 transition-opacity duration-500 animate-[spin-slow]">
                        <span className="material-symbols-outlined text-[180px] text-primary rotate-12">neurology</span>
                    </div>
                    
                    <div className="relative z-10 space-y-6">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 animate-[fadeIn_0.5s_ease-out_forwards]">
                             <span className="material-symbols-outlined text-2xl">hub</span>
                        </div>
                        
                        <h3 className="text-3xl font-bold text-white leading-tight animate-[fadeIn_0.5s_ease-out_forwards] delay-100">
                            The Bridge Between <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Data & Design</span>
                        </h3>
                        
                        <div className="h-1 w-20 bg-primary rounded-full animate-[fill-bar_1s_ease-out_forwards] delay-300"></div>

                        <div className="space-y-4">
                            <p className="text-gray-300 font-light leading-relaxed animate-[slide-right_0.5s_ease-out_forwards] opacity-0" style={{ animationDelay: '400ms' }}>
                                I don't just build UI; I architect <strong>intelligent interfaces</strong> where human intention meets machine precision.
                            </p>
                            
                            <ul className="space-y-3 mt-4">
                                {[
                                    "Translating Neural Architectures to UI",
                                    "Optimizing Inference Latency", 
                                    "Democratizing Advanced AI Models"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-400 animate-[slide-right_0.5s_ease-out_forwards] opacity-0" style={{ animationDelay: `${600 + (i * 100)}ms` }}>
                                        <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </SpotlightCard>
            </TiltCard3D>

            {/* Right Side: Quote & Animated Bio */}
            <div className="space-y-6 flex flex-col">
                {/* Quote Section (Keep existing) */}
                <div className="glass-panel p-6 rounded-xl border-l-2 border-secondary relative overflow-hidden flex-shrink-0">
                    <div className="absolute inset-0 bg-secondary/5"></div>
                    <div className="relative z-10">
                        <h4 className="text-primary font-mono text-xs uppercase tracking-wider mb-2">Core Philosophy</h4>
                        <div className="text-white text-lg font-light italic h-24">
                           "<RevealText text="Intelligence is not just about the model's accuracy, but the clarity with which it is presented to the user." delay={1000} />"
                        </div>
                    </div>
                </div>

                {/* Animated Bio Section (Replaces TechSphere) */}
                 <div className="flex-1 glass-panel rounded-xl border border-white/5 bg-surface/30 p-6 relative overflow-hidden flex flex-col">
                     <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                         <h4 className="text-primary font-mono text-xs uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Bio_Log_v2.4
                         </h4>
                         <span className="text-[10px] text-gray-500">READING_STREAM...</span>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-4">
                         <TypewriterParagraph 
                            text="As an M.Tech candidate at Bennett University, I operate at the convergence of Machine Learning and Frontend Engineering. My work addresses a critical gap in the industry: making complex AI models accessible through intuitive, high-performance interfaces." 
                            delay={500}
                            speed={20}
                         />
                         <div className="h-4"></div> {/* Spacer */}
                         <TypewriterParagraph 
                            text="I specialize in wrapping sophisticated Transformer architectures—like BERT and RoBERTa—into responsive web applications. This approach transforms raw computation into actionable intelligence, ensuring that advanced data science serves the end-user effectively." 
                            delay={4500} // Approximate delay based on first paragraph length
                            speed={20}
                         />
                     </div>
                </div>
            </div>
        </div>
    </div>
  </div>
);

const TerminalView = () => {
  const [history, setHistory] = useState<string[]>(['> SYSTEM INITIALIZED', '> WELCOME TO NEURAL CLI V1.0', '> TYPE "help" FOR COMMANDS']);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleCommand = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const cmd = input.trim().toLowerCase();
      const newHistory = [...history, `> ${input}`];
      
      switch (cmd) {
        case 'help':
          newHistory.push(
            'AVAILABLE COMMANDS:', 
            '  ls        - List all projects',
            '  whoami    - Display profile summary',
            '  skills    - List core competencies',
            '  contact   - Display contact info',
            '  clear     - Clear terminal',
          );
          break;
        case 'ls':
          newHistory.push('PROJECTS DIRECTORY:');
          PROJECTS.forEach((p, i) => newHistory.push(`  [${i}] ${p.title} (${p.type})`));
          break;
        case 'whoami':
          newHistory.push(`USER: ${RESUME_DATA.name}`, `TITLE: ${RESUME_DATA.title}`, `BIO: ${RESUME_DATA.summary}`);
          break;
        case 'skills':
          newHistory.push('CORE SKILLS:', ...CORE_SKILLS.map(s => `  - ${s}`));
          break;
        case 'contact':
          newHistory.push(`EMAIL: ${RESUME_DATA.email}`, `PHONE: ${RESUME_DATA.phone}`, `LOC: ${RESUME_DATA.location}`);
          break;
        case 'clear':
          setHistory(['> CONSOLE CLEARED']);
          setInput('');
          return;
        default:
          newHistory.push(`ERROR: Command "${cmd}" not recognized. Type "help".`);
      }
      
      setHistory(newHistory);
      setInput('');
    }
  };

  return (
    <div className="h-full flex flex-col font-mono text-sm md:text-base">
      <div className="glass-panel w-full h-full rounded-xl p-6 flex flex-col border-primary/30 shadow-[0_0_20px_rgb(var(--color-primary)/0.1)] overflow-hidden">
        {/* Terminal Header */}
        <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
           <div className="flex gap-2">
             <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
             <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
             <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
           </div>
           <span className="text-xs text-gray-500">root@neural-interface:~</span>
        </div>

        {/* Output Area */}
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide text-primary/90" onClick={() => inputRef.current?.focus()}>
          {history.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap">{line}</div>
          ))}
          <div ref={scrollRef} />
          
          {/* Input Line */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-primary animate-pulse">{'>'}</span>
            <input 
              ref={inputRef}
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleCommand}
              className="flex-1 bg-transparent border-none outline-none text-white focus:ring-0"
              autoFocus
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ProjectsView = ({ onSelectProject }: { onSelectProject: (p: Project) => void }) => (
  <div className="space-y-8 pb-10">
    <div className="flex items-end justify-between border-b border-white/10 pb-4">
      <h2 className="text-3xl font-bold text-white">Project Archive</h2>
      <span className="font-mono text-primary text-sm">SELECTED_WORKS // {PROJECTS.length}</span>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {PROJECTS.map((project, idx) => (
        <div 
          key={idx} 
          onClick={() => onSelectProject(project)}
          className="group relative glass-panel rounded-xl p-1 hover:border-primary/50 transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-[0_0_20px_rgb(var(--color-primary)/0.15)]"
        >
          <div className="bg-surface/50 rounded-lg p-6 h-full flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <span className="material-symbols-outlined">deployed_code</span>
              </div>
              <span className="text-xs font-mono text-gray-500 border border-white/10 px-2 py-1 rounded">{project.type}</span>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">{project.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-grow line-clamp-3">{project.description}</p>
            
            <div className="flex flex-wrap gap-2 mt-auto">
              {project.tech.map((t, i) => (
                <span key={i} className="text-xs font-medium px-2 py-1 rounded bg-white/5 text-gray-300 border border-white/5">
                  {t}
                </span>
              ))}
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm rounded-xl">
              <span className="text-primary font-mono text-sm tracking-widest border border-primary px-4 py-2 rounded uppercase">Inspect Protocol</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ProjectModal = ({ project, onClose }: { project: Project, onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
    <div className="relative w-full max-w-2xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      {/* Modal Header */}
      <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5">
        <div>
          <h2 className="text-2xl font-bold text-white">{project.title}</h2>
          <p className="text-primary font-mono text-xs mt-1">{project.type}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      
      {/* Modal Content */}
      <div className="p-8 overflow-y-auto">
        <div className="space-y-6">
          <div className="glass-panel p-4 rounded-lg border-l-2 border-primary">
            <h4 className="text-xs font-mono text-gray-500 uppercase mb-2">System Description</h4>
            <p className="text-gray-300 leading-relaxed">{project.description}</p>
          </div>
          
          <div>
            <h4 className="text-xs font-mono text-gray-500 uppercase mb-3">Tech Stack Modules</h4>
            <div className="flex flex-wrap gap-2">
               {project.tech.map((t, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-gray-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="p-4 rounded border border-dashed border-white/20 text-center">
              <span className="material-symbols-outlined text-3xl text-gray-600 mb-2">code</span>
              <p className="text-xs text-gray-500">Source Code Locked</p>
            </div>
             <div className="p-4 rounded border border-dashed border-white/20 text-center">
              <span className="material-symbols-outlined text-3xl text-gray-600 mb-2">visibility_off</span>
              <p className="text-xs text-gray-500">Demo Restricted</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decoration */}
      <div className="h-1 w-full bg-gradient-to-r from-primary to-secondary"></div>
    </div>
  </div>
);

const EducationView = () => (
  <div className="flex flex-col h-full max-w-4xl mx-auto">
    <h2 className="text-3xl font-bold text-white mb-12 flex items-center gap-3 animate-[fadeIn_0.5s_ease-out_forwards]">
      <span className="material-symbols-outlined text-secondary text-4xl">history_edu</span>
      Academic History
    </h2>

    <div className="relative border-l border-white/10 ml-4 space-y-12">
      {EDUCATION_HISTORY.map((edu, idx) => (
        <div 
            key={idx} 
            className="relative pl-8 group cursor-pointer opacity-0 animate-slide-right"
            style={{ animationDelay: `${idx * 200}ms` }}
        >
          {/* Enhanced Node */}
          <div className="absolute -left-[10px] top-6 w-5 h-5 rounded-full bg-dark border border-secondary group-hover:bg-secondary group-hover:scale-125 group-hover:shadow-[0_0_15px_rgba(112,0,255,0.6)] transition-all duration-300 z-10 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>
          
          <div className="glass-panel p-6 rounded-xl group-hover:translate-x-2 transition-all duration-300 border-l-4 border-l-transparent group-hover:border-l-secondary group-hover:shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
              <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{edu.degree}</h3>
              <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded">{edu.year}</span>
            </div>
            <div className="flex justify-between items-center text-gray-400">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">school</span>
                {edu.school}
              </span>
              <span className="text-sm font-semibold text-white/80">{edu.score}</span>
            </div>

            {/* Expandable Details Section */}
            <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-500 ease-out">
              <div className="overflow-hidden">
                <div className="pt-4 mt-4 border-t border-white/5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-mono">Key Modules & Focus</p>
                  <ul className="grid grid-cols-1 gap-2">
                    {edu.details?.map((detail, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                        <span className="w-1 h-1 rounded-full bg-primary/50"></span>
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>

    <div 
        className="mt-16 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
        style={{ animationDelay: `${EDUCATION_HISTORY.length * 150 + 200}ms` }}
    >
      <h3 className="text-xl font-bold text-white mb-6">Certifications</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CERTIFICATES.map((cert, idx) => (
          <div 
            key={idx} 
            className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-primary/20 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
            style={{ animationDelay: `${(EDUCATION_HISTORY.length * 150 + 200) + (idx * 100)}ms` }}
          >
            <span className="material-symbols-outlined text-primary/70">{cert.icon}</span>
            <span className="text-sm text-gray-300">{cert.name}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel p-3 rounded border border-primary/30 shadow-[0_0_15px_rgb(var(--color-primary)/0.3)]">
        <p className="text-white text-sm font-bold font-display">{payload[0].payload.subject}</p>
        <p className="text-primary text-xs font-mono">
          PROFICIENCY: {payload[0].value}%
        </p>
      </div>
    );
  }
  return null;
};

const SkillsView = () => {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-8 shrink-0">
        <h2 className="text-4xl font-bold text-white mb-2">Competency Matrix</h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm">Quantifiable metrics of technical proficiency and professional interests.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
        {/* Radar Chart Section */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col items-center justify-center relative order-2 lg:order-1 min-h-[400px]">
          <div className="absolute top-4 left-4 p-2 bg-white/5 rounded border border-white/10">
             <span className="material-symbols-outlined text-primary">data_usage</span>
          </div>
          <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={SKILL_METRICS}>
                <PolarGrid stroke="#ffffff20" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'Space Mono' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Radar
                  name="Skills"
                  dataKey="A"
                  stroke="rgb(var(--color-primary))"
                  strokeWidth={2}
                  fill="#7000ff"
                  fillOpacity={0.4}
                  isAnimationActive={true}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* List & Cloud Section */}
        <div className="flex flex-col gap-6 order-1 lg:order-2 overflow-y-auto pr-2 scrollbar-hide">
           {/* Detail List */}
           <div className="glass-panel rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">list_alt</span>
                Detailed Protocols
              </h3>
              <div className="space-y-3">
                {SKILL_METRICS.map((skill, idx) => (
                  <div key={idx} className="group cursor-default">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-300 font-mono">{skill.subject}</span>
                      <span className="text-xs text-primary">{skill.A}%</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-1000 ease-out" 
                        style={{
                          width: animate ? `${skill.A}%` : '0%',
                          transitionDelay: `${idx * 50}ms`
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
           </div>

           {/* Interests Cloud */}
           <div className="glass-panel rounded-2xl p-6 flex-1 flex flex-col justify-center">
              <h3 className="text-lg font-bold text-secondary mb-4 text-center">Core Interests</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {INTERESTS.map((interest, idx) => (
                  <span 
                    key={idx} 
                    className={`px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-primary/50 text-xs text-gray-300 hover:text-white transition-all duration-500 cursor-default hover:scale-105 ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ transitionDelay: `${(idx * 50) + 600}ms` }}
                  >
                    {interest}
                  </span>
                ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const InfoPill = ({ icon, text, onClick }: { icon: string, text: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-2 text-xs text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 hover:border-primary/30 transition-colors ${onClick ? 'cursor-pointer hover:bg-white/10 hover:text-white' : 'cursor-default'}`}
  >
    <span className="material-symbols-outlined text-[14px] text-primary">{icon}</span>
    <span className="truncate max-w-[200px]">{text}</span>
  </div>
);

// --- Neural Assistant Chat Widget ---
const NeuralChatWidget = ({ currentThemeHex }: { currentThemeHex: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: `Neural Link Established. I am Anubhav's automated assistant. Ask me about his projects, skills, or research.`, timestamp: Date.now() }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Clean up audio on unmount
  useEffect(() => {
      return () => {
          stopVoiceSession();
      }
  }, []);

  // Offline Simulation Logic
  const getSimulationResponse = (query: string) => {
    const lowerInput = query.toLowerCase();
    let reply = "SIMULATION MODE: Neural Uplink Offline (No API Key). Providing cached data.";
    
    if (lowerInput.includes('project')) reply = "Anubhav has worked on key projects like the High-Precision Textual Verification System using BERT/RoBERTa and a Cross-Platform Component Library.";
    else if (lowerInput.includes('skill') || lowerInput.includes('tech')) reply = "Core competencies include Python (AI), React, Node.js, and Transformer models (BERT, RoBERTa).";
    else if (lowerInput.includes('contact') || lowerInput.includes('email')) reply = `You can reach Anubhav at ${RESUME_DATA.email}.`;
    else if (lowerInput.includes('hello') || lowerInput.includes('hi')) reply = "Greetings. Accessing local database...";
    else reply = "I am currently running in offline mode. I can answer basic questions about projects and skills, but live generative capabilities are disabled.";
    
    return reply;
  };

  const stopVoiceSession = () => {
      setIsVoiceActive(false);
      if (sessionRef.current) {
          // sessionRef.current.close(); 
      }
      if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
      }
      if (inputAudioContextRef.current) {
          inputAudioContextRef.current.close();
          inputAudioContextRef.current = null;
      }
      sourcesRef.current.forEach(source => source.stop());
      sourcesRef.current.clear();
      nextStartTimeRef.current = 0;
  };

  const startVoiceSession = async () => {
      // Check for API Key first
      if (apiKey === 'demo_key') {
          setMessages(prev => [...prev, { role: 'model', text: "Voice uplink requires a valid API Key configuration. Please deploy with a valid key.", timestamp: Date.now() }]);
          return;
      }

      if (isVoiceActive) {
          stopVoiceSession();
          return;
      }

      setIsVoiceActive(true);
      setMessages(prev => [...prev, { role: 'model', text: "Voice uplink initialized. Listening...", timestamp: Date.now() }]);
      
      try {
          // Initialize Audio Contexts
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
          const outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
          
          inputAudioContextRef.current = inputAudioContext;
          audioContextRef.current = outputAudioContext;
          
          const outputNode = outputAudioContext.createGain();
          outputNode.connect(outputAudioContext.destination);

          // Get User Media
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // Demo mode: Voice session is simulated since ai.live API is not available in this SDK version
          // In production, this would connect to Gemini Live API
          setMessages(prev => [...prev, { role: 'model', text: "Voice uplink established. System ready for audio input. (Demo Mode)", timestamp: Date.now() }]);
          
          // Simulate voice feedback
          const mockAudioUrl = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';
          const audioElement = new Audio(mockAudioUrl);
          audioElement.play().catch(() => {
              // Autoplay may be blocked, silently fail
          });
          
          sessionRef.current = Promise.resolve(null);

      } catch (error) {
          console.error("Failed to start voice session", error);
          setIsVoiceActive(false);
          setMessages(prev => [...prev, { role: 'model', text: "Voice hardware initialization failed. Check permissions.", timestamp: Date.now() }]);
      }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Immediate Simulation Check
    if (apiKey === 'demo_key') {
        setTimeout(() => {
            const reply = getSimulationResponse(userMsg.text);
            setMessages(prev => [...prev, { role: 'model', text: reply, timestamp: Date.now() }]);
            setLoading(false);
        }, 600); // Small artificial delay for realism
        return;
    }

    try {
      const contextData = JSON.stringify({ RESUME_DATA, PROJECTS, EDUCATION_HISTORY, CORE_SKILLS });
      const systemPrompt = `You are a high-tech AI assistant for Anubhav Kumar's portfolio. 
          Use the following JSON data to answer questions about him: ${contextData}.
          
          Guidelines:
          1. Be concise and professional but maintain a subtle sci-fi/technological persona (e.g., use phrases like "Data retrieved", "Analyzing...").
          2. If the user asks about something not in the data, state that the information is encrypted or unavailable.
          3. Format your answers in plain text, but use bullet points if listing items.
          4. Keep responses under 50 words unless asked for a detailed explanation.`;
      
      const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const fullPrompt = systemPrompt + "\n\nUser question: " + input;
      const response = await model.generateContent(fullPrompt);
      
      const reply = response.response?.text() || "Data corrupted. Please retry.";
      setMessages(prev => [...prev, { role: 'model', text: reply, timestamp: Date.now() }]);
    } catch (error) {
      console.error("API Error", error);
      // Fallback Simulation Mode (Network Error)
      setTimeout(() => {
         const reply = getSimulationResponse(input);
         setMessages(prev => [...prev, { role: 'model', text: reply, timestamp: Date.now() }]);
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end relative">
      {/* 3D Orb Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-300 hover:scale-110 z-50 focus:outline-none"
      >
        <div className="absolute inset-0 bg-black/50 rounded-full blur-md"></div>
        <NeuralOrb state={isVoiceActive ? 'active' : (loading ? 'processing' : (isOpen ? 'active' : 'idle'))} themeHex={currentThemeHex} />
      </button>

      {/* Holographic Chat Interface */}
      <div className={`
        absolute bottom-20 right-0 w-[350px] md:w-[400px] h-[500px] 
        transition-all duration-300 z-40
        ${isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-90 translate-y-10 pointer-events-none'}
      `}>
        <HolographicCard active={isOpen}>
            <div className="w-full h-full bg-dark/90 backdrop-blur-xl border border-primary/30 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 bg-primary/10 border-b border-primary/20 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isVoiceActive ? 'bg-red-500 animate-pulse' : (loading ? 'bg-yellow-400 animate-ping' : 'bg-green-400 animate-pulse')}`}></span>
                    <span className="text-primary font-mono text-xs tracking-widest">{isVoiceActive ? 'VOICE_UPLINK_ACTIVE' : (apiKey !== 'demo_key' ? 'NEURAL_ASSISTANT_V2' : 'OFFLINE_SIMULATION_MODE')}</span>
                </div>
                <div className="flex gap-2">
                     <button onClick={startVoiceSession} className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${isVoiceActive ? 'text-red-500 bg-red-500/10' : 'text-primary'}`}>
                        <span className="material-symbols-outlined text-lg">{isVoiceActive ? 'mic_off' : 'mic'}</span>
                     </button>
                    <span className="material-symbols-outlined text-primary/50 text-sm pt-1">wifi</span>
                </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-gradient-to-b from-transparent to-black/40">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-lg text-sm shadow-lg backdrop-blur-sm ${
                        msg.role === 'user' 
                        ? 'bg-primary/20 text-white border border-primary/20 rounded-tr-none' 
                        : 'bg-white/5 text-gray-300 border border-white/10 rounded-tl-none'
                    }`}>
                        {msg.text}
                    </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                    <div className="bg-white/5 px-3 py-3 rounded-lg rounded-tl-none border border-white/10 flex flex-col gap-2 w-3/4 animate-pulse">
                        <SkeletonBlock className="w-full h-2 rounded-full" />
                        <SkeletonBlock className="w-2/3 h-2 rounded-full" />
                    </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-white/10 bg-black/40">
                <div className="relative flex items-center gap-2">
                    <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={isVoiceActive ? "Voice Mode Active..." : "Query Neural Database..."}
                    disabled={isVoiceActive}
                    className="flex-1 bg-white/5 border border-white/10 rounded px-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50 placeholder-gray-500 font-mono shadow-inner disabled:opacity-50"
                    />
                    <button 
                    onClick={handleSend}
                    disabled={loading || isVoiceActive}
                    className="p-2 rounded bg-primary/20 text-primary hover:bg-primary hover:text-black transition-colors disabled:opacity-50 shadow-[0_0_10px_rgb(var(--color-primary)/0.2)]"
                    >
                    <span className="material-symbols-outlined text-lg">send</span>
                    </button>
                </div>
                </div>
            </div>
        </HolographicCard>
      </div>
    </div>
  );
};

export default App