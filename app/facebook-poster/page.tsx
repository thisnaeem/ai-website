'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { userSettingsAPI, facebookPagesAPI, postsAPI } from '@/lib/api';

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

interface ScheduledPost {
  id: string;
  title: string;
  content?: string;
  postType: string;
  mediaUrls: string[];
  carouselImages: string[];
  pageId: string;
  pageName: string;
  status: string;
  scheduledFor: string;
  intervalMinutes?: number;
  isRecurring: boolean;
  firstComment?: string;
  postFirstComment: boolean;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
  facebookPostId?: string;
  errorMessage?: string;
}

function FacebookPosterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [postType, setPostType] = useState<PostType>('text');
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
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [autoGenerateCaption, ] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [autoGenerateComment, ] = useState(false);
  const [isGeneratingComment, setIsGeneratingComment] = useState(false);
  
  // Automation-specific state variables
  const [automationTopic, setAutomationTopic] = useState('');
  const [automationPlatform, setAutomationPlatform] = useState('facebook');
  const [automationLink, setAutomationLink] = useState('');
  const [isGeneratingAutomationCaptions, setIsGeneratingAutomationCaptions] = useState(false);
  const [isGeneratingAutomationComments, setIsGeneratingAutomationComments] = useState(false);
  const [postCaptions, setPostCaptions] = useState<{[key: number]: string}>({});
  const [postComments, setPostComments] = useState<{[key: number]: string}>({});
  
  // Get active tab from URL or default to manual
  const activeTab = (searchParams.get('tab') as 'manual' | 'automation' | 'scheduled') || 'manual';
  
  // Function to handle tab changes
  const setActiveTab = (tab: 'manual' | 'automation' | 'scheduled') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`?${params.toString()}`);
  };

  // Helper function to get Gemini API key from database
  const getGeminiApiKey = async (): Promise<string | null> => {
    try {
      const settings = await userSettingsAPI.getSettings();
      return settings.geminiApiKey || null;
    } catch (error) {
      console.error('Error fetching Gemini API key from database:', error);
      return null;
    }
  };
  
  // Function to handle page selection with persistence
  const handlePageSelection = async (pageId: string) => {
    setSelectedPageId(pageId);
    try {
      await facebookPagesAPI.setSelectedPage(pageId);
    } catch (error) {
      console.error('Error saving selected page to database:', error);
      // Fallback to localStorage for backward compatibility
      localStorage.setItem('selected_page_id', pageId);
    }
    setIsDropdownOpen(false);
  };
  
  // Automation specific states
  const [intervalMinutes, setIntervalMinutes] = useState<number>(10);
  const [multipleFiles, setMultipleFiles] = useState<UploadedFile[]>([]);
  
  // Filter state for scheduled posts
  const [filterPageId, setFilterPageId] = useState<string>('all');
  
  // Edit state for scheduled posts
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editIntervalMinutes, setEditIntervalMinutes] = useState<number>(10);

  // Validate reel file specifications
  const validateReelFile = async (file: File): Promise<string | null> => {
    // Check file type
    if (!file.type.startsWith('video/')) {
      return 'Reel must be a video file';
    }

    // Check file size (approximate limit for 90 seconds at good quality)
    const maxSizeBytes = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSizeBytes) {
      return 'Reel file size must be under 100MB';
    }

    // Create video element to check duration and dimensions
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        const duration = video.duration;
        const width = video.videoWidth;
        const height = video.videoHeight;
        
        URL.revokeObjectURL(url);
        
        // Check duration (3-90 seconds)
        if (duration < 3) {
          resolve('Reel duration must be at least 3 seconds');
          return;
        }
        if (duration > 90) {
          resolve('Reel duration must not exceed 90 seconds');
          return;
        }
        
        // Check aspect ratio (should be 9:16 or close to it)
        const aspectRatio = width / height;
        const targetAspectRatio = 9 / 16;
        const tolerance = 0.1; // Allow some tolerance
        
        if (Math.abs(aspectRatio - targetAspectRatio) > tolerance) {
          resolve('Reel should have a 9:16 aspect ratio (portrait orientation)');
          return;
        }
        
        // Check minimum resolution (540x960)
        if (width < 540 || height < 960) {
          resolve('Reel resolution must be at least 540x960 pixels');
          return;
        }
        
        resolve(null); // No validation errors
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('Unable to validate video file. Please ensure it\'s a valid video format.');
      };
      
      video.src = url;
    });
  };

  // Load scheduled posts
  const loadScheduledPosts = async () => {
    try {
      const result = await postsAPI.getScheduledPosts();
      // Extract posts array from the response data structure
      const posts = result.posts || [];
      setScheduledPosts(posts);
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
      // Set empty array on error to prevent filter issues
      setScheduledPosts([]);
    }
  };

  // Sync Facebook pages with backend
  const syncFacebookPages = async (pages: FacebookPage[]) => {
    try {
      console.log('Syncing Facebook pages with backend:', pages);
      const response = await fetch('http://localhost:3002/api/facebook-pages/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pages),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Facebook pages synced successfully:', result);
        return result;
      } else {
        console.error('Failed to sync Facebook pages:', response.statusText);
      }
    } catch (error) {
      console.error('Error syncing Facebook pages:', error);
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
        
        // Use individual caption and comment for each post if available
        const individualCaption = postCaptions[i] || postContent || '';
        const individualComment = postComments[i] || firstComment || '';
        
        const postData = await postsAPI.createScheduledPost({
          title: postType === 'image' ? 'Image' : 'Reel',
          content: individualCaption,
          postType,
          mediaUrls: [mediaUrl], // Single media URL per post
          carouselImages: [],
          pageId: selectedPageId,
          pageName: selectedPage?.name || '',
          scheduledFor: scheduledTime.toISOString(),
          intervalMinutes: null, // No interval for one-time posts
          isRecurring: false, // One-time posts only
          firstComment: individualComment,
          postFirstComment: postFirstComment || !!individualComment
        });
        
        createdPosts.push(postData);
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
      await postsAPI.deleteScheduledPost(postId);
      showToast('Post deleted successfully!', 'success');
      loadScheduledPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      showToast('Failed to delete post', 'error');
    }
  };

  // Update a scheduled post's interval
  const updateScheduledPost = async (postId: string, newIntervalMinutes: number) => {
    try {
      await postsAPI.updateScheduledPost(postId, {
        intervalMinutes: newIntervalMinutes
      });
      showToast('Post interval updated successfully!', 'success');
      setEditingPostId(null);
      loadScheduledPosts();
    } catch (error) {
      console.error('Error updating post:', error);
      showToast('Failed to update post', 'error');
    }
  };

  // Start editing a post
  const startEditingPost = (postId: string, currentInterval: number) => {
    setEditingPostId(postId);
    setEditIntervalMinutes(currentInterval || 10);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingPostId(null);
    setEditIntervalMinutes(10);
  };

  // Stop automation for all or specific page
  const stopAutomation = async (pageId: string = 'all') => {
    try {
      const result = await postsAPI.stopAutomation(pageId);
      showToast(result.message, 'success');
      loadScheduledPosts();
    } catch (error) {
      console.error('Error stopping automation:', error);
      showToast('Failed to stop automation', 'error');
    }
  };

  // Delete all scheduled posts for all or specific page
  const deleteAllScheduledPosts = async (pageId: string = 'all') => {
    if (!confirm(`Are you sure you want to delete all scheduled posts${pageId !== 'all' ? ' for this page' : ''}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const result = await postsAPI.deleteAllScheduledPosts(pageId);
      showToast(result.message, 'success');
      loadScheduledPosts();
    } catch (error) {
      console.error('Error deleting posts:', error);
      showToast('Failed to delete posts', 'error');
    }
  };

  const postTypes = [
    { value: 'text', label: 'Text', icon: '📝' },
    { value: 'image', label: 'Image', icon: '🖼️' },
    { value: 'video', label: 'Video', icon: '📹' },
    { value: 'reel', label: 'Reel', icon: '🎥' },
    { value: 'carousel', label: 'Carousel', icon: '🎠' },
    
  ];

  useEffect(() => {
    // Load data from database
    const loadData = async () => {
      try {
        // Load Facebook pages from database
        const pages = await facebookPagesAPI.getUserPages();
        setFacebookPages(pages);
        
        // Load selected page from database
        try {
          const selectedPage = await facebookPagesAPI.getSelectedPage();
          if (selectedPage && pages.find((p: FacebookPage) => p.id === selectedPage.id)) {
            setSelectedPageId(selectedPage.id);
          } else if (pages.length > 0) {
            setSelectedPageId(pages[0].id);
            // Set first page as selected if none is selected
            await facebookPagesAPI.setSelectedPage(pages[0].id);
          }
        } catch (error) {
          // If no selected page, default to first page
          if (pages.length > 0) {
            setSelectedPageId(pages[0].id);
            await facebookPagesAPI.setSelectedPage(pages[0].id);
          }
        }
        
        // Load Cloudinary config from database
        const settings = await userSettingsAPI.getSettings();
        if (settings.cloudinaryCloudName && settings.cloudinaryApiKey && settings.cloudinaryApiSecret) {
          setCloudinaryConfig({
            cloudName: settings.cloudinaryCloudName,
            apiKey: settings.cloudinaryApiKey,
            apiSecret: settings.cloudinaryApiSecret
          });
        }
      } catch (error) {
        console.error('Error loading data from database:', error);
        
        // Fallback to localStorage for backward compatibility
        const savedPages = localStorage.getItem('facebook_pages');
        if (savedPages) {
          const pages = JSON.parse(savedPages);
          setFacebookPages(pages);
          
          // Sync pages with backend
          syncFacebookPages(pages);
          
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
      }
    };
    
    loadData();
    
    // Load scheduled posts
    loadScheduledPosts();
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

  // Removed unused carousel functions: addCarouselImage, removeCarouselImage, updateCarouselImage

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

  // Removed unused generateAutoCaption function

  const generateManualCaption = async () => {
    if (!mediaUrl) {
      showToast('Please upload media first to generate a caption.', 'error');
      return;
    }
    
    setIsGeneratingCaption(true);
    
    try {
      const apiKey = await getGeminiApiKey();
      
      if (!apiKey) {
        showToast('Please set your Gemini API key in Settings first.', 'error');
        setIsGeneratingCaption(false);
        return;
      }
      
      const mediaType = postType === 'video' || postType === 'reel' ? 'video' : 'image';
      
      const response = await fetch('/api/auto-caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          mediaUrl,
          mediaType
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate caption');
      }
      
      const data = await response.json();
      setPostContent(data.caption);
      showToast('Caption generated successfully! 🤖', 'success');
    } catch (error) {
      console.error('Error generating manual caption:', error);
      showToast(`Failed to generate caption: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
       setIsGeneratingCaption(false);
     }
   };

  const generateManualComment = async () => {
    if (!mediaUrl) {
      showToast('Please upload media first before generating a comment.', 'error');
      return;
    }
    
    setIsGeneratingComment(true);
    
    try {
      const apiKey = await getGeminiApiKey();
      
      if (!apiKey) {
        showToast('Please set your Gemini API key in Settings first.', 'error');
        setIsGeneratingComment(false);
        return;
      }
      
      const mediaType = postType === 'video' || postType === 'reel' ? 'video' : 'image';
      
      const response = await fetch('/api/auto-caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          mediaUrl,
          mediaType,
          isComment: true
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate comment');
      }
      
      const data = await response.json();
      setFirstComment(data.caption);
      showToast('Comment generated successfully! 🤖', 'success');
    } catch (error) {
      console.error('Error generating manual comment:', error);
      showToast(`Failed to generate comment: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsGeneratingComment(false);
    }
  };

  // Removed unused generateAutoComment function

  // Automation generation functions
  const generateBulkCaptions = async () => {
    if (!automationTopic || multipleFiles.length === 0) return;
    
    setIsGeneratingAutomationCaptions(true);
    
    try {
      const apiKey = await getGeminiApiKey();
      
      if (!apiKey) {
        showToast('Please set your Gemini API key in Settings first.', 'error');
        setIsGeneratingAutomationCaptions(false);
        return;
      }
      
      const newCaptions: {[key: number]: string} = {};
      
      // Generate captions for each file by analyzing the actual image
      for (let i = 0; i < multipleFiles.length; i++) {
        const file = multipleFiles[i];
        const mediaType = file.file.type.startsWith('video/') ? 'video' : 'image';
        
        const response = await fetch('/api/auto-caption', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey,
            mediaUrl: file.url,
            mediaType,
            isComment: false
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate caption');
        }
        
        const data = await response.json();
        if (data.caption) {
          newCaptions[i] = data.caption;
        }
      }
      
      setPostCaptions(newCaptions);
      showToast(`Generated ${Object.keys(newCaptions).length} unique captions successfully! 🤖`, 'success');
    } catch (error) {
      console.error('Error generating bulk captions:', error);
      showToast(`Failed to generate captions: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsGeneratingAutomationCaptions(false);
    }
  };

  const generateBulkComments = async () => {
    if (!automationTopic || multipleFiles.length === 0) return;
    
    setIsGeneratingAutomationComments(true);
    
    try {
      const apiKey = await getGeminiApiKey();
      
      if (!apiKey) {
        showToast('Please set your Gemini API key in Settings first.', 'error');
        setIsGeneratingAutomationComments(false);
        return;
      }
      
      const newComments: {[key: number]: string} = {};
      
      // Generate comments for each file by analyzing the actual image
      for (let i = 0; i < multipleFiles.length; i++) {
        const file = multipleFiles[i];
        const mediaType = file.file.type.startsWith('video/') ? 'video' : 'image';
        
        const response = await fetch('/api/auto-caption', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey,
            mediaUrl: file.url,
            mediaType,
            isComment: true
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate comment');
        }
        
        const data = await response.json();
        if (data.caption) {
          newComments[i] = data.caption;
        }
      }
      
      setPostComments(newComments);
      showToast(`Generated ${Object.keys(newComments).length} unique comments successfully! 🤖`, 'success');
    } catch (error) {
      console.error('Error generating bulk comments:', error);
      showToast(`Failed to generate comments: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsGeneratingAutomationComments(false);
    }
  };

  const generateIndividualCaption = async (index: number) => {
    if (!automationTopic) return;
    
    try {
      const apiKey = await getGeminiApiKey();
      
      if (!apiKey) {
        showToast('Please set your Gemini API key in Settings first.', 'error');
        return;
      }
      
      const file = multipleFiles[index];
      const mediaType = file.file.type.startsWith('video/') ? 'video' : 'image';
      
      const response = await fetch('/api/auto-caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          mediaUrl: file.url,
          mediaType,
          isComment: false
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate caption');
      }
      
      const data = await response.json();
      if (data.caption) {
        setPostCaptions(prev => ({
          ...prev,
          [index]: data.caption
        }));
        showToast('Unique caption generated successfully! 🤖', 'success');
      }
    } catch (error) {
      console.error('Error generating individual caption:', error);
      showToast(`Failed to generate caption: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const generateIndividualComment = async (index: number) => {
    if (!automationTopic) return;
    
    try {
      const apiKey = await getGeminiApiKey();
      
      if (!apiKey) {
        showToast('Please set your Gemini API key in Settings first.', 'error');
        return;
      }
      
      const file = multipleFiles[index];
      const mediaType = file.file.type.startsWith('video/') ? 'video' : 'image';
      
      const response = await fetch('/api/auto-caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          mediaUrl: file.url,
          mediaType,
          isComment: true
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate comment');
      }
      
      const data = await response.json();
      if (data.caption) {
        setPostComments(prev => ({
          ...prev,
          [index]: data.caption
        }));
        showToast('Unique comment generated successfully! 🤖', 'success');
      }
    } catch (error) {
      console.error('Error generating individual comment:', error);
      showToast(`Failed to generate comment: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
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

      const apiEndpoint = postType === 'reel' ? '/api/facebook-reel' : '/api/facebook-post';
      const response = await fetch(apiEndpoint, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'x-facebook-pages': JSON.stringify(facebookPages)
         },
         body: JSON.stringify({
           pageId: selectedPageId,
           postType: postType === 'reel' ? undefined : postType, // Reel endpoint doesn't need postType
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
      
      // Save the posted post to database
      try {
        const selectedPage = facebookPages.find(page => page.id === selectedPageId);
        if (selectedPage) {
          await fetch('http://localhost:3002/api/posts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: postContent.substring(0, 50) + (postContent.length > 50 ? '...' : '') || `${postType} post`,
              content: postContent,
              postType: postType,
              mediaUrls: postType === 'carousel' ? carouselImages.filter(url => url.trim()) : (mediaUrl ? [mediaUrl] : []),
              carouselImages: postType === 'carousel' ? carouselImages.filter(url => url.trim()) : [],
              pageId: selectedPageId,
              pageName: selectedPage.name,
              scheduledFor: new Date().toISOString(), // Current time since it's already posted
              status: 'posted',
              facebookPostId: data.postId,
              postedAt: new Date().toISOString(),
              firstComment: postFirstComment ? firstComment : null,
              postFirstComment: postFirstComment
            })
          });
          
          // Reload scheduled posts to show the new posted post
          loadScheduledPosts();
        }
      } catch (dbError) {
        console.error('Error saving post to database:', dbError);
        // Don't fail the whole operation if database save fails
      }
      
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
                          <span className="text-gray-500">Select a Facebook page</span>
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
                          backgroundColor: '#3b82f6',
                          width: '20%',
                          left: postType === 'text' ? '0%' : 
                                postType === 'image' ? '20%' : 
                                postType === 'video' ? '40%' : 
                                postType === 'reel' ? '60%' : 
                                postType === 'carousel' ? '80%' : '0%'
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center justify-between w-full">
                      <label className="block text-sm font-medium text-gray-700">
                        Caption {postType === 'text' ? '*' : '(Optional)'}
                      </label>
                      {(postType === 'image' || postType === 'video' || postType === 'reel') && mediaUrl && (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={generateManualCaption}
                            disabled={isGeneratingCaption}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-[var(--primary-highlight)] hover:bg-[var(--primary-highlight)]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary-highlight)] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isGeneratingCaption ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating...
                              </>
                            ) : (
                              <>
                                🤖 Generate Caption
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={generateManualComment}
                            disabled={isGeneratingComment}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isGeneratingComment ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating...
                              </>
                            ) : (
                              <>
                                💬 Generate Comment
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Enter your caption here..."
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
                  />

                </div>

                {/* Media Upload for single media posts */}
                {(postType === 'image' || postType === 'video' || postType === 'reel') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {postType === 'image' ? 'Upload Image *' : postType === 'video' ? 'Upload Video *' : postType === 'reel' ? 'Upload Reel *' : 'Upload Media *'}
                    </label>
                    
                    {!mediaUrl ? (
                      <div>
                        <input
                          type="file"
                          accept={postType === 'image' ? 'image/*' : (postType === 'video' || postType === 'reel') ? 'video/*' : '*/*'}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Validate reel specifications
                              if (postType === 'reel') {
                                const validationError = await validateReelFile(file);
                                if (validationError) {
                                  alert(validationError);
                                  return;
                                }
                              }
                              
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
                          {isUploading ? 'Uploading...' : `Choose ${postType === 'image' ? 'Image' : postType === 'video' ? 'Video' : postType === 'reel' ? 'Reel' : 'Media'}`}
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-sm text-green-700 mb-3">✓ {postType === 'image' ? 'Image' : postType === 'video' ? 'Video' : postType === 'reel' ? 'Reel' : 'Media'} uploaded successfully</p>
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

                {/* Post Type Selection - Image, Video, and Reel for automation */}
                <div>
                  <label className="text-base font-medium text-gray-900">Post Type</label>
                  <div className="mt-4">
                    <div className="relative inline-flex bg-gray-100 rounded-lg p-1 w-full max-w-md">
                      <div
                        className={`absolute top-1 bottom-1 rounded-md transition-transform duration-200 ease-in-out`}
                        style={{ 
                          backgroundColor: '#3b82f6',
                          width: '33.33%',
                          left: postType === 'image' ? '0%' : postType === 'video' ? '33.33%' : '66.66%'
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
                        Video
                      </button>
                      <button
                        onClick={() => setPostType('reel')}
                        className={`relative z-10 flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
                          postType === 'reel'
                            ? 'text-black'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Reel
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Generation Options */}
                {(postType === 'image' || postType === 'reel') && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-700">AI Caption & Comment Generation</h3>
                    
                    {/* Topic Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Topic
                      </label>
                      <select
                        value={automationTopic}
                        onChange={(e) => setAutomationTopic(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
                      >
                        <option value="">Select a topic...</option>
                        <option value="Jobs">Jobs</option>
                        <option value="Princess leonar">Princess leonar</option>
                        <option value="USA girl">USA girl</option>
                        <option value="sheikha mahira">sheikha mahira</option>
                      </select>
                    </div>

                    {/* Platform Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Platform
                      </label>
                      <select
                        value={automationPlatform}
                        onChange={(e) => setAutomationPlatform(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
                      >
                        <option value="facebook">Facebook</option>
                        <option value="threads">Threads</option>
                      </select>
                    </div>

                    {/* Link Option */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Link (Optional)
                      </label>
                      <input
                        type="url"
                        value={automationLink}
                        onChange={(e) => setAutomationLink(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
                      />
                    </div>

                    {/* Generation Buttons */}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={generateBulkCaptions}
                        disabled={isGeneratingAutomationCaptions || !automationTopic || multipleFiles.length === 0}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isGeneratingAutomationCaptions ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>🤖 Generate Captions</>
                        )}
                      </button>
                      
                      <button
                        type="button"
                        onClick={generateBulkComments}
                        disabled={isGeneratingAutomationComments || !automationTopic || multipleFiles.length === 0}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isGeneratingAutomationComments ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>💬 Generate Comments</>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Post Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Caption (Optional)
                  </label>
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Enter your caption here..."
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] resize-none"
                  />

                </div>

                {/* File Upload for Image/Video */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload {postType === 'image' ? 'Images' : 'Reels'} for Automation *
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
                             
                             // Validate reel files if post type is reel
                             if (postType === 'reel') {
                               for (const file of files) {
                                 const validationError = await validateReelFile(file);
                                 if (validationError) {
                                   alert(`File "${file.name}": ${validationError}`);
                                   return;
                                 }
                               }
                             }
                             
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
                        {isUploading ? 'Uploading...' : `Choose ${postType === 'image' ? 'Images' : 'Reels'}`}
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
                  
                  {/* Individual Post Caption & Comment Editor */}
                  {multipleFiles.length > 0 && (
                    <div className="mt-4 space-y-4">
                      <h4 className="text-sm font-medium text-gray-700">Edit Captions & Comments for Each Post</h4>
                      {multipleFiles.map((uploadedFile, index) => (
                        <div key={index} className="p-4 border border-gray-200 rounded-lg bg-white">
                          <div className="flex gap-4">
                            {/* File Preview */}
                            <div className="flex-shrink-0">
                              <div className="w-20 h-20 bg-gray-100 rounded-md border flex items-center justify-center">
                                {postType === 'image' ? (
                                  <img
                                    src={uploadedFile.url}
                                    alt={`Post ${index + 1}`}
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
                              <p className="text-xs text-gray-500 mt-1 text-center">Post {index + 1}</p>
                            </div>
                            
                            {/* Caption & Comment Fields */}
                            <div className="flex-1 space-y-3">
                              {/* Caption Field */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Caption
                                </label>
                                <textarea
                                  value={postCaptions[index] || ''}
                                  onChange={(e) => setPostCaptions(prev => ({...prev, [index]: e.target.value}))}
                                  placeholder="Enter caption for this post..."
                                  rows={3}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] resize-none"
                                />
                              </div>
                              
                              {/* Comment Field */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  First Comment
                                </label>
                                <textarea
                                  value={postComments[index] || ''}
                                  onChange={(e) => setPostComments(prev => ({...prev, [index]: e.target.value}))}
                                  placeholder="Enter first comment for this post..."
                                  rows={2}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] resize-none"
                                />
                              </div>
                              
                              {/* Individual Generation Buttons */}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => generateIndividualCaption(index)}
                                  disabled={!automationTopic}
                                  className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  🤖 Generate Caption
                                </button>
                                <button
                                  type="button"
                                  onClick={() => generateIndividualComment(index)}
                                  disabled={!automationTopic}
                                  className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-md hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  💬 Generate Comment
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
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
                    <div className="space-y-3">
                      {/* AI Generate Comment Button */}
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">
                          First Comment
                        </label>
                        <button
                          type="button"
                          onClick={generateManualComment}
                          disabled={isGeneratingComment}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-[var(--primary-highlight)] hover:bg-[var(--primary-highlight)]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary-highlight)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeneratingComment ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating...
                            </>
                          ) : (
                            <>
                              🤖 Generate Comment
                            </>
                          )}
                        </button>
                      </div>
                      
                      <textarea
                        value={firstComment}
                        onChange={(e) => setFirstComment(e.target.value)}
                        placeholder="Enter your first comment here..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)] resize-none"
                      />

                    </div>
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
              
              {/* Bulk Actions */}
              <div className="flex items-center justify-between mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <h4 className="text-sm font-medium text-gray-700">Bulk Actions:</h4>
                  <button
                    onClick={() => stopAutomation(filterPageId)}
                    className="px-3 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 text-sm font-medium transition-colors"
                  >
                    {filterPageId === 'all' ? 'Stop All Automation' : 'Stop Page Automation'}
                  </button>
                  <button
                    onClick={() => deleteAllScheduledPosts(filterPageId)}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm font-medium transition-colors"
                  >
                    {filterPageId === 'all' ? 'Delete All Posts' : 'Delete Page Posts'}
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  {filterPageId === 'all' ? 'Actions apply to all pages' : `Actions apply to selected page only`}
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
                        Published At
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Interval (min)
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
                         : scheduledPosts.filter(post => post.pageId === filterPageId);
                      
                      return filteredPosts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                            {filterPageId === 'all' ? 'No scheduled posts yet' : 'No posts found for selected page'}
                          </td>
                        </tr>
                      ) : (
                        filteredPosts.map(post => {
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
                          <td className="px-4 py-4 text-sm text-gray-900">
                            {post.postedAt ? new Date(post.postedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '-'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            {editingPostId === post.id ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  value={editIntervalMinutes}
                                  onChange={(e) => setEditIntervalMinutes(Number(e.target.value))}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  min="1"
                                />
                                <button
                                  onClick={() => updateScheduledPost(post.id, editIntervalMinutes)}
                                  className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <span>{post.intervalMinutes || '-'}</span>
                            )}
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
                                  onClick={() => startEditingPost(post.id, post.intervalMinutes || 10)}
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