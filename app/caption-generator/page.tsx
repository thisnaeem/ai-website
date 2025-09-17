'use client';

import { useState, useEffect } from 'react';

type Platform = 'facebook' | 'threads';
type Topic = 'Jobs' | 'Princess leonar' | 'USA girl' | 'sheikha mahira';
type PostType = 'profile post' | 'group post' | 'page post';

interface GeneratedContent {
  captions: string[];
  comments?: string[];
}

export default function CaptionGenerator() {
  const [platform, setPlatform] = useState<Platform>('facebook');
  const [selectedTopic, setSelectedTopic] = useState<Topic>('Jobs');
  const [selectedPostType, setSelectedPostType] = useState<PostType>('profile post');
  const [captionCount, setCaptionCount] = useState<number>(3);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);
  const [postTypeDropdownOpen, setPostTypeDropdownOpen] = useState(false);
  const [captionCountDropdownOpen, setCaptionCountDropdownOpen] = useState(false);
  
  // Link functionality
  const [includeLink, setIncludeLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  
  // Auto mode functionality
  const [autoMode, setAutoMode] = useState(false);
  
  // Individual comment generation
  const [generatingComments, setGeneratingComments] = useState<{[key: number]: boolean}>({});
  
  // Load saved state from localStorage on component mount
  useEffect(() => {
    const savedPlatform = localStorage.getItem('caption-generator-platform');
    const savedTopic = localStorage.getItem('caption-generator-topic');
    const savedPostType = localStorage.getItem('caption-generator-postType');
    const savedCaptionCount = localStorage.getItem('caption-generator-captionCount');
    const savedIncludeLink = localStorage.getItem('caption-generator-includeLink');
    const savedLinkUrl = localStorage.getItem('caption-generator-linkUrl');
    const savedAutoMode = localStorage.getItem('caption-generator-autoMode');
    
    if (savedPlatform) setPlatform(savedPlatform as Platform);
    if (savedTopic) setSelectedTopic(savedTopic as Topic);
    if (savedPostType) setSelectedPostType(savedPostType as PostType);
    if (savedCaptionCount) setCaptionCount(parseInt(savedCaptionCount));
    if (savedIncludeLink) setIncludeLink(savedIncludeLink === 'true');
    if (savedLinkUrl) setLinkUrl(savedLinkUrl);
    if (savedAutoMode) setAutoMode(savedAutoMode === 'true');
  }, []);
  
  // Save state to localStorage whenever values change
  useEffect(() => {
    localStorage.setItem('caption-generator-platform', platform);
  }, [platform]);
  
  useEffect(() => {
    localStorage.setItem('caption-generator-topic', selectedTopic);
  }, [selectedTopic]);
  
  useEffect(() => {
    localStorage.setItem('caption-generator-postType', selectedPostType);
  }, [selectedPostType]);
  
  useEffect(() => {
    localStorage.setItem('caption-generator-captionCount', captionCount.toString());
  }, [captionCount]);
  
  useEffect(() => {
    localStorage.setItem('caption-generator-includeLink', includeLink.toString());
  }, [includeLink]);
  
  useEffect(() => {
    localStorage.setItem('caption-generator-linkUrl', linkUrl);
  }, [linkUrl]);
  
  useEffect(() => {
    localStorage.setItem('caption-generator-autoMode', autoMode.toString());
  }, [autoMode]);

  const topics: Topic[] = ['Jobs', 'Princess leonar', 'USA girl', 'sheikha mahira'];
  const postTypes: PostType[] = ['profile post', 'group post', 'page post'];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setTopicDropdownOpen(false);
        setPostTypeDropdownOpen(false);
        setCaptionCountDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const generateCaptions = async () => {
    setIsGenerating(true);
    setGeneratedContent(null);
    
    try {
      // Get API key from localStorage
      const apiKey = localStorage.getItem('gemini_api_key');
      
      if (!apiKey) {
        alert('Please set your Gemini API key in Settings first.');
        setIsGenerating(false);
        return;
      }
      
      // Call the API to generate captions
      const response = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          platform,
          topic: selectedTopic,
          postType: selectedPostType,
          captionCount: autoMode ? 1 : captionCount,
          includeLink,
          linkUrl: includeLink ? linkUrl : undefined,
          generateComments: true
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate captions');
      }
      
      const data = await response.json();
      setGeneratedContent(data);
    } catch (error) {
      console.error('Error generating captions:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate captions. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateIndividualComment = async (captionIndex: number, caption: string) => {
    setGeneratingComments(prev => ({ ...prev, [captionIndex]: true }));
    
    try {
      const apiKey = localStorage.getItem('gemini_api_key');
      
      if (!apiKey) {
        alert('Please set your Gemini API key in Settings first.');
        return;
      }
      
      const response = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          platform,
          topic: selectedTopic,
          postType: selectedPostType,
          captionCount: 1,
           generateComments: true,
           specificCaption: caption,
          includeLink,
          linkUrl: includeLink ? linkUrl : undefined
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate comment');
      }
      
      const data = await response.json();
      
      if (data.comments && data.comments[0]) {
        setGeneratedContent(prev => {
          if (!prev) return prev;
          const newComments = [...(prev.comments || [])];
          newComments[captionIndex] = data.comments[0];
          return { ...prev, comments: newComments };
        });
      }
    } catch (error) {
      console.error('Error generating comment:', error);
      alert('Failed to generate comment. Please try again.');
    } finally {
      setGeneratingComments(prev => ({ ...prev, [captionIndex]: false }));
    }
  };

  const copyToClipboard = async (text: string, isCaption: boolean = false) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      
      // Auto-generate new caption if auto mode is enabled and a caption was copied
      if (autoMode && isCaption && !isGenerating) {
        setTimeout(() => {
          generateCaptions();
        }, 500); // Small delay to show the copy action completed
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Caption Generator</h1>
        <p className="mt-1 text-sm text-gray-600">
          Generate engaging captions for Facebook and Threads
        </p>
      </div>

      <div className="card">
        <div className="px-6 py-8">
          <div className="space-y-6">
            {/* Platform Toggle */}
            <div>
              <label className="text-base font-medium text-gray-900">Platform</label>
              <div className="mt-4">
                <div className="relative inline-flex bg-gray-100 rounded-lg p-1 w-64">
                  <div
                    className={`absolute top-1 bottom-1 rounded-md transition-transform duration-200 ease-in-out ${
                      platform === 'threads' ? 'left-1/2 right-1' : 'left-1 right-1/2'
                    }`}
                    style={{ backgroundColor: '#c8f300' }}
                  />
                  <button
                     onClick={() => setPlatform('facebook')}
                     className={`relative z-10 flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
                       platform === 'facebook'
                         ? 'text-black'
                         : 'text-gray-600 hover:text-gray-800'
                     }`}
                   >
                     Facebook
                   </button>
                   <button
                     onClick={() => setPlatform('threads')}
                     className={`relative z-10 flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
                       platform === 'threads'
                         ? 'text-black'
                         : 'text-gray-600 hover:text-gray-800'
                     }`}
                   >
                     Threads
                   </button>
                </div>
              </div>
            </div>

            {/* Topic and Post Type Selection - Same Line */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Topic Selection */}
              <div className="relative dropdown-container">
                <label className="block text-sm font-medium text-gray-700">
                  Topic
                </label>
                <div className="mt-1 relative">
                  <button
                    type="button"
                    onClick={() => setTopicDropdownOpen(!topicDropdownOpen)}
                    className="relative w-full bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] sm:text-sm transition-all duration-200"
                  >
                    <span className="block truncate text-gray-900">{selectedTopic}</span>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${topicDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {topicDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white max-h-60 rounded-md py-1 text-base border border-gray-200 overflow-auto focus:outline-none sm:text-sm">
                      {topics.map((topic) => (
                        <div
                          key={topic}
                          onClick={() => {
                            setSelectedTopic(topic);
                            setTopicDropdownOpen(false);
                          }}
                          className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-[var(--primary-highlight-light)] transition-colors duration-200 ${
                            selectedTopic === topic ? 'bg-[var(--primary-highlight-light)] text-gray-900 font-medium' : 'text-gray-900'
                          }`}
                        >
                          <span className={`block truncate ${selectedTopic === topic ? 'font-medium' : 'font-normal'}`}>
                            {topic}
                          </span>
                          {selectedTopic === topic && (
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

              {/* Post Type Selection */}
              <div className="relative dropdown-container">
                <label className="block text-sm font-medium text-gray-700">
                  Post Type
                </label>
                <div className="mt-1 relative">
                  <button
                    type="button"
                    onClick={() => setPostTypeDropdownOpen(!postTypeDropdownOpen)}
                    className="relative w-full bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] sm:text-sm transition-all duration-200"
                  >
                    <span className="block truncate text-gray-900">{selectedPostType}</span>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${postTypeDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {postTypeDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white max-h-60 rounded-md py-1 text-base border border-gray-200 overflow-auto focus:outline-none sm:text-sm">
                      {postTypes.map((type) => (
                        <div
                          key={type}
                          onClick={() => {
                            setSelectedPostType(type);
                            setPostTypeDropdownOpen(false);
                          }}
                          className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-[var(--primary-highlight-light)] transition-colors duration-200 ${
                            selectedPostType === type ? 'bg-[var(--primary-highlight-light)] text-gray-900 font-medium' : 'text-gray-900'
                          }`}
                        >
                          <span className={`block truncate ${selectedPostType === type ? 'font-medium' : 'font-normal'}`}>
                            {type}
                          </span>
                          {selectedPostType === type && (
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

            {/* Auto Mode Toggle */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Auto Mode
                </label>
                <button
                  type="button"
                  onClick={() => setAutoMode(!autoMode)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    autoMode
                      ? 'bg-[var(--primary-highlight)] focus:ring-[var(--primary-highlight)]'
                      : 'bg-gray-200 focus:ring-gray-500'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      autoMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {autoMode 
                  ? 'Automatically generates 1 caption and creates a new one when copied'
                  : 'Manually select number of captions to generate'
                }
              </p>
            </div>

            {/* Caption Count Slider */}
            {!autoMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Number of Captions: <span className="font-semibold text-gray-900">{captionCount}</span>
                </label>
              <div className="relative">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={captionCount}
                  onChange={(e) => setCaptionCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, var(--primary-highlight) 0%, var(--primary-highlight) ${((captionCount - 1) / 19) * 100}%, #e5e7eb ${((captionCount - 1) / 19) * 100}%, #e5e7eb 100%)`
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
            )}

            {/* Link Toggle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Include Link in Captions & Comments
                </label>
                <button
                  type="button"
                  onClick={() => setIncludeLink(!includeLink)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:ring-offset-2 ${
                    includeLink ? 'bg-[var(--primary-highlight)]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                      includeLink ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {includeLink && (
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Enter your link URL (e.g., https://example.com)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
                />
              )}
            </div>



            {/* Generate Button */}
            <div>
              <button
                onClick={generateCaptions}
                disabled={isGenerating}
                className="w-full flex justify-center py-3 px-6 border border-transparent rounded-lg text-sm font-semibold btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Generating...' : 'Generate Captions'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Content */}
      {generatedContent && (
        <div className="space-y-4">
          {/* Captions Section */}
          <div className="card">
            <div className="px-6 py-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Generated Captions</h3>
              <div className="space-y-6">
                {generatedContent.captions.map((caption, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Caption {index + 1}</h4>
                    
                    {/* Caption and Comment Side by Side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Caption */}
                      <div>
                        <h5 className="text-xs font-medium text-gray-600 mb-2">Caption</h5>
                        <div className="bg-gray-50 rounded-md p-3">
                          <p className="text-gray-700 mb-3">{caption}</p>
                          <button
                            onClick={() => copyToClipboard(caption, true)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-semibold rounded-md transition-all duration-200 hover:transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2"
                            style={{ 
                              backgroundColor: 'var(--primary-highlight)', 
                              color: '#1f2937',
                              boxShadow: '0 0 0 3px var(--primary-highlight-light)' 
                            }}
                          >
                            Copy Caption
                          </button>
                        </div>
                      </div>
                      
                      {/* Comment */}
                      <div>
                        <h5 className="text-xs font-medium text-gray-600 mb-2">Comment</h5>
                        {generatedContent.comments && generatedContent.comments[index] ? (
                          <div className="bg-blue-50 rounded-md p-3">
                            <p className="text-gray-700 mb-3">{generatedContent.comments[index]}</p>
                            <button
                              onClick={() => copyToClipboard(generatedContent.comments![index])}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-semibold rounded-md transition-all duration-200 hover:transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2"
                              style={{ 
                                backgroundColor: 'var(--primary-highlight)', 
                                color: '#1f2937',
                                boxShadow: '0 0 0 3px var(--primary-highlight-light)' 
                              }}
                            >
                              Copy Comment
                            </button>
                          </div>
                        ) : (
                          <div className="bg-gray-100 rounded-md p-3 text-center">
                            <p className="text-gray-500 text-sm">No comment generated</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}