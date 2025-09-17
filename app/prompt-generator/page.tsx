'use client';

import { useState, useEffect } from 'react';

type PromptType = 'image' | 'video';
type StyleType = 'realistic' | 'artistic' | 'cinematic' | 'abstract' | 'vintage' | 'futuristic' | 'minimalist';
type EnvironmentType = 'studio' | 'outdoor' | 'urban' | 'nature' | 'interior' | 'fantasy' | 'space' | 'underwater';
type ThemeType = 'colorful' | 'monochrome' | 'bright' | 'dark' | 'warm' | 'cool' | 'neon' | 'pastel';
type MoodType = 'peaceful' | 'energetic' | 'dramatic' | 'mysterious' | 'playful' | 'serene' | 'intense' | 'dreamy';

export default function PromptGenerator() {
  const [promptType, setPromptType] = useState<PromptType>('image');
  const [style, setStyle] = useState<StyleType>('realistic');
  const [environment, setEnvironment] = useState<EnvironmentType>('studio');
  const [theme, setTheme] = useState<ThemeType>('colorful');
  const [mood, setMood] = useState<MoodType>('peaceful');
  const [promptCount, setPromptCount] = useState<number>(3);
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Dropdown states
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [environmentDropdownOpen, setEnvironmentDropdownOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [moodDropdownOpen, setMoodDropdownOpen] = useState(false);

  const styles = [
    { value: 'realistic', label: 'Realistic' },
    { value: 'artistic', label: 'Artistic' },
    { value: 'cinematic', label: 'Cinematic' },
    { value: 'abstract', label: 'Abstract' },
    { value: 'vintage', label: 'Vintage' },
    { value: 'futuristic', label: 'Futuristic' },
    { value: 'minimalist', label: 'Minimalist' }
  ];

  const environments = [
    { value: 'studio', label: 'Studio' },
    { value: 'outdoor', label: 'Outdoor' },
    { value: 'urban', label: 'Urban' },
    { value: 'nature', label: 'Nature' },
    { value: 'interior', label: 'Interior' },
    { value: 'fantasy', label: 'Fantasy' },
    { value: 'space', label: 'Space' },
    { value: 'underwater', label: 'Underwater' }
  ];

  const themes = [
    { value: 'colorful', label: 'Colorful' },
    { value: 'monochrome', label: 'Monochrome' },
    { value: 'bright', label: 'Bright' },
    { value: 'dark', label: 'Dark' },
    { value: 'warm', label: 'Warm Tones' },
    { value: 'cool', label: 'Cool Tones' },
    { value: 'neon', label: 'Neon' },
    { value: 'pastel', label: 'Pastel' }
  ];

  const moods = [
    { value: 'peaceful', label: 'Peaceful' },
    { value: 'energetic', label: 'Energetic' },
    { value: 'dramatic', label: 'Dramatic' },
    { value: 'mysterious', label: 'Mysterious' },
    { value: 'playful', label: 'Playful' },
    { value: 'serene', label: 'Serene' },
    { value: 'intense', label: 'Intense' },
    { value: 'dreamy', label: 'Dreamy' }
  ];

  // Load saved state from localStorage on component mount
  useEffect(() => {
    const savedPromptType = localStorage.getItem('prompt-generator-promptType');
    const savedStyle = localStorage.getItem('prompt-generator-style');
    const savedEnvironment = localStorage.getItem('prompt-generator-environment');
    const savedTheme = localStorage.getItem('prompt-generator-theme');
    const savedMood = localStorage.getItem('prompt-generator-mood');
    const savedPromptCount = localStorage.getItem('prompt-generator-promptCount');
    const savedAdditionalDetails = localStorage.getItem('prompt-generator-additionalDetails');
    
    if (savedPromptType) setPromptType(savedPromptType as PromptType);
    if (savedStyle) setStyle(savedStyle as StyleType);
    if (savedEnvironment) setEnvironment(savedEnvironment as EnvironmentType);
    if (savedTheme) setTheme(savedTheme as ThemeType);
    if (savedMood) setMood(savedMood as MoodType);
    if (savedPromptCount) setPromptCount(parseInt(savedPromptCount));
    if (savedAdditionalDetails) setAdditionalDetails(savedAdditionalDetails);
  }, []);
  
  // Save state to localStorage whenever values change
  useEffect(() => {
    localStorage.setItem('prompt-generator-promptType', promptType);
  }, [promptType]);
  
  useEffect(() => {
    localStorage.setItem('prompt-generator-style', style);
  }, [style]);
  
  useEffect(() => {
    localStorage.setItem('prompt-generator-environment', environment);
  }, [environment]);
  
  useEffect(() => {
    localStorage.setItem('prompt-generator-theme', theme);
  }, [theme]);
  
  useEffect(() => {
    localStorage.setItem('prompt-generator-mood', mood);
  }, [mood]);
  
  useEffect(() => {
    localStorage.setItem('prompt-generator-promptCount', promptCount.toString());
  }, [promptCount]);
  
  useEffect(() => {
    localStorage.setItem('prompt-generator-additionalDetails', additionalDetails);
  }, [additionalDetails]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setStyleDropdownOpen(false);
        setEnvironmentDropdownOpen(false);
        setThemeDropdownOpen(false);
        setMoodDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const generatePrompts = async () => {
    setIsGenerating(true);
    setGeneratedPrompts([]);
    
    try {
      // Get API key from localStorage
      const apiKey = localStorage.getItem('gemini_api_key');
      
      if (!apiKey) {
        alert('Please set your Gemini API key in Settings first.');
        setIsGenerating(false);
        return;
      }
      
      // Call the API to generate prompts
      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          promptType,
          style,
          environment,
          theme,
          mood,
          promptCount,
          additionalDetails
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate prompts');
      }
      
      const data = await response.json();
      setGeneratedPrompts(data.prompts);
    } catch (error) {
      console.error('Error generating prompts:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate prompts. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {promptType === 'image' ? 'Image Prompt Generator' : 'Video Prompt Generator'}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {promptType === 'image' 
            ? 'Generate general AI image prompts for any creative content'
            : 'Generate general AI video prompts for Veo3 video generation'
          }
        </p>
      </div>

      <div className="card">
        <div className="px-6 py-8">
          {/* Prompt Type Toggle */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Prompt Type
            </label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setPromptType('image')}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 ${
                  promptType === 'image'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Image Prompts
              </button>
              <button
                onClick={() => setPromptType('video')}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 ${
                  promptType === 'video'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Video Prompts (Veo3)
              </button>
            </div>
          </div>
          
          <div className="space-y-6">
            {/* First Row - 3 Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Style Selection */}
              <div className="relative dropdown-container">
                <label className="block text-sm font-medium text-gray-700">
                  Style
                </label>
                <div className="mt-1 relative">
                  <button
                    type="button"
                    onClick={() => setStyleDropdownOpen(!styleDropdownOpen)}
                    className="relative w-full bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] sm:text-sm transition-all duration-200"
                  >
                    <span className="block truncate text-gray-900">{styles.find(s => s.value === style)?.label}</span>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${styleDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {styleDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white max-h-60 rounded-md py-1 text-base border border-gray-200 overflow-auto focus:outline-none sm:text-sm">
                      {styles.map((styleOption) => (
                        <div
                          key={styleOption.value}
                          onClick={() => {
                            setStyle(styleOption.value as StyleType);
                            setStyleDropdownOpen(false);
                          }}
                          className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-[var(--primary-highlight-light)] transition-colors duration-200 ${
                            style === styleOption.value ? 'bg-[var(--primary-highlight-light)] text-gray-900 font-medium' : 'text-gray-900'
                          }`}
                        >
                          <span className={`block truncate ${style === styleOption.value ? 'font-medium' : 'font-normal'}`}>
                            {styleOption.label}
                          </span>
                          {style === styleOption.value && (
                            <span className="absolute inset-y-0 right-0 flex items-center pr-4" style={{ color: 'var(--primary-highlight)' }}>
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Environment Selection */}
              <div className="relative dropdown-container">
                <label className="block text-sm font-medium text-gray-700">
                  Environment
                </label>
                <div className="mt-1 relative">
                  <button
                    type="button"
                    onClick={() => setEnvironmentDropdownOpen(!environmentDropdownOpen)}
                    className="relative w-full bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] sm:text-sm transition-all duration-200"
                  >
                    <span className="block truncate text-gray-900">{environments.find(e => e.value === environment)?.label}</span>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${environmentDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {environmentDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white max-h-60 rounded-md py-1 text-base border border-gray-200 overflow-auto focus:outline-none sm:text-sm">
                      {environments.map((env) => (
                        <div
                          key={env.value}
                          onClick={() => {
                            setEnvironment(env.value as EnvironmentType);
                            setEnvironmentDropdownOpen(false);
                          }}
                          className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-[var(--primary-highlight-light)] transition-colors duration-200 ${
                            environment === env.value ? 'bg-[var(--primary-highlight-light)] text-gray-900 font-medium' : 'text-gray-900'
                          }`}
                        >
                          <span className={`block truncate ${environment === env.value ? 'font-medium' : 'font-normal'}`}>
                            {env.label}
                          </span>
                          {environment === env.value && (
                            <span className="absolute inset-y-0 right-0 flex items-center pr-4" style={{ color: 'var(--primary-highlight)' }}>
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Theme Selection */}
              <div className="relative dropdown-container">
                <label className="block text-sm font-medium text-gray-700">
                  Theme
                </label>
                <div className="mt-1 relative">
                  <button
                    type="button"
                    onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
                    className="relative w-full bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] sm:text-sm transition-all duration-200"
                  >
                    <span className="block truncate text-gray-900">{themes.find(t => t.value === theme)?.label}</span>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${themeDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {themeDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white max-h-60 rounded-md py-1 text-base border border-gray-200 overflow-auto focus:outline-none sm:text-sm">
                      {themes.map((themeOption) => (
                        <div
                          key={themeOption.value}
                          onClick={() => {
                            setTheme(themeOption.value as ThemeType);
                            setThemeDropdownOpen(false);
                          }}
                          className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-[var(--primary-highlight-light)] transition-colors duration-200 ${
                            theme === themeOption.value ? 'bg-[var(--primary-highlight-light)] text-gray-900 font-medium' : 'text-gray-900'
                          }`}
                        >
                          <span className={`block truncate ${theme === themeOption.value ? 'font-medium' : 'font-normal'}`}>
                            {themeOption.label}
                          </span>
                          {theme === themeOption.value && (
                            <span className="absolute inset-y-0 right-0 flex items-center pr-4" style={{ color: 'var(--primary-highlight)' }}>
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mood Selection */}
            <div className="relative dropdown-container">
              <label className="block text-sm font-medium text-gray-700">
                Mood
              </label>
              <div className="mt-1 relative">
                <button
                  type="button"
                  onClick={() => setMoodDropdownOpen(!moodDropdownOpen)}
                  className="relative w-full bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] sm:text-sm transition-all duration-200"
                >
                  <span className="block truncate text-gray-900">{moods.find(m => m.value === mood)?.label}</span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${moodDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                {moodDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white max-h-60 rounded-md py-1 text-base border border-gray-200 overflow-auto focus:outline-none sm:text-sm">
                    {moods.map((moodOption) => (
                      <div
                        key={moodOption.value}
                        onClick={() => {
                          setMood(moodOption.value as MoodType);
                          setMoodDropdownOpen(false);
                        }}
                        className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-[var(--primary-highlight-light)] transition-colors duration-200 ${
                          mood === moodOption.value ? 'bg-[var(--primary-highlight-light)] text-gray-900 font-medium' : 'text-gray-900'
                        }`}
                      >
                        <span className={`block truncate ${mood === moodOption.value ? 'font-medium' : 'font-normal'}`}>
                          {moodOption.label}
                        </span>
                        {mood === moodOption.value && (
                          <span className="absolute inset-y-0 right-0 flex items-center pr-4" style={{ color: 'var(--primary-highlight)' }}>
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Number of Prompts Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Number of Prompts: <span className="font-semibold text-gray-900">{promptCount}</span>
              </label>
              <div className="relative">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={promptCount}
                  onChange={(e) => setPromptCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, var(--primary-highlight) 0%, var(--primary-highlight) ${((promptCount - 1) / 19) * 100}%, #e5e7eb ${((promptCount - 1) / 19) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1</span>
                  <span>20</span>
                </div>
              </div>
              <style jsx>{`
                .slider::-webkit-slider-thumb {
                  appearance: none;
                  height: 20px;
                  width: 20px;
                  border-radius: 50%;
                  background: var(--primary-highlight);
                  cursor: pointer;
                  border: 2px solid #fff;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                .slider::-moz-range-thumb {
                  height: 20px;
                  width: 20px;
                  border-radius: 50%;
                  background: var(--primary-highlight);
                  cursor: pointer;
                  border: 2px solid #fff;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
              `}</style>
            </div>

            {/* Additional Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Details (Optional)
              </label>
              <textarea
                value={additionalDetails}
                onChange={(e) => setAdditionalDetails(e.target.value)}
                placeholder={promptType === 'image' 
                  ? "Add specific details like hair color, accessories, pose, lighting, etc."
                  : "Add specific details like camera angles, movements, duration, special effects, etc."
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
              />
            </div>

            {/* Generate Button */}
            <div>
              <button
                onClick={generatePrompts}
                disabled={isGenerating}
                className="w-full flex justify-center py-3 px-6 border border-transparent rounded-lg text-sm font-semibold btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating 
                  ? 'Generating Prompts...' 
                  : `Generate ${promptType === 'image' ? 'Image' : 'Video'} Prompts`
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Prompts */}
      {generatedPrompts.length > 0 && (
        <div className="card">
          <div className="px-6 py-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Generated {promptType === 'image' ? 'Image' : 'Video'} Prompts
            </h3>
            <div className="space-y-4">
              {generatedPrompts.map((prompt, index) => (
                <div key={index} className="bg-gray-50 rounded-md p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-sm font-medium text-gray-900">Prompt {index + 1}</h4>
                    <button
                      onClick={() => copyToClipboard(prompt)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-semibold rounded-md transition-all duration-200 hover:transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2"
                      style={{ 
                        backgroundColor: 'var(--primary-highlight)', 
                        color: '#1f2937',
                        boxShadow: '0 0 0 3px var(--primary-highlight-light)' 
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{prompt}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <button
                onClick={() => copyToClipboard(generatedPrompts.join('\n\n'))}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md transition-all duration-200 hover:transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ 
                  backgroundColor: 'var(--primary-highlight)', 
                  color: '#1f2937',
                  boxShadow: '0 0 0 3px var(--primary-highlight-light)' 
                }}
              >
                Copy All Prompts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}