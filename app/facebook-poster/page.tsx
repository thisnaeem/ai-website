'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { startScheduler, isSchedulerRunning } from '@/lib/scheduler';

type PostType = 'text' | 'image' | 'video' | 'carousel' | 'reel';

interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
  picture?: string;
  followersCount?: number;
}

interface UploadedFile {
  file: File;
  url: string;
  publicId: string;
}

function FacebookPosterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [postType, setPostType] = useState<PostType>('image');
  const [selectedPageId, setSelectedPageId] = useState('');
  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
  const [postContent, setPostContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [carouselImages, setCarouselImages] = useState<string[]>(['', '']);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{url: string, publicId: string, resourceType: string}>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [cloudinaryConfig, setCloudinaryConfig] = useState<{cloudName: string, apiKey: string, apiSecret: string} | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [firstComment, setFirstComment] = useState('');
  const [postFirstComment, setPostFirstComment] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState([]);
  
  // Get active tab from URL or default to manual
  const activeTab = (searchParams.get('tab') as 'manual' | 'automation' | 'scheduled') || 'manual';
  
  // Function to handle tab changes
  const setActiveTab = (tab: 'manual' | 'automation' | 'scheduled') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`?${params.toString()}`);
  };
  
  // Function to handle page selection with persistence
  const handlePageSelection = (pageId: string) => {
    setSelectedPageId(pageId);
    localStorage.setItem('selected_page_id', pageId);
    setIsDropdownOpen(false);
  };
  
  // Automation specific states
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  const [multipleFiles, setMultipleFiles] = useState<UploadedFile[]>([]);
  
  // Filter state for scheduled posts
  const [filterPageId, setFilterPageId] = useState<string>('all');


  // Load scheduled posts
  const loadScheduledPosts = async () => {
    try {
      const response = await fetch('/api/scheduled-posts');
      if (response.ok) {
        const posts = await response.json();
        setScheduledPosts(posts);
      }
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
    }
  };

  // Schedule a new post
  const schedulePost = async () => {
    if (!selectedPageId || multipleFiles.length === 0) {
      showToast('Please select a page and upload a file', 'error');
      return;
    }

    try {
      setIsPosting(true);
      
      const mediaUrls: string[] = [];
      
      // Use already uploaded Cloudinary URLs
      if (multipleFiles.length > 0) {
        for (const uploadedFile of multipleFiles) {
          mediaUrls.push(uploadedFile.url);
        }
      }
      
      const selectedPage = facebookPages.find(page => page.id === selectedPageId);
      
      // Schedule for immediate posting (current time)
      const now = new Date();
      
      // Create individual posts for each uploaded file
      const createdPosts = [];
      
      for (let i = 0; i < mediaUrls.length; i++) {
         const mediaUrl = mediaUrls[i];
         const scheduledTime = i === 0 ? now : new Date(now.getTime() + (i * intervalMinutes * 60000)); // First post immediate, rest staggered
        
        const response = await fetch('/api/scheduled-posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: postType === 'image' ? 'Image' : 'Reel',
            content: postContent || '',
            postType,
            mediaUrls: [mediaUrl], // Single media URL per post
            carouselImages: [],
            pageId: selectedPageId,
            pageName: selectedPage?.name || '',
            scheduledFor: scheduledTime.toISOString(),
            intervalMinutes: intervalMinutes,
            isRecurring: true,
            firstComment,
            postFirstComment
          })
        });
        
        if (response.ok) {
          const postData = await response.json();
          createdPosts.push(postData);
        }
      }
      
      if (createdPosts.length > 0) {
         showToast(`${createdPosts.length} posts scheduled successfully!`, 'success');
         // Clear form
         setPostContent('');
         setMultipleFiles([]);
         setFirstComment('');
         setPostFirstComment(false);
         // Reload scheduled posts
         loadScheduledPosts();
       } else {
         throw new Error('Failed to create scheduled posts');
       }
    } catch (error) {
      console.error('Error starting automation:', error);
      showToast('Failed to start automation', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  // Delete a scheduled post
  const deleteScheduledPost = async (postId: string) => {
    try {
      const response = await fetch(`/api/scheduled-posts?id=${postId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        showToast('Post deleted successfully!', 'success');
        loadScheduledPosts();
      } else {
        throw new Error('Failed to delete post');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      showToast('Failed to delete post', 'error');
    }
  };



  const postTypes = [
    { value: 'text', label: 'Text', icon: '📝' },
    { value: 'image', label: 'Image', icon: '🖼️' },
    { value: 'video', label: 'Reel', icon: '🎥' },
    { value: 'carousel', label: 'Carousel', icon: '🎠' },
    
  ];

  useEffect(() => {
    // Load Facebook pages from localStorage
    const savedPages = localStorage.getItem('facebook_pages');
    if (savedPages) {
      const pages = JSON.parse(savedPages);
      setFacebookPages(pages);
      
      // Load previously selected page or default to first page
      const savedSelectedPageId = localStorage.getItem('selected_page_id');
      if (savedSelectedPageId && pages.find((p: FacebookPage) => p.id === savedSelectedPageId)) {
        setSelectedPageId(savedSelectedPageId);
      } else if (pages.length > 0) {
        setSelectedPageId(pages[0].id);
        localStorage.setItem('selected_page_id', pages[0].id);
      }
    }
    
    // Load Cloudinary config from localStorage
    const cloudName = localStorage.getItem('cloudinary_cloud_name');
    const apiKey = localStorage.getItem('cloudinary_api_key');
    const apiSecret = localStorage.getItem('cloudinary_api_secret');
    
    if (cloudName && apiKey && apiSecret) {
      setCloudinaryConfig({ cloudName, apiKey, apiSecret });
    }
    
    // Load scheduled posts
    loadScheduledPosts();
    
    // Auto-start scheduler if Facebook pages are available
    if (savedPages && JSON.parse(savedPages).length > 0 && !isSchedulerRunning()) {
      startScheduler();
    }
  }, []);

  // Load scheduled posts when switching to scheduled tab
  useEffect(() => {
    if (activeTab === 'scheduled') {
      loadScheduledPosts();
    }
  }, [activeTab]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const addCarouselImage = () => {
    if (carouselImages.length < 10) {
      setCarouselImages([...carouselImages, '']);
    }
  };

  const removeCarouselImage = (index: number) => {
    if (carouselImages.length > 2) {
      setCarouselImages(carouselImages.filter((_, i) => i !== index));
    }
  };

  const updateCarouselImage = (index: number, url: string) => {
    const updated = [...carouselImages];
    updated[index] = url;
    setCarouselImages(updated);
  };

  const uploadFileToCloudinary = async (file: File, resourceType: string = 'auto') => {
    if (!cloudinaryConfig) {
      alert('Please configure Cloudinary in Settings first.');
      return null;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cloudName', cloudinaryConfig.cloudName);
      formData.append('apiKey', cloudinaryConfig.apiKey);
      formData.append('apiSecret', cloudinaryConfig.apiSecret);
      formData.append('resourceType', resourceType);
      
      const response = await fetch('/api/cloudinary-upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }
      
      const data = await response.json();
      const uploadedFile = {
        url: data.url,
        publicId: data.publicId,
        resourceType: data.resourceType
      };
      
      setUploadedFiles(prev => [...prev, uploadedFile]);
      return uploadedFile;
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteUploadedFiles = async () => {
    if (!cloudinaryConfig || uploadedFiles.length === 0) return;
    
    try {
      for (const file of uploadedFiles) {
        await fetch('/api/cloudinary-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            publicId: file.publicId,
            cloudName: cloudinaryConfig.cloudName,
            apiKey: cloudinaryConfig.apiKey,
            apiSecret: cloudinaryConfig.apiSecret,
            resourceType: file.resourceType
          })
        });
      }
      setUploadedFiles([]);
    } catch (error) {
      console.error('Error deleting uploaded files:', error);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000); // Auto-hide after 5 seconds
  };

  const postToFacebook = async () => {
    if (!selectedPageId) {
      alert('Please select a Facebook page first.');
      return;
    }

    if (!postContent.trim() && postType === 'text') {
      alert('Please enter post content.');
      return;
    }

    if ((postType === 'image' || postType === 'video' || postType === 'reel') && !mediaUrl.trim()) {
      alert('Please enter media URL.');
      return;
    }

    if (postType === 'carousel' && carouselImages.some(url => !url.trim())) {
      alert('Please fill all carousel image URLs.');
      return;
    }

    setIsPosting(true);
    
    try {
      const selectedPage = facebookPages.find(page => page.id === selectedPageId);
      if (!selectedPage) {
        throw new Error('Selected page not found');
      }

      const response = await fetch('/api/facebook-post', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'x-facebook-pages': JSON.stringify(facebookPages)
         },
         body: JSON.stringify({
           pageId: selectedPageId,
           postType,
           content: postContent,
           mediaUrl: postType === 'carousel' ? undefined : mediaUrl,
           carouselImages: postType === 'carousel' ? carouselImages : undefined
         })
       });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post to Facebook');
      }
      
      const data = await response.json();
      
      // Post first comment if enabled and comment text is provided
      if (postFirstComment && firstComment.trim()) {
        try {
          const selectedPage = facebookPages.find(page => page.id === selectedPageId);
          if (!selectedPage) {
            throw new Error('Selected page not found');
          }
          
          const commentResponse = await fetch('/api/facebook-comment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              postId: data.postId,
              message: firstComment.trim(),
              accessToken: selectedPage.accessToken
            })
          });
          
          if (!commentResponse.ok) {
             const commentError = await commentResponse.json();
             console.error('Comment posting failed:', commentError);
             showToast(`Post successful! Post ID: ${data.postId}. Comment failed: ${commentError.error}`, 'success');
           } else {
             showToast(`Post and comment successful! Post ID: ${data.postId}`, 'success');
           }
         } catch (commentError) {
           console.error('Error posting comment:', commentError);
           showToast(`Post successful! Post ID: ${data.postId}. Comment failed to post.`, 'success');
         }
       } else {
         showToast(`Post successful! Post ID: ${data.postId}`, 'success');
       }
      
      // Delete uploaded files from Cloudinary after successful post
      await deleteUploadedFiles();
      
      // Clear form
      setPostContent('');
      setMediaUrl('');
      setCarouselImages(['', '']);
      setFirstComment('');
      setPostFirstComment(false);
    } catch (error) {
      console.error('Error posting to Facebook:', error);
      showToast(`Error: ${error instanceof Error ? error.message : 'Failed to post to Facebook'}`, 'error');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Facebook Poster</h1>
        <p className="mt-1 text-sm text-gray-600">
          Post content to your Facebook pages with different media types
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
            activeTab === 'manual'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Manual Posting
        </button>
        <button
          onClick={() => setActiveTab('automation')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
            activeTab === 'automation'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Automation
        </button>
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
            activeTab === 'scheduled'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Scheduled Posts
        </button>
      </div>

      {facebookPages.length === 0 && (
        <div className="card">
          <div className="px-6 py-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Facebook Pages Configured</h3>
            <p className="text-gray-600 mb-4">
              Please add your Facebook pages in the Settings page first.
            </p>
            <a
              href="/settings"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md btn-primary"
            >
              Go to Settings
            </a>
          </div>
        </div>
      )}

      {facebookPages.length > 0 && (
        <>
          {/* Manual Posting Tab */}
          {activeTab === 'manual' && (
          <div className="card">
            <div className="px-6 py-8">
              <div className="space-y-6">
                {/* Page Selection */}
                <div className="dropdown-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Facebook Page
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] bg-white text-left flex items-center justify-between"
                    >
                      {(() => {
                        const selectedPage = facebookPages.find(page => page.id === selectedPageId);
                        return selectedPage ? (
                          <div className="flex items-center space-x-3">
                            {selectedPage.picture && (
                              <img
                                src={selectedPage.picture}
                                alt={`${selectedPage.name} profile`}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            )}
                            <span className="text-gray-900">{selectedPage.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">Select a page</span>
                        );
                      })()} 
                      <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        isDropdownOpen ? 'rotate-180' : ''
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {facebookPages.map((page) => (
                          <button
                            key={page.id}
                            onClick={() => handlePageSelection(page.id)}
                            className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                              selectedPageId === page.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                            }`}
                          >
                            {page.picture && (
                              <img
                                src={page.picture}
                                alt={`${page.name} profile`}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            )}
                            <span className="font-medium">{page.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Post Type Selection */}
                <div>
                  <label className="text-base font-medium text-gray-900">Post Type</label>
                  <div className="mt-4">
                    <div className="relative inline-flex bg-gray-100 rounded-lg p-1 w-full max-w-2xl">
                      <div
                        className={`absolute top-1 bottom-1 rounded-md transition-transform duration-200 ease-in-out`}
                        style={{ 
                          backgroundColor: '#c8f300',
                          width: '25%',
                          left: postType === 'text' ? '0%' : 
                                postType === 'image' ? '25%' : 
                                postType === 'video' ? '50%' : 
                                postType === 'carousel' ? '75%' : '0%'
                        }}
                      />
                      {postTypes.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setPostType(type.value as PostType)}
                          className={`relative z-10 flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
                            postType === type.value
                              ? 'text-black'
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Post Content {postType === 'text' ? '*' : '(Optional)'}
                  </label>
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Enter your post content here..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
                  />
                </div>

                {/* Media Upload for single media posts */}
                {(postType === 'image' || postType === 'video' || postType === 'reel') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {postType === 'image' ? 'Upload Image *' : postType === 'video' ? 'Upload Video *' : 'Upload Reel *'}
                    </label>
                    
                    {!mediaUrl ? (
                      <div>
                        <input
                          type="file"
                          accept={postType === 'image' ? 'image/*' : 'video/*'}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const resourceType = postType === 'image' ? 'image' : 'video';
                              const uploaded = await uploadFileToCloudinary(file, resourceType);
                              if (uploaded) {
                                setMediaUrl(uploaded.url);
                              }
                            }
                          }}
                          className="hidden"
                          id="media-upload"
                          disabled={isUploading}
                        />
                        <label
                          htmlFor="media-upload"
                          className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md btn-primary ${
                            isUploading ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {isUploading ? 'Uploading...' : `Choose ${postType === 'image' ? 'Image' : postType === 'video' ? 'Video' : 'Reel'}`}
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-sm text-green-700 mb-3">✓ {postType === 'image' ? 'Image' : postType === 'video' ? 'Video' : 'Reel'} uploaded successfully</p>
                          {postType === 'image' ? (
                            <img
                              src={mediaUrl}
                              alt="Uploaded preview"
                              className="w-full max-w-md h-48 object-cover rounded-md border"
                            />
                          ) : (
                            <video
                              src={mediaUrl}
                              controls
                              className="w-full max-w-md h-48 object-cover rounded-md border"
                            />
                          )}
                         </div>
                        <button
                          onClick={() => setMediaUrl('')}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Remove and upload different file
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Carousel Images */}
                {postType === 'carousel' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Carousel Images 
                    </label>
                    
                    {carouselImages.filter(img => img).length === 0 ? (
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length > 0) {
                              const maxFiles = Math.min(files.length, 10);
                              const newImages = ['', ''];
                              
                              for (let i = 0; i < maxFiles; i++) {
                                const uploaded = await uploadFileToCloudinary(files[i], 'image');
                                if (uploaded) {
                                  if (i < 2) {
                                    newImages[i] = uploaded.url;
                                  } else {
                                    newImages.push(uploaded.url);
                                  }
                                }
                              }
                              setCarouselImages(newImages);
                            }
                          }}
                          className="hidden"
                          id="carousel-upload"
                          disabled={isUploading}
                        />
                        <label
                          htmlFor="carousel-upload"
                          className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md btn-primary ${
                            isUploading ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {isUploading ? 'Uploading...' : 'Choose Images'}
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {carouselImages.filter(img => img).map((url, index) => (
                            <div key={index} className="relative">
                              <img
                                src={url}
                                alt={`Carousel image ${index + 1}`}
                                className="w-full h-32 object-cover rounded-md border"
                              />
                              <button
                                onClick={() => {
                                  const newImages = carouselImages.filter((_, i) => i !== carouselImages.indexOf(url));
                                  if (newImages.length < 2) {
                                    newImages.push('', '');
                                  }
                                  setCarouselImages(newImages.slice(0, Math.max(2, newImages.length)));
                                }}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setCarouselImages(['', '']);
                            }}
                            className="px-3 py-2 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50"
                          >
                            Clear All
                          </button>
                          
                          {carouselImages.filter(img => img).length < 10 && (
                            <div>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={async (e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (files.length > 0) {
                                    const currentImages = carouselImages.filter(img => img);
                                    const remainingSlots = 10 - currentImages.length;
                                    const maxFiles = Math.min(files.length, remainingSlots);
                                    
                                    const newImages = [...carouselImages];
                                    
                                    for (let i = 0; i < maxFiles; i++) {
                                      const uploaded = await uploadFileToCloudinary(files[i], 'image');
                                      if (uploaded) {
                                        const emptyIndex = newImages.findIndex(img => !img);
                                        if (emptyIndex !== -1) {
                                          newImages[emptyIndex] = uploaded.url;
                                        } else {
                                          newImages.push(uploaded.url);
                                        }
                                      }
                                    }
                                    setCarouselImages(newImages);
                                  }
                                }}
                                className="hidden"
                                id="carousel-add-more"
                                disabled={isUploading}
                              />
                              <label
                                htmlFor="carousel-add-more"
                                className={`cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-semibold rounded-md text-gray-700 bg-white hover:bg-gray-50 ${
                                  isUploading ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              >
                                {isUploading ? 'Uploading...' : 'Add More Images'}
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* First Comment Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label htmlFor="postFirstComment" className="text-sm font-medium text-gray-700">
                      Post first comment automatically
                    </label>
                    <button
                      type="button"
                      onClick={() => setPostFirstComment(!postFirstComment)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:ring-offset-2 ${
                        postFirstComment ? 'bg-[var(--primary-highlight)]' : 'bg-gray-200'
                      }`}
                      id="postFirstComment"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                          postFirstComment ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {postFirstComment && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Comment (Optional)
                      </label>
                      <textarea
                        value={firstComment}
                        onChange={(e) => setFirstComment(e.target.value)}
                        placeholder="Enter your first comment here..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This comment will be posted automatically after your main post is published.
                      </p>
                    </div>
                  )}
                </div>

                {/* Post Button */}
                <div>
                  <button
                    onClick={postToFacebook}
                    disabled={isPosting || !selectedPageId || (postType !== 'text' && !mediaUrl) || (postType === 'carousel' && carouselImages.filter(img => img).length < 2)}
                    className="w-full flex justify-center py-3 px-6 border border-transparent rounded-lg text-sm font-semibold btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPosting ? 'Posting...' : 'Post to Facebook'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Automation Tab */}
          {activeTab === 'automation' && (
          <div className="card">
            <div className="px-6 py-8">
              <div className="space-y-6">
                {/* Page Selection */}
                <div className="dropdown-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Facebook Page
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] bg-white text-left flex items-center justify-between"
                    >
                      {(() => {
                        const selectedPage = facebookPages.find(page => page.id === selectedPageId);
                        return selectedPage ? (
                          <div className="flex items-center space-x-3">
                            {selectedPage.picture && (
                              <img
                                src={selectedPage.picture}
                                alt={`${selectedPage.name} profile`}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            )}
                            <span className="text-gray-900">{selectedPage.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">Select a page</span>
                        );
                      })()} 
                      <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        isDropdownOpen ? 'rotate-180' : ''
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {facebookPages.map((page) => (
                          <button
                            key={page.id}
                            onClick={() => handlePageSelection(page.id)}
                            className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                              selectedPageId === page.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                            }`}
                          >
                            {page.picture && (
                              <img
                                src={page.picture}
                                alt={`${page.name} profile`}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            )}
                            <span className="font-medium">{page.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Post Type Selection - Limited to image and reel for automation */}
                <div>
                  <label className="text-base font-medium text-gray-900">Post Type</label>
                  <div className="mt-4">
                    <div className="relative inline-flex bg-gray-100 rounded-lg p-1 w-full max-w-md">
                      <div
                        className={`absolute top-1 bottom-1 rounded-md transition-transform duration-200 ease-in-out`}
                        style={{ 
                          backgroundColor: '#c8f300',
                          width: '50%',
                          left: postType === 'image' ? '0%' : '50%'
                        }}
                      />
                      <button
                        onClick={() => setPostType('image')}
                        className={`relative z-10 flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
                          postType === 'image'
                            ? 'text-black'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Image
                      </button>
                      <button
                        onClick={() => setPostType('video')}
                        className={`relative z-10 flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
                          postType === 'video'
                            ? 'text-black'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Reel
                      </button>
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Post Content (Optional)
                  </label>
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Enter your post content here..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] resize-none"
                  />
                </div>

                {/* File Upload for Image/Video */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload {postType === 'image' ? 'Images' : 'Videos'} for Automation *
                  </label>
                  
                  {multipleFiles.length === 0 ? (
                    <div>
                      <input
                         type="file"
                         accept={postType === 'image' ? 'image/*' : 'video/*'}
                         multiple
                         onChange={async (e) => {
                           if (e.target.files) {
                             const files = Array.from(e.target.files);
                             setIsUploading(true);
                             const uploadedFiles = [];
                             
                             for (const file of files) {
                               const resourceType = postType === 'image' ? 'image' : 'video';
                               const uploaded = await uploadFileToCloudinary(file, resourceType);
                               if (uploaded) {
                                 uploadedFiles.push({ file, url: uploaded.url, publicId: uploaded.publicId });
                               }
                             }
                             
                             setMultipleFiles(uploadedFiles);
                             setIsUploading(false);
                           }
                         }}
                         className="hidden"
                         id="automation-upload"
                         disabled={isUploading}
                       />
                      <label
                        htmlFor="automation-upload"
                        className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md btn-primary ${
                          isUploading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {isUploading ? 'Uploading...' : `Choose ${postType === 'image' ? 'Images' : 'Videos'}`}
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-3">
                       <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                         <p className="text-sm text-green-700 mb-3">✓ {multipleFiles.length} file(s) uploaded to Cloudinary for automation</p>
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                           {multipleFiles.map((uploadedFile, index) => (
                             <div key={index} className="relative">
                               <div className="w-full h-32 bg-gray-100 rounded-md border flex items-center justify-center">
                                 {postType === 'image' ? (
                                   <img
                                     src={uploadedFile.url}
                                     alt={`Uploaded ${index + 1}`}
                                     className="w-full h-full object-cover rounded-md"
                                   />
                                 ) : (
                                   <video
                                     src={uploadedFile.url}
                                     className="w-full h-full object-cover rounded-md"
                                     controls={false}
                                     muted
                                   />
                                 )}
                               </div>
                               <button
                                 onClick={() => {
                                   const newFiles = multipleFiles.filter((_, i) => i !== index);
                                   setMultipleFiles(newFiles);
                                 }}
                                 className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                               >
                                 ×
                               </button>
                             </div>
                           ))}
                         </div>
                       </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setMultipleFiles([])}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Remove all files
                        </button>
                        <div>
                          <input
                             type="file"
                             accept={postType === 'image' ? 'image/*' : 'video/*'}
                             multiple
                             onChange={async (e) => {
                               if (e.target.files) {
                                 const files = Array.from(e.target.files);
                                 setIsUploading(true);
                                 const uploadedFiles = [];
                                 
                                 for (const file of files) {
                                   const resourceType = postType === 'image' ? 'image' : 'video';
                                   const uploaded = await uploadFileToCloudinary(file, resourceType);
                                   if (uploaded) {
                                     uploadedFiles.push({ file, url: uploaded.url, publicId: uploaded.publicId });
                                   }
                                 }
                                 
                                 setMultipleFiles([...multipleFiles, ...uploadedFiles]);
                                 setIsUploading(false);
                               }
                             }}
                             className="hidden"
                             id="automation-add-more"
                             disabled={isUploading}
                           />
                          <label
                            htmlFor="automation-add-more"
                            className={`cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-semibold rounded-md text-gray-700 bg-white hover:bg-gray-50 ${
                              isUploading ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            {isUploading ? 'Uploading...' : 'Add More Files'}
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Scheduling */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Posting Interval
                  </label>
                  <select
                    value={intervalMinutes}
                      onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
                    >
                      <option value={1}>1 minute</option>
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                      <option value={360}>6 hours</option>
                      <option value={720}>12 hours</option>
                      <option value={1440}>24 hours</option>
                    </select>
                </div>

                {/* First Comment */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Post first comment automatically
                    </label>
                    <button
                      type="button"
                      onClick={() => setPostFirstComment(!postFirstComment)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:ring-offset-2 ${
                        postFirstComment ? 'bg-[var(--primary-highlight)]' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                          postFirstComment ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {postFirstComment && (
                    <textarea
                      value={firstComment}
                      onChange={(e) => setFirstComment(e.target.value)}
                      placeholder="Enter your first comment here..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] resize-none"
                    />
                  )}
                </div>

                {/* Schedule Button */}
                 <div>
                   <button
                     onClick={schedulePost}
                     disabled={isPosting || !selectedPageId || multipleFiles.length === 0}
                     className="w-full flex justify-center py-3 px-6 border border-transparent rounded-lg text-sm font-semibold btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {isPosting ? 'Starting Automation...' : 'Start Automation'}
                   </button>
                 </div>
              </div>
            </div>
          </div>
          )}

          {/* Scheduled Posts Tab */}
          {activeTab === 'scheduled' && (
          <div className="card">
            <div className="px-6 py-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Scheduled Posts</h3>
                
                {/* Page Filter */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Filter by Page:</label>
                  <select
                    value={filterPageId}
                    onChange={(e) => setFilterPageId(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Pages</option>
                    {facebookPages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Table */}
              <div>
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Page
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Scheduled For
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      const filteredPosts = filterPageId === 'all' 
                         ? scheduledPosts 
                         : scheduledPosts.filter((post: {
                             id: string;
                             title: string;
                             postType: string;
                             pageName: string;
                             pageId: string;
                             status: string;
                             scheduledFor: string;
                             createdAt: string;
                             facebookPostId?: string;
                           }) => post.pageId === filterPageId);
                      
                      return filteredPosts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                            {filterPageId === 'all' ? 'No scheduled posts yet' : 'No posts found for selected page'}
                          </td>
                        </tr>
                      ) : (
                        filteredPosts.map((post: {
                        id: string;
                        title: string;
                        postType: string;
                        pageName: string;
                        pageId: string;
                        status: string;
                        scheduledFor: string;
                        createdAt: string;
                        facebookPostId?: string;
                      }) => {
                        const page = facebookPages.find(p => p.id === post.pageId);
                        return (
                        <tr key={post.id}>
                          <td className="px-4 py-4 text-sm font-medium text-gray-900">
                            {post.postType || post.title}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            <div className="flex items-center space-x-3">
                              {page?.picture ? (
                                <img
                                  src={page.picture}
                                  alt={page.name}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-xs font-medium text-gray-600">
                                    {(post.pageName || 'U').charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <span>{post.pageName || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              post.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                              post.status === 'posted' ? 'bg-green-100 text-green-800' :
                              post.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {post.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            {new Date(post.scheduledFor).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            {new Date(post.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </td>
                          <td className="px-4 py-4 text-sm font-medium">
                            <div className="flex space-x-2">
                              {post.status === 'posted' && post.facebookPostId ? (
                                <button
                                  onClick={() => {
                                    const page = facebookPages.find(p => p.id === post.pageId);
                                    if (page && post.facebookPostId) {
                                      window.open(`https://www.facebook.com/${post.facebookPostId}`, '_blank');
                                    }
                                  }}
                                  className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 text-xs font-medium"
                                >
                                  View Post
                                </button>
                              ) : (
                                <button
                                  onClick={() => {/* TODO: Implement edit function */}}
                                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-xs font-medium"
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                onClick={() => deleteScheduledPost(post.id)}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-xs font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                       })
                       );
                     })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}

          {/* Toast Notification */}
          {toast && (
            <div className={`fixed top-4 right-4 z-50 max-w-sm w-full transform transition-all duration-300 ease-in-out ${
              toast ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            }`}>
              <div className={`rounded-lg shadow-lg border-l-4 p-4 ${
                toast.type === 'success' 
                  ? 'bg-white border-green-500' 
                  : 'bg-white border-red-500'
              }`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {toast.type === 'success' ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className={`text-sm font-medium ${
                      toast.type === 'success' ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {toast.type === 'success' ? 'Success!' : 'Error!'}
                    </p>
                    <p className={`text-sm mt-1 ${
                      toast.type === 'success' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {toast.message}
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <button
                      onClick={() => setToast(null)}
                      className={`inline-flex text-sm ${
                        toast.type === 'success' ? 'text-green-500 hover:text-green-600' : 'text-red-500 hover:text-red-600'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function FacebookPoster() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading...</div></div>}>
      <FacebookPosterContent />
    </Suspense>
  );
}